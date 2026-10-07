import "server-only";

import {
  isArticleCompositionLayoutKey,
  isArticleCompositionSlot,
  isArticleCompositionStatus,
  type ArticleCompositionSettings,
  type ProjectArticleComposition,
  type ProjectArticleCompositionAsset,
} from "@/lib/article-composition";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";

type ArticleCompositionRow = {
  article_id: string;
  created_at: string;
  id: string;
  layout_key: string;
  project_id: string;
  settings: unknown;
  status: string;
  updated_at: string;
};

type ArticleCompositionAssetRow = {
  asset_id: string;
  composition_id: string;
  created_at: string;
  id: string;
  is_visible: boolean;
  settings: unknown;
  slot: string;
  sort_order: number;
  updated_at: string;
};

export type ArticleCompositionRepositoryStatus =
  | "ok"
  | "invalid_input"
  | "not_configured"
  | "migration_required"
  | "not_found"
  | "request_failed";

export type ArticleCompositionRepositoryResult<T> = {
  data: T;
  message: string;
  status: ArticleCompositionRepositoryStatus;
};

function getServiceRoleHeaders() {
  const config = getSupabaseConfigStatus();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!config.isConfigured || !config.hasServiceRoleKey || !key) return null;

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function isMigrationRequired(status: number, body: string) {
  return status === 404 || body.includes("PGRST205") || body.includes("42P01") || body.includes("Could not find the table");
}

function readSettings(value: unknown): ArticleCompositionSettings | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ArticleCompositionSettings)
    : null;
}

function mapPlacement(row: ArticleCompositionAssetRow): ProjectArticleCompositionAsset | null {
  const settings = readSettings(row.settings);

  if (!isArticleCompositionSlot(row.slot) || !settings) return null;

  return {
    assetId: row.asset_id,
    compositionId: row.composition_id,
    createdAt: row.created_at,
    id: row.id,
    isVisible: row.is_visible,
    settings,
    slot: row.slot,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

function mapComposition(
  row: ArticleCompositionRow,
  assets: ProjectArticleCompositionAsset[],
): ProjectArticleComposition | null {
  const settings = readSettings(row.settings);

  if (!isArticleCompositionLayoutKey(row.layout_key) || !isArticleCompositionStatus(row.status) || !settings) {
    return null;
  }

  return {
    articleId: row.article_id,
    assets,
    createdAt: row.created_at,
    id: row.id,
    layoutKey: row.layout_key,
    projectId: row.project_id,
    settings,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function getProjectArticleComposition(
  projectId: string,
  articleId: string,
): Promise<ArticleCompositionRepositoryResult<ProjectArticleComposition | null>> {
  const normalizedProjectId = projectId.trim();
  const normalizedArticleId = articleId.trim();

  if (!normalizedProjectId || !normalizedArticleId) {
    return { data: null, message: "프로젝트와 기사 식별자가 필요합니다.", status: "invalid_input" };
  }

  const headers = getServiceRoleHeaders();
  const compositionEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_article_compositions?select=id,project_id,article_id,layout_key,status,settings,created_at,updated_at&project_id=eq.${encodeURIComponent(
      normalizedProjectId,
    )}&article_id=eq.${encodeURIComponent(normalizedArticleId)}&limit=1`,
  );

  if (!headers || !compositionEndpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const compositionResponse = await fetch(compositionEndpoint, { headers, cache: "no-store" });

    if (!compositionResponse.ok) {
      const body = await compositionResponse.text();
      console.error("Article composition lookup failed", compositionResponse.status, body);
      return isMigrationRequired(compositionResponse.status, body)
        ? { data: null, message: "기사 Composition을 위한 v1.25 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: null, message: "기사 Composition을 불러오지 못했습니다.", status: "request_failed" };
    }

    const compositionRows = (await compositionResponse.json().catch(() => [])) as ArticleCompositionRow[];
    const compositionRow = compositionRows[0];

    if (!compositionRow) {
      return { data: null, message: "저장된 기사 Composition이 없습니다.", status: "not_found" };
    }

    const placementEndpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_article_composition_assets?select=id,composition_id,asset_id,slot,sort_order,is_visible,settings,created_at,updated_at&composition_id=eq.${encodeURIComponent(
        compositionRow.id,
      )}&order=slot.asc,sort_order.asc,created_at.asc`,
    );

    if (!placementEndpoint) {
      return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
    }

    const placementResponse = await fetch(placementEndpoint, { headers, cache: "no-store" });

    if (!placementResponse.ok) {
      const body = await placementResponse.text();
      console.error("Article composition placement lookup failed", placementResponse.status, body);
      return isMigrationRequired(placementResponse.status, body)
        ? { data: null, message: "기사 Composition을 위한 v1.25 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: null, message: "기사 Composition 자산을 불러오지 못했습니다.", status: "request_failed" };
    }

    const placementRows = (await placementResponse.json().catch(() => [])) as ArticleCompositionAssetRow[];
    const assets = placementRows.flatMap((row) => {
      const asset = mapPlacement(row);
      return asset ? [asset] : [];
    });

    if (assets.length !== placementRows.length) {
      return { data: null, message: "저장된 기사 Composition 자산 형식을 확인하지 못했습니다.", status: "request_failed" };
    }

    const composition = mapComposition(compositionRow, assets);
    return composition
      ? { data: composition, message: "기사 Composition을 불러왔습니다.", status: "ok" }
      : { data: null, message: "저장된 기사 Composition 형식을 확인하지 못했습니다.", status: "request_failed" };
  } catch (error) {
    console.error("Article composition lookup request failed", error);
    return { data: null, message: "기사 Composition 조회 중 오류가 발생했습니다.", status: "request_failed" };
  }
}
