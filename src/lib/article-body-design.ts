export type ArticleBodyDesign = { kind: "info" | "quote"; tone?: "default" | "key" | "notice" | "warning"; source?: string; enabled?: boolean };
export const infoBoxLabels = { default: "기본", key: "핵심 정보", notice: "안내", warning: "주의" } as const;
export function validateArticleBodyDesign(value: unknown): ArticleBodyDesign {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("정보박스·인용문 설정을 확인해 주세요.");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["kind", "tone", "source", "enabled"].includes(k)) || !["info", "quote"].includes(v.kind as string) || (v.enabled !== undefined && typeof v.enabled !== "boolean") || (v.tone !== undefined && !Object.keys(infoBoxLabels).includes(v.tone as string)) || (v.source !== undefined && (typeof v.source !== "string" || v.source.length > 200))) throw new Error("정보박스·인용문 설정을 확인해 주세요.");
  return { kind: v.kind as ArticleBodyDesign["kind"], ...(v.tone !== undefined ? { tone: v.tone as ArticleBodyDesign["tone"] } : {}), ...(v.source !== undefined ? { source: (v.source as string).trim() } : {}), ...(v.enabled !== undefined ? { enabled: v.enabled as boolean } : {}) };
}
export function readArticleBodyDesign(value: unknown): ArticleBodyDesign | undefined {
  try { return validateArticleBodyDesign(value); } catch { return undefined; }
}
