import "server-only";
import { NextResponse } from "next/server";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { assertUuid, parseUploadInput, directUploadEnabled, DirectUploadError } from "@/lib/design-asset-direct-upload-contract";

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"}});
async function boundedJson(request:Request):Promise<Record<string,unknown>> {
  if(!request.headers.get("content-type")?.startsWith("application/json")||!request.body)throw new DirectUploadError(400,"invalid_request","rejected");
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new DirectUploadError(413,"request_too_large","rejected");}chunks.push(value);}}
  finally{reader.releaseLock();}
  const value=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(!value||typeof value!=="object"||Array.isArray(value))throw new DirectUploadError(400,"invalid_request","rejected");
  return value;
}
export async function handleDirectUpload(request:Request,action:"prepare"|"status"|"finalize") {
  if(!directUploadEnabled())return reply({ok:false,code:"disabled"},404);
  try{
    // Same-origin GET fetches may omit Origin. Fetch Metadata is browser-controlled;
    // the existing helper still validates Vercel host/proto/canonical origin.
    if(action==="status"&&!request.headers.has("origin")&&request.headers.get("sec-fetch-site")==="same-origin"){
      const headers=new Headers(request.headers);
      headers.set("origin",process.env.VERCEL==="1"?`https://${headers.get("host")}`:new URL(request.url).origin);
      requireImageSameOrigin(new Request(request.url,{headers}));
    }else requireImageSameOrigin(request);
    const raw:Record<string,unknown>=action==="status"?Object.fromEntries(new URL(request.url).searchParams):await boundedJson(request);
    assertUuid(raw.projectId);
    const access=await requireProjectApiAccess({projectId:raw.projectId});
    if(!access.ok){access.response.headers.set("Cache-Control","private, no-store");return access.response;}
    const {directUploadService}=await import("@/lib/design-asset-direct-upload-server");
    const service=directUploadService(access.user,access.project.id,AbortSignal.any([request.signal,AbortSignal.timeout(45000)]));
    if(action==="prepare")return reply(await service.prepare(parseUploadInput(raw)));
    if(Object.keys(raw).some(k=>!["projectId","sessionId",...(action==="status"?["requestKey"]:[])].includes(k)))throw new DirectUploadError(400,"unexpected_input","rejected");
    if(raw.sessionId!==undefined)assertUuid(raw.sessionId);
    if(action==="status"){
      if(raw.requestKey!==undefined)assertUuid(raw.requestKey);
      if(Boolean(raw.sessionId)===Boolean(raw.requestKey))throw new DirectUploadError(400,"invalid_request","rejected");
      return reply(await service.status(raw.sessionId as string|undefined,raw.requestKey as string|undefined));
    }
    assertUuid(raw.sessionId);return reply(await service.finalize(raw.sessionId));
  }catch(e){
    const error=e instanceof DirectUploadError?e:e instanceof SyntaxError?new DirectUploadError(400,"invalid_request","rejected"):
      e&&typeof e==="object"&&"status"in e&&e.status===403?new DirectUploadError(403,"origin_forbidden","rejected"):new DirectUploadError(502,"upload_result_unknown");
    return reply({ok:false,code:error.code,outcome:error.outcome,message:error.outcome==="unknown"?"등록 결과를 확인하지 못했습니다. 같은 요청키로 상태를 확인하세요.":error.outcome==="pending"?"현재 업로드 상태를 확인한 뒤 다시 진행하세요.":"권한·파일·업로드 조건을 확인하세요."},error.status);
  }
}
