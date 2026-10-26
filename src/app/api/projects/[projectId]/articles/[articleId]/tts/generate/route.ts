import { articleTtsVoices } from "@/lib/article-tts-audio";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import {
  articleTtsStatus,
  generateSafeArticleTts,
  ArticleTtsError,
} from "@/lib/article-tts-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ articleId: string; projectId: string }> };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function access(ctx: Context) {
  const { articleId, projectId } = await ctx.params;
  if (!uuid.test(articleId))
    return { response: json({ ok: false, code: "invalid_article" }, 400) };
  const a = await requireProjectApiAccess({ projectSlug: projectId });
  return a.ok
    ? { project: a.project, user: a.user, articleId: articleId.toLowerCase() }
    : { response: a.response };
}
function failure(error: unknown) {
  return json(
    {
      ok: false,
      state: "unknown",
      code:
        error instanceof ArticleTtsError ? error.code : "status_unavailable",
      message:
        error instanceof ArticleTtsError && error.code === "schema_not_ready"
          ? "안전한 음성 생성 기능의 DB 준비가 필요합니다."
          : "음성 상태를 확인하지 못했습니다. 생성 요청을 반복하지 말고 결과를 확인하세요.",
    },
    error instanceof ArticleTtsError ? error.status : 503,
  );
}
export async function GET(_request: Request, ctx: Context) {
  try {
    const a = await access(ctx);
    if (a.response) return a.response;
    return json({
      ok: true,
      ...(await articleTtsStatus(a.project!.id, a.articleId!)),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, ctx: Context) {
  try {
    const a = await access(ctx);
    if (a.response) return a.response;
    try {
      requireImageSameOrigin(request);
    } catch {
      return json({ ok: false, code: "origin_required" }, 403);
    }
    const text = await request.text();
    if (text.length > 2048)
      return json({ ok: false, code: "invalid_request" }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ ok: false, code: "invalid_request" }, 400);
    }
    if (
      !body ||
      !uuid.test(body.requestId ?? "") ||
      (body.previousRequestId !== null &&
        !uuid.test(body.previousRequestId ?? "")) ||
      typeof body.force !== "boolean" ||
      !articleTtsVoices.includes(body.voice)
    )
      return json({ ok: false, code: "invalid_request" }, 400);
    const result = await generateSafeArticleTts(
      a.project!.id,
      a.articleId!,
      a.user!,
      {
        requestId: body.requestId.toLowerCase(),
        previousRequestId: body.previousRequestId?.toLowerCase() ?? null,
        force: body.force,
        voice: body.voice,
      },
    );
    return json(
      {
        ...result,
        message: result.ok
          ? result.reused
            ? "기존 정상 음성을 재사용합니다."
            : "기사 음성이 준비되었습니다."
          : result.state === "processing"
            ? "음성을 생성 중입니다. 결과 확인을 눌러 주세요."
            : "음성 생성이 완료되지 않았습니다. 기존 음성은 유지됩니다. 결과 확인 후 다시 생성할 수 있습니다.",
      },
      result.httpStatus ?? (result.state === "processing" ? 202 : 200),
    );
  } catch (error) {
    return failure(error);
  }
}
