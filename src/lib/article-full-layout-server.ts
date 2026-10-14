import { deliverAuthorizedPng } from "@/lib/image-delivery-server";
import "server-only";
import { NextResponse } from "next/server";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { getProjectContent, getProjectDesignAssets, type ProjectContentArticle } from "@/lib/newsletter-repository";
import { readFullLayout, originalFullLayoutPresentation } from "@/lib/article-full-layout";
import { isArticlePubliclyVisible } from "@/lib/article-publication";
export async function fullLayoutRpc(projectId: string, articleId: string, action: "snapshot" | "apply" | "revoke", assetId?: string, templateId?: string, expected?: string) {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), url=getSupabaseRestEndpoint('/rest/v1/rpc/apply_newsletter_canva_full_layout_atomic');
  if (!key || !url) throw new CanvaConnectError(503,"서버 설정을 확인하세요.");
  const r=await fetch(url,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_project_id:projectId,p_article_id:articleId,p_action:action,p_design_asset_id:assetId??null,p_template_id:templateId??null,p_expected:expected??null}),cache:"no-store"});
  if(!r.ok) { const d=await r.json().catch(()=>null); throw new CanvaConnectError(d?.code==="PGRST202"?503:r.status===409||d?.code==="PT409"?409:r.status===403?403:404,d?.code==="PGRST202"?"full-layout 함수 migration 적용이 필요합니다.":"기사 내용이 변경되었거나 적용 조건이 맞지 않습니다."); }
  return await r.json() as {snapshot:string;blockId:string|null;assetId?:string;applied:boolean;duplicate?:boolean};
}
async function reference(projectId:string,slug:string,articleId:string,blockId:string,preview:boolean) {
  const content=await getProjectContent(slug),article=content.articles.find(a=>a.id===articleId);
  if(content.source!=="supabase"||!article||(!preview&&!isArticlePubliclyVisible(article)))return null;
  const block=article.blocks.find(b=>b.id===blockId&&b.isVisible),m=block&&readFullLayout(block);if(!block||!m)return null;
  const snapshot=await fullLayoutRpc(projectId,articleId,"snapshot");if(!snapshot.applied||snapshot.blockId!==blockId||snapshot.snapshot!==block.metadata.applied_snapshot)return null;
  const assets=await getProjectDesignAssets(slug),asset=assets.assets.find(a=>a.id===m.assetId);
  const p=asset?.metadata?.canvaExport;
  if(!asset||asset.projectId!==projectId||!asset.isActive||asset.approvalStatus!=="approved"||asset.assetType!=="card_frame"||asset.mimeType!=="image/png"||asset.storageBucket!=="design-production-assets"||!asset.storagePath||asset.storagePath.includes('..')||asset.storagePath.startsWith('/')||asset.storagePath.endsWith('/')||asset.metadata?.source!=="canva"||p?.articleId!==articleId||p.templateId!==m.templateId||p.format!=="png")return null;
  return asset.storagePath;
}
export async function mapFullLayouts(projectId:string,slug:string,articles:ProjectContentArticle[],mode:"public"|"preview"|"review") {
  return Promise.all(articles.map(async article=>{
    if (!article.blocks.some(b=>b.metadata.presentation_mode==="full_layout")) return article;
    const blocks=await Promise.all(article.blocks.map(async b=>{
      if(b.metadata.presentation_mode!=="full_layout")return b;
      let permitted=false;try{permitted=!!await reference(projectId,slug,article.id,b.id,mode==="preview");}catch{/* Fallback to original HTML if unavailable, including unapplied migration. */}
      return {...b,body:permitted?`${mode==="review"?"/api/client-review/files":"/api/public-files/preview"}?${new URLSearchParams({project:slug,articleId:article.id,fullLayoutBlock:b.id,...(mode==="preview"?{preview:"admin"}:{})})}`:"",isVisible:permitted};
    }));return {...article,...(blocks.some(b=>b.isVisible&&readFullLayout(b))?{contentPresentation:"image" as const,showPublicTitle:false}:originalFullLayoutPresentation(article)),blocks};
  }));
}
export async function serveFullLayout(projectId:string,slug:string,articleId:string,blockId:string,preview:boolean,request?:Request) {
  const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
  try{const path=await reference(projectId,slug,articleId,blockId,preview),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!path||!key)throw Error();const url=getSupabaseStorageEndpoint(`/object/design-production-assets/${path.split('/').map(encodeURIComponent).join('/')}`);if(!url)throw Error();const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"});if(!r.ok||!r.body||r.headers.get('content-type')?.split(';')[0]!=="image/png")throw Error();return await deliverAuthorizedPng(r,request,"canva",headers);}catch{return NextResponse.json({ok:false,message:"이미지를 찾지 못했습니다."},{status:404,headers});}
}
