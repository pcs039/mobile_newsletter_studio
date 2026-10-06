import { NextResponse } from "next/server";
import { deleteProjectArticleBlockAtomic } from "@/lib/newsletter-repository";
import { requireProjectApiAccess } from "@/lib/project-api-access";

export const dynamic = "force-dynamic";

function asText(value: string | null) {
  return value?.trim() ?? "";
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectSlug = asText(searchParams.get("projectSlug"));
  const articleId = asText(searchParams.get("articleId"));
  const blockId = asText(searchParams.get("blockId"));

  if (!projectSlug || !articleId || !blockId) {
    return NextResponse.json({ ok: false, message: "삭제할 콘텐츠 블록 정보를 확인하세요." }, { status: 400 });
  }

  const access = await requireProjectApiAccess({ projectSlug });

  if (!access.ok) {
    return access.response;
  }

  const projectId = access.project.id;

  if (!projectId) {
    return NextResponse.json({ ok: false, message: "프로젝트를 찾지 못했습니다." }, { status: 404 });
  }

  const result = await deleteProjectArticleBlockAtomic(projectId, articleId, blockId);

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured" || result.status === "migration_required"
          ? 503
          : result.status === "not_found"
            ? 404
            : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json({ ok: true, message: "콘텐츠 블록을 삭제했습니다." });
}
