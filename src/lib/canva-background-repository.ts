import "server-only";
import { CanvaConnectError, digest } from "@/lib/canva-connect-contract";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { validateCanvaPng, canvaPngMaxBytes } from "@/lib/canva-png-export";
type Background = {id:string;name:string;project_id:string;asset_type:string;approval_status:string;is_active:boolean;metadata?:{source?:string};storage_bucket:string;storage_path:string;mime_type:string;updated_at:string};
function headers(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new CanvaConnectError(503,"자산 서버 설정을 확인하세요.");return {apikey:key,Authorization:`Bearer ${key}`};}
export async function listCanvaBackgrounds(projectId:string):Promise<Background[]> {
 const endpoint=getSupabaseRestEndpoint(`/rest/v1/newsletter_project_design_assets?${new URLSearchParams({select:"id,name,project_id,asset_type,approval_status,is_active,metadata,storage_bucket,storage_path,mime_type,updated_at",project_id:`eq.${projectId}`,asset_type:"eq.background",approval_status:"eq.approved",is_active:"eq.true",storage_bucket:"eq.design-production-assets",mime_type:"eq.image/png",limit:"100",order:"created_at.desc"})}`);
 if(!endpoint)throw new CanvaConnectError(503,"자산 서버 설정을 확인하세요.");
 const r=await fetch(endpoint,{headers:headers(),cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)throw new CanvaConnectError(503,"승인 배경 자산을 확인하지 못했습니다.");
 const rows=await r.json() as Background[];return rows.filter(a=>a.project_id===projectId&&a.asset_type==="background"&&a.approval_status==="approved"&&a.is_active&&a.metadata?.source==="openai"&&a.storage_path.startsWith(`projects/${projectId}/`)&&!a.storage_path.split('/').some(p=>["..","."].includes(p)));
}
export async function readCanvaBackground(projectId:string,assetId:string) {
 const asset=(await listCanvaBackgrounds(projectId)).find(a=>a.id===assetId);if(!asset)throw new CanvaConnectError(404,"현재 프로젝트의 승인된 GPT 배경 PNG를 선택하세요.");
 const endpoint=getSupabaseStorageEndpoint(`/object/authenticated/${asset.storage_bucket}/${asset.storage_path.split('/').map(encodeURIComponent).join('/')}`);if(!endpoint)throw new CanvaConnectError(503,"비공개 파일 설정을 확인하세요.");
 const r=await fetch(endpoint,{headers:headers(),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!r.ok||!r.body)throw new CanvaConnectError(502,"승인 배경 파일을 읽지 못했습니다.");
 const reader=r.body.getReader();let size=0;const parts:Uint8Array[]=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>canvaPngMaxBytes){await reader.cancel();throw new CanvaConnectError(413,"배경 PNG는 10MB 이하만 지원합니다.");}parts.push(part.value);}}finally{reader.releaseLock();}
 const bytes=Buffer.concat(parts);const info=validateCanvaPng(bytes,r.headers.get('content-type')||'');
 if(info.width*4!==info.height*3)throw new CanvaConnectError(409,"배경은 원본 비율을 유지하는 3:4 PNG를 사용하세요.");
 return {id:asset.id,name:asset.name,bytes,hash:digest(JSON.stringify([asset.id,asset.updated_at,digest(bytes.toString('base64'))])),...info};
}
