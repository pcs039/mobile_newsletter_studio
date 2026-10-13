// Client-safe readiness contract. Provider credentials and prepared payloads
// stay on the server; the confirmation binds the saved input for five minutes.
import type { CanvaAutofillExecutionResult } from "@/lib/canva-autofill-execution";
export type CanvaRecommendationPreparation = {
  ok: true;
  supported: boolean;
  connected: boolean;
  isReady: boolean;
  visualReady: boolean;
  stagingAllowed: boolean;
  missingFields: string[];
  visualIssues: Array<{ field: string; fitStatus: "adjusted" | "overflow" }>;
  confirmation?: string;
};
export const canvaFieldLabels: Record<string, string> = {
  TITLE: "제목", EVENT_DATE: "행사 일시", EVENT_PLACE: "행사 장소", EVENT_SUMMARY: "요약", CTA: "행동 버튼", MAIN_IMAGE: "대표 이미지",
};
export function canProduceCanva(value: CanvaRecommendationPreparation | null) {
  return !!value?.stagingAllowed && value.supported && value.connected && value.isReady && value.visualReady && !!value.confirmation;
}
export function canvaExecutionMessage(result: CanvaAutofillExecutionResult) {
  if (result.status === "created") return result.duplicate ? "기존 Canva 디자인을 재사용했습니다." : "Canva 디자인 생성 완료";
  if (result.status === "in_progress") return "제작 중";
  if (result.status === "auth_required") return "Canva 연결 필요 · 프로젝트 디자인 화면에서 Canva에 다시 연결해 주세요.";
  if (result.status === "dataset_mismatch") return "템플릿 정보를 다시 확인해야 합니다.";
  if (result.status === "visual_not_ready" || result.status === "not_ready") return "내용 확인 필요";
  return "제작 실패 · 결과를 확인하지 못했습니다. 자동으로 다시 제작하지 않습니다.";
}
export function canvaEditLink(value: string | undefined) {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" && url.hostname === "www.canva.com" && (/^\/design\/[^/]+(?:\/[^/]+)*\/edit$/.test(url.pathname) || /^\/api\/design\/[^/]+\/edit$/.test(url.pathname)) ? url.href : null; } catch { return null; }
}
