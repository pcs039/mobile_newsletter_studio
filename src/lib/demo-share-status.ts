export const demoMessages = {
  INVALID_LINK: "유효한 시연 링크가 필요합니다. 전달받은 원본 링크로 다시 접속해 주세요.",
  SESSION_MISSING: "이 브라우저에서 시연 쿠키를 확인하지 못했습니다. 쿠키를 허용하거나 원본 링크를 Chrome·삼성 인터넷에서 열어 주세요.",
  SESSION_MISMATCH: "다른 시연 세션이 확인됐습니다. 전달받은 원본 링크에서 소식지를 다시 열어 주세요.",
  EXPIRED: "이 시연 링크의 사용 기간이 지났습니다. 담당자에게 문의해 주세요.",
  REVOKED: "관리자가 이 시연 링크를 회수했습니다. 담당자에게 문의해 주세요.",
  SOURCE_CHANGED: "공유 승인 이후 자료가 변경됐습니다. 담당자에게 링크 확인을 요청해 주세요.",
  SOURCE_UNAVAILABLE: "시연 자료 서버에 일시적으로 연결하지 못했습니다. 잠시 후 소식지 열기를 다시 눌러 주세요.",
  PROJECT_MISMATCH: "이 링크로 열람할 수 있는 시연 자료가 아닙니다.",
  ORIGIN_REJECTED: "현재 브라우저에서 세션 요청을 확인하지 못했습니다. 원본 링크를 외부 브라우저에서 열어 주세요.",
  MEDIA_PREPARATION_FAILED: "열람 권한은 확인됐지만 이미지·음성 준비 중 오류가 발생했습니다. 잠시 후 다시 열어 주세요.",
  RENDER_FAILED: "소식지 화면 준비 중 서버 오류가 발생했습니다. 잠시 후 다시 열어 주세요.",
  INVALID_RESPONSE: "서버가 예상한 형식의 응답을 반환하지 않았습니다. 외부 브라우저에서 원본 링크를 열거나 확인 번호를 담당자에게 알려 주세요.",
  NETWORK_ERROR: "서버 응답을 받지 못했습니다. 네트워크를 확인한 뒤 소식지 열기를 다시 눌러 주세요.",
} as const;
export type DemoFailureCode = keyof typeof demoMessages;
export function demoFailureCode(value: unknown, fallback: DemoFailureCode = "SOURCE_UNAVAILABLE"): DemoFailureCode {
  return typeof value === "string" && Object.hasOwn(demoMessages, value) ? value as DemoFailureCode : fallback;
}
export type DemoStage = "entry_get" | "origin_check" | "session_exchange" | "cookie_issue" | "cookie_read" | "token_validation" | "share_lookup" | "project_lookup" | "source_snapshot" | "approved_articles" | "media_prepare" | "render" | "session_check";

// Correlation only; the server issues an ID if an older WebView lacks randomUUID.
export function demoClientRequestId() {
  try { return globalThis.crypto?.randomUUID?.() ?? ""; } catch { return ""; }
}
