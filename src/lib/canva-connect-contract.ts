import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { CanvaPreviewField, CanvaTemplate } from "@/lib/canva-template";

export const canvaScopes = ["design:content:read", "design:content:write", "design:meta:read", "brandtemplate:content:read"] as const;
export class CanvaConnectError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function matchesState(state: string, expected: string | null) {
  if (!expected || !/^[A-Za-z0-9_-]{43}$/.test(state)) return false;
  const left = Buffer.from(digest(state)); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function makeAuthorization(clientId: string, redirectUri: string) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://www.canva.com/api/oauth/authorize");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", code_challenge_method: "s256", code_challenge: challenge, state, scope: canvaScopes.join(" ") }).toString();
  return { state, verifier, stateHash: digest(state), url: url.toString() };
}
export function validateRedirect(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/api/canva/callback" || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new CanvaConnectError(503, "Canva callback 서버 설정을 확인해 주세요.");
  return url.toString();
}
export function textAutofill(template: CanvaTemplate, fields: CanvaPreviewField[], response: unknown, title: string) {
  const dataset = response && typeof response === "object" && "dataset" in response ? (response as { dataset: unknown }).dataset : null;
  if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) throw new CanvaConnectError(409, "Canva 템플릿의 자동 입력 항목이 변경되었습니다. 템플릿 연결을 다시 확인하세요.");
  const schema = dataset as Record<string, { type?: unknown }>;
  const data: Record<string, { type: "text"; text: string }> = Object.create(null);
  for (const mapping of template.fieldMappings) {
    if (!Object.hasOwn(schema, mapping.field) || schema[mapping.field]?.type !== mapping.type) throw new CanvaConnectError(409, "Canva 템플릿의 자동 입력 항목이 변경되었습니다. 템플릿 연결을 다시 확인하세요.");
    if (mapping.type === "image") continue;
    const field = fields.find(f => f.field === mapping.field && f.type === "text");
    if (!field || field.status !== "ready" || !field.text?.trim()) throw new CanvaConnectError(409, `${mapping.field} 값을 찾지 못했습니다.`);
    if (field.text.length > 10000) throw new CanvaConnectError(400, "자동 입력 글자는 항목당 10,000자 이하로 줄여 주세요.");
    data[mapping.field] = { type: "text", text: field.text };
  }
  // Dataset has no required flag contract. Block image datasets rather than assume omission is safe.
  if (Object.values(schema).some(f => f?.type === "image")) throw new CanvaConnectError(409, "이미지 자동 입력은 다음 단계에서 지원합니다. 이번에는 글자 항목만 있는 템플릿을 사용하세요.");
  if (!Object.keys(data).length) throw new CanvaConnectError(409, "자동 입력할 글자 항목이 없습니다.");
  return { type: template.templateType === "brand_template" ? "create_from_brand_template" : "create_from_design", ...(template.templateType === "brand_template" ? { brand_template_id: template.externalId } : { design_id: template.externalId }), title: title.trim().slice(0,255) || "모바일 소식지", data };
}
export function safeCanvaUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "www.canva.com" && !u.username && !u.password ? u.toString() : null; } catch { return null; }
}
export type CanvaJob = { id: string; status: "in_progress" | "success" | "failed"; designId?: string; editUrl?: string; viewUrl?: string };
export function readCanvaJob(value: unknown): CanvaJob {
  const job = value && typeof value === "object" && "job" in value ? (value as {job: unknown}).job : null;
  if (!job || typeof job !== "object") throw new CanvaConnectError(502, "Canva 작업 응답을 확인하지 못했습니다.");
  const j = job as { id?: unknown; status?: unknown; result?: { type?: unknown; design?: { id?: unknown; url?: unknown; urls?: { edit_url?: unknown; view_url?: unknown } } } };
  if (typeof j.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(j.id) || !["in_progress", "success", "failed"].includes(j.status as string)) throw new CanvaConnectError(502, "Canva 작업 응답을 확인하지 못했습니다.");
  if (j.status !== "success") return { id: j.id, status: j.status as "in_progress" | "failed" };
  const d = j.result?.design;
  const editUrl = safeCanvaUrl(d?.urls?.edit_url) || safeCanvaUrl(d?.url);
  const viewUrl = safeCanvaUrl(d?.urls?.view_url);
  if (j.result?.type !== "create_design" || typeof d?.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(d.id) || (!editUrl && !viewUrl)) throw new CanvaConnectError(502, "Canva 결과 링크를 확인하지 못했습니다.");
  return { id: j.id, status: "success", designId: d.id, ...(editUrl ? {editUrl} : {}), ...(viewUrl ? {viewUrl} : {}) };
}
