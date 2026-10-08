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
  | "conflict"
  | "request_failed";

export type ArticleCompositionRepositoryResult<T> = {
  data: T;
  message: string;
  status: ArticleCompositionRepositoryStatus;
};

export type ProjectArticleCompositionSource = {
  articleId: string;
  status: "draft" | "ready";
  updatedAt: string;
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
  return status === 404
    || body.includes("PGRST202")
    || body.includes("PGRST205")
    || body.includes("42P01")
    || body.includes("Could not find the table");
}

function isConflict(status: number, body: string) {
  return status === 409 || body.includes("23505");
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

export async function getProjectArticleCompositionSources(
  projectId: string,
): Promise<ArticleCompositionRepositoryResult<ProjectArticleCompositionSource[]>> {
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    return { data: [], message: "프로젝트 식별자가 필요합니다.", status: "invalid_input" };
  }

  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_article_compositions?select=article_id,status,updated_at&project_id=eq.${encodeURIComponent(
      normalizedProjectId,
    )}&order=updated_at.desc`,
  );

  if (!headers || !endpoint) {
    return { data: [], message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, { headers, cache: "no-store" });

    if (!response.ok) {
      const body = await response.text();
      console.error("Article composition source lookup failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: [], message: "기사 Composition을 위한 v1.25 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: [], message: "재사용할 기사 디자인 목록을 불러오지 못했습니다.", status: "request_failed" };
    }

    const rows = (await response.json().catch(() => [])) as Array<{
      article_id: string;
      status: string;
      updated_at: string;
    }>;
    const sources = rows.flatMap((row) => {
      if (!row.article_id || !isArticleCompositionStatus(row.status)) return [];
      return [{ articleId: row.article_id, status: row.status, updatedAt: row.updated_at }];
    });

    return sources.length === rows.length
      ? { data: sources, message: "재사용할 기사 디자인 목록을 불러왔습니다.", status: "ok" }
      : { data: [], message: "기사 디자인 목록 형식을 확인하지 못했습니다.", status: "request_failed" };
  } catch (error) {
    console.error("Article composition source lookup request failed", error);
    return { data: [], message: "기사 디자인 목록 조회 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function createProjectArticleComposition(
  projectId: string,
  articleId: string,
): Promise<ArticleCompositionRepositoryResult<ProjectArticleComposition | null>> {
  const existing = await getProjectArticleComposition(projectId, articleId);

  if (existing.status === "ok") return existing;
  if (existing.status !== "not_found") return existing;

  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_article_compositions?select=id");

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        project_id: projectId,
        article_id: articleId,
        layout_key: "standard",
        status: "draft",
        settings: {},
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      if (isConflict(response.status, body)) return getProjectArticleComposition(projectId, articleId);
      console.error("Article composition create failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: null, message: "기사 Composition을 위한 v1.25 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: null, message: "기사 화면 구성을 만들지 못했습니다.", status: "request_failed" };
    }

    return getProjectArticleComposition(projectId, articleId);
  } catch (error) {
    console.error("Article composition create request failed", error);
    return { data: null, message: "기사 화면 구성 생성 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function copyProjectArticleComposition(input: {
  projectId: string;
  sourceArticleId: string;
  targetArticleId: string;
}): Promise<ArticleCompositionRepositoryResult<ProjectArticleComposition | null>> {
  const projectId = input.projectId.trim();
  const sourceArticleId = input.sourceArticleId.trim();
  const targetArticleId = input.targetArticleId.trim();

  if (!projectId || !sourceArticleId || !targetArticleId || sourceArticleId === targetArticleId) {
    return { data: null, message: "원본 기사와 적용할 기사를 확인해 주세요.", status: "invalid_input" };
  }

  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint("/rest/v1/rpc/copy_newsletter_article_composition_atomic");

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_project_id: projectId,
        p_source_article_id: sourceArticleId,
        p_target_article_id: targetArticleId,
      }),
      cache: "no-store",
    });
    const body = await response.text();

    if (!response.ok) {
      if (isMigrationRequired(response.status, body)) {
        return {
          data: null,
          message: "기사 디자인 재사용을 위한 v1.27 migration 적용이 필요합니다.",
          status: "migration_required",
        };
      }
      if (body.includes("composition_copy_same_article") || body.includes("composition_copy_identifiers_required")) {
        return { data: null, message: "원본 기사와 적용할 기사를 다르게 선택해 주세요.", status: "invalid_input" };
      }
      if (body.includes("composition_copy_article_not_found") || body.includes("composition_copy_source_not_found")) {
        return { data: null, message: "복사할 기사 디자인을 찾지 못했습니다.", status: "not_found" };
      }
      if (body.includes("composition_copy_project_mismatch")) {
        return { data: null, message: "같은 프로젝트의 기사 디자인만 재사용할 수 있습니다.", status: "conflict" };
      }

      console.error("Article composition copy failed", response.status, body);
      return { data: null, message: "기사 디자인을 복사하지 못했습니다.", status: "request_failed" };
    }

    const composition = await getProjectArticleComposition(projectId, targetArticleId);
    return composition.status === "ok"
      ? { ...composition, message: "기사 디자인 배치를 복사했습니다." }
      : composition;
  } catch (error) {
    console.error("Article composition copy request failed", error);
    return { data: null, message: "기사 디자인 복사 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function updateProjectArticleCompositionStatus(
  projectId: string,
  articleId: string,
  status: "draft" | "ready",
): Promise<ArticleCompositionRepositoryResult<ProjectArticleComposition | null>> {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_article_compositions?project_id=eq.${encodeURIComponent(projectId)}&article_id=eq.${encodeURIComponent(
      articleId,
    )}`,
  );

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ status }),
      cache: "no-store",
    });
    const body = await response.text();

    if (!response.ok) {
      console.error("Article composition status update failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: null, message: "기사 Composition을 위한 v1.25 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: null, message: "기사 화면 구성 상태를 변경하지 못했습니다.", status: "request_failed" };
    }

    const rows = body ? (JSON.parse(body) as ArticleCompositionRow[]) : [];
    if (!rows[0]) return { data: null, message: "변경할 기사 화면 구성을 찾지 못했습니다.", status: "not_found" };

    return getProjectArticleComposition(projectId, articleId);
  } catch (error) {
    console.error("Article composition status update request failed", error);
    return { data: null, message: "기사 화면 구성 상태 변경 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export type SaveProjectArticleCompositionPlacementInput = {
  articleId: string;
  assetId: string;
  compositionId: string;
  isVisible: boolean;
  placementId?: string;
  projectId: string;
  settings: ArticleCompositionSettings;
  slot: string;
  sortOrder: number;
};

export async function saveProjectArticleCompositionPlacement(
  input: SaveProjectArticleCompositionPlacementInput,
): Promise<ArticleCompositionRepositoryResult<ProjectArticleComposition | null>> {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(
    input.placementId
      ? `/rest/v1/newsletter_article_composition_assets?id=eq.${encodeURIComponent(
          input.placementId,
        )}&composition_id=eq.${encodeURIComponent(input.compositionId)}`
      : "/rest/v1/newsletter_article_composition_assets",
  );

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: input.placementId ? "PATCH" : "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({
        ...(input.placementId ? {} : { composition_id: input.compositionId }),
        asset_id: input.assetId,
        slot: input.slot,
        sort_order: input.sortOrder,
        is_visible: input.isVisible,
        settings: input.settings,
      }),
      cache: "no-store",
    });
    const body = await response.text();

    if (!response.ok) {
      console.error("Article composition placement save failed", response.status, body);
      if (isMigrationRequired(response.status, body)) {
        return { data: null, message: "기사 Composition을 위한 v1.25 migration 적용이 필요합니다.", status: "migration_required" };
      }
      if (isConflict(response.status, body)) {
        return { data: null, message: "같은 위치와 순서를 사용하는 자산이 이미 있습니다.", status: "conflict" };
      }
      return { data: null, message: "기사 화면 구성 자산을 저장하지 못했습니다.", status: "request_failed" };
    }

    const rows = body ? (JSON.parse(body) as ArticleCompositionAssetRow[]) : [];
    if (!rows[0]) return { data: null, message: "변경할 구성 자산을 찾지 못했습니다.", status: "not_found" };

    return getProjectArticleComposition(input.projectId, input.articleId);
  } catch (error) {
    console.error("Article composition placement save request failed", error);
    return { data: null, message: "기사 화면 구성 자산 저장 중 오류가 발생했습니다.", status: "request_failed" };
  }
}

