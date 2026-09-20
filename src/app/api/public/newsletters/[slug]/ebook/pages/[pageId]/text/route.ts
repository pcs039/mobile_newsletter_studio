import { NextResponse } from "next/server";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

type PublicEbookPageTextRouteProps = {
  params: Promise<{
    pageId: string;
    slug: string;
  }>;
};

type PublicEbookProjectRow = {
  id: string;
  status: string;
};

type PublicEbookPageTextRow = {
  id: string;
  page_number: number;
  project_id: string;
  search_text: string | null;
};

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

async function findProjectPageText(projectId: string, pageId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,project_id,page_number,search_text&project_id=eq.${encodeURIComponent(
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

  const rows = (await response.json().catch(() => [])) as PublicEbookPageTextRow[];

  return rows[0] ?? null;
}

export async function GET(_request: Request, { params }: PublicEbookPageTextRouteProps) {
  const { pageId, slug } = await params;
  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 읽기 텍스트를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const project = await findPublishedProject(slug, headers);

  if (!project) {
    return NextResponse.json({ ok: false, message: "공개된 e-book을 찾지 못했습니다." }, { status: 404 });
  }

  const page = await findProjectPageText(project.id, pageId, headers);

  if (!page) {
    return NextResponse.json({ ok: false, message: "페이지를 찾지 못했습니다." }, { status: 404 });
  }

  const text = page.search_text?.trim() ?? "";

  return NextResponse.json({
    hasText: text.length > 0,
    pageId: page.id,
    pageNumber: page.page_number,
    text,
  });
}
