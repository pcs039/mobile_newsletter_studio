import type { ProjectContentArticle, ProjectContentBlock, ProjectDesignAsset } from "@/lib/newsletter-repository";

export type AiImageRole = "hero" | "body";
export type AiImageConnection = { blockId: string; assetId: string; role: AiImageRole };
export type AiImageCandidate = {
  id: string; name: string; previewHref: string; approvalStatus: string;
  generationKey: string; variantIndex: number | null; styleLabel: string;
  aspectRatio: string; stale: boolean;
};
export type AiImageApplyState = { snapshot: string; connections: AiImageConnection[]; candidates: AiImageCandidate[]; conflict: boolean };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function readAiImageBlock(block: ProjectContentBlock) {
  const m = block.metadata ?? {};
  if (block.type !== "image" || block.assetId !== null || m.managed_by !== "ai_image_article_v1" || m.source !== "openai" ||
    m.visual_strategy !== "ai_generated_image" || !uuid.test(String(m.source_asset_id)) || !uuid.test(String(m.generated_for_article_id)) ||
    typeof m.generation_key !== "string" || !/^[a-f0-9]{64}$/.test(m.generation_key) ||
    !["hero", "body"].includes(String(m.applied_role)) || (m.variant_index !== null && (typeof m.variant_index !== "number" || ![1, 2, 3].includes(m.variant_index)))) return null;
  return { assetId: m.source_asset_id as string, articleId: m.generated_for_article_id as string,
    generationKey: m.generation_key, role: m.applied_role as AiImageRole };
}
export function isArticleAiImageAsset(asset: ProjectDesignAsset, projectId: string, articleId: string) {
  const p = asset.metadata?.imageGeneration;
  return asset.projectId === projectId && asset.isActive && ["draft", "approved"].includes(asset.approvalStatus) &&
    asset.metadata?.source === "openai" && p?.generatedForArticleId === articleId && p.visualStrategy === "ai_generated_image" &&
    asset.storageBucket === "design-production-assets" && asset.mimeType === "image/png" && ["background", "illustration"].includes(asset.assetType);
}
// Managed connections are not source copy, and must not make a generated image
// stale merely because it was explicitly attached to its own article.
export function aiImageSourceArticle<T extends { blocks: ProjectContentBlock[] }>(article: T): T {
  return { ...article, blocks: article.blocks.filter(b => b.metadata?.managed_by !== "ai_image_article_v1") };
}
export function aiImageHero(article: ProjectContentArticle) {
  return article.blocks.find(b => b.isVisible && readAiImageBlock(b)?.role === "hero" &&
    readAiImageBlock(b)?.articleId === article.id && b.body.startsWith("/api/") && b.body.includes("aiImageBlock=")) ?? null;
}
