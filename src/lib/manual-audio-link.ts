import "server-only";
import type { AppUser } from "@/lib/app-auth";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";

export type ManualAudioLinkState = {
  revision: string;
  articleId: string | null;
  transcriptText: string;
  transcriptType: string;
  transcriptReviewStatus: string;
  transcriptReviewNote: string;
};
export type ManualAudioLinkInput = { projectId: string; audioId: string; user: AppUser };
export class ManualAudioLinkError extends Error {
  constructor(public status: number, public code: string, message: string, public uncertain = false) { super(message); }
}
export const manualAudioUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const manualAudioHeaders = { "Cache-Control": "private, no-store" };

async function call(input: ManualAudioLinkInput, articleId: string | null, revision: string | null, changes: Record<string, string> | null) {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/rpc/manage_newsletter_manual_audio_link");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!endpoint || !key) throw new ManualAudioLinkError(503, "not_configured", "음성 연결 서버 설정을 확인해 주세요.");
  let response: Response;
  let text: string;
  try {
    response = await fetch(endpoint, {
      method: "POST", cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_project_id: input.projectId, p_audio_id: input.audioId, p_article_id: articleId,
        p_expected_revision: revision, p_changes: changes,
        p_actor_id: input.user.id, p_actor_name: input.user.name, p_actor_role: input.user.role }),
    });
    text = await response.text();
  } catch {
    throw new ManualAudioLinkError(502, "result_unknown", changes === null ? "현재 음성 상태를 불러오지 못했습니다. 다시 조회해 주세요." : "저장 응답을 확인하지 못했습니다. 같은 저장 요청으로 결과를 확인해 주세요.", changes !== null);
  }
  if (!response.ok) {
    if (/PGRST202|42883/.test(text)) throw new ManualAudioLinkError(503, "schema_required", "안전한 음성 연결 기능의 DB 적용이 필요합니다. 기존 연결은 변경하지 않았습니다.");
    if (/manual_audio_forbidden|service_role_required/.test(text)) throw new ManualAudioLinkError(403, "forbidden", "음성 연결을 변경할 권한이 없습니다.");
    if (/manual_audio_not_found/.test(text)) throw new ManualAudioLinkError(404, "not_found", "같은 프로젝트의 기사와 업로드 음성을 선택해 주세요.");
    if (/manual_audio_ai_selected/.test(text)) throw new ManualAudioLinkError(409, "ai_selected", "이 기사는 AI 음성을 사용 중입니다. 기사 작성 화면에서 직접 제작 음성으로 명시적으로 변경한 후 연결해 주세요.");
    if (/manual_audio_conflict/.test(text)) throw new ManualAudioLinkError(409, "conflict", "기사 또는 음성 연결이 변경됐습니다. 최신 상태를 불러온 뒤 다시 확인해 주세요.");
    if (/manual_audio_invalid/.test(text)) throw new ManualAudioLinkError(400, "invalid_input", "음성 연결과 대본 입력값을 확인해 주세요.");
    throw new ManualAudioLinkError(502, "result_unknown", "처리 결과를 확인하지 못했습니다. 같은 저장 요청으로 확인해 주세요.", changes !== null);
  }
  try {
    const result = JSON.parse(text) as { ok?: boolean; duplicate?: boolean; state?: ManualAudioLinkState };
    if (result.ok !== true || (changes === null
      ? !result.state || !/^[a-f0-9]{32}$/.test(result.state.revision) ||
        !(result.state.articleId === null || manualAudioUuid.test(result.state.articleId)) ||
        ![result.state.transcriptText, result.state.transcriptType, result.state.transcriptReviewStatus, result.state.transcriptReviewNote].every(value => typeof value === "string")
      : typeof result.duplicate !== "boolean")) throw new Error("invalid response");
    return result;
  } catch {
    throw new ManualAudioLinkError(502, "result_unknown", "처리 응답이 불명확합니다. 같은 저장 요청으로 확인해 주세요.", changes !== null);
  }
}

export function getManualAudioLinkState(input: ManualAudioLinkInput) { return call(input, null, null, null); }
export function updateProjectAudioArticleLink(input: ManualAudioLinkInput & {
  articleId: string | null; expectedRevision: string; changes: Record<string, string>;
}) { return call(input, input.articleId, input.expectedRevision, input.changes); }
