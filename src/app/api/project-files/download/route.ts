import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const downloadableBuckets = new Set(["mobile-assets"]);

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
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

function getStorageHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function isSafeStoragePath(path: string) {
  return path.length > 0 && !path.includes("..") && !path.startsWith("/") && !path.endsWith("/");
}

function sanitizeFileName(value: string) {
  const fallbackName = "newsletter-image";
  const fileName = value.split("/").pop()?.trim() || fallbackName;

  return fileName.replace(/[^\w가-힣 ._-]/g, "_") || fallbackName;
}

async function findProjectBySlug(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,cover_image_path&slug=eq.${encodeURIComponent(
      projectSlug,
    )}&deleted_at=is.null&limit=1`,
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

  const rows = (await response.json().catch(() => [])) as Array<{ id: string; cover_image_path: string | null }>;

  return rows[0] ?? null;
}

async function isProjectMobileAsset(projectId: string, path: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_assets?select=id&project_id=eq.${encodeURIComponent(
      projectId,
    )}&file_path=eq.${encodeURIComponent(path)}&limit=1`,
  );

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function GET(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket")?.trim() ?? "";
  const path = searchParams.get("path")?.trim() ?? "";
  const projectSlug = searchParams.get("projectSlug")?.trim() ?? "";
  const requestedFileName = searchParams.get("fileName")?.trim() ?? "";
  const serviceHeaders = getServiceHeaders();
  const storageHeaders = getStorageHeaders();

  if (!downloadableBuckets.has(bucket) || !isSafeStoragePath(path) || !projectSlug) {
    return NextResponse.json({ ok: false, message: "다운로드할 파일 정보를 확인하세요." }, { status: 400 });
  }

  if (!serviceHeaders || !storageHeaders) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 파일 다운로드를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const project = await findProjectBySlug(projectSlug, serviceHeaders);

  if (!project) {
    return NextResponse.json({ ok: false, message: "프로젝트를 찾지 못했습니다." }, { status: 404 });
  }

  const isCoverImage = project.cover_image_path === path;
  const isAssetImage = await isProjectMobileAsset(project.id, path, serviceHeaders);

  if (!isCoverImage && !isAssetImage) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 이미지 파일이 아닙니다." }, { status: 404 });
  }

  const storageEndpoint = getSupabaseStorageEndpoint(`/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`);

  if (!storageEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase Storage URL 설정을 확인하세요." }, { status: 503 });
  }

  const storageResponse = await fetch(storageEndpoint, {
    headers: storageHeaders,
    cache: "no-store",
  });

  if (!storageResponse.ok || !storageResponse.body) {
    return NextResponse.json(
      { ok: false, message: "파일을 다운로드하지 못했습니다." },
      { status: storageResponse.status || 500 },
    );
  }

  const fileName = sanitizeFileName(requestedFileName || path);

  return new NextResponse(storageResponse.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Type": storageResponse.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
}
