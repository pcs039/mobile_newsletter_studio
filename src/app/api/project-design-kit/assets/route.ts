import { validateDesignAssetMetadata } from "@/lib/design-asset-metadata";
import { NextResponse } from "next/server";
import {
  getProjectDesignAssets,
  getProjectDesignKit,
  type ProjectDesignAssetApprovalStatus,
  type ProjectDesignAssetType,
  type ProjectDesignAssetBackgroundMode,
  type ProjectDesignAssetLanguage,
  type ProjectDesignAssetUsageRole,
  type ProjectDesignAssetVariant,
  type ProjectDesignProductionAssetType,
} from "@/lib/newsletter-repository";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { requireProjectApiAccess } from "@/lib/project-api-access";

export const dynamic = "force-dynamic";

const brandAssetsBucket = "brand-assets";
const designIntakeAssetsBucket = "design-intake-assets";
const designProductionAssetsBucket = "design-production-assets";
const maxLogoBytes = 5 * 1024 * 1024;
const maxIntakeAssetBytes = 50 * 1024 * 1024;
const maxProductionAssetBytes = 10 * 1024 * 1024;
const logoMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const logoExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const sourceDesignExtensions = new Set(["ai", "svg", "eps", "psd", "pdf"]);
const referenceExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);
const intakeMimeTypes = new Set([
  "application/pdf",
  "application/postscript",
  "application/octet-stream",
  "image/svg+xml",
  "image/vnd.adobe.photoshop",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const productionMimeTypes = new Set(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]);
const productionExtensions = new Set(["svg", "png", "jpg", "jpeg", "webp"]);
const productionAssetTypes = ["background", "illustration", "icon", "card_frame", "banner", "pattern", "decoration"] as const;
const assetTypes = ["logo", "source_design", "reference", ...productionAssetTypes] as const;
const languages = ["ko", "en", "mixed", "other"] as const;
const variants = ["primary", "compact", "inverse", "symbol", "other"] as const;
const backgroundModes = ["light", "dark", "any"] as const;
const usageRoles = ["header", "section", "card", "article", "footer", "general"] as const;
const approvalStatuses = ["draft", "approved", "archived"] as const;

type ProjectAssetRow = {
  id: string;
  project_id: string;
  storage_path: string | null;
  storage_bucket: string | null;
  asset_type: ProjectDesignAssetType;
  is_primary: boolean;
  is_active: boolean;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function isProductionAssetType(value: ProjectDesignAssetType): value is ProjectDesignProductionAssetType {
  return productionAssetTypes.includes(value as ProjectDesignProductionAssetType);
}

function getProjectSlugFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);

  return searchParams.get("projectSlug")?.trim() || searchParams.get("projectId")?.trim() || "";
}

function getServiceHeaders(contentType = "application/json") {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType,
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isSafeStoragePath(path: string) {
  return Boolean(path) && !path.startsWith("/") && !path.includes("..") && !path.endsWith("/");
}

function getExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.trim().toLowerCase() ?? "";

  return extension === fileName ? "" : extension.replace(/[^a-z0-9]/g, "");
}

function normalizeMimeType(file: File) {
  const extension = getExtension(file.name);

  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "ai" || extension === "eps") return "application/postscript";
  if (extension === "psd") return "image/vnd.adobe.photoshop";
  if (extension === "pdf") return "application/pdf";

  return file.type || "application/octet-stream";
}

function isAllowedAssetFile(file: File, assetType: ProjectDesignAssetType) {
  const extension = getExtension(file.name);
  const mimeType = normalizeMimeType(file);

  if (assetType === "logo") {
    return file.size > 0 && file.size <= maxLogoBytes && logoExtensions.has(extension) && logoMimeTypes.has(mimeType);
  }

  if (isProductionAssetType(assetType)) {
    return (
      file.size > 0 &&
      file.size <= maxProductionAssetBytes &&
      productionExtensions.has(extension) &&
      productionMimeTypes.has(mimeType)
    );
  }

  const allowedExtensions = assetType === "source_design" ? sourceDesignExtensions : referenceExtensions;

  return file.size > 0 && file.size <= maxIntakeAssetBytes && allowedExtensions.has(extension) && intakeMimeTypes.has(mimeType);
}

