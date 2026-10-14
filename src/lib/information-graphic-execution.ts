import "server-only";
import { createHash } from "node:crypto";
import { buildVisualDirectorResult, type VisualDirectorArticle } from "@/lib/article-visual-director";
import { buildInformationGraphicSpec, renderInformationGraphicSvg, graphicTypeLabels } from "@/lib/article-information-graphic";
import { ImageGenerationError } from "@/lib/article-image-generation";
import { validateDesignAssetMetadata } from "@/lib/design-asset-metadata";
import { getSupabaseRestEndpoint,getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { uploadProjectDesignAssetFile,insertProjectDesignAssetRecord } from "@/lib/project-design-asset-write";
function stable(value:unknown):unknown{return Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;}
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
export function prepareInformationGraphic(projectId:string,articleId:string,article:VisualDirectorArticle,color:string){
  const plan=buildInformationGraphicSpec(article,articleId);
  const palette=/^#[a-f0-9]{6}$/i.test(color)?color.toLowerCase():"#092046";
  const source={title:article.title,summary:article.summary,body:article.body,articleType:article.articleType,publicInfo:article.publicInfo,
    blocks:article.blocks.filter(b=>b.isVisible&&b.type==="paragraph").map(b=>({id:b.id,body:b.body,title:b.title})),links:article.links};
  const generationKey=hash({projectId,articleId,snapshot:hash(source),director:buildVisualDirectorResult(article),spec:plan.specification,rendererVersion:"svg_public_cards_v1",palette});
  const h=hash(`information-graphic-asset:${generationKey}`),assetId=`${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
  return{...plan,generationKey,assetId,palette};
}
export async function executeInformationGraphic(input:{projectId:string;articleId:string;article:VisualDirectorArticle;color:string;action:"prepare"|"generate"|"status";expectedKey?:string}){
  const plan=prepareInformationGraphic(input.projectId,input.articleId,input.article,input.color);
  const base={plan,generationKey:plan.generationKey,recommendedUsage:"image_block"};
  if(plan.status!=="ready"||!plan.specification)return{...base,status:plan.status};
  if(input.action!=="prepare"&&input.expectedKey!==plan.generationKey)throw new ImageGenerationError(409,"기사 정보가 변경되었습니다. 그래픽 계획을 다시 확인하세요.");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new ImageGenerationError(503,"자산 저장 설정을 확인해 주세요.");
  const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  const endpoint=getSupabaseRestEndpoint(`/rest/v1/newsletter_project_design_assets?${new URLSearchParams({select:"id,name,project_id,asset_type,metadata,is_active,approval_status",project_id:`eq.${input.projectId}`,id:`eq.${plan.assetId}`,limit:"1"})}`);
  const bucket="design-production-assets",path=`projects/${input.projectId}/production/internal/information-${plan.assetId}.svg`;
  const object=getSupabaseStorageEndpoint(`/object/${bucket}/${path}`),bucketEndpoint=getSupabaseStorageEndpoint(`/bucket/${bucket}`);
  if(!endpoint||!object||!bucketEndpoint)throw new ImageGenerationError(503,"비공개 자산 저장 설정을 확인해 주세요.");
  const find=async()=>{const r=await fetch(endpoint,{headers,cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)throw new ImageGenerationError(503,"기존 자산을 확인하지 못했습니다.");const [a]=await r.json();if(!a)return null;
    const m=validateDesignAssetMetadata(a.metadata);if(a.project_id!==input.projectId||!m.ok||m.metadata?.source!=="internal"||m.metadata.informationGraphic?.generationKey!==plan.generationKey||m.metadata.informationGraphic.articleId!==input.articleId||m.metadata.informationGraphic.graphicType!==plan.specification!.graphicType||a.asset_type!=="card_frame"||!a.is_active||!["draft","approved"].includes(a.approval_status))throw new ImageGenerationError(409,"현재 기사의 그래픽 자산 정보를 확인해 주세요.");return{id:a.id as string,name:a.name as string,previewHref:`/api/project-files/preview?designAssetId=${a.id}`};};
  const existing=await find();if(existing)return{...base,status:"success",asset:existing,duplicate:true};
  // An existing private file without a confirmed row is an uncertain prior import.
  // Never overwrite or render it again; status requests only look for its receipt.
  const file=await fetch(object,{headers,method:"GET",cache:"no-store",signal:AbortSignal.timeout(10000)});await file.body?.cancel();
  if(file.ok)return{...base,status:"unknown",message:"파일 등록 결과가 미확정입니다. 자동 재생성하지 않습니다."};
  if(![400,404].includes(file.status))throw new ImageGenerationError(503,"기존 파일 상태를 확인하지 못했습니다.");
  if(input.action!=="generate")return{...base,status:"ready"};
  const check=await fetch(bucketEndpoint,{headers,cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!check.ok||(await check.json()).public!==false)throw new ImageGenerationError(503,"기존 비공개 디자인 Storage가 필요합니다.");
  const svg=renderInformationGraphicSvg(plan.specification,plan.palette);
  const upload=new File([svg],`information-${plan.assetId}.svg`,{type:"image/svg+xml"});
  const r=await uploadProjectDesignAssetFile(bucket,path,upload,{...headers,"Content-Type":"image/svg+xml"},AbortSignal.timeout(10000));
  if(!r.ok){const b=await r.json().catch(()=>null);if(r.status===409||String(b?.statusCode)==="409"||b?.error==="Duplicate")return{...base,status:"in_progress",message:"동일 그래픽 등록 결과를 확인 중입니다."};throw new ImageGenerationError(502,"파일 등록 결과를 확인하지 못했습니다. 진행 상태를 확인하세요.");}
  const metadata=validateDesignAssetMetadata({source:"internal",usageTags:["common"],reuseScope:"project",transparency:"no",informationGraphic:{articleId:input.articleId,graphicType:plan.specification.graphicType,specVersion:"v1",generationKey:plan.generationKey}});
  if(!metadata.ok)throw new ImageGenerationError(400,metadata.message);
  const saved=await insertProjectDesignAssetRecord({id:plan.assetId,project_id:input.projectId,name:`${input.article.title.trim()} · ${graphicTypeLabels[plan.specification.graphicType]} · 정보그래픽`,asset_type:"card_frame",metadata:metadata.metadata,parent_source_asset_id:null,language:"ko",variant:"primary",background_mode:"any",usage_role:"article",approval_status:"draft",is_primary:false,is_active:true,sort_order:0,
    storage_bucket:bucket,storage_path:path,original_file_name:upload.name,mime_type:upload.type,file_size_bytes:upload.size,alt_text:input.article.title,usage_note:"앱 내부 정보그래픽 · 원문 확인 후 승인 · 자동 기사 적용 없음"},headers,AbortSignal.timeout(10000));
  const asset=await find();if(asset)return{...base,status:"success",asset,duplicate:!saved.ok};
  return{...base,status:"unknown",message:"자산 등록 결과가 미확정입니다. 자동 재생성하지 않습니다."};
}
