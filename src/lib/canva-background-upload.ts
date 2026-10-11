import "server-only";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { connectedCanvaRequest } from "@/lib/canva-connect-server";
import { readCanvaUploadJob } from "@/lib/canva-background-autofill";
import type {Connection, Execution} from "@/lib/canva-connection-repository";
export async function uploadCanvaBackground(input:{id:string;hash:string;bytes:Uint8Array},token:string,execution:Execution,update:(patch:object)=>Promise<Connection>) {
 let current=execution;
 async function save(upload:NonNullable<Execution['backgroundUpload']>){current={...current,status:upload.status==="failed"?"failed":"uploading",backgroundUpload:upload};await update({execution:current});}
 const prior=current.backgroundUpload;
 if(prior && (prior.sourceAssetId!==input.id||prior.sourceHash!==input.hash))throw new CanvaConnectError(409,"업로드 대상이 변경되었습니다.");
 if(prior?.status==="success" && prior.assetId)return {execution:current,assetId:prior.assetId};
 if(prior && ["sending","unknown","failed"].includes(prior.status))throw new CanvaConnectError(409,"이전 이미지 업로드 결과를 Canva에서 확인하세요. 중복 업로드하지 않습니다.");
 let job;
 if(prior?.jobId){job=readCanvaUploadJob(await connectedCanvaRequest(`/asset-uploads/${encodeURIComponent(prior.jobId)}`,token,update));if(job.id!==prior.jobId)throw new CanvaConnectError(502,"업로드 job 식별자가 다릅니다.");}
 else{
  await save({sourceAssetId:input.id,sourceHash:input.hash,status:"sending"});
  try{
   const r=await fetch('https://api.canva.com/rest/v1/asset-uploads',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','Asset-Upload-Metadata':JSON.stringify({name_base64:Buffer.from(`GPT ${input.id}`).toString('base64')})},body:new Uint8Array(input.bytes)});
   if(!r.ok){if(r.status===401)await update({access_token:null,refresh_token:null,expires_at:null});throw new CanvaConnectError([400,401,403,429].includes(r.status)?r.status:502,"Canva 이미지 업로드가 거절되었습니다. 연결·권한을 확인하세요.");}
   job=readCanvaUploadJob(await r.json());
  }catch(e){const rejected=e instanceof CanvaConnectError&&[400,401,403,429].includes(e.status);await save({sourceAssetId:input.id,sourceHash:input.hash,status:rejected?"failed":"unknown"});throw e instanceof CanvaConnectError?e:new CanvaConnectError(504,"이미지 업로드 결과가 불확실합니다. 자동 재시도하지 않습니다.");}
 }
 const deadline=Date.now()+10000;
 for(let n=0;;n++){
  await save({sourceAssetId:input.id,sourceHash:input.hash,jobId:job.id,status:job.status,...(job.assetId?{assetId:job.assetId}:{})});
  if(job.status==='failed')throw new CanvaConnectError(502,"Canva 이미지 업로드 처리에 실패했습니다.");
  if(job.assetId)return {execution:current,assetId:job.assetId};
  if(n>=3||Date.now()>=deadline)return {execution:current,assetId:null};
  await new Promise(resolve=>setTimeout(resolve,1000));
  const next=readCanvaUploadJob(await connectedCanvaRequest(`/asset-uploads/${encodeURIComponent(job.id)}`,token,update));if(next.id!==job.id)throw new CanvaConnectError(502,"업로드 job 식별자가 다릅니다.");job=next;
 }
}
