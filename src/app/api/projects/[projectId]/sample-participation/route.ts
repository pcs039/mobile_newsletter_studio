import { requireProjectApiAccess } from "@/lib/project-api-access";
import { stagingRequestAllowed } from "@/lib/staging-environment";
import { requireCanvaSameOrigin } from "@/lib/canva-request-origin";
import { hwaseongSampleSlug } from "@/lib/hwaseong-proposal-sample";
import { participationKinds, participationUuid } from "@/lib/hwaseong-participation-contract";
import { ParticipationError, participationProjectId, participationActor, participationView, participationReceipt, participationAdminData, manageParticipation, requireParticipationArticle, submitParticipation, verifyParticipationToken } from "@/lib/hwaseong-participation-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ projectId: string }> };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
async function access(request: Request, ctx: Context) {
  const { projectId } = await ctx.params;
  if (!stagingRequestAllowed(request) || projectId !== hwaseongSampleSlug) return new Response(null, { status: 404, headers });
  const a = await requireProjectApiAccess({ projectSlug: projectId });
  if (!a.ok) return a.response;
  if (a.project.id !== participationProjectId || a.project.statusCode === "archived") return new Response(null, { status: 403, headers });
  return a;
}
async function boundedBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ParticipationError(415, "JSON 요청만 허용합니다.");
  if (Number(request.headers.get("content-length")) > 16384) throw new ParticipationError(413, "입력 내용이 너무 큽니다.");
  const reader = request.body?.getReader(); if (!reader) throw new ParticipationError(400, "입력을 확인해 주세요.");
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 16384) { await reader.cancel(); throw new ParticipationError(413, "입력 내용이 너무 큽니다."); } chunks.push(value); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!data || typeof data !== "object" || Array.isArray(data)) throw Error(); return data as Record<string, unknown>; } catch { throw new ParticipationError(400, "입력을 확인해 주세요."); }
}
function error(e: unknown) { return e instanceof ParticipationError ? json({ ok: false, message: e.message }, e.status) : json({ ok: false, message: "결과를 확인하지 못했습니다. 자동 재제출하지 말고 저장 상태를 확인해 주세요." }, 503); }
export async function GET(request: Request, ctx: Context) {
  try {
    const a = await access(request, ctx); if (a instanceof Response) return a;
    const q = new URL(request.url).searchParams, actor = participationActor(a.user.id);
    if (q.get("admin") === "1") { if (a.user.role !== "admin") return json({ ok: false }, 403); return json({ ok: true, ...await participationAdminData() }); }
    const articleId = q.get("articleId") ?? ""; await requireParticipationArticle(articleId);
    if (q.has("requestId")) { const id = q.get("requestId")!; if (!participationUuid.test(id)) return json({ ok: false }, 400); return json({ ok: true, receipt: await participationReceipt(articleId, id, actor) }); }
    return json({ ok: true, ...await participationView(articleId, actor, a.user.role === "admin") });
  } catch (e) { return error(e); }
}
export async function POST(request: Request, ctx: Context) {
  try {
    const a = await access(request, ctx); if (a instanceof Response) return a;
    try { requireCanvaSameOrigin(request); } catch { return json({ ok: false, message: "현재 Staging 화면에서 다시 요청해 주세요." }, 403); }
    const input = await boundedBody(request), actor = participationActor(a.user.id);
    if (input.action !== undefined) {
      if (a.user.role !== "admin") return json({ ok: false }, 403);
      if (!["settings", "approve", "reject"].includes(String(input.action))) return json({ ok: false }, 400);
      if (input.action === "approve" && input.privacyChecked !== true) return json({ ok: false, message: "공개할 내용의 개인정보·부적절 표현 여부를 확인해 주세요." }, 400);
      if (input.action === "settings" ? typeof input.commentsEnabled !== "boolean" || (input.surveyId !== "" && !participationUuid.test(String(input.surveyId))) : !participationUuid.test(String(input.id))) return json({ ok: false }, 400);
      return json(await manageParticipation(input, actor));
    }
    if (!participationKinds.includes(input.kind as typeof participationKinds[number]) || !participationUuid.test(String(input.requestId)) || !participationUuid.test(String(input.articleId))) return json({ ok: false, message: "기사와 요청을 다시 확인해 주세요." }, 400);
    const articleId = input.articleId as string; await requireParticipationArticle(articleId);
    verifyParticipationToken(input.token, articleId, actor);
    return json({ ok: true, receipt: await submitParticipation(articleId, actor, input) }, 201);
  } catch (e) { return error(e); }
}