function makeStoragePath(projectId: string, assetType: ProjectDesignAssetType, fileName: string) {
  const extension = getExtension(fileName) || "png";
  const token =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const directory =
    assetType === "logo"
      ? "logos"
      : assetType === "source_design"
        ? "source-design"
        : assetType === "reference"
          ? "references"
          : `production/${assetType}`;

  return `projects/${projectId}/${directory}/${token}.${extension}`;
}

function getAssetBucket(assetType: ProjectDesignAssetType) {
  return assetType === "logo"
    ? brandAssetsBucket
    : assetType === "source_design" || assetType === "reference"
      ? designIntakeAssetsBucket
      : designProductionAssetsBucket;
}

async function ensureAssetBucket(assetType: ProjectDesignAssetType, headers: Record<string, string>) {
  const bucket = getAssetBucket(assetType);
  const bucketEndpoint = getSupabaseStorageEndpoint(`/bucket/${encodeURIComponent(bucket)}`);

  if (!bucketEndpoint) {
    return false;
  }

  const existingBucket = await fetch(bucketEndpoint, {
    headers,
    cache: "no-store",
  });

  if (existingBucket.ok) {
    return true;
  }

  if (existingBucket.status !== 404) {
    return false;
  }

  const createBucketEndpoint = getSupabaseStorageEndpoint("/bucket");

  if (!createBucketEndpoint) {
    return false;
  }

  const isLogo = assetType === "logo";
  const isProduction = isProductionAssetType(assetType);

  const createdBucket = await fetch(createBucketEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: isLogo,
      file_size_limit: isLogo ? maxLogoBytes : isProduction ? maxProductionAssetBytes : maxIntakeAssetBytes,
      allowed_mime_types: Array.from(isLogo ? logoMimeTypes : isProduction ? productionMimeTypes : intakeMimeTypes),
    }),
    cache: "no-store",
  });

  return createdBucket.ok || createdBucket.status === 409;
}

async function canStoreMetadata(projectId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_project_design_assets?select=metadata&project_id=eq.${encodeURIComponent(projectId)}&limit=0`);
  return Boolean(endpoint && (await fetch(endpoint, { headers, cache: "no-store" })).ok);
}

function metadataMigrationRequired() {
  return NextResponse.json({ ok: false, message: "외부 제작 정보 저장을 준비 중입니다. metadata migration 적용 상태를 확인하세요." }, { status: 503 });
}

async function getProjectContext(projectSlug: string) {
  const designKit = await getProjectDesignKit(projectSlug);

  if (!designKit.ok) {
    return designKit;
  }

  return designKit;
}

async function unsetCurrentPrimaryLogo(projectId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?project_id=eq.${encodeURIComponent(projectId)}&asset_type=eq.logo&is_primary=eq.true`,
  );

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_primary: false }),
    cache: "no-store",
  });

  return response.ok;
}

async function promoteFirstActiveLogo(projectId: string, headers: Record<string, string>) {
  const listEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?select=id&project_id=eq.${encodeURIComponent(
      projectId,
    )}&asset_type=eq.logo&is_active=eq.true&order=sort_order.asc&order=created_at.asc&limit=1`,
  );

  if (!listEndpoint) {
    return false;
  }

  const listResponse = await fetch(listEndpoint, {
    headers,
    cache: "no-store",
  });

  if (!listResponse.ok) {
    return false;
  }

  const rows = (await listResponse.json().catch(() => [])) as Array<{ id: string }>;
  const nextLogo = rows[0];

  if (!nextLogo) {
    return true;
  }

  const patchEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?id=eq.${encodeURIComponent(nextLogo.id)}&project_id=eq.${encodeURIComponent(projectId)}`,
  );

  if (!patchEndpoint) {
    return false;
  }

  const patchResponse = await fetch(patchEndpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_primary: true }),
    cache: "no-store",
  });

  return patchResponse.ok;
}

