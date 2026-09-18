import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

function getServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function asText(value: string | null) {
  return value?.trim() ?? "";
}

async function findProjectId(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id&slug=eq.${encodeURIComponent(projectSlug)}&deleted_at=is.null&limit=1`,
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

  const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}

export async function DELETE(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const projectSlug = asText(searchParams.get("projectSlug"));
  const articleId = asText(searchParams.get("articleId"));
  const blockId = asText(searchParams.get("blockId"));
  const headers = getServiceHeaders();

  if (!projectSlug || !articleId || !blockId) {
    return NextResponse.json({ ok: false, message: "삭제할 콘텐츠 블록 정보를 확인하세요." }, { status: 400 });
  }

  if (!headers) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 콘텐츠 블록 삭제를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const projectId = await findProjectId(projectSlug, headers);

  if (!projectId) {
    return NextResponse.json({ ok: false, message: "프로젝트를 찾지 못했습니다." }, { status: 404 });
  }

  const encodedBlockId = encodeURIComponent(blockId);
  const encodedArticleId = encodeURIComponent(articleId);
  const encodedProjectId = encodeURIComponent(projectId);
  const blockEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_content_blocks?id=eq.${encodedBlockId}&article_id=eq.${encodedArticleId}&project_id=eq.${encodedProjectId}&select=id,link_action_id`,
  );

  if (!blockEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase URL 설정을 확인하세요." }, { status: 503 });
  }

  const blockResponse = await fetch(blockEndpoint, {
    method: "DELETE",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    cache: "no-store",
  });

  if (!blockResponse.ok) {
    return NextResponse.json({ ok: false, message: "콘텐츠 블록을 삭제하지 못했습니다." }, { status: 500 });
  }

  const deletedRows = (await blockResponse.json().catch(() => [])) as Array<{
    id: string;
    link_action_id: string | null;
  }>;
  const deletedBlock = deletedRows[0] ?? null;

  if (!deletedBlock) {
    return NextResponse.json({ ok: false, message: "삭제할 콘텐츠 블록을 찾지 못했습니다." }, { status: 404 });
  }

  if (deletedBlock.link_action_id) {
    const linkEndpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_link_actions?id=eq.${encodeURIComponent(
        deletedBlock.link_action_id,
      )}&article_id=eq.${encodedArticleId}&project_id=eq.${encodedProjectId}`,
    );

    if (linkEndpoint) {
      await fetch(linkEndpoint, {
        method: "DELETE",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        cache: "no-store",
      });
    }
  }

  return NextResponse.json({ ok: true, message: "콘텐츠 블록을 삭제했습니다." });
}
