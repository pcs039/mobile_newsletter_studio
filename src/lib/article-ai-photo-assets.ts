import "server-only";

import type { ArticleAiPhotoAssetInput } from "@/lib/article-ai-draft-types";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

const assetBucket = "mobile-assets";
const maxPhotoCount = 3;
const maxTotalPhotoBytes = 20 * 1024 * 1024;
const supportedPhotoMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProjectRow = { id: string; slug: string };
type AssetRow = { file_path: string; mime_type: string; title: string };

export type VerifiedArticleAiPhoto = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  sourceId: string;
  storagePath: string;
};

export type LoadArticleAiPhotosResult =
  | { ok: true; photos: VerifiedArticleAiPhoto[] }
  | { error: string; message: string; ok: false; status: number };

function getServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) return null;

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isSafeStoragePath(path: string) {
  return Boolean(path) && !path.startsWith("/") && !path.endsWith("/") && !path.includes("..");
}

function cleanFileName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

function normalizePhotoInputs(value: unknown): ArticleAiPhotoAssetInput[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxPhotoCount) return null;

  const photos: ArticleAiPhotoAssetInput[] = [];
  const sourceIds = new Set<string>();
  const storagePaths = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;

    const input = item as Record<string, unknown>;
    const sourceId = typeof input.sourceId === "string" ? input.sourceId.trim().slice(0, 80) : "";
    const storagePath = typeof input.storagePath === "string" ? input.storagePath.trim() : "";
    const fileName = typeof input.fileName === "string" ? input.fileName.trim().slice(0, 180) : "";
    const mimeType = typeof input.mimeType === "string" ? input.mimeType.trim().toLowerCase() : "";

    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(sourceId) ||
      !storagePath ||
      !fileName ||
      !supportedPhotoMimeTypes.has(mimeType) ||
      !isSafeStoragePath(storagePath) ||
      sourceIds.has(sourceId) ||
      storagePaths.has(storagePath)
    ) {
      return null;
    }

    sourceIds.add(sourceId);
    storagePaths.add(storagePath);
    photos.push({ sourceId, storagePath, fileName, mimeType });
  }

  return photos;
}

async function findProject(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,slug&slug=eq.${encodeURIComponent(projectSlug)}&deleted_at=is.null&limit=1`,
  );

  if (!endpoint) return null;

  const response = await fetch(endpoint, { headers, cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;

  const rows = (await response.json().catch(() => [])) as ProjectRow[];
  return rows[0] ?? null;
}

async function findProjectAsset(projectId: string, storagePath: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_assets?select=file_path,mime_type,title&project_id=eq.${encodeURIComponent(
      projectId,
    )}&file_path=eq.${encodeURIComponent(storagePath)}&limit=1`,
  );

  if (!endpoint) return null;

  const response = await fetch(endpoint, { headers, cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;

  const rows = (await response.json().catch(() => [])) as AssetRow[];
  return rows[0] ?? null;
}

export async function loadArticleAiPhotoAssets({
  photoAssets,
  projectSlug,
}: {
  photoAssets: unknown;
  projectSlug: string;
}): Promise<LoadArticleAiPhotosResult> {
  const inputs = normalizePhotoInputs(photoAssets);

  if (!inputs) {
    return {
      ok: false,
      error: "AI_PHOTO_INPUT_INVALID",
      message: "AI 사진 분석은 JPG, PNG, WebP 파일을 한 번에 최대 3장까지 사용할 수 있습니다.",
      status: 400,
    };
  }

  if (inputs.length === 0) return { ok: true, photos: [] };

  const headers = getServiceHeaders();
  if (!headers) {
    return {
      ok: false,
      error: "AI_PHOTO_STORAGE_NOT_CONFIGURED",
      message: "사진 소재를 확인할 Storage 설정이 준비되지 않았습니다.",
      status: 503,
    };
  }

  const project = await findProject(projectSlug, headers);
  if (!project) {
    return {
      ok: false,
      error: "AI_PHOTO_PROJECT_NOT_FOUND",
      message: "사진 소재가 속한 프로젝트를 확인하지 못했습니다.",
      status: 404,
    };
  }

  const verifiedPhotos: VerifiedArticleAiPhoto[] = [];
  let totalBytes = 0;

  for (const input of inputs) {
    const asset = await findProjectAsset(project.id, input.storagePath, headers);
    const assetMimeType = asset?.mime_type?.trim().toLowerCase() ?? "";

    if (
      !asset ||
      !input.storagePath.startsWith(`${project.slug}/`) ||
      !supportedPhotoMimeTypes.has(assetMimeType)
    ) {
      return {
        ok: false,
        error: "AI_PHOTO_ASSET_NOT_FOUND",
        message: "프로젝트에 등록된 사진 소재를 확인하지 못했습니다.",
        status: 400,
      };
    }

    const storageEndpoint = getSupabaseStorageEndpoint(
      `/object/${assetBucket}/${encodeStoragePath(asset.file_path)}`,
    );
    if (!storageEndpoint) {
      return {
        ok: false,
        error: "AI_PHOTO_STORAGE_NOT_CONFIGURED",
        message: "사진 소재를 불러올 Storage 주소를 만들지 못했습니다.",
        status: 503,
      };
    }

    const response = await fetch(storageEndpoint, { headers, cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      return {
        ok: false,
        error: "AI_PHOTO_DOWNLOAD_FAILED",
        message: "AI 분석용 사진 소재를 불러오지 못했습니다.",
        status: 502,
      };
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 0 && totalBytes + contentLength > maxTotalPhotoBytes) {
      return {
        ok: false,
        error: "AI_PHOTO_TOTAL_SIZE_EXCEEDED",
        message: "AI 사진 분석에 사용할 사진의 전체 용량은 20MB 이하여야 합니다.",
        status: 400,
      };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    totalBytes += bytes.byteLength;

    if (totalBytes > maxTotalPhotoBytes) {
      return {
        ok: false,
        error: "AI_PHOTO_TOTAL_SIZE_EXCEEDED",
        message: "AI 사진 분석에 사용할 사진의 전체 용량은 20MB 이하여야 합니다.",
        status: 400,
      };
    }

    verifiedPhotos.push({
      sourceId: input.sourceId,
      storagePath: asset.file_path,
      fileName: cleanFileName(asset.title || input.fileName) || "보도사진",
      mimeType: assetMimeType,
      dataUrl: `data:${assetMimeType};base64,${bytes.toString("base64")}`,
    });
  }

  return { ok: true, photos: verifiedPhotos };
}
