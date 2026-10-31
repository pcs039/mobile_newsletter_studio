import { NextResponse } from "next/server";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getManualAudioLinkState, updateProjectAudioArticleLink, ManualAudioLinkError,
  manualAudioHeaders, manualAudioUuid } from "@/lib/manual-audio-link";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: manualAudioHeaders });
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
function failure(error: unknown) {
  return error instanceof ManualAudioLinkError
    ? json({ ok: false, code: error.code, message: error.message, uncertain: error.uncertain }, error.status)
    : json({ ok: false, code: "request_failed", message: "음성 연결 상태를 확인하지 못했습니다." }, 500);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectSlug = params.get("projectSlug")?.trim();
  const audioId = params.get("audioId")?.trim() || "";
  if (!projectSlug || !manualAudioUuid.test(audioId)) return json({ ok: false, message: "음성과 프로젝트를 확인해 주세요." }, 400);
  const access = await requireProjectApiAccess({ projectSlug });
  if (!access.ok) return access.response;
  try { return json(await getManualAudioLinkState({ projectId: access.project.id, audioId, user: access.user })); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try { requireImageSameOrigin(request); }
  catch { return json({ ok: false, message: "현재 관리자 화면에서 요청해 주세요." }, 403); }
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const projectSlug = text(payload?.projectSlug);
  const audioId = text(payload?.audioId);
  const articleId = payload?.articleId === null ? null : text(payload?.articleId);
  const revision = text(payload?.expectedRevision);
  if (!projectSlug || !manualAudioUuid.test(audioId) || (articleId !== null && !manualAudioUuid.test(articleId)) || !/^[a-f0-9]{32}$/.test(revision)) {
    return json({ ok: false, message: "최신 음성 상태를 불러온 뒤 저장해 주세요." }, 400);
  }
  const changes: Record<string, string> = {};
  const limits: Record<string, number> = { transcriptText: 100000, transcriptType: 32, transcriptReviewStatus: 32, transcriptReviewNote: 5000 };
  for (const [key, limit] of Object.entries(limits)) {
    if (!Object.hasOwn(payload!, key)) continue;
    if (typeof payload![key] !== "string" || (payload![key] as string).length > limit) return json({ ok: false, message: "대본 입력값을 확인해 주세요." }, 400);
    changes[key] = text(payload![key]);
  }
  if ((changes.transcriptType !== undefined && !["article_original", "summary_script", "custom_script"].includes(changes.transcriptType)) ||
      (changes.transcriptReviewStatus !== undefined && !["pending", "approved", "needs_revision"].includes(changes.transcriptReviewStatus))) {
    return json({ ok: false, message: "대본 검수 설정을 확인해 주세요." }, 400);
  }
  const access = await requireProjectApiAccess({ projectSlug });
  if (!access.ok) return access.response;
  try {
    const result = await updateProjectAudioArticleLink({ projectId: access.project.id, audioId, user: access.user,
      articleId, expectedRevision: revision, changes });
    return json({ ...result, message: result.duplicate ? "이미 같은 연결과 대본이 저장되어 있습니다." : "음성 연결과 대본을 함께 저장했습니다." });
  } catch (error) { return failure(error); }
}
