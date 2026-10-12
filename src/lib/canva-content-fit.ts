import type { CanonicalCanvaAutofillPayload } from "@/lib/canva-autofill-payload";

export const contentFitFields = ["TITLE", "EVENT_DATE", "EVENT_PLACE", "EVENT_SUMMARY", "CTA"] as const;
export type ContentFitField = typeof contentFitFields[number];
// Observed samples, not exact maximum capacities. Counts include spaces and
// newlines (Unicode code points). Values above tested-safe budgets fail closed.
export const canvaEventFitCalibration = {
  TITLE: { field: "TITLE", safeChars: 8, safeLines: 2, borderlineChars: 8, overflowObservedAt: 28, notes: "시민 문화 축제: 2줄 안전. 28자는 제목이 날짜·본문과 겹침." },
  EVENT_DATE: { field: "EVENT_DATE", safeChars: 11, safeLines: 2, borderlineChars: 11, overflowObservedAt: 25, notes: "10월 25일 10시: 2줄 가독성 유지. 25자는 장소·본문 영역 침범." },
  EVENT_PLACE: { field: "EVENT_PLACE", safeChars: 9, safeLines: 2, borderlineChars: 9, overflowObservedAt: 25, notes: "시청광장 중앙무대: 2줄, 하단선에 근접. 25자는 요약 영역 침범." },
  EVENT_SUMMARY: { field: "EVENT_SUMMARY", safeChars: 21, safeLines: 1, borderlineChars: 39, overflowObservedAt: 96, notes: "21자 1줄 안전. 39자 2줄은 CTA 상단에 근접하여 검토 필요. 96자는 CTA와 겹침." },
  CTA: { field: "CTA", safeChars: 24, safeLines: 1, borderlineChars: 24, overflowObservedAt: 49, notes: "24자 1줄이 버튼 안에 표시됨. 49자는 여러 줄로 버튼 하단 밖에 잘림." },
} as const;
const constraints: Record<ContentFitField, { maxChars: number; maxLines: number }> = {
  TITLE: { maxChars: canvaEventFitCalibration.TITLE.safeChars, maxLines: canvaEventFitCalibration.TITLE.safeLines },
  EVENT_DATE: { maxChars: canvaEventFitCalibration.EVENT_DATE.safeChars, maxLines: canvaEventFitCalibration.EVENT_DATE.safeLines },
  EVENT_PLACE: { maxChars: canvaEventFitCalibration.EVENT_PLACE.safeChars, maxLines: canvaEventFitCalibration.EVENT_PLACE.safeLines },
  EVENT_SUMMARY: { maxChars: canvaEventFitCalibration.EVENT_SUMMARY.safeChars, maxLines: canvaEventFitCalibration.EVENT_SUMMARY.safeLines },
  CTA: { maxChars: canvaEventFitCalibration.CTA.safeChars, maxLines: canvaEventFitCalibration.CTA.safeLines },
};
export type ContentFitResult = {
  field: ContentFitField; originalText: string; fittedText: string; changed: boolean;
  fitStatus: "ok" | "adjusted" | "overflow";
  strategy: "preserve" | "normalize_line_endings" | "manual_fit_required";
  characterCount: number; explicitLines: number; maxLines: number; maxChars: number;
};

// No semantic rewrite, factual reformatting, truncation or ellipsis. An
// overflowing value stays intact so an operator can see what needs attention.
export function fitCanvaEventField(field: ContentFitField, originalText: string): ContentFitResult {
  if (!Object.hasOwn(constraints, field) || typeof originalText !== "string") throw Error("지원하는 Canva 글자 필드를 확인하세요.");
  const constraint = constraints[field];
  const fittedText = originalText.replace(/\r\n?/g, "\n");
  const changed = fittedText !== originalText;
  const lines = fittedText.split("\n").length;
  const characterCount = Array.from(fittedText).length;
  const overflow = !fittedText.trim() || originalText.length > 10000 ||
    /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/.test(fittedText) || lines > constraint.maxLines || characterCount > constraint.maxChars;
  return { field, originalText, fittedText, changed, fitStatus: overflow ? "overflow" : changed ? "adjusted" : "ok",
    strategy: overflow ? "manual_fit_required" : changed ? "normalize_line_endings" : "preserve",
    characterCount, explicitLines: lines, ...constraint };
}

export type CanvaContentFitPreflight = {
  templateId: string; canvaBrandTemplateId: string; supported: boolean;
  profile: "event_festival_02_observed_samples_v1" | null;
  isReady: boolean; visualReady: boolean;
  fields: Array<ContentFitResult & { provenance: {
    source: CanonicalCanvaAutofillPayload["textFields"][string]["source"];
    blockId?: string; linkId?: string;
    transform?: CanonicalCanvaAutofillPayload["textFields"][string]["transform"];
  } }>;
  warnings: string[]; payload: CanonicalCanvaAutofillPayload["payload"];
};

// Separate, opt-in presentation layer. The existing builder/adapter contracts
// are unchanged. Future execution integration must recompute this on-server.
export function prepareCanvaContentFit(raw: CanonicalCanvaAutofillPayload): CanvaContentFitPreflight {
  const supported = raw.templateId === "event_festival_02" && raw.canvaBrandTemplateId === "EAHXxCyfpSI";
  const fields: CanvaContentFitPreflight["fields"] = supported ? contentFitFields.map(field => {
    const value = raw.textFields[field];
    return { ...fitCanvaEventField(field, value?.text ?? ""), provenance: {
      source: value?.source ?? null, ...(value?.blockId ? { blockId: value.blockId } : {}),
      ...(value?.linkId ? { linkId: value.linkId } : {}), ...(value?.transform ? { transform: value.transform } : {}),
    } };
  }) : [];
  const payloadMatches = raw.payload?.brand_template_id === raw.canvaBrandTemplateId &&
    contentFitFields.every(field => {
      const trace = raw.textFields[field], data = raw.payload?.data[field];
      return trace?.status === "ready" && trace.type === "text" && data?.type === "text" && data.text === trace.text;
    });
  const visualReady = supported && raw.datasetStatus === "verified" && raw.isReady && raw.missingFields.length === 0 &&
    !!raw.payload && payloadMatches && fields.every(f => f.fitStatus !== "overflow");
  let payload: CanvaContentFitPreflight["payload"] = null;
  if (visualReady && raw.payload) {
    payload = { ...raw.payload, data: Object.fromEntries(Object.entries(raw.payload.data).map(([field, value]) => [field, { ...value }])) };
    for (const field of fields) payload.data[field.field] = { type: "text", text: field.fittedText };
  }
  return { templateId: raw.templateId, canvaBrandTemplateId: raw.canvaBrandTemplateId, supported,
    profile: supported ? "event_festival_02_observed_samples_v1" : null, isReady: raw.isReady, visualReady, fields, payload,
    warnings: !supported ? ["이 템플릿의 content-fit 제약은 아직 검증되지 않았습니다."] : [
      "실제 관찰한 안전 입력 길이 기준입니다. 같은 글자 수라도 글꼴·문자 구성·줄바꿈에 따라 실제 검수가 필요합니다.",
      ...fields.filter(f => f.fitStatus === "overflow").map(f => `${f.field}: 검증된 안전 범위를 초과했습니다. 원문을 자르지 않았습니다.`),
      ...(!payloadMatches ? ["원본 필드와 payload의 글자 값이 일치하지 않습니다."] : []),
    ] };
}
