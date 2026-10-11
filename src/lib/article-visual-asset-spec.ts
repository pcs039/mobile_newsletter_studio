import { conceptDirections, validateDesignConcept, type ArticleDesignConcept } from "@/lib/article-design-concept";
import { isArticleHexColor } from "@/lib/article-text-colors";

export const visualAssetRoles = {
  hero_background: "기사 배경판", hero_illustration: "상단 일러스트", decoration: "재사용 장식", pattern: "반복 배경 무늬",
} as const;
export type VisualAssetRole = keyof typeof visualAssetRoles;
export type VisualAssetSpecification = {
  assetRole: VisualAssetRole;
  purpose: string;
  visualStyle: string;
  colorDirection: ArticleDesignConcept["colorDirection"];
  compositionDirection: string;
  aspectRatio: "3:4" | "3:2" | "1:1";
  targetSize: { width: number; height: number; unit: "px" };
  transparentBackground: boolean;
  safeArea: { unit: "percent"; top: number; right: number; bottom: number; left: number; instruction: string };
  textInImage: false;
  brandConstraints: { paletteReference: "existing-project-and-article"; articleColors: string[]; rules: string[] };
  canvaUsage: "background" | "overlay" | "standalone";
};
const purposeByPattern = { event: "행사 안내", policy: "정책·지원 정보", interview: "인물·인터뷰", manual: "기존 디자인" };
const roleRules = {
  hero_background: { name: "기사 배경판", width: 1080, height: 1440, aspectRatio: "3:4", transparent: false, usage: "background",
    composition: "장식은 가장자리에 두고 중앙은 HTML 제목·본문이 놓일 수 있도록 비웁니다.", top: 20, bottom: 15 },
  hero_illustration: { name: "상단 일러스트", width: 1080, height: 720, aspectRatio: "3:2", transparent: true, usage: "overlay",
    composition: "배경판과 분리된 단일 시각 요소. HTML 제목·본문 영역에 겹치지 않게 상단에 배치합니다.", top: 8, bottom: 12 },
  decoration: { name: "재사용 장식", width: 512, height: 512, aspectRatio: "1:1", transparent: true, usage: "overlay",
    composition: "독립된 작은 장식으로 제작하고 가장자리 배치·반복·크기 확장에 대응합니다.", top: 8, bottom: 8 },
  pattern: { name: "반복 배경 무늬", width: 1024, height: 1024, aspectRatio: "1:1", transparent: false, usage: "background",
    composition: "이음새 없이 반복 가능한 저밀도 무늬. HTML 텍스트 가독성을 방해하지 않습니다.", top: 0, bottom: 0 },
} as const;

// Pure planning only: no provider calls, IDs, paths, persistence or placement changes.
export function buildVisualAssetSpecifications(value: unknown, articleColors: readonly string[] = []): VisualAssetSpecification[] {
  const concept = validateDesignConcept(value);
  if (!concept || concept.pattern === "manual" || concept.assetRole === "none") return [];
  const roles: VisualAssetRole[] = [];
  if (concept.assetRole === "background" || concept.assetRole === "both") roles.push("hero_background", "pattern");
  if (concept.assetRole === "illustration" || concept.assetRole === "both") roles.push("hero_illustration", "decoration");
  const colors = [...new Set(articleColors.filter(isArticleHexColor).map(c => c.toUpperCase()))].slice(0, 3);
  return roles.map(assetRole => {
    const rule = roleRules[assetRole];
    return {
      assetRole, purpose: `${purposeByPattern[concept.pattern]}용 ${rule.name}${assetRole === "decoration" || assetRole === "pattern" ? " (선택적 재사용 자산)" : ""}`,
      visualStyle: `${conceptDirections.visualTone[concept.visualTone]} 공공소식지 스타일 · 과도한 광고·회화 표현 없이 절제`,
      colorDirection: concept.colorDirection,
      compositionDirection: `${conceptDirections.layoutDirection[concept.layoutDirection]}. ${rule.composition}`,
      aspectRatio: rule.aspectRatio, targetSize: { width: rule.width, height: rule.height, unit: "px" },
      transparentBackground: rule.transparent,
      safeArea: { unit: "percent", top: rule.top, right: assetRole === "pattern" ? 0 : 8, bottom: rule.bottom, left: assetRole === "pattern" ? 0 : 8,
        instruction: assetRole === "pattern" ? "전체가 반복 타일입니다. 텍스트나 정보는 넣지 않고 낮은 대비를 유지합니다." : assetRole === "hero_background" ? "중앙 84% 폭·65% 높이는 HTML 텍스트용 여백으로 유지합니다." : "가장자리 안전 여백 안에 피사체를 유지하며, 제목·본문은 별도 HTML로 둡니다." },
      textInImage: false,
      brandConstraints: { paletteReference: "existing-project-and-article", articleColors: [...colors], rules: [
        "기관·프로젝트의 승인된 브랜드 색상과 톤 우선. 없는 브랜드 정보나 새 HEX를 추측하지 않음.",
        "기사 색상은 참고값이며 기관 브랜드와 충돌하면 승인된 기관 팔레트 우선.",
        "텍스트·숫자·로고·워터마크를 이미지에 생성하지 않음. 의미 있는 내용은 HTML로 유지.",
        "모바일 390px 기준 기본·최대 글자 크기에서 제목·본문 가림 금지.",
        "배경판·일러스트·장식·무늬는 독립 자산으로 제작해 Canva에서 분리 재사용.",
      ] },
      canvaUsage: rule.usage,
    };
  });
}
