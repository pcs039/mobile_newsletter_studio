import { NextResponse } from "next/server";
import { updateProjectAudioArticleLink } from "@/lib/newsletter-repository";
import { requireProjectApiAccess } from "@/lib/project-api-access";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : status === "invalid_input"
        ? 400
        : httpStatus ?? 500;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const articleId = asText(payload?.articleId) || null;
  const audioId = asText(payload?.audioId);
  const projectSlug = asText(payload?.projectSlug);
  const transcriptReviewNote = asText(payload?.transcriptReviewNote);
  const transcriptReviewStatus = asText(payload?.transcriptReviewStatus);
  const transcriptText = asText(payload?.transcriptText);
  const transcriptType = asText(payload?.transcriptType);
  const unlink = asBoolean(payload?.unlink);

  if (!audioId || !projectSlug) {
    return NextResponse.json(
      { ok: false, message: "연결할 음성 파일과 프로젝트 정보를 확인하세요." },
      { status: 400 },
    );
  }

  const access = await requireProjectApiAccess({ projectSlug });

  if (!access.ok) {
    return access.response;
  }

  const result = await updateProjectAudioArticleLink({
    articleId,
    audioId,
    projectSlug,
    unlink,
    transcriptReviewNote,
    transcriptReviewStatus,
    transcriptText,
    transcriptType,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result);
}
