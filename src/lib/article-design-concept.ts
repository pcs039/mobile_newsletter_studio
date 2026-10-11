import { articleTextColorDefaults, isArticleHexColor } from "@/lib/article-text-colors";
import type { DraftSnapshot } from "@/lib/article-design-draft";
import type { ProjectContentArticle } from "@/lib/newsletter-repository";
import { isArticleProductionPattern, type ArticleProductionPattern } from "@/lib/article-production-pattern";
import { buildPatternRecommendationInput, patternRecommendationInstruction } from "@/lib/article-pattern-recommendation";

export const conceptDirections = {
  visualTone: { clear: "명확하고 절제된", editorial: "여백을 살린", friendly: "친근하고 부드러운" },
  layoutDirection: { information: "정보 위계 중심", editorial: "이미지와 제목 중심", friendly: "안내와 참여 중심" },
  colorDirection: { brand: "기관 색상 중심", neutral: "중립적", warm: "따뜻한", cool: "차분한", vivid: "선명한", muted: "절제된", "high-contrast": "높은 대비" },
  assetRole: { none: "장식 최소화", background: "옅은 배경판", illustration: "상단 일러스트", both: "배경판과 상단 일러스트" },
} as const;
export type ArticleDesignConcept = {
  name: string; description: string; pattern: ArticleProductionPattern; rationale: string;
  visualTone: keyof typeof conceptDirections.visualTone;
  layoutDirection: keyof typeof conceptDirections.layoutDirection;
  colorDirection: keyof typeof conceptDirections.colorDirection;
  assetRole: keyof typeof conceptDirections.assetRole;
};
const textLimits = { name: 60, description: 180, rationale: 300 } as const;
export function validateDesignConcept(value: unknown): ArticleDesignConcept | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ["pattern", ...Object.keys(textLimits), ...Object.keys(conceptDirections)];
  if (Object.keys(v).length !== keys.length || Object.keys(v).some(k => !keys.includes(k)) || !isArticleProductionPattern(v.pattern)) return null;
  for (const [k, limit] of Object.entries(textLimits)) if (typeof v[k] !== "string" || !(v[k] as string).trim() || (v[k] as string).length > limit) return null;
  for (const [k, allowed] of Object.entries(conceptDirections)) if (typeof v[k] !== "string" || !Object.hasOwn(allowed, v[k] as string)) return null;
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, typeof val === "string" ? val.trim() : val])) as ArticleDesignConcept;
}
export function parseDesignConcepts(text: string): ArticleDesignConcept[] | null {
  try {
    const v = JSON.parse(text);
    if (!v || Object.keys(v).length !== 1 || !Array.isArray(v.concepts) || v.concepts.length !== 3) return null;
    const list = v.concepts.map(validateDesignConcept);
    if (list.some((c: ArticleDesignConcept | null) => !c) || new Set(list.map((c: ArticleDesignConcept) => c.name)).size !== 3 || new Set(list.map((c: ArticleDesignConcept) => c.layoutDirection)).size !== 3) return null;
    return list;
  } catch { return null; }
}
export const designConceptSchema = {
  type: "object", additionalProperties: false, required: ["concepts"], properties: {
    concepts: { type: "array", minItems: 3, maxItems: 3, items: {
      type: "object", additionalProperties: false,
      required: ["name", "description", "pattern", "visualTone", "layoutDirection", "colorDirection", "assetRole", "rationale"],
      properties: {
        ...Object.fromEntries(Object.entries(textLimits).map(([k, maxLength]) => [k, { type: "string", minLength: 1, maxLength }])),
        pattern: { type: "string", enum: ["event", "policy", "interview", "manual"] },
        ...Object.fromEntries(Object.entries(conceptDirections).map(([k, values]) => [k, { type: "string", enum: Object.keys(values) }])),
      },
    } },
  },
};
export const designConceptInstruction = `${patternRecommendationInstruction.split("confidence는")[0]}
이번 요청은 기사에 맞는 디자인 콘셉트 3안을 concepts로 반환한다. name/description/rationale는 짧은 한국어다.
3안은 information/editorial/friendly layoutDirection을 하나씩 사용하고, 기사별로 다른 이름과 이유를 제안한다.
기사 본문이나 라벨 문구 생성, HEX, DB 정보, asset ID, URL, Canva 정보를 반환하지 않는다. visualTone/colorDirection/assetRole은 허용된 semantic 값만 사용한다.
제목·본문·정보박스·인용·캡션은 실제 HTML 텍스트로 유지하고 raster 자산은 배경·일러스트 역할로 분리한다. 이미지 내부에 글자를 생성하거나 글자를 이미지로 대체하는 구성을 전제로 하지 않는다.
기관의 기존 brand tone을 우선하고 과도한 광고형·회화형 스타일을 지양한다. brand 정보가 입력에 없으면 추측하지 않고 기존 팔레트 유지 방향으로 제안한다.
assetRole의 background와 illustration 역할을 구분한다. decoration/pattern 등 향후 역할을 현재 자동 배치 슬롯으로 확장하지 않는다.
모바일 가독성과 기본/최대 글자 크기에서의 안정성을 우선한다. 고정 높이·텍스트 겹침·장식으로 제목이나 본문을 가리는 구성을 제안하지 않는다.
기존 색상·콘텐츠·배치를 존중한다. manual은 현재 디자인 유지다.`;
export function buildDesignConceptInput(article: ProjectContentArticle) {
  return JSON.stringify({ articleType: article.articleType, text: buildPatternRecommendationInput(article).slice(0, 6000),
    bodyLength: article.body.length, hasImage: article.blocks.some(b => b.isVisible && b.type === "image"),
    hasDate: Boolean(article.publicInfo.dateTime), hasPlace: Boolean(article.publicInfo.place) });
}
export function fallbackDesignConcepts(article: ProjectContentArticle): ArticleDesignConcept[] {
  const pattern: ArticleProductionPattern = article.articleType === "event_festival" ? "event" : ["welfare_health", "government_major"].includes(article.articleType) ? "policy" : "manual";
  const topic = article.title.trim().slice(0, 22) || "기사";
  return [
    { name: "핵심정보형", description: `${topic}의 핵심 정보를 먼저 확인하는 구성`, pattern, visualTone: "clear", layoutDirection: "information", colorDirection: "high-contrast", assetRole: "none", rationale: "기존 정보박스와 본문의 가독성을 우선합니다." },
    { name: "여백 중심형", description: `${topic}의 제목과 기존 이미지를 중심으로 보는 구성`, pattern, visualTone: "editorial", layoutDirection: "editorial", colorDirection: "brand", assetRole: "background", rationale: "기존 제목·이미지를 유지하고 확실한 배경 후보만 사용합니다." },
    { name: "친근한 안내형", description: `${topic}을 편안하게 읽는 안내 구성`, pattern, visualTone: "friendly", layoutDirection: "friendly", colorDirection: "muted", assetRole: "illustration", rationale: "현재 프로젝트의 승인된 상단 장식 후보가 있을 때만 제안합니다." },
  ];
}

// The existing atomic RPC intentionally cannot write placement color tokens.
// Resolve an existing palette for the proposal; leave renderer fallback untouched.
export function resolveExistingConceptColors(snapshot: DraftSnapshot, projectColor?: string) {
  const frame = snapshot.placements.find(p => p.slot === "hero_background" && p.is_visible)?.settings;
  const settings = frame && typeof frame === "object" ? frame as Record<string, unknown> : {};
  const current = (key: keyof typeof articleTextColorDefaults) => typeof settings[key] === "string" && isArticleHexColor(settings[key] as string) ? settings[key] as string : null;
  const brand = projectColor && isArticleHexColor(projectColor) ? projectColor : articleTextColorDefaults.titleColor;
  return { titleColor: current("titleColor") ?? brand, bodyColor: current("bodyColor") ?? articleTextColorDefaults.bodyColor,
    accentColor: current("accentColor") ?? brand };
}
