import "server-only";
import { requestOpenAiSpeech } from "@/lib/article-tts-audio";
import { inspectArticleMp3, readTtsBytes } from "@/lib/article-tts-media";
import { createTtsDiagnostics, SpeechRequestError } from "@/lib/tts-request-diagnostics";
import { getProjectContent } from "@/lib/newsletter-repository";
import { hwaseongSampleSlug, proposalSample, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { actingAdoptionProof, actingArticleId, actingModel, actingPrefix, actingRevisionPrefix, actingRevisionTitlePrefix, actingProjectId, actingTitlePrefix, allCartoonActingPlans, type AnyCartoonActingPlan } from "@/lib/hwaseong-cartoon-acting";
import type { SampleAudioDeliveries } from "@/lib/sample-audio-delivery";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";

type Row = { id:string; project_id:string; article_id:string|null; title:string; file_path:string; script_text:string; script_status:string; ai_tts_voice:string; ai_tts_model:string; ai_tts_text_hash:string; ai_tts_audio_paths:string[]; ai_tts_generated_at:string|null; duration_seconds:number|null; pronunciation_note?:string|null };
function headers() {
  if (!stagingEnvironmentConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw Error("Staging required");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY.trim(); return {apikey:key,Authorization:`Bearer ${key}`};
}
function table(query="") { const endpoint=getSupabaseRestEndpoint("/rest/v1/newsletter_audio_files"+query); if(!endpoint)throw Error("Database unavailable");return endpoint; }
function object(path:string) { if(![actingPrefix,actingRevisionPrefix].some(prefix=>path.startsWith(prefix))||path.includes(".."))throw Error("Pilot path required");const endpoint=getSupabaseStorageEndpoint("/object/audio-files/"+path.split("/").map(encodeURIComponent).join("/"));if(!endpoint)throw Error("Storage unavailable");return endpoint; }
export async function actingPlans(provided?: ProposalSample[]) {
  headers();
  let sample=provided?.find(s=>s.article.id===actingArticleId&&!s.editorTest);
  if(!provided){
    const content=await getProjectContent(hwaseongSampleSlug);
    if(content.source!=="supabase")throw Error("Original source unavailable");
    const article=content.articles.find(a=>a.id===actingArticleId);sample=article&&proposalSample(article,actingProjectId)||undefined;
  }
  if(!sample)throw Error("Original cartoon unavailable");return allCartoonActingPlans(sample);
}
async function rows() {
  const result:Row[]=[];
  for(let offset=0;offset<1000;offset+=100){const q=new URLSearchParams({select:"*",project_id:`eq.${actingProjectId}`,or:`(title.like.${actingTitlePrefix}*,title.like.${actingRevisionTitlePrefix}*)`,order:"id.asc",limit:"100",offset:String(offset)});const r=await fetch(table("?"+q),{headers:headers(),cache:"no-store",signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("Pilot status unavailable");const page:Row[]=await r.json();if(!Array.isArray(page))throw Error("Pilot status invalid");result.push(...page);if(page.length<100)return result;}
  throw Error("Unconfirmed pagination");
}
type Expected = { id:string;path:string;hash:string;text:string;voice:string;allowApproved?:boolean };
function finalExpected(p:AnyCartoonActingPlan):Expected {return {id:p.id,path:p.path,hash:p.hash,text:p.script,voice:p.finalVoice,allowApproved:p.variant==="B"&&p.version===1};}
function matches(row:Row|undefined,p:Expected) {return !!row&&row.project_id===actingProjectId&&row.article_id===null&&(row.script_status==="pending"||(p.allowApproved&&row.script_status==="approved"))&&row.file_path===p.path&&row.script_text===p.text&&row.ai_tts_voice===p.voice&&row.ai_tts_model===actingModel&&row.ai_tts_text_hash===p.hash&&JSON.stringify(row.ai_tts_audio_paths)===JSON.stringify([p.path]);}
function complete(row:Row|undefined,p:Expected) {return matches(row,p)&&!!row?.ai_tts_generated_at;}
function finalReady(row:Row|undefined,p:AnyCartoonActingPlan){return complete(row,finalExpected(p))&&Number.isFinite(row?.duration_seconds)&&(row?.duration_seconds??0)>0;}
function adopted(plans:AnyCartoonActingPlan[],stored:Row[]) {
  const plan=plans.find(p=>p.variant==="B"&&p.version===1),row=stored.find(r=>r.id===plan?.id);
  if(!plan||row?.script_status!=="approved"||!finalReady(row,plan)||plan.parts.some(p=>!complete(stored.find(r=>r.id===p.id),p)))return null;
  try {if(JSON.stringify(JSON.parse(row.pronunciation_note??"{}").adoption)!==JSON.stringify(actingAdoptionProof))return null;}catch{return null;}
  return plan;
}
export async function selectedCartoonAudio(provided?: ProposalSample[], deliveries?: SampleAudioDeliveries):Promise<SampleAudio|null> {
  if(!stagingEnvironmentConfigured())return null;
  const [plans,stored]=await Promise.all([actingPlans(provided),rows()]),plan=adopted(plans,stored);
  if(!plan)return null;
  deliveries?.set(plan.id,(segment,request)=>deliverActingPlan(plan,segment,request));
  const audio:SampleAudio={id:plan.id,voice:"coral",voiceLabel:"Coral · Marin",narrationLabel:"채택된 22초 만평 성우 음성 · 요약·상세 동일 음성",transcriptText:plan.script,manifestHref:`/api/projects/${hwaseongSampleSlug}/sample-tts/acting?audio=${plan.id}`};
  return {...audio,detail:{...audio}};
}
export async function actingStatus() {
  const [plans,stored]=await Promise.all([actingPlans(),rows()]),selection=adopted(plans,stored),visible=selection?[selection]:plans;
  return {adopted:!!selection,configured:!!process.env.STAGING_OPENAI_API_KEY?.trim(),maximumCalls:selection?0:7,script:selection?.script??plans[2].script,scriptHash:selection?.scriptHash??plans[2].scriptHash,
    plans:visible.map(p=>({variant:p.variant,version:p.version,actingNote:selection?"사용자 채택 · 04번 요약·상세 연결 · 추가 생성 중단":p.actingNote,script:p.script,id:p.id,hash:p.hash,label:p.label,voiceLabel:p.voiceLabel,maximumCalls:!selection&&p.version===2?p.parts.length:0,ready:finalReady(stored.find(r=>r.id===p.id),p),duration:stored.find(r=>r.id===p.id)?.duration_seconds??null,manifestHref:`/api/projects/${hwaseongSampleSlug}/sample-tts/acting?audio=${p.id}`,parts:p.parts.map(part=>{const row=stored.find(r=>r.id===part.id);return {index:part.index,state:complete(row,part)?"complete":row?"unknown":"not_started"};})}))};
}
export async function generateActingPart(variant:string,index:number,expectedHash:string) {
  const apiKey=stagingEnvironmentConfigured()?process.env.STAGING_OPENAI_API_KEY?.trim():"";
  if(!apiKey)return {ok:false,state:"rejected",calls:0,message:"Staging 전용 키가 없습니다."};
  const [plans,stored]=await Promise.all([actingPlans(),rows()]),plan=plans.find(p=>p.variant===variant);
  if(adopted(plans,stored))return {ok:false,state:"retired",calls:0,message:"B안 채택 완료. 미선택 시안을 다시 생성하지 않습니다."};
  if(!plan||plan.version!==2||plan.hash!==expectedHash||!Number.isInteger(index)||index<0||!plan.parts[index])return {ok:false,state:"rejected",calls:0};
  const part=plan.parts[index],existing=stored.find(r=>r.id===part.id);
  if(existing)return {ok:false,state:complete(existing,part)?"complete":"unknown",id:part.id,calls:0,message:"기존 시도입니다. 다시 생성하지 않습니다."};
  if(stored.some(row=>!row.ai_tts_generated_at))return {ok:false,state:"unknown",calls:0,message:"시험 작업의 결과 불명 기록을 먼저 확인하세요."};
  const prerequisite=variant==="B-2"?[...plans.find(p=>p.variant==="A-2")!.parts,...plan.parts.slice(0,index)]:plan.parts.slice(0,index);
  if(prerequisite.some(p=>!complete(stored.find(r=>r.id===p.id),p)))return {ok:false,state:"rejected",calls:0,message:"이전 발화의 정상 저장을 먼저 확인하세요."};
  const h=headers();
  try {const claim=await fetch(table(),{method:"POST",headers:{...h,"Content-Type":"application/json"},body:JSON.stringify({id:part.id,project_id:actingProjectId,article_id:null,title:`${plan.titlePrefix}${variant} · 발화 ${index+1}`,file_path:part.path,script_text:part.text,script_status:"pending",source_type:"ai_tts",transcript_type:"custom_script",ai_tts_voice:part.voice,ai_tts_model:actingModel,ai_tts_text_hash:part.hash,ai_tts_audio_paths:[part.path],pronunciation_note:JSON.stringify({variant,index,planHash:plan.hash,scriptHash:plan.scriptHash,sourceHash:plan.sourceHash})}),cache:"no-store",signal:AbortSignal.timeout(15000)});if(!claim.ok)return {ok:false,state:"unknown",id:part.id,calls:0,message:"예약 결과 확인 필요"};}
  catch{return {ok:false,state:"unknown",id:part.id,calls:0,message:"예약 응답 불명. 조회만 하세요."};}
  const diagnostics=createTtsDiagnostics(event=>console.info("cartoon_acting_pilot",JSON.stringify({id:part.id,variant,index,...event})));
  try {
    const speech=await requestOpenAiSpeech(part.text,part.voice,actingModel,{apiKey,captureReceipt:true,diagnostics,signal:AbortSignal.timeout(90000),bodyIdleTimeoutMs:30000,maxBytes:8*1024*1024,narration:{speed:1,instructions:part.instructions}});
    if(!speech.ok)return {ok:false,state:"unknown",id:part.id,calls:1,receipt:diagnostics.receipt(),message:"제공자 응답 미완료. 추가 생성 중단"};
    const bytes=new Uint8Array(speech.data),proof=inspectArticleMp3(bytes);
    try{await fetch(object(part.path),{method:"POST",headers:{...h,"Content-Type":"audio/mpeg","x-upsert":"false"},body:Buffer.from(bytes),cache:"no-store",signal:AbortSignal.timeout(15000)});}catch{/* Verify once by GET; never replay the provider. */}
    const saved=inspectArticleMp3(await readTtsBytes(await fetch(object(part.path),{headers:h,cache:"no-store",signal:AbortSignal.timeout(15000)})));
    if(saved.hash!==proof.hash||saved.size!==proof.size)throw Error("Stored bytes differ");
    const done=await fetch(table("?"+new URLSearchParams({id:`eq.${part.id}`,project_id:`eq.${actingProjectId}`,script_status:"eq.pending",ai_tts_text_hash:`eq.${part.hash}`})),{method:"PATCH",headers:{...h,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({ai_tts_generated_at:new Date().toISOString(),duration_seconds:proof.duration}),cache:"no-store",signal:AbortSignal.timeout(15000)});
    const confirmed:Row[]=await done.json();if(!done.ok||confirmed.length!==1||!complete(confirmed[0],part))throw Error("Completion unconfirmed");
    return {ok:true,state:"complete",id:part.id,calls:1,receipt:diagnostics.receipt(),proof:{path:part.path,...proof}};
  }catch(error){return {ok:false,state:"unknown",id:part.id,calls:1,receipt:diagnostics.receipt(),...(error instanceof SpeechRequestError?{failure:error.failure}:{}),message:"결과 확인 필요. 다음 발화 생성과 자동 재시도를 중단하세요."};}
}
export async function actingDelivery(id:string,segment:string|null,request:Request) {
  const [plans,stored]=await Promise.all([actingPlans(),rows()]),p=plans.find(p=>p.id===id),row=stored.find(r=>r.id===id);
  if(!p||!finalReady(row,p)||p.parts.some(part=>!complete(stored.find(r=>r.id===part.id),part)))return new Response(null,{status:404});
  return deliverActingPlan(p,segment,request);
}
async function deliverActingPlan(p:AnyCartoonActingPlan,segment:string|null,request:Request) {
  const responseHeaders={"Cache-Control":"private, no-store"};
  if(segment===null)return Response.json({hasAudio:true,source:"ai_tts",stale:false,voice:p.voiceLabel,segments:[{index:0,url:`/api/projects/${hwaseongSampleSlug}/sample-tts/acting?audio=${p.id}&segment=0`}]},{headers:responseHeaders});
  if(segment!=="0")return new Response(null,{status:404});
  const r=await fetch(object(p.path),{headers:{...headers(),...(request.headers.has("range")?{Range:request.headers.get("range")!}:{})},cache:"no-store",signal:AbortSignal.timeout(15000)}),h=new Headers({...responseHeaders,"Content-Type":"audio/mpeg","X-Content-Type-Options":"nosniff"});
  for(const key of ["content-length","content-range","accept-ranges"]){const value=r.headers.get(key);if(value)h.set(key,value);}return new Response(r.body,{status:r.status,headers:h});
}