async function findDesignAsset(projectId: string, assetId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?select=id,project_id,asset_type,storage_bucket,storage_path,is_primary,is_active&id=eq.${encodeURIComponent(
      assetId,
    )}&project_id=eq.${encodeURIComponent(projectId)}&limit=1`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json().catch(() => [])) as ProjectAssetRow[];

  return rows[0] ?? null;
}

async function isProjectSourceDesignAsset(projectId: string, assetId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?select=id&id=eq.${encodeURIComponent(assetId)}&project_id=eq.${encodeURIComponent(
      projectId,
    )}&asset_type=eq.source_design&limit=1`,
  );

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, { headers, cache: "no-store" });

  if (!response.ok) {
    return false;
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;

  return Boolean(rows[0]?.id);
}

async function deleteStorageObject(bucket: string, path: string, headers: Record<string, string>) {
  if (!isSafeStoragePath(path)) {
    return true;
  }

  if (bucket !== brandAssetsBucket && bucket !== designIntakeAssetsBucket && bucket !== designProductionAssetsBucket) {
    return false;
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${encodeURIComponent(bucket)}`);

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: [path] }),
    cache: "no-store",
  });

  return response.ok || response.status === 404;
}

function readLanguage(value: unknown): ProjectDesignAssetLanguage {
  return isOneOf(value, languages) ? value : "ko";
}

function readVariant(value: unknown): ProjectDesignAssetVariant {
  return isOneOf(value, variants) ? value : "primary";
}

function readBackgroundMode(value: unknown): ProjectDesignAssetBackgroundMode {
  return isOneOf(value, backgroundModes) ? value : "any";
}

function readUsageRole(value: unknown): ProjectDesignAssetUsageRole {
  return isOneOf(value, usageRoles) ? value : "general";
}

function readApprovalStatus(value: unknown): ProjectDesignAssetApprovalStatus {
  return isOneOf(value, approvalStatuses) ? value : "draft";
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "unconfigured" || status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : httpStatus ?? 500;
}

function isCompositionAssetInUseError(body: string) {
  try {
    const error = JSON.parse(body) as { code?: string; details?: string; message?: string };
    const description = `${error.message ?? ""} ${error.details ?? ""}`;

    return (
      error.code === "23503" &&
      description.includes("newsletter_article_composition_assets_asset_id_fkey")
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const projectSlug = getProjectSlugFromRequest(request);

  if (!projectSlug) {
    return NextResponse.json({ ok: false, message: "프로젝트 ID를 확인하지 못했습니다." }, { status: 400 });
  }

  const access = await requireProjectApiAccess({ projectSlug });

  if (!access.ok) {
    return access.response;
  }

  const result = await getProjectDesignAssets(projectSlug);

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.source, result.httpStatus) });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ ok: false, message: "디자인 자산 업로드 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const projectSlug = asText(formData.get("projectSlug")) || asText(formData.get("projectId"));
  const file = formData.get("file");
  const requestedAssetType = formData.get("assetType");
  const assetType = requestedAssetType === null ? "logo" : isOneOf(requestedAssetType, assetTypes) ? requestedAssetType : null;

  if (!projectSlug || !(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "프로젝트와 디자인 파일을 모두 확인해야 합니다." }, { status: 400 });
  }

  if (!assetType) {
    return NextResponse.json({ ok: false, message: "디자인 자산 유형 값이 올바르지 않습니다." }, { status: 400 });
  }

  const access = await requireProjectApiAccess({ projectSlug });

  if (!access.ok) {
    return access.response;
  }

  if (!isAllowedAssetFile(file, assetType)) {
    const message =
      assetType === "logo"
        ? "PNG, JPG, WebP 로고 파일만 5MB까지 업로드할 수 있습니다."
        : assetType === "source_design"
          ? "AI, SVG, EPS, PSD, PDF 원본 파일만 50MB까지 업로드할 수 있습니다."
          : assetType === "reference"
            ? "PDF, PNG, JPG, WebP 참고자료만 50MB까지 업로드할 수 있습니다."
            : "SVG, PNG, JPG, WebP 제작 자산만 10MB까지 업로드할 수 있습니다.";

    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const metadataInput = formData.get("metadata");
  let metadataValue: unknown = null;
  if (metadataInput !== null) {
    if (typeof metadataInput !== "string" || metadataInput.length > 1024) {
      return NextResponse.json({ ok: false, message: "외부 제작 정보 형식이 올바르지 않습니다." }, { status: 400 });
    }
    try { metadataValue = JSON.parse(metadataInput); } catch {
      return NextResponse.json({ ok: false, message: "외부 제작 정보 형식이 올바르지 않습니다." }, { status: 400 });
    }
  }
  const metadata = validateDesignAssetMetadata(metadataValue);
  if (!metadata.ok) return NextResponse.json({ ok: false, message: metadata.message }, { status: 400 });

  const context = await getProjectContext(projectSlug);

  if (!context.ok) {
    return NextResponse.json(context, { status: getErrorStatus(context.source, context.httpStatus) });
  }

  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json({ ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 디자인 자산을 업로드할 수 있습니다." }, { status: 503 });
  }

  if (metadataInput !== null && !(await canStoreMetadata(context.project.id, headers))) {
    return metadataMigrationRequired();
  }

  const requestedParentSourceAssetId = asText(formData.get("parentSourceAssetId"));
  const parentSourceAssetId = isProductionAssetType(assetType) && requestedParentSourceAssetId ? requestedParentSourceAssetId : null;

  if (
    parentSourceAssetId &&
    !(await isProjectSourceDesignAsset(context.project.id, parentSourceAssetId, headers))
  ) {
    return NextResponse.json(
      { ok: false, message: "현재 프로젝트의 디자인 원본만 파생 자산에 연결할 수 있습니다." },
      { status: 400 },
    );
  }

  const assets = await getProjectDesignAssets(projectSlug);
  const hasPrimaryLogo = assets.ok
    ? assets.assets.some((asset) => asset.assetType === "logo" && asset.isPrimary && asset.isActive)
    : false;
  const isPrimary = assetType === "logo" && (asText(formData.get("isPrimary")) === "true" || !hasPrimaryLogo);
  const name = asText(formData.get("name")) || file.name.replace(/\.[^.]+$/, "") || "디자인 자료";
  const storageBucket = getAssetBucket(assetType);
  const storagePath = makeStoragePath(context.project.id, assetType, file.name);
  const storageEndpoint = getSupabaseStorageEndpoint(`/object/${storageBucket}/${encodeStoragePath(storagePath)}`);
  const storageHeaders = getServiceHeaders(normalizeMimeType(file));

  if (!storageEndpoint || !storageHeaders || !(await ensureAssetBucket(assetType, headers))) {
    return NextResponse.json({ ok: false, message: "Supabase Storage 버킷을 준비하지 못했습니다." }, { status: 503 });
  }

  const uploadResponse = await fetch(storageEndpoint, {
    method: "POST",
    headers: {
      ...storageHeaders,
      "x-upsert": "false",
    },
    body: file,
    cache: "no-store",
  });

  if (!uploadResponse.ok) {
    console.error("Failed to upload design asset", {
      status: uploadResponse.status,
      body: await uploadResponse.text().catch(() => ""),
    });

    return NextResponse.json({ ok: false, message: "디자인 파일을 Storage에 업로드하지 못했습니다." }, { status: uploadResponse.status || 500 });
  }

  if (isPrimary && !(await unsetCurrentPrimaryLogo(context.project.id, headers))) {
    await deleteStorageObject(storageBucket, storagePath, headers);

    return NextResponse.json({ ok: false, message: "기존 대표 로고 상태를 정리하지 못했습니다." }, { status: 500 });
  }

  const insertEndpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_project_design_assets?select=*");

  if (!insertEndpoint) {
    const cleanedUp = await deleteStorageObject(storageBucket, storagePath, headers);

    if (!cleanedUp) {
      console.warn("Failed to clean up uploaded design asset after REST endpoint failure", { storageBucket, storagePath });
    }

    return NextResponse.json(
      {
        ok: false,
        warning: cleanedUp ? undefined : "storage_cleanup_failed",
        message: cleanedUp
          ? "Supabase REST 주소를 만들지 못했습니다."
          : "Supabase REST 주소를 만들지 못했고 Storage 원본 정리에도 실패했습니다. 관리자에게 원본 정리를 요청하세요.",
      },
      { status: 503 },
    );
  }

  const insertResponse = await fetch(insertEndpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...(metadataInput !== null ? { metadata: metadata.metadata } : {}),
      project_id: context.project.id,
      asset_type: assetType,
      parent_source_asset_id: parentSourceAssetId,
      name,
      language: readLanguage(formData.get("language")),
      variant: readVariant(formData.get("variant")),
      background_mode: readBackgroundMode(formData.get("backgroundMode")),
      usage_role: isProductionAssetType(assetType) ? readUsageRole(formData.get("usageRole")) : "general",
      approval_status: isProductionAssetType(assetType) ? readApprovalStatus(formData.get("approvalStatus")) : "draft",
      storage_path: storagePath,
      storage_bucket: storageBucket,
      original_file_name: file.name,
      mime_type: normalizeMimeType(file),
      file_size_bytes: file.size,
      alt_text:
        asText(formData.get("altText")) || (assetType === "logo" ? `${context.project.organization} 로고` : null),
      usage_note: asText(formData.get("usageNote")) || null,
      is_primary: isPrimary,
      is_active: true,
      sort_order: assets.ok ? assets.assets.length : 0,
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Failed to insert design asset", {
      status: insertResponse.status,
      body: await insertResponse.text().catch(() => ""),
    });
    const cleanedUp = await deleteStorageObject(storageBucket, storagePath, headers);

    if (!cleanedUp) {
      console.warn("Failed to clean up uploaded design asset after database insert failure", { storageBucket, storagePath });
    }

    if (isPrimary) {
      await promoteFirstActiveLogo(context.project.id, headers);
    }

    return NextResponse.json(
      {
        ok: false,
        warning: cleanedUp ? undefined : "storage_cleanup_failed",
        message: cleanedUp
          ? "디자인 파일은 업로드됐지만 자산 기록을 저장하지 못했습니다."
          : "자산 기록을 저장하지 못했고 Storage 원본 정리에도 실패했습니다. 관리자에게 원본 정리를 요청하세요.",
      },
      { status: 500 },
    );
  }

  const updated = await getProjectDesignAssets(projectSlug);

  return NextResponse.json(
    {
      ok: true,
      assets: updated.ok ? updated.assets : [],
      message:
        assetType === "logo"
          ? isPrimary
            ? "대표 로고를 등록했습니다."
            : "로고 자산을 등록했습니다."
          : assetType === "source_design"
            ? "디자인 원본을 등록했습니다."
            : assetType === "reference"
              ? "참고 자료를 등록했습니다."
              : "모바일 제작 자산을 등록했습니다.",
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "디자인 자산 수정 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const projectSlug = asText(payload.projectSlug) || asText(payload.projectId);
  const assetId = asText(payload.assetId);

  if (!projectSlug || !assetId) {
    return NextResponse.json({ ok: false, message: "프로젝트와 디자인 자산을 확인해야 합니다." }, { status: 400 });
  }

  const access = await requireProjectApiAccess({ projectSlug });

  if (!access.ok) {
    return access.response;
  }

  const metadata = validateDesignAssetMetadata("metadata" in payload ? payload.metadata : null);
  if (!metadata.ok) return NextResponse.json({ ok: false, message: metadata.message }, { status: 400 });

  const context = await getProjectContext(projectSlug);

  if (!context.ok) {
    return NextResponse.json(context, { status: getErrorStatus(context.source, context.httpStatus) });
  }

  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json({ ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 디자인 자산을 수정할 수 있습니다." }, { status: 503 });
  }

  const currentAsset = await findDesignAsset(context.project.id, assetId, headers);

  if (!currentAsset) {
    return NextResponse.json({ ok: false, message: "수정할 디자인 자산을 찾지 못했습니다." }, { status: 404 });
  }

  if ("metadata" in payload && !(await canStoreMetadata(context.project.id, headers))) {
    return metadataMigrationRequired();
  }

  const shouldSetPrimary = currentAsset.asset_type === "logo" && payload.isPrimary === true;
  const isProductionAsset = isProductionAssetType(currentAsset.asset_type);

  if (shouldSetPrimary && !(await unsetCurrentPrimaryLogo(context.project.id, headers))) {
    return NextResponse.json({ ok: false, message: "기존 대표 로고 상태를 정리하지 못했습니다." }, { status: 500 });
  }

  const patchBody: Record<string, unknown> = {};
  if ("metadata" in payload) patchBody.metadata = metadata.metadata;

  if ("name" in payload) patchBody.name = asText(payload.name) || (currentAsset.asset_type === "logo" ? "공식 로고" : "디자인 자산");
  if (currentAsset.asset_type === "logo" && "language" in payload) patchBody.language = readLanguage(payload.language);
  if (currentAsset.asset_type === "logo" && "variant" in payload) patchBody.variant = readVariant(payload.variant);
  if ((currentAsset.asset_type === "logo" || isProductionAsset) && "backgroundMode" in payload) {
    patchBody.background_mode = readBackgroundMode(payload.backgroundMode);
  }
  if (currentAsset.asset_type === "logo" && "altText" in payload) patchBody.alt_text = asText(payload.altText) || null;
  if (isProductionAsset && "usageRole" in payload) patchBody.usage_role = readUsageRole(payload.usageRole);
  if (isProductionAsset && "approvalStatus" in payload) patchBody.approval_status = readApprovalStatus(payload.approvalStatus);
  if (isProductionAsset && "parentSourceAssetId" in payload) {
    const parentSourceAssetId = asText(payload.parentSourceAssetId);

    if (parentSourceAssetId && !(await isProjectSourceDesignAsset(context.project.id, parentSourceAssetId, headers))) {
      return NextResponse.json(
        { ok: false, message: "현재 프로젝트의 디자인 원본만 파생 자산에 연결할 수 있습니다." },
        { status: 400 },
      );
    }

    patchBody.parent_source_asset_id = parentSourceAssetId || null;
  }
  if ("usageNote" in payload) patchBody.usage_note = asText(payload.usageNote) || null;
  if ("isActive" in payload) patchBody.is_active = payload.isActive !== false;
  if (shouldSetPrimary) {
    patchBody.is_primary = true;
    patchBody.is_active = true;
  }
  if (currentAsset.is_primary && patchBody.is_active === false) {
    patchBody.is_primary = false;
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?id=eq.${encodeURIComponent(assetId)}&project_id=eq.${encodeURIComponent(
      context.project.id,
    )}`,
  );

  if (!endpoint) {
    return NextResponse.json({ ok: false, message: "Supabase REST 주소를 만들지 못했습니다." }, { status: 503 });
  }

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patchBody),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Failed to update design asset", {
      status: response.status,
      body: await response.text().catch(() => ""),
    });

    return NextResponse.json({ ok: false, message: "디자인 자산 수정에 실패했습니다." }, { status: response.status || 500 });
  }

  if (currentAsset.is_primary && patchBody.is_active === false) {
    await promoteFirstActiveLogo(context.project.id, headers);
  }

  const updated = await getProjectDesignAssets(projectSlug);

  return NextResponse.json({
    ok: true,
    assets: updated.ok ? updated.assets : [],
    message: shouldSetPrimary ? "대표 로고를 변경했습니다." : "디자인 자산을 수정했습니다.",
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectSlug = searchParams.get("projectSlug")?.trim() || searchParams.get("projectId")?.trim() || "";
  const assetId = searchParams.get("assetId")?.trim() ?? "";

  if (!projectSlug || !assetId) {
    return NextResponse.json({ ok: false, message: "삭제할 프로젝트와 디자인 자산을 확인해야 합니다." }, { status: 400 });
  }

  const access = await requireProjectApiAccess({ projectSlug });

  if (!access.ok) {
    return access.response;
  }

  const context = await getProjectContext(projectSlug);

  if (!context.ok) {
    return NextResponse.json(context, { status: getErrorStatus(context.source, context.httpStatus) });
  }

  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json({ ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 디자인 자산을 삭제할 수 있습니다." }, { status: 503 });
  }

  const currentAsset = await findDesignAsset(context.project.id, assetId, headers);

  if (!currentAsset) {
    return NextResponse.json({ ok: false, message: "삭제할 디자인 자산을 찾지 못했습니다." }, { status: 404 });
  }

  const storageBucket = currentAsset.storage_bucket || brandAssetsBucket;
  const isLogoAsset = currentAsset.asset_type === "logo";

  if (isLogoAsset && currentAsset.storage_path && !(await deleteStorageObject(storageBucket, currentAsset.storage_path, headers))) {
    return NextResponse.json({ ok: false, message: "Storage 원본 디자인 파일을 삭제하지 못했습니다." }, { status: 500 });
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?id=eq.${encodeURIComponent(assetId)}&project_id=eq.${encodeURIComponent(
      context.project.id,
    )}`,
  );

  if (!endpoint) {
    return NextResponse.json({ ok: false, message: "Supabase REST 주소를 만들지 못했습니다." }, { status: 503 });
  }

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");

    if (isCompositionAssetInUseError(responseBody)) {
      return NextResponse.json(
        {
          ok: false,
          code: "asset_in_use",
          message: "이 자산은 기사 구성에서 사용 중입니다. 먼저 기사 구성에서 제거하거나 교체하세요.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to delete design asset", {
      status: response.status,
      body: responseBody,
    });

    return NextResponse.json({ ok: false, message: "디자인 자산 삭제에 실패했습니다." }, { status: response.status || 500 });
  }

  let storageCleanupFailed = false;

  if (!isLogoAsset && currentAsset.storage_path) {
    storageCleanupFailed = !(await deleteStorageObject(storageBucket, currentAsset.storage_path, headers));

    if (storageCleanupFailed) {
      console.warn("Failed to clean up deleted design asset from Storage", {
        assetId: currentAsset.id,
        storageBucket,
        storagePath: currentAsset.storage_path,
      });
    }
  }

  if (isLogoAsset && currentAsset.is_primary) {
    await promoteFirstActiveLogo(context.project.id, headers);
  }

  const updated = await getProjectDesignAssets(projectSlug);

  return NextResponse.json({
    ok: true,
    assets: updated.ok ? updated.assets : [],
    warning: storageCleanupFailed ? "storage_cleanup_failed" : undefined,
    message: storageCleanupFailed
      ? "디자인 자료 기록은 삭제했지만 Storage 원본 정리에 실패했습니다. 관리자에게 원본 정리를 요청하세요."
      : "디자인 자산을 삭제했습니다.",
  });
}
