import "server-only";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { requestOpenAiSpeech } from "@/lib/article-tts-audio";
import { executeMarinRecovery, reconcileMarinRecovery, type MarinDependencies } from "@/lib/hwaseong-marin-recovery-engine";
import {
  marinParentId, marinProjectId, marinAudioId, marinPath, marinOriginalPath, marinRequestHash,
  marinMaxBytes, inspectMarinMp3, validateMarinParent, validMarinReceipt,
  bytesHash, marinScriptHash,
  type MarinActor, type MarinReceipt, type MarinParent,
} from "@/lib/hwaseong-marin-recovery-contract";

export function marinRecoveryEnabled() {
  return process.env.HWASEONG_MARIN_RECOVERY_ENABLED === "true" && process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "staging" && stagingEnvironmentConfigured();
}
function headers() {
  if (!marinRecoveryEnabled() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw Error("Recovery unavailable");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY.trim(); return {apikey:key,Authorization:`Bearer ${key}`};
}
function endpoint(path: string, storage=false) {
  const url=storage ? getSupabaseStorageEndpoint(path) : getSupabaseRestEndpoint(`/rest/v1/${path}`);
  if (!url) throw Error("Endpoint unavailable"); return url;
}
async function query<T>(path: string, body?: unknown): Promise<T> {
  const response=await fetch(endpoint(path),{method:body===undefined?"GET":"POST",headers:{...headers(),"Content-Type":"application/json"},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:"no-store",signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error("Recovery database unavailable");
  return await response.json() as T;
}
const receiptColumns="parent_id,project_id,audio_id,request_key,phase,path,byte_hash,byte_size,duration_seconds,provider_status,provider_request_id,last_error";
export async function marinRecoveryReceipt() {
  const rows=await query<MarinReceipt[]>(`hwaseong_marin_recoveries?select=${receiptColumns}&parent_id=eq.${marinParentId}&project_id=eq.${marinProjectId}&limit=1`);
  if (!rows[0]) return null;
  if (!validMarinReceipt(rows[0])) throw Error("Recovery scope mismatch"); return rows[0];
}
async function parent() {
  const rows=await query<MarinParent[]>(`newsletter_audio_files?select=*&id=eq.${marinParentId}&project_id=eq.${marinProjectId}&limit=1`);
  if (!rows[0]) throw Error("Parent missing"); validateMarinParent(rows[0]); return rows[0];
}
function objectUrl(path: string) {
  if (![marinOriginalPath,marinPath].includes(path)) throw Error("Storage scope mismatch");
  return endpoint(`/object/audio-files/${path.split('/').map(encodeURIComponent).join('/')}`,true);
}
async function object(path: string) {
  const r=await fetch(objectUrl(path),{headers:headers(),cache:"no-store",signal:AbortSignal.timeout(20000)});
  if (!r.ok) {
    // Supabase may use HTTP 400 with a 404 JSON error. Denied/timeouts are never absence.
    const e=await r.json().catch(()=>null);
    if ([400,404].includes(r.status) && String(e?.statusCode)==="404" && e?.message==="Object not found") return null;
    throw Error("Storage read unconfirmed");
  }
  if (r.headers.get("content-type")?.split(';')[0].trim()!=="audio/mpeg" || !r.body) throw Error("Storage MIME mismatch");
  const reader=r.body.getReader(), chunks:Uint8Array[]=[];let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>marinMaxBytes)throw Error("Storage size limit");chunks.push(value);} }
  finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return bytes;
}

