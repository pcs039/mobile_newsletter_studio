import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const allowedBuckets = new Set(["mobile-assets", "audio-files", "fonts", "brand-assets"]);

type ProjectFileReference = {
  project_id: string;
};

type ProjectReference = {
  id: string;
  status: string;
};

type PublicFileAccess =
  | { ok: true; cacheControl: string }
  | { ok: false; response: NextResponse };

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
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

async function fetchRows<T>(path: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(path);

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

  return (await response.json()) as T[];
}

async function findProjectReference(projectId: string, headers: Record<string, string>) {
  const rows = await fetchRows<ProjectReference>(
    `/rest/v1/newsletter_projects?select=id,status&id=eq.${encodeURIComponent(projectId)}&deleted_at=is.null&limit=1`,
    headers,
  );

  return rows?.[0] ?? null;
}

async function findProjectFileReference(
  bucket: string,
  path: string,
  headers: Record<string, string>,
) {
  const encodedPath = encodeURIComponent(path);

  if (bucket === "mobile-assets") {
    const coverRows = await fetchRows<ProjectReference>(
      `/rest/v1/newsletter_projects?select=id,status&cover_image_path=eq.${encodedPath}&deleted_at=is.null&limit=1`,
      headers,
    );

    if (coverRows?.[0]) {
      return coverRows[0];
    }

    const assetRows = await fetchRows<ProjectFileReference>(
      `/rest/v1/newsletter_assets?select=project_id&file_path=eq.${encodedPath}&limit=1`,
      headers,
    );

    return assetRows?.[0]
      ? findProjectReference(assetRows[0].project_id, headers)
      : null;
  }

  const table = bucket === "audio-files" ? "newsletter_audio_files" : "newsletter_project_design_assets";
  const pathColumn = bucket === "audio-files" ? "file_path" : "storage_path";
  const activeFilter = bucket === "brand-assets" ? "&is_active=eq.true" : "";
  const rows = await fetchRows<ProjectFileReference>(
    `/rest/v1/${table}?select=project_id&${pathColumn}=eq.${encodedPath}${activeFilter}&limit=1`,
    headers,
  );

  return rows?.[0]
    ? findProjectReference(rows[0].project_id, headers)
    : null;
}

async function authorizePublicFile(
  bucket: string,
  path: string,
  headers: Record<string, string>,
): Promise<PublicFileAccess> {
  if (bucket === "fonts") {
    const rows = await fetchRows<{ id: string }>(
      `/rest/v1/font_assets?select=id&font_file_path=eq.${encodeURIComponent(path)}&is_active=eq.true&webfont_allowed=eq.true&limit=1`,
      headers,
    );

    return rows?.[0]
      ? { ok: true, cacheControl: "public, max-age=300" }
      : {
          ok: false,
          response: NextResponse.json({ ok: false, message: "파일을 찾지 못했습니다." }, { status: 404 }),
        };
  }

  const project = await findProjectFileReference(bucket, path, headers);

  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "파일을 찾지 못했습니다." }, { status: 404 }),
    };
  }

  if (project.status === "published") {
    return { ok: true, cacheControl: "public, max-age=300" };
  }

  const access = await requireProjectApiAccess({ projectId: project.id });

  if (!access.ok) {
    if (access.response.status === 401) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, message: "파일을 찾지 못했습니다." }, { status: 404 }),
      };
    }

    return access;
  }

  return { ok: true, cacheControl: "private, no-store" };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket")?.trim() ?? "";
  const path = searchParams.get("path")?.trim() ?? "";
  const headers = getStorageHeaders();

  if (!allowedBuckets.has(bucket) || !isSafeStoragePath(path)) {
    return NextResponse.json({ ok: false, message: "파일 경로를 확인하세요." }, { status: 400 });
  }

  if (!headers) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 파일 미리보기를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const access = await authorizePublicFile(bucket, path, headers);

  if (!access.ok) {
    return access.response;
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`);

  if (!endpoint) {
    return NextResponse.json({ ok: false, message: "Supabase Storage URL 설정을 확인하세요." }, { status: 503 });
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { ok: false, message: "Supabase Storage에서 파일을 불러오지 못했습니다." },
      { status: response.status || 500 },
    );
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Cache-Control": access.cacheControl,
      "Content-Disposition": "inline",
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
}
