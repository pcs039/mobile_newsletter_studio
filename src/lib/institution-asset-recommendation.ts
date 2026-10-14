import "server-only";
import { createHash } from "node:crypto";
import type { ProjectDesignAsset } from "@/lib/newsletter-repository";
import type { VisualDirectorArticle } from "@/lib/article-visual-director";
import { buildInstitutionAssetRecommendation, institutionArticleSnapshot, institutionAssetSnapshot, type InstitutionMatchAsset } from "@/lib/institution-asset-matching";

export function prepareInstitutionAssetRecommendation(article:VisualDirectorArticle,articleId:string,assets:ProjectDesignAsset[],projectId:string,context?:"hybrid") {
  const safeAssets:InstitutionMatchAsset[]=assets.map(a=>({...institutionAssetSnapshot({...a,hasPrivateImage:["brand-assets","design-intake-assets","design-production-assets"].includes(a.storageBucket)&&!!a.storagePath}),metadata:a.metadata}));
  const result=buildInstitutionAssetRecommendation(article,articleId,safeAssets,projectId,3,context);
  const snapshot={matcherVersion:"v1",projectId,article:institutionArticleSnapshot(article),spec:result.spec,
    assets:safeAssets.filter(a=>a.projectId===projectId).map(institutionAssetSnapshot).sort((a,b)=>a.id.localeCompare(b.id))};
  const matchKey=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return {...result,matchKey,candidates:result.candidates.map(a=>({...a,previewHref:`/api/project-files/preview?institutionAssetId=${a.assetId}&projectId=${projectId}`}))};
}
