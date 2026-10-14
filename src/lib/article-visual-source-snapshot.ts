import type { VisualDirectorArticle } from "@/lib/article-visual-director";
export const safeVisualText=(s:string)=>s.normalize("NFC").replace(/\S+/g,token=>/^https?:/i.test(token)||token.includes("/")||token.includes("\\")?" ":token).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g," ").trim();
export function institutionArticleSnapshot(a:VisualDirectorArticle) {
  return {title:safeVisualText(a.title),summary:safeVisualText(a.summary),body:safeVisualText(a.body),articleType:a.articleType,
    publicInfo:Object.fromEntries(Object.entries(a.publicInfo).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,safeVisualText(v)])),
    institutionPriority:a.institutionPriority,urgency:a.urgency,publicationKind:a.publicationKind,
    blocks:a.blocks.filter(b=>b.type==="paragraph").map(b=>({id:b.id,title:safeVisualText(b.title),body:safeVisualText(b.body),isVisible:b.isVisible}))};
}
export function visualArticleSnapshot(a:VisualDirectorArticle) {
  return {...institutionArticleSnapshot(a),links:a.links?.map(l=>({id:l.id,label:safeVisualText(l.label),isVisible:l.isVisible}))};
}
