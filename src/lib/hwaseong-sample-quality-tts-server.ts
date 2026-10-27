import "server-only";
import { requestOpenAiSpeech } from "@/lib/article-tts-audio";
import { inspectArticleMp3, readTtsBytes } from "@/lib/article-tts-media";
import { createTtsDiagnostics, SpeechRequestError } from "@/lib/tts-request-diagnostics";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { getProjectContent } from "@/lib/newsletter-repository";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { hwaseongSampleSlug, proposalSample, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { qualityInstructions, qualityPlan, scopedQualityPlan, qualityPrefix, qualityProjectId, qualityTitlePrefix, type QualityPlan } from "@/lib/hwaseong-sample-quality-narration";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";

type Row = { id: string; project_id: string; article_id: string | null; title: string; file_path: string; script_text: string; script_status: string; ai_tts_voice: string; ai_tts_model: string; ai_tts_text_hash: string; ai_tts_audio_paths: string[]; ai_tts_generated_at: string | null; created_at?: string; pronunciation_note?: string | null };
function headers() {
  if (!stagingEnvironmentConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw Error("Staging required");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  return { apikey: key, Authorization: `Bearer ${key}` };
}
function table(q = "") { const url = getSupabaseRestEndpoint("/rest/v1/newsletter_audio_files" + q); if (!url) throw Error("Database unavailable"); return url; }
function object(path: string) {
  if (!path.startsWith(qualityPrefix) || path.includes("..")) throw Error("Invalid audio membership");
  const url = getSupabaseStorageEndpoint("/object/audio-files/" + path.split("/").map(encodeURIComponent).join("/"));
  if (!url) throw Error("Storage unavailable"); return url;
}
export async function qualityPlans(provided?: ProposalSample[]) {
  headers();
  let samples = provided;
  if (!samples) {
    const content = await getProjectContent(hwaseongSampleSlug);
    if (content.source !== "supabase") throw Error("Content unavailable");
    samples = content.articles.map(a => proposalSample(a, qualityProjectId)).filter((s): s is ProposalSample => !!s && !s.editorTest);
  }
  if (samples.length !== 7 || new Set(samples.map(s => s.article.id)).size !== 7) throw Error("Seven sample membership required");
  return samples.flatMap(s => (["summary", "detail"] as const).map(part => scopedQualityPlan(qualityPlan(s, part))));
}
export async function qualityRows() {
  const out: Row[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const q = new URLSearchParams({ select: "*", project_id: `eq.${qualityProjectId}`, title: `like.${qualityTitlePrefix}*`, order: "id.asc", limit: "100", offset: String(offset) });
    const r = await fetch(table("?" + q), { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Error("Audio status unavailable");
    const page: Row[] = await r.json();
    if (!Array.isArray(page)) throw Error("Invalid audio status");
    out.push(...page); if (page.length < 100) return out;
  }
  throw Error("Unconfirmed pagination");
}
function matches(row: Row | undefined, p: QualityPlan) {
  return !!row && row.project_id === qualityProjectId && row.article_id === null && row.ai_tts_model === p.model && row.ai_tts_voice === p.voice && row.ai_tts_text_hash === p.hash && row.script_text === p.text && row.file_path === p.path && JSON.stringify(row.ai_tts_audio_paths) === JSON.stringify([p.path]) && (!p.resume || row.pronunciation_note === JSON.stringify(p.resume));
}
function ready(row: Row | undefined, p: QualityPlan) { return matches(row, p) && row!.script_status === "approved" && !!row!.ai_tts_generated_at; }
function audio(p: QualityPlan, review = false): SampleAudio {
  return { id: p.id, voice: p.voice, transcriptText: p.text, manifestHref: `/api/projects/${hwaseongSampleSlug}/sample-tts?version=3&audio=${p.id}${review ? "&review=1" : ""}` };
}
export async function qualityAudioIndex(provided?: ProposalSample[]): Promise<Record<string, SampleAudio>> {
  if (!stagingEnvironmentConfigured()) return {};
  const [plans, rows] = await Promise.all([qualityPlans(provided), qualityRows()]);
  // A complete verified set is required before the reader switches away from v2.
  const authored = provided ?? (await getProjectContent(hwaseongSampleSlug)).articles.map(a => proposalSample(a,qualityProjectId)).filter((s): s is ProposalSample => !!s && !s.editorTest);
  if (plans.some(p => !ready(rows.find(r => r.id === p.id), p) && !authored.find(s => s.article.id === p.articleId)?.authorEdited)) return {};
  return Object.fromEntries(plans.filter(p => p.part === "summary" && ready(rows.find(r=>r.id===p.id),p) && ready(rows.find(r=>r.id===plans.find(d=>d.articleId===p.articleId&&d.part==="detail")!.id),plans.find(d=>d.articleId===p.articleId&&d.part==="detail")!)).map(p => [p.articleId, { ...audio(p), detail: audio(plans.find(d => d.articleId === p.articleId && d.part === "detail")!) }]));
}
export async function qualityStatus() {
  const [plans, rows] = await Promise.all([qualityPlans(), qualityRows()]);
  return { version: 3, configured: !!process.env.STAGING_OPENAI_API_KEY?.trim(), model: plans[0].model, totalCalls: plans.reduce((n,p) => n+p.calls,0),
    plans: plans.map(p => { const row = rows.find(r => r.id === p.id); return { job: p.job, id: p.id, title: `${p.title} · ${p.part === "summary" ? "요약" : "상세"}`, voice: p.voice, text: p.text, scriptHash: p.scriptHash, characters: p.text.length, calls: p.calls, ...(p.resume ? { resumeKey: p.resume.requestKey, preservesUnknownId: p.resume.parentId } : {}), state: ready(row,p) ? "ready" : matches(row,p) && row?.ai_tts_generated_at ? "editing" : row ? "unknown" : "not_started" }; }),
    audio: Object.fromEntries(plans.filter(p => { const row=rows.find(r=>r.id===p.id); return matches(row,p) && !!row?.ai_tts_generated_at; }).map(p => [p.job, audio(p, true)])) };
}

// Same sample-tts workflow and existing audio table. Each immutable reservation is
// claimed before the first paid call. Local PCM editing is a separate reviewed step;
// raw generation NEVER marks a row approved or activates a reader player.
export async function generateQualityTts(job: string, resumeKey?: string) {
  const apiKey = stagingEnvironmentConfigured() ? process.env.STAGING_OPENAI_API_KEY?.trim() : "";
  if (!apiKey) return { ok: false, state: "rejected", calls: 0, message: "Staging 전용 키가 없습니다." };
  const [plans, rows] = await Promise.all([qualityPlans(), qualityRows()]);
  const p = plans.find(p => p.job === job);
  if (!p) return { ok: false, state: "rejected", calls: 0 };
  const current = rows.find(r => r.id === p.id);
  if (current) return { ok: ready(current,p), state: ready(current,p) ? "ready" : "unknown", id:p.id, calls:0, message:"기존 예약입니다. 다시 호출하지 않습니다." };
  const resumed = plans.find(plan => plan.resume);
  const parent = resumed?.resume && rows.find(r => r.id === resumed.resume!.parentId);
  const parentMatches = !!(resumed?.resume && parent && matches(parent, { ...resumed, resume: undefined, id: resumed.resume.parentId, path: resumed.resume.parentFinalPath }) && parent.script_status === "pending" && !parent.ai_tts_generated_at && parent.created_at && Date.now() - Date.parse(parent.created_at) > 300_000);
  const replacement = resumed && rows.find(r => r.id === resumed.id);
  const parentResolved = !!(parentMatches && replacement && resumed && matches(replacement,resumed) && replacement.ai_tts_generated_at);
  if (p.resume && (resumeKey !== p.resume.requestKey || !parentMatches)) return {ok:false,state:"rejected",calls:0,message:"승인된 중단 요청과 명시적 재개 키를 확인하세요."};
  if (rows.some(r => !r.ai_tts_generated_at && !(r.id === resumed?.resume?.parentId && (parentResolved || (p.resume && parentMatches))))) return { ok: false, state: "unknown", calls: 0, message: "결과 불명 요청이 있어 중단합니다." };
  const summary = plans.find(s => s.articleId === p.articleId && s.part === "summary")!;
  if (p.part === "detail" && (!matches(rows.find(r=>r.id===summary.id),summary) || !rows.find(r=>r.id===summary.id)?.ai_tts_generated_at)) return {ok:false,state:"rejected",calls:0,message:"검증된 제목 원본을 먼저 준비하세요."};
  const h = headers();
  let recoveredLast: Uint8Array | undefined;
  if (p.resume) {
    // Confirm every reusable byte before reserving/calling the provider.
    try {
      const reused = inspectArticleMp3(await readTtsBytes(await fetch(object(p.resume.reusedPath), {headers:h,cache:"no-store",signal:AbortSignal.timeout(15000)})));
      if (reused.hash !== p.resume.reusedHash || reused.size !== p.resume.reusedSize) throw Error("Reuse integrity");
      const oldFinal = await fetch(object(p.resume.parentFinalPath), {headers:h,cache:"no-store",signal:AbortSignal.timeout(15000)});
      if (oldFinal.ok) return {ok:false,state:"unknown",calls:0,message:"기존 최종 파일이 발견됐습니다. 재생성 없이 파일부터 확인하세요."};
      const oldFinalError = await oldFinal.json().catch(() => null);
      if (oldFinal.status !== 404 && !(oldFinal.status === 400 && ["404","not_found"].includes(String(oldFinalError?.statusCode ?? oldFinalError?.code ?? "")))) throw Error("Old final status uncertain");
      const previous = await fetch(object(p.resume.missingPath), {headers:h,cache:"no-store",signal:AbortSignal.timeout(15000)});
      if (previous.ok) { recoveredLast = await readTtsBytes(previous); inspectArticleMp3(recoveredLast); }
      else { const error = await previous.json().catch(() => null); if (previous.status !== 404 && !(previous.status === 400 && ["404","not_found"].includes(String(error?.statusCode ?? error?.code ?? "")))) throw Error("Old object status uncertain"); }
    } catch { return {ok:false,state:"unknown",calls:0,message:"기존 청크 무결성·존재 여부를 확인하지 못했습니다. 생성하지 않습니다."}; }
  }
  try {
    const claim = await fetch(table(), { method:"POST",headers:{...h,"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000),body:JSON.stringify({id:p.id,project_id:qualityProjectId,article_id:null,title:qualityTitlePrefix+p.title+" · "+p.part,file_path:p.path,script_text:p.text,script_status:"pending",source_type:"ai_tts",transcript_type:"custom_script",ai_tts_voice:p.voice,ai_tts_model:p.model,ai_tts_text_hash:p.hash,ai_tts_audio_paths:[p.path],...(p.resume?{pronunciation_note:JSON.stringify(p.resume)}:{})}) });
    if (!claim.ok) return {ok:false,state:"unknown",id:p.id,calls:0,message:"예약 결과 확인 필요"};
  } catch { return {ok:false,state:"unknown",id:p.id,calls:0,message:"예약 응답 유실. GET만 조회하세요."}; }
  let calls=0;
  const receipts: {clientRequestId:string;httpStatus:number|null;providerRequestId:string|null}[]=[];
  const proofs: {path:string;hash:string;size:number;duration:number}[]=[];
  try {
    // Reuse the exact same spoken title for both parts of an article.
    if(p.part==="detail") inspectArticleMp3(await readTtsBytes(await fetch(object(summary.titlePath),{headers:h,cache:"no-store",signal:AbortSignal.timeout(15000)})));
    const tasks=[...(p.part==="summary"?[{text:p.title,path:p.titlePath,index:-1}]:[]),...p.chunks.map((text,i)=>({text,path:p.bodyPaths[i],index:i}))];
    for(const task of tasks){
      if (p.resume && task.index === 0) {
        const proof = inspectArticleMp3(await readTtsBytes(await fetch(object(task.path),{headers:h,cache:"no-store",signal:AbortSignal.timeout(15000)})));
        if (proof.hash !== p.resume.reusedHash || proof.size !== p.resume.reusedSize) throw Error("Reuse integrity changed");
        proofs.push({path:task.path,...proof}); continue;
      }
      const diagnostics=createTtsDiagnostics(event=>console.info("sample_tts_quality",JSON.stringify({id:p.id,segment:calls,...event})));
      let speech;
      try { if (recoveredLast) speech={ok:true as const,data:recoveredLast.buffer.slice(recoveredLast.byteOffset,recoveredLast.byteOffset+recoveredLast.byteLength) as ArrayBuffer}; else { calls++; speech=await requestOpenAiSpeech(task.text,p.voice,p.model,{apiKey,captureReceipt:true,diagnostics,signal:AbortSignal.timeout(90000),maxBytes:8*1024*1024,narration:{speed:1,instructions:qualityInstructions}}); } }
      finally { if (!recoveredLast) receipts.push(diagnostics.receipt()); }
      if(!speech.ok)return {ok:false,state:"unknown",id:p.id,calls,receipts,providerStatus:speech.httpStatus,message:"제공자 실패. 재호출하지 않습니다."};
      const bytes=new Uint8Array(speech.data),proof=inspectArticleMp3(bytes);
      try {await fetch(object(task.path),{method:"POST",headers:{...h,"Content-Type":"audio/mpeg","x-upsert":"false"},body:Buffer.from(bytes),cache:"no-store",signal:AbortSignal.timeout(15000)});}catch{/* Read-only verification after an ambiguous upload. */}
      const saved=inspectArticleMp3(await readTtsBytes(await fetch(object(task.path),{headers:h,cache:"no-store",signal:AbortSignal.timeout(15000)})));
      if(saved.hash!==proof.hash||saved.size!==proof.size)throw Error("Integrity mismatch");
      proofs.push({path:task.path,...proof});
    }
    const done=await fetch(table("?"+new URLSearchParams({id:`eq.${p.id}`,project_id:`eq.${qualityProjectId}`,script_status:"eq.pending",ai_tts_text_hash:`eq.${p.hash}`})),{method:"PATCH",headers:{...h,"Content-Type":"application/json",Prefer:"return=representation"},cache:"no-store",signal:AbortSignal.timeout(15000),body:JSON.stringify({ai_tts_generated_at:new Date().toISOString(),duration_seconds:proofs.reduce((n,p)=>n+p.duration,0)})});
    if(!done.ok)throw Error("Raw completion unknown");
    const confirmed:Row[]=await done.json();if(confirmed.length!==1||!matches(confirmed[0],p)||confirmed[0].script_status!=="pending"||!confirmed[0].ai_tts_generated_at)throw Error("Raw completion unknown");
    return {ok:true,state:"editing",id:p.id,calls,receipts,proofs,message:"원본 준비 완료. 로컬 무음 편집·검증 전에는 독자 음성으로 전환하지 않습니다."};
  }catch(error){return {ok:false,state:"unknown",id:p.id,calls,receipts,proofs,...(error instanceof SpeechRequestError?{failure:error.failure,providerStatus:error.httpStatus}:{}),message:"결과 확인 필요. POST 재실행 금지."};}
}
export async function qualityDelivery(id:string,segment:string|null,request:Request,review=false){
  const [plans,rows]=await Promise.all([qualityPlans(),qualityRows()]),p=plans.find(p=>p.id===id),row=rows.find(r=>r.id===id);
  if(!p||!(ready(row,p)||(review&&matches(row,p)&&row?.script_status==="pending"&&row.ai_tts_generated_at)))return new Response(null,{status:404});
  const privateHeaders={"Cache-Control":"private, no-store"};
  if(segment===null)return Response.json({hasAudio:true,source:"ai_tts",stale:false,voice:p.voice,segments:[{index:0,url:`/api/projects/${hwaseongSampleSlug}/sample-tts?version=3&audio=${p.id}&segment=0${review?"&review=1":""}`}]},{headers:privateHeaders});
  if(segment!=="0")return new Response(null,{status:404});
  const r=await fetch(object(p.path),{headers:{...headers(),...(request.headers.has("range")?{Range:request.headers.get("range")!}:{})},cache:"no-store",signal:AbortSignal.timeout(15000)});
  const h=new Headers({...privateHeaders,"Content-Type":"audio/mpeg","X-Content-Type-Options":"nosniff"});
  for(const key of ["content-length","content-range","accept-ranges"]){const v=r.headers.get(key);if(v)h.set(key,v);}
  return new Response(r.body,{status:r.status,headers:h});
}