export async function deleteProjectArticleCompositionPlacement(input: {
  articleId: string;
  compositionId: string;
  placementId: string;
  projectId: string;
}): Promise<ArticleCompositionRepositoryResult<ProjectArticleComposition | null>> {
  const headers = getServiceRoleHeaders();
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_article_composition_assets?id=eq.${encodeURIComponent(
      input.placementId,
    )}&composition_id=eq.${encodeURIComponent(input.compositionId)}`,
  );

  if (!headers || !endpoint) {
    return { data: null, message: "Supabase 서버 설정을 확인해 주세요.", status: "not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { ...headers, Prefer: "return=representation" },
      cache: "no-store",
    });
    const body = await response.text();

    if (!response.ok) {
      console.error("Article composition placement delete failed", response.status, body);
      return isMigrationRequired(response.status, body)
        ? { data: null, message: "기사 Composition을 위한 v1.25 migration 적용이 필요합니다.", status: "migration_required" }
        : { data: null, message: "기사 화면 구성 자산을 제거하지 못했습니다.", status: "request_failed" };
    }

    const rows = body ? (JSON.parse(body) as ArticleCompositionAssetRow[]) : [];
    if (!rows[0]) return { data: null, message: "제거할 구성 자산을 찾지 못했습니다.", status: "not_found" };

    return getProjectArticleComposition(input.projectId, input.articleId);
  } catch (error) {
    console.error("Article composition placement delete request failed", error);
    return { data: null, message: "기사 화면 구성 자산 제거 중 오류가 발생했습니다.", status: "request_failed" };
  }
}
