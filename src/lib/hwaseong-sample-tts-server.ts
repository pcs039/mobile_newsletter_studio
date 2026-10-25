import "server-only";
import { createHash } from "crypto";
import { chunkArticleTtsText, normalizeKoreanTtsText, requestOpenAiSpeech, articleTtsVoices, type ArticleTtsVoice } from "@/lib/article-tts-audio";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { getProjectContent } from "@/lib/newsletter-repository";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { hwaseongSampleSlug, proposalSample, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { sampleArticleVoice, sampleNarration, sampleTtsModel, sampleVoiceProbe, type SampleAudio } from "@/lib/hwaseong-sample-narration";
import { marinRecoveryEnabled, marinRecoveryReceipt, resolvedMarinAudio, recoveredMarinDelivery } from "@/lib/hwaseong-marin-recovery-server";
import { marinParentId, marinRequestHash } from "@/lib/hwaseong-marin-recovery-contract";

export const sampleProjectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
const prefix = `projects/${sampleProjectId}/sample-tts-v1/`;
const titlePrefix = "[시연 TTS v1] ";
type Row = { id:string; article_id:string|null; title:string; file_path:string; script_text:string; script_status:string; ai_tts_voice:ArticleTtsVoice; ai_tts_model:string; ai_tts_text_hash:string; ai_tts_audio_paths:string[]; ai_tts_generated_at:string|null };
const columns = "id,article_id,title,file_path,script_text,script_status,ai_tts_voice,ai_tts_model,ai_tts_text_hash,ai_tts_audio_paths,ai_tts_generated_at";
function sampleTtsApiKey() {
 return stagingEnvironmentConfigured() ? process.env.STAGING_OPENAI_API_KEY?.trim() ?? "" : "";
}
function headers() {
  if (!stagingEnvironmentConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw Error("Staging configuration required");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY.trim(); return {apikey:key,Authorization:`Bearer ${key}`};
}
function table(query="") { const url=getSupabaseRestEndpoint(`/rest/v1/newsletter_audio_files${query}`); if(!url)throw Error("Database unavailable");return url; }
function storage(path:string) { const url=getSupabaseStorageEndpoint(`/object/audio-files/${path.split('/').map(encodeURIComponent).join('/')}`);if(!url)throw Error("Storage unavailable");return url; }
function hash(text:string) {return createHash("sha256").update(text).digest("hex");}
export function sampleTtsIdentity(job:string,voice:ArticleTtsVoice,text:string) {
 const digest=hash(`sample-tts-v1\n${job}\n${voice}\n${sampleTtsModel}\n${text}`);
 return {id:`${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`,hash:digest};
}
export async function sampleTtsPlan(provided?: ProposalSample[]) {
 headers(); let samples=provided; if(!samples){const content=await getProjectContent(hwaseongSampleSlug);if(content.source!=="supabase")throw Error("Sample content unavailable");samples=content.articles.map(a=>proposalSample(a,sampleProjectId)).filter((s):s is ProposalSample=>!!s);}
 const plans=samples.flatMap(s=>{const a=s.article,voice=sampleArticleVoice(a.id);if(!s||!voice)return [];const text=normalizeKoreanTtsText(sampleNarration(s));if(!text||text.length>16000)throw Error("Narration limit");return [{job:a.id,voice,text,title:s.headline.replaceAll('\n',' ')}];});
 return [...articleTtsVoices.map(voice=>({job:`probe-${voice}`,voice,text:normalizeKoreanTtsText(sampleVoiceProbe),title:`음질 비교 ${voice}`})),...plans].map(p=>({...p,...sampleTtsIdentity(p.job,p.voice,p.text),chunks:chunkArticleTtsText(p.text)}));
}
export async function sampleTtsRows() {
 const r=await fetch(table(`?select=${columns}&project_id=eq.${sampleProjectId}&title=like.${encodeURIComponent(titlePrefix)}*&limit=20`),{headers:headers(),cache:"no-store"});if(!r.ok)throw Error("Audio lookup failed");return await r.json() as Row[];
}
function ready(row:Row) {return row.script_status==="approved"&&!!row.ai_tts_generated_at&&row.ai_tts_model===sampleTtsModel&&row.ai_tts_audio_paths.length>0&&row.ai_tts_audio_paths.every(p=>p.startsWith(prefix+row.id+"/")&&!p.includes(".."))&&row.file_path===row.ai_tts_audio_paths[0];}
export async function sampleAudioIndex(samples?:ProposalSample[]):Promise<Record<string,SampleAudio>> {
 if(!stagingEnvironmentConfigured())return {};
 const rows=await sampleTtsRows(),plans=await sampleTtsPlan(samples);const result:Record<string,SampleAudio>={};
 for(const plan of plans){const row=rows.find(r=>r.id===plan.id&&r.ai_tts_text_hash===plan.hash&&r.script_text===plan.text&&r.ai_tts_voice===plan.voice);if(row&&ready(row))result[plan.job]={id:row.id,voice:plan.voice,transcriptText:row.script_text,manifestHref:`/api/projects/${hwaseongSampleSlug}/sample-tts?audio=${row.id}`};}
 if(marinRecoveryEnabled()) {const recovered=await resolvedMarinAudio();if(recovered&&plans.some(p=>p.job==='probe-marin'&&p.id===marinParentId&&p.hash===marinRequestHash&&p.text===recovered.transcriptText))result['probe-marin']={id:recovered.id,voice:recovered.voice,transcriptText:recovered.transcriptText,manifestHref:`/api/projects/${hwaseongSampleSlug}/sample-tts?audio=${marinParentId}`};}
 return result;
}
// Read-only, non-generation check; never returns provider credentials or raw error text.
export async function checkSampleTtsProvider() {
 headers(); const key=sampleTtsApiKey();if(!key)return {configured:false};
 try {const r=await fetch(`https://api.openai.com/v1/models/${sampleTtsModel}`,{headers:{Authorization:`Bearer ${key}`},cache:"no-store",signal:AbortSignal.timeout(15000)});let code="";if(!r.ok){const body=await r.json().catch(()=>null);const value=body?.error?.code;if(typeof value==='string'&&/^[a-z0-9_]{1,64}$/.test(value))code=value;}
 return {configured:true,model:sampleTtsModel,httpStatus:r.status,code,readOnly:true};}catch{return {configured:true,model:sampleTtsModel,readOnly:true,message:"Provider check unavailable"};}
}
export async function sampleTtsStatus() {
 const plans=await sampleTtsPlan(),rows=await sampleTtsRows();
 const audio=await sampleAudioIndex();
 const recoveredAttempt=marinRecoveryEnabled()?await marinRecoveryReceipt():null;
 return {configured:!!sampleTtsApiKey(),model:sampleTtsModel,plans:plans.map(p=>{const row=rows.find(r=>r.id===p.id);return {job:p.job,id:p.id,voice:p.voice,title:p.title,characters:p.text.length,calls:p.chunks.length,state:audio[p.job]?"ready":row?ready(row)?"ready":"unknown":p.id===marinParentId&&recoveredAttempt?"unknown":"not_started"};}),audio};
}
export async function generateSampleTts(job:string) {
 const plan=(await sampleTtsPlan()).find(p=>p.job===job);if(!plan)return {ok:false,state:"rejected",message:"허용되지 않은 기사 또는 음성입니다."};
 const apiKey=sampleTtsApiKey();
 if(!apiKey)return {ok:false,state:"rejected",message:"Staging 전용 OpenAI API가 설정되지 않았습니다."};
 if(job==='probe-marin'&&plan.id===marinParentId&&plan.hash===marinRequestHash&&marinRecoveryEnabled()){const recovered=await resolvedMarinAudio();if(recovered)return {ok:true,state:"ready",id:recovered.id,calls:0,voice:recovered.voice,model:sampleTtsModel};if(await marinRecoveryReceipt())return {ok:false,state:"unknown",id:plan.id,calls:0,message:"복구 시도 이력이 있습니다. 음성 삭제 후에도 같은 요청을 자동 재생성하지 않습니다."};}
 if(!job.startsWith('probe-')){const probes=(await sampleTtsPlan()).filter(p=>p.job.startsWith('probe-')),rows=await sampleTtsRows();const recovered=marinRecoveryEnabled()?await resolvedMarinAudio():null;if(!probes.every(p=>rows.some(r=>r.id===p.id&&ready(r))||(p.id===marinParentId&&p.hash===marinRequestHash&&!!recovered&&p.text===recovered.transcriptText)))return {ok:false,state:"rejected",message:"네 음성 비교 샘플을 먼저 생성·검수하세요."};}
 const h=headers(), paths=plan.chunks.map((_,i)=>`${prefix}${plan.id}/${String(i).padStart(3,'0')}.mp3`);
 // Claim the deterministic primary key before a paid call. Unknown outcomes never regenerate.
 const claim=await fetch(table(),{method:"POST",headers:{...h,"Content-Type":"application/json"},body:JSON.stringify({id:plan.id,project_id:sampleProjectId,article_id:null,title:titlePrefix+plan.title,file_path:paths[0],script_text:plan.text,script_status:"pending",source_type:"ai_tts",transcript_type:"custom_script",ai_tts_voice:plan.voice,ai_tts_model:sampleTtsModel,ai_tts_text_hash:plan.hash,ai_tts_audio_paths:paths}),cache:"no-store"});
 if(!claim.ok){const row=(await sampleTtsRows()).find(r=>r.id===plan.id);return {ok:!!row&&ready(row),state:row&&ready(row)?"ready":"unknown",id:plan.id,message:"동일 요청의 저장 상태를 확인했습니다. 자동 재생성하지 않습니다."};}
 let calls=0,bytes=0;
 try {
 for(let i=0;i<plan.chunks.length;i++){
  calls++;const speech=await requestOpenAiSpeech(plan.chunks[i],plan.voice,sampleTtsModel,{apiKey});
  if(!speech.ok)return {ok:false,state:"unknown",id:plan.id,calls,providerStatus:speech.httpStatus,message:"음성 생성이 완료되지 않았습니다. 기존 요청을 보존하며 자동 재시도하지 않습니다."};
  const data=new Uint8Array(speech.data);if(data.length<100||data.length>8*1024*1024||!(String.fromCharCode(...data.slice(0,3))==='ID3'||data[0]===255))throw Error("Invalid MP3");
  bytes+=data.length;let uploaded=false;
  try{const r=await fetch(storage(paths[i]),{method:"POST",headers:{...h,"Content-Type":"audio/mpeg","x-upsert":"false"},body:Buffer.from(data),cache:"no-store"});uploaded=r.ok;}catch{/* Verify ambiguous upload; never call provider again. */}
  const check=await fetch(storage(paths[i]),{headers:h,cache:"no-store"});if(!check.ok)throw Error(uploaded?"Upload verification failed":"Upload incomplete");
  const stored=Buffer.from(await check.arrayBuffer());if(stored.length!==data.length||hash(stored.toString('base64'))!==hash(Buffer.from(data).toString('base64')))throw Error("Upload integrity mismatch");
 }
 const done=await fetch(table(`?id=eq.${plan.id}&project_id=eq.${sampleProjectId}&script_status=eq.pending`),{method:"PATCH",headers:{...h,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({script_status:"approved",ai_tts_generated_at:new Date().toISOString()}),cache:"no-store"});
 if(!done.ok)throw Error("Commit unknown");const rows=await done.json() as Row[];if(!rows[0]||!ready(rows[0]))throw Error("Commit unconfirmed");
 return {ok:true,state:"ready",id:plan.id,calls,bytes,voice:plan.voice,model:sampleTtsModel};
 }catch{return {ok:false,state:"unknown",id:plan.id,calls,bytes,message:"결과 확인이 필요합니다. 같은 요청 ID를 조회하고 자동 재생성하지 마세요."};}
}
export async function sampleTtsDelivery(id:string,segment:string|null,request:Request) {
 if(id===marinParentId&&marinRecoveryEnabled()&&await resolvedMarinAudio(false))return recoveredMarinDelivery(segment,request);
 const row=(await sampleTtsRows()).find(r=>r.id===id);const plan=(await sampleTtsPlan()).find(p=>p.id===id);if(!row||!plan||row.ai_tts_text_hash!==plan.hash||!ready(row))return new Response(null,{status:404});
 if(segment===null)return Response.json({hasAudio:true,source:"ai_tts",stale:false,voice:row.ai_tts_voice,segments:row.ai_tts_audio_paths.map((_,index)=>({index,url:`/api/projects/${hwaseongSampleSlug}/sample-tts?audio=${id}&segment=${index}`}))},{headers:{"Cache-Control":"private, no-store"}});
 if(!/^\d{1,2}$/.test(segment)||!row.ai_tts_audio_paths[Number(segment)])return new Response(null,{status:404});
 const r=await fetch(storage(row.ai_tts_audio_paths[Number(segment)]),{headers:{...headers(),...(request.headers.has('range')?{Range:request.headers.get('range')!}:{})},cache:"no-store"});
 const out=new Headers({"Cache-Control":"private, no-store","Content-Type":"audio/mpeg","X-Content-Type-Options":"nosniff"});for(const key of ['content-length','content-range','accept-ranges']){const v=r.headers.get(key);if(v)out.set(key,v);}return new Response(r.body,{status:r.status,headers:out});
}
