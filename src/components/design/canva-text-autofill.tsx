"use client";
import { useEffect, useRef, useState } from "react";
import type { CanvaPreviewField } from "@/lib/canva-template";
type Job={id:string;status:"in_progress"|"success"|"failed";designId?:string;editUrl?:string;viewUrl?:string};
type Execution={status:string;job?:Job};
export function CanvaTextAutofill({projectSlug,articleId,templateId}:{projectSlug:string;articleId:string;templateId:string}) {
  const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [confirmed,setConfirmed]=useState(false);
  const [prepared,setPrepared]=useState<{fields:CanvaPreviewField[];confirmation:string;imageExcluded:boolean}|null>(null);
  const [execution,setExecution]=useState<Execution|null>(null);const pending=useRef(false);const key=useRef<string|null>(null);const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function json(method:string,body?:object){
    const r=await fetch(method==="GET"?`/api/canva/autofill?${new URLSearchParams({projectSlug,articleId})}`:"/api/canva/autofill",{method,headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(45000),...(body?{body:JSON.stringify({projectSlug,articleId,templateId,...body})}:{})});
    const d=await r.json();if(!r.ok)throw Error(d.message||"Canva 요청을 확인하지 못했습니다.");return d;
  }
  async function poll(initial:Execution){
    let current=initial;const deadline=Date.now()+120000;
    for(let n=0;n<30 && current.job?.status==="in_progress" && Date.now()<deadline && alive.current;n++){
      await new Promise(resolve=>setTimeout(resolve,2000));if(!alive.current)return;
      const d=await json("GET");current=d.execution;if(alive.current)setExecution(current);
      if(!current)break;
    }
    if(alive.current && current?.job?.status==="in_progress")setNotice("결과 확인 시간이 지났습니다. 진행 작업 확인으로 다시 조회할 수 있습니다.");
  }
  async function run(action:"prepare"|"execute"|"status"){
    if(pending.current)return;pending.current=true;setBusy(true);setNotice("");
    try{
      if(action==="prepare"){
        const d=await json("POST",{action});if(!alive.current)return;
        setPrepared(d);setConfirmed(false);key.current=crypto.randomUUID();
      }else{
        const d=await json(action==="status"?"GET":"POST",action==="status"?undefined:{action,confirmation:prepared?.confirmation,requestKey:key.current});
        if(!alive.current)return;setExecution(d.execution);
        if(!d.execution)setNotice("현재 기사에 진행 중인 작업이 없습니다.");
        else if(d.execution.status==="unknown" || d.execution.status==="sending")setNotice("전송 결과가 불확실합니다. 중복 생성을 방지하기 위해 다시 보내지 않습니다. Canva에서 생성 여부를 확인하세요.");
        else await poll(d.execution);
      }
    }catch(e){if(alive.current)setNotice(e instanceof Error?e.message:"Canva 요청을 처리하지 못했습니다. 기존 기사에는 영향이 없습니다.");}
    finally{pending.current=false;if(alive.current)setBusy(false);}
  }
  const running=execution && ["sending","unknown","in_progress"].includes(execution.status);
  return <section aria-label="Canva 글자 자동 입력" className="mt-3 rounded border border-slate-200 p-3">
    <h4 className="font-bold">Canva 디자인 만들기</h4><p className="my-2 text-sm text-slate-600">저장된 글자를 전달해 새 디자인을 만듭니다. 원본 Canva 디자인과 기사 디자인은 변경하지 않습니다.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!!running} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void run("prepare")}>전달 내용 확인</button><button type="button" disabled={busy} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void run("status")}>진행 작업 확인</button></div>
    <p role="status" className="my-2 whitespace-pre-wrap break-words text-sm">{busy?(execution?.job?.status==="in_progress"?"디자인 생성 중 · 완료 여부를 확인합니다":"Canva 요청 처리 중"):notice}</p>
    {prepared && !execution && <div className="mt-3"><p className="font-bold">Canva에 다음 내용을 전달합니다.</p><dl className="my-2 space-y-2">{prepared.fields.map(f=><div key={f.field}><dt className="break-all text-sm font-bold">{f.field}</dt><dd className="whitespace-pre-wrap break-words text-sm">{f.text}</dd></div>)}</dl>
      {prepared.imageExcluded&&<p>이미지 자동 입력은 다음 단계에서 지원합니다.</p>}
      <label className="my-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>위 글자를 Canva에 전달해 새 디자인을 만드는 데 동의합니다.</label>
      <button type="button" disabled={busy||!confirmed} className="rounded bg-blue-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={()=>void run("execute")}>Canva 디자인 만들기</button><button type="button" disabled={busy} className="ml-2 text-sm" onClick={()=>{setPrepared(null);setConfirmed(false);}}>취소</button>
    </div>}
    {execution?.status==="success"&&<div><p>Canva 디자인이 생성되었습니다.</p><p className="break-all text-sm">디자인 ID: {execution.job?.designId}</p>{execution.job?.editUrl&&<a href={execution.job.editUrl} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">Canva에서 열기</a>}{execution.job?.viewUrl&&<a href={execution.job.viewUrl} target="_blank" rel="noopener noreferrer" className="ml-3 text-blue-800 underline">Canva에서 보기</a>}</div>}
    {execution?.status==="failed"&&<p>Canva 디자인 생성에 실패했습니다. 기존 기사에는 영향이 없습니다.</p>}
    {execution && ["success","failed"].includes(execution.status)&&<button type="button" disabled={busy} className="mt-2 text-sm underline" onClick={()=>{setExecution(null);setPrepared(null);key.current=null;}}>새 전달 내용 준비</button>}
  </section>;
}
