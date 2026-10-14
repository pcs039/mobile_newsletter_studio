import "server-only";
import { ImageGenerationError, imageGenerationEnabled, type GeneratedImageProof } from "@/lib/article-image-generation";
import { insertProjectDesignAssetRecord, uploadProjectDesignAssetFile } from "@/lib/project-design-asset-write";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { type DesignAssetMetadata, validateDesignAssetMetadata } from "@/lib/design-asset-metadata";
function headers(type="application/json"){
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new ImageGenerationError(503,"서버 저장 설정을 확인해 주세요.");
  return {apikey:key,Authorization:`Bearer ${key}`,"Content-Type":type};
}
export async function findGeneratedImageAsset(proof:GeneratedImageProof, generation?: DesignAssetMetadata["imageGeneration"]){
  const endpoint=getSupabaseRestEndpoint(`/rest/v1/newsletter_project_design_assets?${new URLSearchParams({select:"id,name,asset_type,metadata,is_active,approval_status",id:`eq.${proof.assetId}`,project_id:`eq.${proof.projectId}`,limit:"1"})}`);
  if(!endpoint)throw new ImageGenerationError(503,"자산 저장 설정이 없습니다.");
  const r=await fetch(endpoint,{headers:headers(),cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new ImageGenerationError(503,"기존 자산을 확인하지 못했습니다.");
  const [row]=await r.json();if(!row)return null;
  if(row.metadata?.source!=="openai"||row.asset_type!==(proof.role==="hero_background"?"background":"illustration"))throw new ImageGenerationError(409,"등록 자산의 정보가 다릅니다.");
  if(generation && (!row.is_active || !["draft","approved"].includes(row.approval_status) || Object.entries(generation).some(([key,value])=>row.metadata.imageGeneration?.[key]!==value))) throw new ImageGenerationError(409,"생성 자산의 출처가 다릅니다.");
  return {id:row.id as string,name:row.name as string};
}
export async function registerGeneratedImageAsset(proof:GeneratedImageProof,bytes:Uint8Array,name:string, generation?: DesignAssetMetadata["imageGeneration"]){
  if(!imageGenerationEnabled())throw new ImageGenerationError(403,"Staging에서만 등록할 수 있습니다.");
  const existing=await findGeneratedImageAsset(proof,generation);if(existing)return {...existing,duplicate:true};
  const bucket="design-production-assets",path=`projects/${proof.projectId}/production/openai/generated-${proof.assetId}.png`;
  const bucketEndpoint=getSupabaseStorageEndpoint(`/bucket/${bucket}`);
  if(!bucketEndpoint)throw new ImageGenerationError(503,"자산 Storage 설정이 없습니다.");
  const check=await fetch(bucketEndpoint,{headers:headers(),cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!check.ok||(await check.json()).public!==false)throw new ImageGenerationError(503,"기존 비공개 디자인 Storage가 필요합니다.");
  const file=new File([new Uint8Array(bytes)],`generated-${proof.assetId}.png`,{type:"image/png"});
  const uploaded=await uploadProjectDesignAssetFile(bucket,path,file,headers("image/png"),AbortSignal.timeout(15000));
  if(!uploaded.ok){const e=await uploaded.json().catch(()=>null);if(uploaded.status!==409&&!["Duplicate","409"].includes(String(e?.statusCode))&&e?.error!=="Duplicate")throw new ImageGenerationError(502,"파일 등록에 실패했습니다. 동일 결과 승인으로 다시 확인할 수 있습니다.");}
  const metadata=validateDesignAssetMetadata({source:"openai",usageTags:generation?["common"]:[proof.pattern],reuseScope:"project",...(generation ? {imageGeneration:generation} : {}),transparency:proof.role==="hero_illustration"?"yes":"no"});
  if(!metadata.ok)throw new ImageGenerationError(400,metadata.message);
  const insert=await insertProjectDesignAssetRecord({id:proof.assetId,project_id:proof.projectId,name,asset_type:proof.role==="hero_background"?"background":"illustration",
    metadata:metadata.metadata,parent_source_asset_id:null,language:"ko",variant:"primary",background_mode:"any",usage_role:"article",approval_status:generation?"draft":"approved",is_primary:false,is_active:true,sort_order:0,
    storage_bucket:bucket,storage_path:path,original_file_name:file.name,mime_type:"image/png",file_size_bytes:file.size,alt_text:null,usage_note:`GPT Images · ${proof.model} · ${proof.role}`},headers(),AbortSignal.timeout(10000));
  const saved=await findGeneratedImageAsset(proof,generation);if(saved)return {...saved,duplicate:false};
  if(!insert.ok)throw new ImageGenerationError(502,"자산 기록을 확인하지 못했습니다. 동일 결과 승인으로 다시 확인할 수 있습니다.");
  throw new ImageGenerationError(502,"저장 결과를 확인하지 못했습니다. 새로고침 후 자산 목록을 확인해 주세요.");
}
