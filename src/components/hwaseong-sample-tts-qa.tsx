"use client";
import { useRef, useState } from "react";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";
type Status={configured:boolean;model:string;totalCalls?:number;plans:{job:string;id:string;voice:string;title:string;text?:string;characters:number;calls:number;state:string}[];audio:Record<string,SampleAudio>};
export function SampleTtsQa({slug}:{slug:string}) {
 const [status,setStatus]=useState<Status|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);const lock=useRef(false);
 const endpoint=`/api/projects/${encodeURIComponent(slug)}/sample-tts`;
 async function inspect(){try{const r=await fetch(endpoint+'?version=3',{cache:"no-store"});if(!r.ok)throw Error();setStatus(await r.json());}catch{setMessage("상태 조회 실패 · 생성 요청을 자동 재시도하지 마세요.");}}
 async function checkProvider(){try{const r=await fetch(endpoint+"?provider=check",{cache:"no-store"});const p=await r.json();setMessage(`읽기 전용 모델 접근 확인: HTTP ${p.httpStatus??"미확인"} ${p.code||""} · 음성 생성 호출 없음`);}catch{setMessage("모델 접근 확인 실패 · 생성 재시도 없음");}}
 async function generate(job:string){if(lock.current)return;lock.current=true;setBusy(true);setMessage("생성 중 · 재실행하지 마세요.");try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job,version:3})});const result=await r.json();setMessage(JSON.stringify(result));}catch{setMessage("결과 불명 · 같은 요청의 상태를 조회하세요. 재생성하지 않습니다.");}finally{await inspect();lock.current=false;setBusy(false);}}
 return <details className="border-t border-slate-200 bg-slate-50 p-4 text-slate-800"><summary className="min-h-11 cursor-pointer content-center text-xs font-bold">내부 QA · Staging 음성 자산</summary>
 <p className="my-2 text-xs leading-6">관리자 전용 · 새 불변 자산만 생성 · 같은 요청 재생성 금지. 제목 원본을 요약·상세에 재사용합니다. 로컬에서 제목 뒤 1초 무음 편집·파일 검증을 마친 뒤에만 14개 플레이어를 전환합니다. editing은 최종 파일 검수 대기 상태입니다.</p>
 <button className="min-h-11 rounded-lg border bg-white px-3 text-sm font-bold" disabled={busy} onClick={inspect}>음성 설정·요청 상태 확인</button><button className="ml-2 min-h-11 rounded-lg border bg-white px-3 text-sm" disabled={busy} onClick={checkProvider}>모델 접근 읽기 전용 확인</button><p role="status" className="my-2 text-xs">{message}</p>
 {status ? <><p className="text-xs">OpenAI 설정: {status.configured?"있음":"없음"} · {status.model} · 생성 속도 1 · 제목 뒤 저장 오디오 무음 1초</p><ol className="space-y-3">{status.plans.map(p=><li key={p.id} className="rounded-xl border bg-white p-3"><p className="text-sm font-bold">{p.title} · {p.voice}</p><p className="mt-1 text-xs">{p.characters}자 · 최대 {p.calls}회 · {p.state}</p>{p.state==="not_started" ? <button className="mt-2 min-h-11 rounded-lg border px-3 text-sm" disabled={busy||!status.configured} onClick={()=>generate(p.job)}>{p.job.startsWith("probe-")?p.voice+" 짧은 음성 생성":p.title+" 기사 음성 생성"}</button>:null}{status.audio[p.job] ? <PublicArticleAudioPlayer key={p.id} ariaLabel={p.title+" QA 음성"} isAiGenerated manifestUrl={status.audio[p.job].manifestHref} />:null}</li>)}</ol><p className="mt-3 text-xs">완료 후 새로고침하면 기사에 연결됩니다. 결과 불명은 잠금 상태로 보존하며 복구 전 다시 생성하지 않습니다.</p></>:null}
 </details>;
}
