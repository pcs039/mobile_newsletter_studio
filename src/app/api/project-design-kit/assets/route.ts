import { NextResponse } from "next/server";
import { canAccessProject, requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import {
  getProjectDesignAssets,
  getProjectDesignKit,
  type ProjectDesignAssetBackgroundMode,
  type ProjectDesignAssetLanguage,
  type ProjectDesignAssetVariant,
} from "@/lib/newsletter-repository";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const brandAssetsBucket = "brand-assets";
const maxLogoBytes = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const languages = ["ko", "en", "mixed", "other"] as const;
const variants = ["primary", "compact", "inverse", "symbol", "other"] as const;
const backgroundModes = ["light", "dark", "any"] as const;

type ProjectAssetRow = {
  id: string;
  project_id: string;
  storage_path: string | null;
  is_primary: boolean;
  is_active: boolean;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
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

  if (file.type) {
    return file.type;
  }

  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";

  return "";
}

function isAllowedLogoFile(file: File) {
  const extension = getExtension(file.name);
  const mimeType = normalizeMimeType(file);

  return file.size > 0 && file.size <= maxLogoBytes && allowedExtensions.has(extension) && allowedMimeTypes.has(mimeType);
}

function makeStoragePath(projectId: string, fileName: string) {
  const extension = getExtension(fileName) || "png";
  const token =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `projects/${projectId}/design-assets/${token}.${extension}`;
}

async function ensureBrandAssetsBucket(headers: Record<string, string>) {
  const bucketEndpoint = getSupabaseStorageEndpoint(`/bucket/${encodeURIComponent(brandAssetsBucket)}`);

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

  const createdBucket = await fetch(createBucketEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: brandAssetsBucket,
      name: brandAssetsBucket,
      public: true,
      file_size_limit: maxLogoBytes,
      allowed_mime_types: Array.from(allowedMimeTypes),
    }),
    cache: "no-store",
  });

  return createdBucket.ok || createdBucket.status === 409;
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

async function findLogoAsset(projectId: string, assetId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_project_design_assets?select=id,project_id,storage_path,is_primary,is_active&id=eq.${encodeURIComponent(
      assetId,
    )}&project_id=eq.${encodeURIComponent(projectId)}&asset_type=eq.logo&limit=1`,
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

async function deleteStorageObject(path: string, headers: Record<string, string>) {
  if (!isSafeStoragePath(path)) {
    return true;
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${encodeURIComponent(brandAssetsBucket)}`);

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

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "unconfigured" || status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : httpStatus ?? 500;
}

