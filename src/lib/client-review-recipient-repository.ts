import "server-only";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { parseClientReviewRecipientEmail } from "@/lib/client-review-recipient";

// Deliberately separate from shared/public project selectors and mappers.
export async function clientReviewRecipient(projectId: string, change?: { email: unknown }) {
  const parsed = change ? parseClientReviewRecipientEmail(change.email) : null;
  if (parsed && !parsed.ok) return { ok: false, status: 400, message: "잘못된 이메일 형식입니다. 254자 이하의 이메일을 입력해 주세요." };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const config = getSupabaseConfigStatus();
  const endpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_projects?select=id,client_review_recipient_email&id=eq.${encodeURIComponent(projectId)}&deleted_at=is.null`);
  if (!key || !config.anonKey || !endpoint) return { ok: false, status: 503, message: "서버 설정을 확인해 주세요." };
  try {
    const response = await fetch(endpoint, {
      method: change ? "PATCH" : "GET", cache: "no-store",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
      ...(parsed?.ok ? { body: JSON.stringify({ client_review_recipient_email: parsed.email }) } : {}),
    });
    const body = await response.text();
    if (!response.ok) {
      if (body.includes("client_review_recipient_email") && (body.includes("42703") || body.includes("PGRST204"))) {
        return { ok: !change, status: change ? 503 : 200, email: null, supported: false, message: "기관 검토 이메일 등록 기능이 아직 준비 중입니다." };
      }
      return { ok: false, status: 500, message: "기관 검토 이메일을 처리하지 못했습니다." };
    }
    const rows = JSON.parse(body) as { client_review_recipient_email: string | null }[];
    if (!rows[0]) return { ok: false, status: 404, message: "프로젝트를 찾지 못했습니다." };
    return { ok: true, status: 200, supported: true, email: rows[0].client_review_recipient_email, message: change ? "저장 완료" : "조회 완료" };
  } catch {
    // Do not log recipient values or upstream response bodies.
    return { ok: false, status: 500, message: "기관 검토 이메일 처리 중 오류가 발생했습니다." };
  }
}