// The journal records a past operation, not a promise that a subsequently deleted file still exists.
export async function marinRecoveryStatus() {
  const receipt = await marinRecoveryReceipt();
  const records = await query<Array<{id:string;script_status:string;ai_tts_generated_at:string|null}>>(
    `newsletter_audio_files?select=id,script_status,ai_tts_generated_at&project_id=eq.${marinProjectId}&id=in.(${marinParentId},${marinAudioId})`,
  );
  const existence = async (path:string) => {
    try { const bytes=await object(path); return bytes ? "present" as const : "missing" as const; }
    catch { return "unknown" as const; }
  };
  const [original,replacement]=await Promise.all([existence(marinOriginalPath),existence(marinPath)]);
  const record = (id:string) => {const row=records.find(r=>r.id===id);return {exists:!!row,status:row?.script_status??null,generatedAt:row?.ai_tts_generated_at??null};};
  return {receipt,records:{original:record(marinParentId),replacement:record(marinAudioId)},objects:{original,replacement}};
}
function dependencies(): MarinDependencies {
  return {
    parent,receipt:marinRecoveryReceipt,object,
    claim:(actor,snapshot,token,approval)=>query("rpc/marin_recovery_claim",{p_actor:actor,p_parent_snapshot:snapshot,p_token:token,p_approval:approval}),
    record:(actor,token,proof,status,requestId,error)=>query("rpc/marin_recovery_record",{p_actor:actor,p_token:token,p_proof:proof,p_status:status,p_request_id:requestId,p_error:error}),
    complete:(actor,proof)=>query("rpc/marin_recovery_complete",{p_actor:actor,p_hash:proof.hash,p_size:proof.size,p_duration:proof.duration}),
    speech:text=>requestOpenAiSpeech(text,"marin","gpt-4o-mini-tts",{
      apiKey:process.env.STAGING_OPENAI_API_KEY?.trim()??"",captureReceipt:true,maxBytes:marinMaxBytes,signal:AbortSignal.timeout(90000),
    }),
    put:async(path,bytes)=>{
      const r=await fetch(objectUrl(path),{method:"POST",headers:{...headers(),"Content-Type":"audio/mpeg","x-upsert":"false"},body:Buffer.from(bytes),cache:"no-store",signal:AbortSignal.timeout(20000)});
      if (!r.ok) throw Error("Upload unconfirmed");
    },
  };
}
export async function runMarinRecovery(actor: MarinActor, approval: string) {
  // No DB/Storage or provider request when OFF or scoped key missing. Never fall back.
  if (!marinRecoveryEnabled() || !process.env.STAGING_OPENAI_API_KEY?.trim()) return {ok:false,state:"rejected",calls:0,code:"scoped_recovery_unavailable"};
  return executeMarinRecovery(dependencies(),actor,approval);
}
export async function finishMarinRecovery(actor: MarinActor) {
  if (!marinRecoveryEnabled()) return {ok:false,state:"rejected",calls:0,code:"recovery_unavailable"};
  return reconcileMarinRecovery(dependencies(),actor);
}

// A historical ready receipt alone cannot advertise a deleted/replaced object as playable.
export async function resolvedMarinAudio(verifyBytes = true) {
  if (!marinRecoveryEnabled()) return null;
  const receipt=await marinRecoveryReceipt(); if (!receipt || receipt.phase!=="ready") return null;
  const rows=await query<Array<MarinParent>>(`newsletter_audio_files?select=*&id=eq.${marinAudioId}&project_id=eq.${marinProjectId}&limit=1`), a=rows[0];
  if (!a || a.id!==marinAudioId || a.project_id!==marinProjectId || a.article_id!==null || a.source_type!=="ai_tts" || a.transcript_type!=="custom_script" || typeof a.script_text!=="string" || bytesHash(Buffer.from(a.script_text))!==marinScriptHash ||
      a.ai_tts_text_hash!==marinRequestHash || a.ai_tts_voice!=="marin" || a.ai_tts_model!=="gpt-4o-mini-tts" || a.script_status!=="approved" ||
      !a.ai_tts_generated_at || a.file_path!==marinPath || JSON.stringify(a.ai_tts_audio_paths)!==JSON.stringify([marinPath]) || a.duration_seconds!==receipt.duration_seconds) return null;
  if (verifyBytes) {
    const data=await object(marinPath); if (!data) return null;
    let proof; try { proof=inspectMarinMp3(data); } catch { return null; }
    if (proof.hash!==receipt.byte_hash || proof.size!==receipt.byte_size || proof.duration!==receipt.duration_seconds) return null;
  }
  return {id:marinAudioId,voice:"marin" as const,transcriptText:a.script_text,receipt};
}
export async function recoveredMarinDelivery(segment: string|null, request: Request) {
  const audio=await resolvedMarinAudio(false); if (!audio) return new Response(null,{status:404});
  const data=await object(marinPath); if (!data) return new Response(null,{status:404});
  const proof=inspectMarinMp3(data), r=audio.receipt;
  if (proof.hash!==r.byte_hash || proof.size!==r.byte_size || proof.duration!==r.duration_seconds) return new Response(null,{status:409});
  const common={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
  if (segment===null) return Response.json({hasAudio:true,source:"ai_tts",stale:false,voice:"marin",segments:[{index:0,url:`/api/projects/hwaseong-2026-10-samples/sample-tts?audio=${marinParentId}&segment=0`}]},{headers:common});
  if (segment!=="0") return new Response(null,{status:404});
  const out=new Headers({...common,"Content-Type":"audio/mpeg","Accept-Ranges":"bytes"});
  const range=request.headers.get("range"); let start=0,end=data.length-1,status=200;
  if (range) {
    const m=/^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m || (!m[1]&&!m[2])) return new Response(null,{status:416,headers:{...common,"Content-Range":`bytes */${data.length}`}});
    if (!m[1]) start=Math.max(0,data.length-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
    if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=data.length) return new Response(null,{status:416,headers:{...common,"Content-Range":`bytes */${data.length}`}});
    status=206;out.set("Content-Range",`bytes ${start}-${end}/${data.length}`);
  }
  out.set("Content-Length",String(end-start+1)); return new Response(Buffer.from(data.subarray(start,end+1)),{status,headers:out});
}
