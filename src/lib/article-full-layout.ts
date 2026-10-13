import type { ProjectContentArticle, ProjectContentBlock } from "@/lib/newsletter-repository";
import { getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readFullLayout(block: ProjectContentBlock) {
  const m = block.metadata;
  if (block.type !== "image" || m.presentation_mode !== "full_layout" || m.design_source !== "canva" || m.managed_by !== "canva_full_layout_v1" ||
    typeof m.design_asset_id !== "string" || !uuid.test(m.design_asset_id) || typeof m.template_id !== "string" || !getCanonicalCanvaTemplate(m.template_id) ||
    typeof m.source_snapshot !== "string" || !/^[a-f0-9]{32}$/.test(m.source_snapshot) || typeof m.applied_snapshot !== "string" || !/^[a-f0-9]{32}$/.test(m.applied_snapshot)) return null;
  return { assetId: m.design_asset_id, templateId: m.template_id };
}
export function activeFullLayout(article: ProjectContentArticle) {
  return article.blocks.find(b => b.isVisible && readFullLayout(b) && /^\/api\/(public-files\/preview|client-review\/files)\?/.test(b.body) && b.body.includes("fullLayoutBlock=")) ?? null;
}

export function originalFullLayoutPresentation(article: ProjectContentArticle) {
  const blocks=article.blocks.filter(b=>b.metadata.presentation_mode!=="full_layout");
  const mode=blocks.find(b=>["text","image","mixed"].includes(String(b.metadata.presentation_mode)))?.metadata.presentation_mode;
  const title=blocks.find(b=>typeof b.metadata.show_public_title==="boolean")?.metadata.show_public_title;
  return {contentPresentation:(mode??(blocks.some(b=>b.type==="image")?"mixed":"text")) as ProjectContentArticle["contentPresentation"],showPublicTitle:typeof title==="boolean"?title:true};
}
// Own presentation override is not an edit to the recommendation's source copy.
// Other source/block/link changes still invalidate the existing review session.
export function fullLayoutSourceVersion<T extends {blocks:ProjectContentBlock[];showPublicTitle?:boolean}>(article:T){
  if(!article.blocks.some(b=>readFullLayout(b)))return JSON.stringify(article);
  const visible=article.blocks.filter(b=>!readFullLayout(b));
  const flag=visible.find(b=>typeof b.metadata.show_public_title==='boolean')?.metadata.show_public_title;
  return JSON.stringify({...article,showPublicTitle:typeof flag==='boolean'?flag:true,blocks:visible});
}
