import "server-only";
import { createHash } from "node:crypto";
import { chunkArticleTtsText, normalizeKoreanTtsText, requestOpenAiSpeech, type ArticleTtsVoice } from "@/lib/article-tts-audio";
import { inspectArticleMp3, readTtsBytes } from "@/lib/article-tts-media";
import { createTtsDiagnostics, SpeechRequestError } from "@/lib/tts-request-diagnostics";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { getProjectContent } from "@/lib/newsletter-repository";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { hwaseongSampleSlug, proposalSample, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { splitArticleVoice, splitNarration, splitProbeText, splitTtsModel, splitTtsShutdown } from "@/lib/hwaseong-sample-split-narration";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";

const projectId="4cd5297e-a0fd-434c-84d4-fa4d3baf9389",prefix=`projects/${projectId}/sample-tts-v2/`,titlePrefix="[시연 TTS v2] ";
const probeVoices:ArticleTtsVoice[]=["marin","cedar","coral","onyx"];
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
type Row={id:string;project_id:string;article_id:string|null;title:string;file_path:string;script_text:string;script_status:string;ai_tts_voice:string;ai_tts_model:string;ai_tts_text_hash:string;ai_tts_audio_paths:string[];ai_tts_generated_at:string|null;duration_seconds:number|null};
const columns="id,project_id,article_id,title,file_path,script_text,script_status,ai_tts_voice,ai_tts_model,ai_tts_text_hash,ai_tts_audio_paths,ai_tts_generated_at,duration_seconds";
function headers(){if(!stagingEnvironmentConfigured()||!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())throw Error("Staging required");const key=process.env.SUPABASE_SERVICE_ROLE_KEY.trim();return {apikey:key,Authorization:`Bearer ${key}`};}
function table(q=""){const u=getSupabaseRestEndpoint('/rest/v1/newsletter_audio_files'+q);if(!u)throw Error("Database unavailable");return u;}
function object(path:string){if(!path.startsWith(prefix)||path.includes('..'))throw Error("Invalid membership");const u=getSupabaseStorageEndpoint('/object/audio-files/'+path.split('/').map(encodeURIComponent).join('/'));if(!u)throw Error("Storage unavailable");return u;}
export async function splitTtsPlans(provided?:ProposalSample[]){
 headers();let samples=provided;if(!samples){const content=await getProjectContent(hwaseongSampleSlug);if(content.source!=="supabase")throw Error("Content unavailable");samples=content.articles.map(a=>proposalSample(a,projectId)).filter((s):s is ProposalSample=>!!s);}
 if(samples.length!==7||new Set(samples.map(s=>s.article.id)).size!==7||samples.some(s=>!splitArticleVoice(s.article.id)))throw Error("Seven sample membership required");
 const jobs=[...probeVoices.map(voice=>({job:`probe-v2-${voice}`,voice,title:`음질 비교 ${voice}`,text:splitProbeText})),...samples.flatMap(s=>(["summary","detail"] as const).map(part=>({job:`${s.article.id}:${part}`,voice:splitArticleVoice(s.article.id)!,title:`${s.headline.replaceAll('\n',' ')} · ${part==='summary'?'요약':'상세'}`,text:splitNarration(s,part)})))];
 return jobs.map(p=>identifyPlan(p));
}
function identifyPlan(p:{job:string;voice:ArticleTtsVoice;title:string;text:string}){const text=normalizeKoreanTtsText(p.text);if(!text||text.length>8000)throw Error("Narration limits");const digest=hash(`sample-tts-v2\n${p.job}\n${p.voice}\n${splitTtsModel}\n${text}`),id=`${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;const chunks=chunkArticleTtsText(text,600);return {...p,text,id,hash:digest,scriptHash:hash(text),chunks,paths:chunks.map((_,i)=>`${prefix}${id}/${String(i).padStart(3,'0')}.mp3`)};}
type Plan=Awaited<ReturnType<typeof splitTtsPlans>>[number];
const previousVoices:Record<string,ArticleTtsVoice>={'723d4dff-9d15-4515-af0a-0d725eb94b5e':'onyx','a802c522-becf-496e-b78f-e374e4b7e98d':'cedar'};
function previousPlans(plans:Plan[]){return plans.flatMap(p=>{const voice=previousVoices[p.job.split(':')[0]];return voice?[identifyPlan({...p,voice})]:[];});}
export async function splitTtsRows(){const out:Row[]=[];for(let offset=0;offset<1000;offset+=100){const q=new URLSearchParams({select:columns,project_id:`eq.${projectId}`,title:`like.${titlePrefix}*`,order:'id.asc',limit:'100',offset:String(offset)});const r=await fetch(table('?'+q),{headers:headers(),cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("Audio status unavailable");const page:Row[]=await r.json();if(!Array.isArray(page))throw Error("Invalid status");out.push(...page);if(page.length<100)return out;}throw Error("Unconfirmed pagination");}
function ready(row:Row|undefined,p:Plan){return !!row&&row.project_id===projectId&&row.article_id===null&&row.script_status==='approved'&&!!row.ai_tts_generated_at&&row.ai_tts_model===splitTtsModel&&row.ai_tts_voice===p.voice&&row.ai_tts_text_hash===p.hash&&row.script_text===p.text&&JSON.stringify(row.ai_tts_audio_paths)===JSON.stringify(p.paths)&&row.file_path===p.paths[0];}
function audio(p:Plan):SampleAudio{return {id:p.id,voice:p.voice,transcriptText:p.text,manifestHref:`/api/projects/${hwaseongSampleSlug}/sample-tts?version=2&audio=${p.id}`};}
export async function splitAudioIndex(provided?:ProposalSample[]):Promise<Record<string,SampleAudio>>{
 if(!stagingEnvironmentConfigured())return {};const [plans,rows]=await Promise.all([splitTtsPlans(provided),splitTtsRows()]);let stories=plans.filter(p=>!p.job.startsWith('probe-'));
 // Keep each verified pair until BOTH replacement parts are ready. Other articles are untouched.
 for(const id of Object.keys(previousVoices)){
  const pair=stories.filter(p=>p.job.startsWith(id+':'));
  if(pair.length===2&&!pair.every(p=>ready(rows.find(r=>r.id===p.id),p))){
   const previous=previousPlans(pair);
   if(previous.every(p=>ready(rows.find(r=>r.id===p.id),p)))stories=stories.map(p=>previous.find(old=>old.job===p.job)??p);
  }
 }
 // Atomic presentation cutover: never replace legacy players with a partial set.
 if(stories.length!==14||!stories.every(p=>ready(rows.find(r=>r.id===p.id),p)))return {};
 const result:Record<string,SampleAudio>={};for(const p of stories.filter(p=>p.job.endsWith(':summary'))){const id=p.job.split(':')[0],detail=stories.find(d=>d.job===`${id}:detail`)!;result[id]={...audio(p),detail:audio(detail)};}return result;
}
export async function splitTtsStatus(){const [plans,rows]=await Promise.all([splitTtsPlans(),splitTtsRows()]);return {version:2,configured:!!process.env.STAGING_OPENAI_API_KEY?.trim(),model:splitTtsModel,shutdown:splitTtsShutdown,totalCalls:plans.reduce((n,p)=>n+p.chunks.length,0),plans:plans.map(p=>({job:p.job,id:p.id,title:p.title,voice:p.voice,text:p.text,scriptHash:p.scriptHash,characters:p.text.length,calls:p.chunks.length,state:ready(rows.find(r=>r.id===p.id),p)?'ready':rows.some(r=>r.id===p.id)?'unknown':'not_started'})),audio:Object.fromEntries(plans.filter(p=>ready(rows.find(r=>r.id===p.id),p)).map(p=>[p.job,audio(p)]))};}
export async function generateSplitTts(job:string){
 const apiKey=stagingEnvironmentConfigured()?process.env.STAGING_OPENAI_API_KEY?.trim():'';if(!apiKey)return {ok:false,state:'rejected',calls:0,message:'Staging 전용 키가 없습니다.'};
 const [plans,rows]=await Promise.all([splitTtsPlans(),splitTtsRows()]),p=plans.find(x=>x.job===job);if(!p)return {ok:false,state:'rejected',calls:0,message:'허용된 요청이 아닙니다.'};
 const current=rows.find(r=>r.id===p.id);if(current)return {ok:ready(current,p),state:ready(current,p)?'ready':'unknown',id:p.id,calls:0,message:'기존 요청을 조회했습니다. 재호출하지 않습니다.'};
 if(rows.some(r=>plans.some(x=>x.id===r.id&&!ready(r,x))))return {ok:false,state:'unknown',id:p.id,calls:0,message:'확인되지 않은 요청이 있어 새 생성을 중단합니다.'};
 if(!job.startsWith('probe-')&&!plans.filter(x=>x.job.startsWith('probe-')).every(x=>ready(rows.find(r=>r.id===x.id),x)))return {ok:false,state:'rejected',calls:0,message:'네 음성 미리듣기를 먼저 생성·검수하세요.'};
 const h=headers();let claim:Response;try{claim=await fetch(table(),{method:'POST',headers:{...h,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({id:p.id,project_id:projectId,article_id:null,title:titlePrefix+p.title,file_path:p.paths[0],script_text:p.text,script_status:'pending',source_type:'ai_tts',transcript_type:'custom_script',ai_tts_voice:p.voice,ai_tts_model:splitTtsModel,ai_tts_text_hash:p.hash,ai_tts_audio_paths:p.paths})});}catch{return {ok:false,state:'unknown',id:p.id,calls:0,message:'예약 결과 불명. 동일 ID 조회만 하세요.'};}
 if(!claim.ok)return {ok:false,state:'unknown',id:p.id,calls:0,message:'예약을 확인할 수 없어 제공자를 호출하지 않았습니다.'};
 let calls=0;const proofs:ReturnType<typeof inspectArticleMp3>[]=[],receipts:{clientRequestId:string;httpStatus:number|null;providerRequestId:string|null}[]=[];let phase='provider';
 try{for(let i=0;i<p.chunks.length;i++){
  const diagnostics=createTtsDiagnostics(event=>console.info('sample_tts_v2',JSON.stringify({id:p.id,segment:i,...event})));calls++;
  let speech;try{speech=await requestOpenAiSpeech(p.chunks[i],p.voice,splitTtsModel,{apiKey,captureReceipt:true,diagnostics,signal:AbortSignal.timeout(90000),maxBytes:8*1024*1024});}finally{receipts.push(diagnostics.receipt());}
  if(!speech.ok)return {ok:false,state:'unknown',id:p.id,calls,providerStatus:speech.httpStatus,receipts,message:'제공자 요청 실패. 자동 재호출하지 않습니다.'};
  phase='validation';const bytes=new Uint8Array(speech.data),proof=inspectArticleMp3(bytes);phase='storage';
  try{await fetch(object(p.paths[i]),{method:'POST',headers:{...h,'Content-Type':'audio/mpeg','x-upsert':'false'},body:Buffer.from(bytes),cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{/* Verify stored bytes only; no second provider call. */}
  phase='storage_verification';const stored=await readTtsBytes(await fetch(object(p.paths[i]),{headers:h,cache:'no-store',signal:AbortSignal.timeout(15000)}));const saved=inspectArticleMp3(stored);if(saved.hash!==proof.hash||saved.size!==proof.size)throw Error('Integrity mismatch');proofs.push(proof);
 }
 phase='db_complete';const done=await fetch(table('?'+new URLSearchParams({id:`eq.${p.id}`,project_id:`eq.${projectId}`,script_status:'eq.pending',ai_tts_text_hash:`eq.${p.hash}`})),{method:'PATCH',headers:{...h,'Content-Type':'application/json',Prefer:'return=representation'},cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({script_status:'approved',ai_tts_generated_at:new Date().toISOString(),duration_seconds:proofs.reduce((n,p)=>n+p.duration,0)})});if(!done.ok)throw Error('Completion unknown');const saved:Row[]=await done.json();if(saved.length!==1||!ready(saved[0],p))throw Error('Completion unknown');
 return {ok:true,state:'ready',id:p.id,calls,voice:p.voice,model:splitTtsModel,receipts,proofs,paths:p.paths};
 }catch(error){return {ok:false,state:'unknown',id:p.id,calls,phase,receipts,proofs,...(error instanceof SpeechRequestError?{failure:error.failure,providerStatus:error.httpStatus}:{}),message:'결과 확인 필요. POST 재실행 없이 GET으로만 확인하세요.'};}
}
export async function splitTtsDelivery(id:string,segment:string|null,request:Request){const [plans,rows]=await Promise.all([splitTtsPlans(),splitTtsRows()]);const p=[...plans,...previousPlans(plans)].find(p=>p.id===id);if(!p||!ready(rows.find(r=>r.id===id),p))return new Response(null,{status:404});const privateHeaders={'Cache-Control':'private, no-store'};
 if(segment===null)return Response.json({hasAudio:true,source:'ai_tts',stale:false,voice:p.voice,segments:p.paths.map((_,index)=>({index,url:`/api/projects/${hwaseongSampleSlug}/sample-tts?version=2&audio=${id}&segment=${index}`}))},{headers:privateHeaders});
 if(!/^\d{1,2}$/.test(segment)||!p.paths[Number(segment)])return new Response(null,{status:404});const r=await fetch(object(p.paths[Number(segment)]),{headers:{...headers(),...(request.headers.has('range')?{Range:request.headers.get('range')!}:{})},cache:'no-store',signal:AbortSignal.timeout(15000)});const h=new Headers({...privateHeaders,'Content-Type':'audio/mpeg','X-Content-Type-Options':'nosniff'});for(const key of ['content-length','content-range','accept-ranges']){const v=r.headers.get(key);if(v)h.set(key,v);}return new Response(r.body,{status:r.status,headers:h});
}
