import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { getProjectSurveys, getValidatedSurveyAnswer, isProjectSurveyPubliclyActive, type ProjectSurveyItem } from "@/lib/newsletter-repository";
import { hwaseongSampleSlug } from "@/lib/hwaseong-proposal-sample";
import { sampleOrderRules } from "@/lib/hwaseong-sample-interest";
import { participationKinds, safeParticipationText, type ParticipationEntry, type ParticipationKind } from "@/lib/hwaseong-participation-contract";

export const participationProjectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
export class ParticipationError extends Error { constructor(public status: number, message: string) { super(message); } }
function secret() { const value = process.env.NEWSLETTER_AUTH_SECRET?.trim(); if (!value) throw new ParticipationError(503, "참여 기능 인증 설정을 확인해 주세요."); return value; }
export function participationActor(userId: string) { return createHmac("sha256", secret()).update(`sample-participation:${participationProjectId}:${userId}`).digest("hex"); }
export function participationToken(articleId: string, actor: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ articleId, actor, at: now })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyParticipationToken(token: unknown, articleId: string, actor: string, now = Date.now()) {
  try {
    if (typeof token !== "string" || token.length > 600) throw Error();
    const [payload, signature, extra] = token.split("."); const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature ?? "", "base64url");
    if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error();
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.articleId !== articleId || data.actor !== actor || typeof data.at !== "number" || !Number.isFinite(data.at) || now - data.at < 1200 || now - data.at > 20 * 60_000) throw Error();
  } catch { throw new ParticipationError(403, "화면을 다시 열고 내용을 확인한 뒤 제출해 주세요."); }
}
async function db<T>(path: string, init?: RequestInit): Promise<T> {
  if (!stagingEnvironmentConfigured()) throw new ParticipationError(404, "사용할 수 없는 기능입니다.");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), url = getSupabaseRestEndpoint(`/rest/v1/${path}`);
  if (!key || !url) throw new ParticipationError(503, "참여 저장소를 사용할 수 없습니다.");
  const r = await fetch(url, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!r.ok) {
    if (r.status === 409) throw new ParticipationError(409, "요청 ID 또는 참여 설정이 변경됐습니다. 저장 상태를 확인해 주세요.");
    if (r.status === 429) throw new ParticipationError(429, "잠시 후 다시 참여해 주세요. 연속 제출이 제한됩니다.");
    if ([400, 403, 404].includes(r.status)) throw new ParticipationError(r.status, "입력값 또는 참여 가능 상태를 다시 확인해 주세요.");
    throw new ParticipationError(503, "저장 결과를 확인할 수 없습니다. 자동 재제출하지 말고 상태를 확인해 주세요.");
  }
  return r.json();
}
export async function requireParticipationArticle(articleId: string) {
  if (!Object.hasOwn(sampleOrderRules, articleId)) throw new ParticipationError(404, "기사를 찾지 못했습니다.");
  const rows = await db<{ id: string }[]>(`newsletter_articles?select=id&id=eq.${articleId}&project_id=eq.${participationProjectId}&limit=1`);
  if (!rows.length) throw new ParticipationError(404, "기사를 찾지 못했습니다.");
}
type SurveySnapshot = { id: string; title: string; description: string | null; status: "draft" | "open" | "closed"; start_at: string | null; end_at: string | null; questions: { id: string; title: string; question_type: ProjectSurveyItem["questions"][number]["typeCode"]; options: string[]; is_required: boolean }[] };
function snapshotSurvey(s: SurveySnapshot | null): ProjectSurveyItem | null {
  if (!s) return null;
  return { id: s.id, title: s.title, description: s.description ?? "", kind: "설문", kindCode: "survey", status: s.status === "open" ? "진행 중" : s.status === "closed" ? "마감" : "작성 중", statusCode: s.status, respondentTarget: "비공개 시연 참여자", startAt: s.start_at ?? "", startAtRaw: s.start_at ?? "", endAt: s.end_at ?? "", endAtRaw: s.end_at ?? "", eventPrize: "", drawNote: "", responseCount: 0, linkedArticleTitles: [], questionCount: s.questions.length, updated: "", questions: s.questions.map((q,i) => ({ id:q.id, surveyId:s.id, order:i+1, title:q.title, type:q.question_type, typeCode:q.question_type, options:q.options, isRequired:q.is_required, updated:"" })) };
}
export async function participationSettings() {
  const rows = await db<{ comments_enabled: boolean; survey_id: string | null; survey_snapshot: SurveySnapshot | null }[]>(`newsletter_sample_participation_settings?select=comments_enabled,survey_id,survey_snapshot&project_id=eq.${participationProjectId}&limit=1`);
  return { survey_id: rows[0]?.survey_id ?? null, survey_snapshot: rows[0]?.survey_snapshot ?? null };
}
export async function participationView(articleId: string, actor: string, isAdmin: boolean) {
  const settings = await participationSettings();
  const candidate = snapshotSurvey(settings.survey_snapshot);
  const survey = candidate && isProjectSurveyPubliclyActive(candidate) ? candidate : null;
  return { survey, token: participationToken(articleId, actor), isAdmin };
}
export async function participationReceipt(articleId: string, id: string, actor: string) {
  const rows = await db<Pick<ParticipationEntry, "id" | "state" | "kind">[]>(`newsletter_sample_participation?select=id,state,kind&kind=in.(private,survey)&id=eq.${id}&project_id=eq.${participationProjectId}&article_id=eq.${articleId}&actor_key=eq.${actor}&limit=1`);
  return rows[0] && participationKinds.includes(rows[0].kind as ParticipationKind) ? rows[0] : null;
}
export async function submitParticipation(articleId: string, actor: string, input: Record<string, unknown>) {
  if (!participationKinds.includes(input.kind as ParticipationKind)) throw new ParticipationError(403, "사용할 수 없는 참여 유형입니다.");
  if (input.consent !== true || input.website !== "") throw new ParticipationError(400, "개인정보 제외 안내를 확인해 주세요.");
  const kind = input.kind as ParticipationKind;
  let body: string | null = null, surveyId: string | null = null;
  const answers: Record<string, string | string[]> = {};
  if (kind === "survey") {
    const view = await participationView(articleId, actor, false), survey = view.survey;
    if (!survey || input.surveyId !== survey.id || !input.answers || typeof input.answers !== "object" || Array.isArray(input.answers)) throw new ParticipationError(400, "설문을 다시 확인해 주세요.");
    const provided = input.answers as Record<string, unknown>;
    if (Object.keys(provided).some(id => !survey.questions.some(q => q.id === id))) throw new ParticipationError(400, "알 수 없는 문항입니다.");
    for (const q of survey.questions) {
      const checked = getValidatedSurveyAnswer({ id: q.id, title: q.title, question_type: q.typeCode, options: q.options, is_required: q.isRequired }, provided[q.id]);
      if (!checked.ok || (q.isRequired && (!checked.answer || checked.answer.length === 0))) throw new ParticipationError(400, "필수 응답과 선택지를 확인해 주세요.");
      const answer = checked.answer;
      if (typeof answer === "string" && answer) { try { answers[q.id] = safeParticipationText(answer, 500); } catch (e) { throw new ParticipationError(400, (e as Error).message); } }
      else if (Array.isArray(answer)) answers[q.id] = answer;
    }
    surveyId = survey.id;
  } else {
    try { body = safeParticipationText(input.body, 1000); } catch (e) { throw new ParticipationError(400, (e as Error).message); }
  }
  return db<{ id: string; state: string }>("rpc/sample_participation_submit", { method: "POST", body: JSON.stringify({ p_id: input.requestId, p_project_id: participationProjectId, p_article_id: articleId, p_actor_key: actor, p_kind: kind, p_body: body, p_answers: answers, p_survey_id: surveyId }) });
}
export async function participationAdminData() {
  const [settings, entries, surveyData] = await Promise.all([participationSettings(), db<ParticipationEntry[]>(`newsletter_sample_participation?select=id,article_id,kind,body,answers,survey_id,state,created_at&kind=in.(private,survey)&project_id=eq.${participationProjectId}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.desc&limit=200`), getProjectSurveys(hwaseongSampleSlug)]);
  return { settings, entries: entries.filter(e => participationKinds.includes(e.kind as ParticipationKind)), surveys: surveyData.surveys.map(s => s.id === settings.survey_id ? snapshotSurvey(settings.survey_snapshot) ?? s : s) };
}
export function manageParticipation(input: Record<string, unknown>, actor: string) {
  if (input.action !== "settings" || (input.commentsEnabled !== undefined && input.commentsEnabled !== false)) throw new ParticipationError(403, "사용할 수 없는 관리 요청입니다.");
  return db("rpc/sample_participation_manage", { method: "POST", body: JSON.stringify({ p_project_id: participationProjectId, p_action: "settings", p_id: null, p_enabled: false, p_survey_id: input.surveyId || null, p_reviewer_key: actor }) });
}
