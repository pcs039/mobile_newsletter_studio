import "server-only";
import type { AppUser } from "@/lib/app-auth";
import type { ProjectWorkspaceInfo } from "@/lib/newsletter-repository";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";

export type PublicationMode = "author_direct" | "client_review";
export type PublicationHistory = { requestKey: string; actorId: string; mode: string; action: string; status: string; createdAt: string; publishedAt: string | null };
export type PublicationPreparation = {
  revision: string; status: string; publishedAt: string | null; eligibleArticles: number;
  excludedArticles: number; ebookReady: boolean; canPublish: boolean; canReviewPublish: boolean; warnings: string[]; history: PublicationHistory[];
};
export type PublicationReceipt = {
  ok: true; project_id: string; slug: string; title: string; status: string; current_status: string;
  published_at: string | null; request_key: string; mode: string; action: string; duplicate: boolean;
};
export class PublicationError extends Error {
  constructor(public status: number, message: string, public uncertain = false) { super(message); }
}
export const publicationHeaders = { "Cache-Control": "private, no-store" };
export const publicationUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const url = getSupabaseRestEndpoint(`/rest/v1/rpc/${name}`);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new PublicationError(503, "발행 서버 설정을 확인하세요.");
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", cache: "no-store", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch { throw new PublicationError(502, "처리 결과를 확인하지 못했습니다. 같은 요청으로 결과를 다시 확인하세요.", true); }
  let text: string;
  try { text = await response.text(); } catch { throw new PublicationError(502, "응답이 중단되었습니다. 같은 요청으로 결과를 확인하세요.", true); }
  if (!response.ok) {
    if (response.status === 404 || /PGRST202|42P01/.test(text)) throw new PublicationError(503, "직접 발행 기능을 준비 중입니다. 관리자에게 문의하세요.");
    if (/publication_forbidden|service_role_required/.test(text)) throw new PublicationError(403, "이 프로젝트를 발행할 권한이 없습니다.");
    if (/publication_not_found/.test(text)) throw new PublicationError(404, "프로젝트를 찾지 못했습니다.");
    if (/client_review_approval_required|client_review_project_not_ready/.test(text)) throw new PublicationError(409, "기관 승인 완료 후 기관 검수 경로로 발행할 수 있습니다.");
    if (/publication_not_ready/.test(text)) throw new PublicationError(409, "공개 가능한 콘텐츠가 없습니다. 저장본을 확인하세요.");
    if (/publication_invalid/.test(text)) throw new PublicationError(400, "공개 자료 확인과 올바른 발행 요청이 필요합니다.");
    if (/publication_stale|publication_.*conflict|publication_archived|publication_not_published/.test(text)) throw new PublicationError(409, "프로젝트 상태나 내용이 변경되었습니다. 공개 대상을 다시 확인하세요.");
    throw new PublicationError(502, "처리 결과를 확인하지 못했습니다. 같은 요청으로 결과를 다시 확인하세요.", true);
  }
  try { return JSON.parse(text) as T; }
  catch { throw new PublicationError(502, "처리 응답을 확인하지 못했습니다. 같은 요청으로 다시 확인하세요.", true); }
}
export function prepareProjectPublication(projectId: string) {
  return rpc<PublicationPreparation>("project_publication_state", { p_project_id: projectId });
}
export async function transitionProjectPublication(project: ProjectWorkspaceInfo, user: AppUser, input: {
  requestKey: unknown; action: unknown; mode: unknown; revision: unknown; confirmed: unknown; targetStatus?: unknown;
}) {
  if (typeof input.requestKey !== "string" || !publicationUuid.test(input.requestKey) || typeof input.revision !== "string" || !/^[a-f0-9]{32}$/.test(input.revision) || input.confirmed !== true || !["publish", "unpublish", "status"].includes(String(input.action)) || !["author_direct", "client_review", "legacy"].includes(String(input.mode))) {
    throw new PublicationError(400, "공개 자료 확인과 발행 요청을 확인하세요.");
  }
  return rpc<PublicationReceipt>("transition_project_publication_atomic", {
    p_project_id: project.id, p_actor_id: user.id, p_actor_name: user.name, p_actor_role: user.role,
    p_expected_assignee: project.assigneeName || null, p_request_key: input.requestKey,
    p_action: input.action, p_mode: input.mode, p_expected_revision: input.revision,
    p_confirmed: input.confirmed, p_target_status: input.targetStatus ?? null,
  });
}
