import { readArticleTextDesign, type ArticleTextDesign } from "@/lib/article-text-design";

export const articleProductionPatterns = ["manual", "event", "policy", "interview"] as const;
export type ArticleProductionPattern = (typeof articleProductionPatterns)[number];
export const productionPatternDescriptions: Record<ArticleProductionPattern, { name: string; description: string }> = {
  manual: { name: "직접 구성", description: "현재 디자인을 유지하고 직접 조정합니다." },
  event: { name: "행사안내형", description: "행사·축제·설명회·모집 안내에 적합" },
  policy: { name: "정책안내형", description: "정책·복지·지원사업 안내에 적합" },
  interview: { name: "인터뷰형", description: "인터뷰·인물 소개·대담 기사에 적합" },
};
export function isArticleProductionPattern(value: unknown): value is ArticleProductionPattern {
  return typeof value === "string" && articleProductionPatterns.some(pattern => pattern === value);
}

// Only presentation settings change. Article content, block metadata, colors and placements are not inputs.
export function applyArticleProductionPattern(pattern: ArticleProductionPattern, value: unknown): ArticleTextDesign {
  const current = readArticleTextDesign(value);
  if (pattern === "manual") return current;
  return {
    ...current,
    labelEnabled: true,
    label: { event: "행사", policy: "정책", interview: "인터뷰" }[pattern],
    captionStyled: true,
    bodyEmphasis: pattern === "interview" ? "quote" : "info",
  };
}
