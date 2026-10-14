import type { VisualDirectorArticle } from "@/lib/article-visual-director";
import { safeVisualText } from "@/lib/article-visual-source-snapshot";

export const directorStyleLabels = {
  public_editorial: "공공 편집형", public_illustration: "공공 설명 일러스트", civic_lifestyle: "주민 생활형",
  culture_visual: "문화·계절형", conceptual_policy: "정책 개념형",
} as const;
export type DirectorStylePreset = keyof typeof directorStyleLabels;
export const headlineSafeAreaLabels = { top: "상단", center: "중앙", none: "별도 여백 없음" } as const;
export type HeadlineSafeArea = keyof typeof headlineSafeAreaLabels;
export const directorImageSizes = { "4:5": { width: 1536, height: 1920 }, "1:1": { width: 1536, height: 1536 }, "16:9": { width: 1536, height: 864 } } as const;
export const directorQualityVersion = "quality-v1";
export function validDirectorVariant(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 3; }
export function chooseDirectorStyle(article: VisualDirectorArticle, reasons: string[]): DirectorStylePreset {
  const text = safeVisualText(article.title + " " + article.summary).slice(0, 1200);
  const hits = (patterns: RegExp[]) => patterns.reduce((sum, p) => sum + Number(p.test(text)), 0);
  const scores: Record<DirectorStylePreset, number> = {
    public_editorial: 1 + hits([/행정|민원/, /서비스|생활정보/, /공공|주민/]),
    public_illustration: hits([/디지털|온라인/, /교육|학습/, /이용|서비스|설명|제도/]) * 2,
    civic_lifestyle: hits([/복지|건강|돌봄/, /고령|어르신|가족|아동/, /주민|공동체|생활/]) * 2,
    culture_visual: hits([/문화|관광/, /계절|봄|여름|가을|겨울/, /여행|체험|감상|분위기/]) * 2,
    conceptual_policy: hits([/AI|인공지능|데이터/i, /정책|도시/, /추상|개념|상징|구조/]) * 2,
  };
  if (article.articleType === "tourism_place") scores.culture_visual += 2;
  if (article.articleType === "welfare_health") scores.civic_lifestyle += 2;
  for (const preset of ["public_illustration", "civic_lifestyle", "culture_visual", "conceptual_policy"] as const) {
    if (scores[preset] < 4) scores[preset] = 0;
  }
  // Director evidence is auxiliary; it cannot invent topical evidence or override
  // its real-photo/urgent eligibility gate, which runs before this selector.
  if (reasons.some(r => /개념 표현/.test(r)) && scores.conceptual_policy >= 4) scores.conceptual_policy++;
  if (article.publicationKind === "rolling" && scores.public_editorial >= 3) scores.public_editorial++;
  if (article.urgency === "time_sensitive") scores.public_editorial++;
  return (Object.keys(scores) as DirectorStylePreset[]).sort((a, b) => scores[b] - scores[a])[0];
}
export function chooseDirectorRatio(article: VisualDirectorArticle): keyof typeof directorImageSizes {
  const text = safeVisualText(article.title + " " + article.summary);
  if (article.articleType === "government_major" || (/배너|e-?book|전자책/i.test(text) && /가로|PC|웹용/i.test(text))) return "16:9";
  if (article.articleType === "life_civil" || (/카드|요약/.test(text) && /핵심|한눈|간단|정리/.test(text))) return "1:1";
  return "4:5";
}
export const directorStylePrompts: Record<DirectorStylePreset, string> = {
  public_editorial: "Public editorial visual: calm, trustworthy, intuitive civic-service scene; restrained matte treatment, minimal decoration.",
  public_illustration: "Public explanatory illustration: clean flat vector-like shapes, simple background, recognizable mobile-scale scene; no UI screenshots.",
  civic_lifestyle: "Civic lifestyle illustration: generalized people of varied ages in natural everyday care/community contexts; warm but restrained. No recognizable real person, excessive skin retouching, malformed hands or faces.",
  culture_visual: "Culture and seasonal visual: attractive seasonal color and atmosphere with restrained public-institution tone; not a cinematic poster or tourist photo claiming a real site.",
  conceptual_policy: "Conceptual policy visual: abstract symbols and clear structural relationships for policy/cities/data; never recreate a specific real facility or documentary scene.",
};