export async function GET(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const projectSlug = getProjectSlugFromRequest(request);

  if (!projectSlug) {
    return NextResponse.json({ ok: false, message: "프로젝트 ID를 확인하지 못했습니다." }, { status: 400 });
  }

  const result = await getProjectDesignAssets(projectSlug);

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.source, result.httpStatus) });
  }

  if (!canAccessProject(user, result.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 로고 자산을 열 권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ ok: false, message: "로고 업로드 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const projectSlug = asText(formData.get("projectSlug")) || asText(formData.get("projectId"));
  const file = formData.get("file");

  if (!projectSlug || !(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "프로젝트와 로고 파일을 모두 확인해야 합니다." }, { status: 400 });
  }

  if (!isAllowedLogoFile(file)) {
    return NextResponse.json({ ok: false, message: "PNG, JPG, WebP 로고 파일만 5MB까지 업로드할 수 있습니다." }, { status: 400 });
  }

  const context = await getProjectContext(projectSlug);

  if (!context.ok) {
    return NextResponse.json(context, { status: getErrorStatus(context.source, context.httpStatus) });
  }

  if (!canAccessProject(user, context.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 로고 자산을 등록할 권한이 없습니다." }, { status: 403 });
  }

  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json({ ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 로고를 업로드할 수 있습니다." }, { status: 503 });
  }

  const assets = await getProjectDesignAssets(projectSlug);
  const hasPrimaryLogo = assets.ok ? assets.assets.some((asset) => asset.isPrimary && asset.isActive) : false;
  const isPrimary = asText(formData.get("isPrimary")) === "true" || !hasPrimaryLogo;
  const name = asText(formData.get("name")) || file.name.replace(/\.[^.]+$/, "") || "공식 로고";
  const storagePath = makeStoragePath(context.project.id, file.name);
  const storageEndpoint = getSupabaseStorageEndpoint(`/object/${brandAssetsBucket}/${encodeStoragePath(storagePath)}`);
  const storageHeaders = getServiceHeaders(normalizeMimeType(file));

  if (!storageEndpoint || !storageHeaders || !(await ensureBrandAssetsBucket(headers))) {
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
    console.error("Failed to upload design logo", {
      status: uploadResponse.status,
      body: await uploadResponse.text().catch(() => ""),
    });

    return NextResponse.json({ ok: false, message: "로고 파일을 Storage에 업로드하지 못했습니다." }, { status: uploadResponse.status || 500 });
  }

  if (isPrimary && !(await unsetCurrentPrimaryLogo(context.project.id, headers))) {
    await deleteStorageObject(storagePath, headers);

    return NextResponse.json({ ok: false, message: "기존 대표 로고 상태를 정리하지 못했습니다." }, { status: 500 });
  }

  const insertEndpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_project_design_assets?select=*");

  if (!insertEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase REST 주소를 만들지 못했습니다." }, { status: 503 });
  }

  const insertResponse = await fetch(insertEndpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      project_id: context.project.id,
      asset_type: "logo",
      name,
      language: readLanguage(formData.get("language")),
      variant: readVariant(formData.get("variant")),
      background_mode: readBackgroundMode(formData.get("backgroundMode")),
      storage_path: storagePath,
      alt_text: asText(formData.get("altText")) || `${context.project.organization} 로고`,
      usage_note: asText(formData.get("usageNote")) || null,
      is_primary: isPrimary,
      is_active: true,
      sort_order: assets.ok ? assets.assets.length : 0,
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Failed to insert design logo", {
      status: insertResponse.status,
      body: await insertResponse.text().catch(() => ""),
    });
    await deleteStorageObject(storagePath, headers);
    if (isPrimary) {
      await promoteFirstActiveLogo(context.project.id, headers);
    }

    return NextResponse.json({ ok: false, message: "로고 파일은 업로드됐지만 자산 기록을 저장하지 못했습니다." }, { status: 500 });
  }

  const updated = await getProjectDesignAssets(projectSlug);

  return NextResponse.json(
    {
      ok: true,
      assets: updated.ok ? updated.assets : [],
      message: isPrimary ? "대표 로고를 등록했습니다." : "로고 자산을 등록했습니다.",
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "로고 수정 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const projectSlug = asText(payload.projectSlug) || asText(payload.projectId);
  const assetId = asText(payload.assetId);

  if (!projectSlug || !assetId) {
    return NextResponse.json({ ok: false, message: "프로젝트와 로고 자산을 확인해야 합니다." }, { status: 400 });
  }

  const context = await getProjectContext(projectSlug);

  if (!context.ok) {
    return NextResponse.json(context, { status: getErrorStatus(context.source, context.httpStatus) });
  }

  if (!canAccessProject(user, context.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 로고 자산을 수정할 권한이 없습니다." }, { status: 403 });
  }

  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json({ ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 로고를 수정할 수 있습니다." }, { status: 503 });
  }

  const currentAsset = await findLogoAsset(context.project.id, assetId, headers);

  if (!currentAsset) {
    return NextResponse.json({ ok: false, message: "수정할 로고 자산을 찾지 못했습니다." }, { status: 404 });
  }

  const shouldSetPrimary = payload.isPrimary === true;

  if (shouldSetPrimary && !(await unsetCurrentPrimaryLogo(context.project.id, headers))) {
    return NextResponse.json({ ok: false, message: "기존 대표 로고 상태를 정리하지 못했습니다." }, { status: 500 });
  }

  const patchBody: Record<string, unknown> = {};

  if ("name" in payload) patchBody.name = asText(payload.name) || "공식 로고";
  if ("language" in payload) patchBody.language = readLanguage(payload.language);
  if ("variant" in payload) patchBody.variant = readVariant(payload.variant);
  if ("backgroundMode" in payload) patchBody.background_mode = readBackgroundMode(payload.backgroundMode);
  if ("altText" in payload) patchBody.alt_text = asText(payload.altText) || null;
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
    console.error("Failed to update design logo", {
      status: response.status,
      body: await response.text().catch(() => ""),
    });

    return NextResponse.json({ ok: false, message: "로고 자산 수정에 실패했습니다." }, { status: response.status || 500 });
  }

  if (currentAsset.is_primary && patchBody.is_active === false) {
    await promoteFirstActiveLogo(context.project.id, headers);
  }

  const updated = await getProjectDesignAssets(projectSlug);

  return NextResponse.json({
    ok: true,
    assets: updated.ok ? updated.assets : [],
    message: shouldSetPrimary ? "대표 로고를 변경했습니다." : "로고 자산을 수정했습니다.",
  });
}

export async function DELETE(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const projectSlug = searchParams.get("projectSlug")?.trim() || searchParams.get("projectId")?.trim() || "";
  const assetId = searchParams.get("assetId")?.trim() ?? "";

  if (!projectSlug || !assetId) {
    return NextResponse.json({ ok: false, message: "삭제할 프로젝트와 로고 자산을 확인해야 합니다." }, { status: 400 });
  }

  const context = await getProjectContext(projectSlug);

  if (!context.ok) {
    return NextResponse.json(context, { status: getErrorStatus(context.source, context.httpStatus) });
  }

  if (!canAccessProject(user, context.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 로고 자산을 삭제할 권한이 없습니다." }, { status: 403 });
  }

  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json({ ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 로고를 삭제할 수 있습니다." }, { status: 503 });
  }

  const currentAsset = await findLogoAsset(context.project.id, assetId, headers);

  if (!currentAsset) {
    return NextResponse.json({ ok: false, message: "삭제할 로고 자산을 찾지 못했습니다." }, { status: 404 });
  }

  if (currentAsset.storage_path && !(await deleteStorageObject(currentAsset.storage_path, headers))) {
    return NextResponse.json({ ok: false, message: "Storage 원본 로고 파일을 삭제하지 못했습니다." }, { status: 500 });
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
    console.error("Failed to delete design logo", {
      status: response.status,
      body: await response.text().catch(() => ""),
    });

    return NextResponse.json({ ok: false, message: "로고 자산 삭제에 실패했습니다." }, { status: response.status || 500 });
  }

  if (currentAsset.is_primary) {
    await promoteFirstActiveLogo(context.project.id, headers);
  }

  const updated = await getProjectDesignAssets(projectSlug);

  return NextResponse.json({
    ok: true,
    assets: updated.ok ? updated.assets : [],
    message: "로고 자산을 삭제했습니다.",
  });
}
