import { NextResponse } from "next/server";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

type PublicEbookPageImageRouteProps = {
  params: Promise<{
    pageId: string;
    slug: string;
  }>;
};

type PublicEbookProjectRow = {
  id: string;
  status: string;
};

type PublicEbookPageRow = {
  id: string;
  image_path: string | null;
  project_id: string;
};

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function getServiceHeaders() {
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

async function findPublishedProject(slug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,status&slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&limit=1`,
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

  const rows = (await response.json().catch(() => [])) as PublicEbookProjectRow[];
  const project = rows[0] ?? null;

  return project?.status === "published" ? project : null;
}

async function findProjectPage(projectId: string, pageId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,project_id,image_path&project_id=eq.${encodeURIComponent(
      projectId,
    )}&id=eq.${encodeURIComponent(pageId)}&limit=1`,
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

  const rows = (await response.json().catch(() => [])) as PublicEbookPageRow[];

  return rows[0] ?? null;
}

export async function GET(_request: Request, { params }: PublicEbookPageImageRouteProps) {
  const { pageId, slug } = await params;
  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 e-book 이미지를 표시할 수 있습니다." },
      { status: 503 },
    );
  }

  const project = await findPublishedProject(slug, headers);

  if (!project) {
    return NextResponse.json({ ok: false, message: "공개된 e-book을 찾지 못했습니다." }, { status: 404 });
  }

  const page = await findProjectPage(project.id, pageId, headers);
  const imagePath = page?.image_path?.trim() ?? "";

  if (!page || !isSafeStoragePath(imagePath)) {
    return NextResponse.json({ ok: false, message: "페이지 이미지 경로를 확인하세요." }, { status: 404 });
  }

  const storageEndpoint = getSupabaseStorageEndpoint(`/object/page-images/${encodeStoragePath(imagePath)}`);

  if (!storageEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase Storage URL 설정을 확인하세요." }, { status: 503 });
  }

  const response = await fetch(storageEndpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { ok: false, message: "페이지 이미지를 불러오지 못했습니다." },
      { status: response.status || 500 },
    );
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Disposition": "inline",
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
}
