"use client";
import { useRef,useState } from "react";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
type Plan={variant:string;version:number;actingNote:string;script:string;id:string;hash:string;label:string;voiceLabel:string;maximumCalls:number;ready:boolean;duration:number|null;manifestHref:string;parts:{index:number;state:string}[]};
type Status={configured:boolean;maximumCalls:number;script:string;scriptHash:string;plans:Plan[]};
type Result={ok:boolean;state:string;calls:number;[key:string]:unknown};
const listeningChecks=["한국어 발음과 조사·어미 연결이 자연스러운가","기존보다 목소리가 가볍고 가늘게 들리는가","전체적인 분위기가 밝고 발랄한가","보호자와 속마음의 감정이 자연스럽게 구분되는가","과도한 연기나 어색한 억양 없이 이야기를 전달하는가","마지막 문장과 장면 전환이 편안하고 자연스러운가","공공성과 친근함을 함께 유지하는가"];
export function CartoonActingQa({slug}:{slug:string}){
  const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");const lock=useRef(false);
  const endpoint=`/api/projects/${encodeURIComponent(slug)}/sample-tts/acting`;
  async function inspect(){const r=await fetch(endpoint,{cache:"no-store"});if(!r.ok)throw Error("상태 조회 실패");const next:Status=await r.json();setStatus(next);return next;}
  async function generate(plan:Plan){
    if(lock.current)return;lock.current=true;setBusy(true);const results:Result[]=[];
    try{
      const latest=await inspect(),current=latest.plans.find(p=>p.id===plan.id);
      if(!current||current.version!==2||current.hash!==plan.hash||!latest.configured)throw Error("대본·설정을 다시 확인하세요.");
      for(const part of current.parts){
        if(part.state==="complete")continue;
        if(part.state!=="not_started")throw Error("결과 불명 기록이 있습니다. 생성하지 않습니다.");
        setMessage(`${plan.label} · 발화 ${part.index+1}/${current.parts.length} 생성 중 · 재실행하지 마세요.`);
        const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({variant:plan.variant,part:part.index,hash:plan.hash})});
        const result:Result=await r.json();results.push(result);
        if(!r.ok||!result.ok||result.state!=="complete")throw Error("결과 불명 · 다음 발화 생성 중단");
      }
      setMessage(JSON.stringify({variant:plan.variant,calls:results.reduce((n,r)=>n+r.calls,0),results}));
    }catch(error){setMessage(JSON.stringify({variant:plan.variant,calls:results.reduce((n,r)=>n+r.calls,0),results,message:error instanceof Error?error.message:"결과 불명 · 자동 재시도하지 않습니다."}));}
    finally{try{await inspect();}catch{/* Preserve the last request result. */}setBusy(false);lock.current=false;}
  }
  return <section data-cartoon-acting-pilot className="my-4 border-y border-slate-300 py-4" onPlayCapture={event=>event.currentTarget.querySelectorAll("audio").forEach(audio=>{if(audio!==event.target)audio.pause();})}>
    <h3 className="break-keep text-base font-bold">04번 만평 · AI 성우 연기형 비교</h3>
    <p className="my-2 break-keep text-xs leading-6">관리자 전용 시험 음성입니다. 기존 독자용 음성은 변경되지 않습니다. 최종 채택 여부는 미결정입니다. A-2·B-2는 동일한 대본이며 기존 A·B와 이야기 내용은 같습니다. AI 생성 음성 · 청감 평가 대기</p>
    <button type="button" disabled={busy} onClick={()=>void inspect().catch(()=>setMessage("상태 조회 실패 · 생성 요청은 실행하지 않았습니다."))} className="min-h-10 rounded-md border bg-white px-3 text-sm font-bold">연기형 시험 상태 확인</button>
    {status?<>
      <p className="my-2 break-keep text-xs leading-6">전용 키 {status.configured?"설정됨":"미설정"} · 생성 speed 1.0 · 2차 최대 A-2 1회 / B-2 6회 · 일반 독자 미적용</p>
      <details className="my-3"><summary className="min-h-10 cursor-pointer text-sm font-bold">2차 공통 시험 대본 확인</summary><p className="whitespace-pre-wrap break-keep text-sm leading-7">{status.script}</p></details>
      <div className="grid grid-cols-1 gap-3">{status.plans.map(plan=>{
        const rawReady=plan.parts.every(p=>p.state==="complete"),unknown=plan.parts.some(p=>p.state==="unknown"),priorReady=plan.variant!=="B-2"||!!status.plans.find(p=>p.variant==="A-2")?.parts.every(p=>p.state==="complete");
        return <article key={plan.id} data-acting-variant={plan.variant} className="min-w-0 rounded-md border border-slate-300 bg-white p-3">
          <h4 className="break-keep text-sm font-bold">{plan.label}</h4><p className="my-2 break-keep text-xs leading-6">제작 v{plan.version} · {plan.voiceLabel}</p><p className="mb-2 break-keep text-xs leading-6">{plan.actingNote}</p>
          {plan.ready?<><PublicArticleAudioPlayer ariaLabel={`${plan.label} 시험 음성`} isAiGenerated manifestUrl={plan.manifestHref}/><p className="mt-2 text-xs">재생시간 {plan.duration}초 · 기술 검증 완료 · 청감 평가 대기</p></>:rawReady?<p className="break-keep text-xs leading-6">원본 준비 완료 · 최종 편집·검증 대기</p>:plan.version===1?<p className="text-xs">기존 시안 · 재생성하지 않음</p>:<button type="button" disabled={busy||!status.configured||unknown||!priorReady} onClick={()=>void generate(plan)} className="min-h-10 rounded-md border border-slate-400 px-3 text-sm font-bold disabled:opacity-50">{plan.label} 생성 · 최대 {plan.maximumCalls}회</button>}
          <details className="mt-2"><summary className="min-h-10 cursor-pointer text-xs">시안 대본 확인</summary><p className="whitespace-pre-wrap break-keep text-xs leading-6">{plan.script}</p></details>
          {unknown?<p className="mt-2 text-xs text-red-700">결과 불명 · 자동 재시도 중단</p>:null}
        </article>;
      })}</div>
    </>:null}
    <p role="status" className="my-2 whitespace-pre-wrap break-keep break-words text-xs">{message}</p>
    <details className="mt-3"><summary className="min-h-10 cursor-pointer text-sm font-bold">청감 검수 항목</summary><ol className="list-inside list-decimal space-y-1 break-keep text-xs leading-6">{listeningChecks.map(check=><li key={check}>{check}</li>)}</ol><p className="mt-2 break-keep text-xs leading-6">파일 해시·디코딩·재생 확인은 자동 기술 검사입니다. 발음·억양·연기·속도·공공성은 직접 청취한 뒤 평가합니다. 사용자 승인 전 기존 음성을 교체하거나 삭제하지 않습니다.</p></details>
  </section>;
}
