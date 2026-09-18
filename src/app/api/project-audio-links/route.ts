import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { updateProjectAudioArticleLink } from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const articleId = asText(payload?.articleId) || null;
  const audioId = asText(payload?.audioId);
  const projectSlug = asText(payload?.projectSlug);

  if (!audioId || !projectSlug) {
    return NextResponse.json(
      { ok: false, message: "연결할 음성 파일과 프로젝트 정보를 확인하세요." },
      { status: 400 },
    );
  }

  const result = await updateProjectAudioArticleLink({
    articleId,
    audioId,
    projectSlug,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result);
}
