import type { ProjectContentArticle, ProjectDesignAsset } from "@/lib/newsletter-repository";
import type { ProjectArticleComposition } from "@/lib/article-composition";
import { isArticleCompositionAssetTypeCompatible } from "@/lib/article-composition";
import { readArticleBodyDesign } from "@/lib/article-body-design";
import { productionPatternDescriptions } from "@/lib/article-production-pattern";
import type { ArticleProductionPattern } from "@/lib/article-production-pattern";
import type { ArticleDesignConcept } from "@/lib/article-design-concept";
import { conceptDirections } from "@/lib/article-design-concept";
import type { ArticleTextDesign } from "@/lib/article-text-design";

export type DraftSnapshot = {
  id: string; settings: ProjectArticleComposition["settings"]; status: "draft" | "ready"; updated_at: string;
  placements: Array<{ id: string; asset_id: string; slot: string; sort_order: number; is_visible: boolean; settings: unknown; updated_at: string }>;
  content_version: string;
};
export type DraftPlacement = { assetId: string; slot: "hero_background" | "hero_illustration"; name: string };
export type ArticleDesignDraft = {
  pattern: ArticleProductionPattern; textDesign: ArticleTextDesign; placements: DraftPlacement[];
  changes: string[]; preserved: string[]; snapshot: DraftSnapshot;
};

// No content is generated. Source/provider does not participate in scoring.
function buildArticleDesignDraft(article: ProjectContentArticle, pattern: ArticleProductionPattern,
  assets: ProjectDesignAsset[], readyVisible: Record<string, string[]>, snapshot: DraftSnapshot): ArticleDesignDraft {
  const preserved = ["기사 제목·요약·본문·링크·이미지·캡션 문구", "색상·소제목·번호 배지·기존 배치"];
  const draft: ArticleDesignDraft = { pattern, textDesign: {}, placements: [], changes: [], preserved, snapshot };
  if (pattern === "manual") { draft.changes.push("현재 디자인 유지 · 저장할 변경 없음"); return draft; }
  draft.textDesign = { labelEnabled: true, label: { event: "행사", policy: "정책", interview: "인터뷰" }[pattern] };
  draft.changes.push(`라벨: ${draft.textDesign.label}`);
  const blocks = article.blocks.filter(b => b.isVisible);
  const has = (kind: "info" | "quote") => blocks.some(b => b.type === "paragraph" && b.body.trim() &&
    readArticleBodyDesign(b.metadata.body_design)?.kind === kind && readArticleBodyDesign(b.metadata.body_design)?.enabled !== false);
  const emphasis = pattern === "interview" ? "quote" : "info";
  if (has(emphasis)) { draft.textDesign.bodyEmphasis = emphasis; draft.changes.push(emphasis === "info" ? "기존 정보박스 강조" : "기존 인용문 강조"); }
  if (blocks.some(b => b.type === "image" && b.title.trim())) {
    draft.textDesign.captionStyled = true; draft.changes.push("기존 이미지 설명 스타일 적용");
  }
  if (pattern === "event" && (article.publicInfo.dateTime || article.publicInfo.place))
    draft.preserved.push("기존 행사 일시·장소 정보와 표시 순서");
  // Preserve occupied slots (including hidden placements). Only reuse a single,
  // explicitly tagged and already ready/visible asset; ties mean no selection.
  for (const slot of ["hero_illustration", "hero_background"] as const) {
    if (pattern === "policy" || (pattern === "interview" && slot === "hero_background") || snapshot.placements.some(p => p.slot === slot)) continue;
    const candidates = assets.filter(a => a.approvalStatus === "approved" && a.isActive && readyVisible[a.id]?.includes(slot) &&
      a.storageBucket === "design-production-assets" && a.storagePath && !a.storagePath.includes("..") &&
      /^(image\/(png|jpeg|webp|svg\+xml))$/.test(a.mimeType) &&
      isArticleCompositionAssetTypeCompatible(slot, a.assetType) && a.metadata?.usageTags?.includes(pattern) &&
      // Opaque full poster/card imagery is not a safe top-decoration default.
      (slot !== "hero_illustration" || a.metadata?.transparency === "yes"));
    if (candidates.length === 1) {
      draft.placements.push({ assetId: candidates[0].id, slot, name: candidates[0].name });
      draft.changes.push(`${slot === "hero_background" ? "배경판 (옅게)" : "상단 장식"}: ${candidates[0].name}`);
    }
  }
  if (!draft.placements.length) draft.preserved.push("자산 배치 유지 · 확실한 후보 없음");
  return draft;
}

export function buildDraftForProject(projectId: string, article: ProjectContentArticle, pattern: ArticleProductionPattern,
  assets: ProjectDesignAsset[], readyVisible: Record<string, string[]>, snapshot: DraftSnapshot, concept?: ArticleDesignConcept) {
  const draft = buildArticleDesignDraft(article, pattern, assets.filter(a => a.projectId === projectId), readyVisible, snapshot);
  if (!concept || pattern === "manual") return draft;
  if (concept.layoutDirection === "editorial") delete draft.textDesign.bodyEmphasis;
  const slots = concept.assetRole === "both" ? ["hero_background", "hero_illustration"] :
    concept.assetRole === "background" ? ["hero_background"] : concept.assetRole === "illustration" ? ["hero_illustration"] : [];
  draft.placements = draft.placements.filter(p => slots.includes(p.slot));
  draft.changes = [
    `제작 패턴: ${productionPatternDescriptions[pattern].name}`,
    `라벨: ${draft.textDesign.label}`,
    ...(draft.textDesign.bodyEmphasis ? [draft.textDesign.bodyEmphasis === "info" ? "기존 정보박스 강조" : "기존 인용문 강조"] : []),
    ...(draft.textDesign.captionStyled ? ["기존 이미지 설명 스타일 적용"] : []),
    ...draft.placements.map(p => `${p.slot === "hero_background" ? "옅은 배경판" : "상단 장식"}: ${p.name}`),
  ];
  draft.preserved.push(`색상 방향: ${conceptDirections.colorDirection[concept.colorDirection]} · 현재 기사 색상과 기관 기본색 유지 (새 색상 저장 없음)`);
  if (!draft.placements.length) draft.preserved.push("새 자산 배치 없음");
  return draft;
}
