import { articleCompositionSlotAssetTypes, type ArticleCompositionSlot } from "@/lib/article-composition";
import type { ProjectDesignAsset } from "@/lib/newsletter-repository";

export type InstitutionPlacementLink = { assetIds: string[]; onRequest: (assetId: string) => void };
export const institutionPlacementSlots = ["hero_background", "hero_illustration"] as const;
export type InstitutionPlacementSlot = typeof institutionPlacementSlots[number];
export const institutionPlacementLabels: Record<InstitutionPlacementSlot, string> = {
  hero_background: "배경판", hero_illustration: "상단 이미지·장식",
};
// UI eligibility only. The existing Composition API remains the authority at write time.
export function institutionAssetPlacementSlots(asset: ProjectDesignAsset | undefined, projectId: string): InstitutionPlacementSlot[] {
  if (!asset || asset.projectId !== projectId || !asset.isActive || !["draft", "approved"].includes(asset.approvalStatus) ||
    asset.metadata?.source !== "institution" || asset.storageBucket !== "design-production-assets" ||
    !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType) ||
    /폐기|삭제|사용\s*금지/.test([asset.name, asset.altText, asset.usageNote].join(" "))) return [];
  return institutionPlacementSlots.filter(slot => (articleCompositionSlotAssetTypes[slot] as readonly string[]).includes(asset.assetType));
}
export function isInstitutionPlacementSlot(value: string): value is InstitutionPlacementSlot {
  return (institutionPlacementSlots as readonly ArticleCompositionSlot[]).includes(value as ArticleCompositionSlot);
}
