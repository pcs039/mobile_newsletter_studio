"use client";
import { useEffect, useRef, useState } from "react";
import type { CanvaPreviewField } from "@/lib/canva-template";
import { CanvaPngImportControls } from "./canva-png-import-controls";
import { useStagingE2E, StagingE2ENotice } from "./staging-e2e-status";
type Job={id:string;status:"in_progress"|"success"|"failed";designId?:string;editUrl?:string;viewUrl?:string};
type Execution={status:string;job?:Job};
export function CanvaTextAutofill({projectSlug,articleId,templateId}:{projectSlug:string;articleId:string;templateId:string}) {
  const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [confirmed,setConfirmed]=useState(false);
  const [prepared,setPrepared]=useState<{fields:CanvaPreviewField[];confirmation:string;imageExcluded:boolean;background?:{id:string;name:string;width:number;height:number}|null}|null>(null);
  const [execution,setExecution]=useState<Execution|null>(null);const pending=useRef(false);const key=useRef<string|null>(null);const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const e2e = useStagingE2E();
  const [backgrounds,setBackgrounds]=useState<Array<{id:string;name:string}>>([]);
  const [backgroundAssetId,setBackgroundAssetId]=useState("");
  const [autoDisplayTitle,setAutoDisplayTitle]=useState<string|null>(null);
  const [manualOverride,setManualOverride]=useState<string|null>(null);
  function changeTitle(value:string|null){setManualOverride(value);setPrepared(null);setConfirmed(false);key.current=null;}
  useEffect(()=>{if(e2e!=="enabled")return;let active=true;fetch(`/api/canva/autofill?${new URLSearchParams({projectSlug,articleId})}`).then(async r=>{const d=await r.json();if(active&&r.ok){setBackgrounds(d.backgrounds||[]);setAutoDisplayTitle(d.autoDisplayTitle??null);}}).catch(()=>{});return()=>{active=false;};},[projectSlug,articleId,e2e]);
  async function json(method:string,body?:object){
    const r=await fetch(method==="GET"?`/api/canva/autofill?${new URLSearchParams({projectSlug,articleId})}`:"/api/canva/autofill",{method,headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(45000),...(body?{body:JSON.stringify({projectSlug,articleId,templateId,...(backgroundAssetId?{backgroundAssetId}:{}),...body})}:{})});
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
        const d=await json("POST",{action,displayTitleOverride:manualOverride});if(!alive.current)return;
        setPrepared(d);setConfirmed(false);setExecution(d.execution||null);key.current=d.requestKey||crypto.randomUUID();
      }else{
        const d=await json(action==="status"?"GET":"POST",action==="status"?undefined:{action,confirmation:prepared?.confirmation,requestKey:key.current,displayTitleOverride:manualOverride});
        if(!alive.current)return;setExecution(d.execution);
        if(!d.execution)setNotice("현재 기사에 진행 중인 작업이 없습니다.");
        else if(d.execution.status==="unknown" || d.execution.status==="sending")setNotice("전송 결과가 불확실합니다. 중복 생성을 방지하기 위해 다시 보내지 않습니다. Canva에서 생성 여부를 확인하세요.");
        else if(d.execution.status==="uploading")setNotice("배경 업로드 처리 중입니다. 업로드 확인·생성 계속을 눌러 같은 작업을 이어가세요.");
        else await poll(d.execution);
      }
    }catch(e){if(alive.current)setNotice(e instanceof Error?e.message:"Canva 요청을 처리하지 못했습니다. 기존 기사에는 영향이 없습니다.");}
    finally{pending.current=false;if(alive.current)setBusy(false);}
  }
  const running=execution && ["sending","unknown","uploading","in_progress"].includes(execution.status);
  if(e2e !== "enabled") return e2e === "loading" ? <p>Canva 실행 환경 확인 중…</p> : <StagingE2ENotice/>;
  return <section aria-label="Canva 글자 자동 입력" className="mt-3 rounded border border-slate-200 p-3">
    <h4 className="font-bold">Canva 디자인 만들기</h4><p className="my-2 text-sm text-slate-600">저장된 글자와 선택한 승인 GPT 배경으로 새 디자인을 만듭니다. 원본 Canva 디자인과 기사 디자인은 변경하지 않습니다.</p>
    <fieldset className="my-3 min-w-0 rounded border p-3" disabled={busy||!!running||!!execution||autoDisplayTitle===null}>
      <legend className="text-sm font-bold">Canva 표시 제목</legend>
      <div className="flex flex-wrap gap-3 text-sm"><label><input type="radio" checked={manualOverride===null} onChange={()=>changeTitle(null)}/> 자동 추천</label><label><input type="radio" checked={manualOverride!==null} onChange={()=>changeTitle(autoDisplayTitle||"")}/> 직접 수정</label></div>
      <label className="mt-2 block text-sm">표시 제목<textarea rows={3} maxLength={500} readOnly={manualOverride===null} value={manualOverride??autoDisplayTitle??""} onChange={e=>changeTitle(e.target.value)} className="mt-1 w-full min-w-0 rounded border p-2"/></label>
      <p className="text-xs text-slate-600">원본 제목은 바뀌지 않습니다. 직접 수정한 값은 현재 화면에서만 유지됩니다. 빈 줄 없이 최대 3줄입니다.</p>
      {manualOverride!==null&&<button type="button" className="mt-2 text-sm underline" onClick={()=>changeTitle(null)}>자동 추천으로 되돌리기</button>}
    </fieldset>
    <label className="my-2 block text-sm">승인된 GPT 배경<select className="mt-1 w-full rounded border p-2" value={backgroundAssetId} disabled={busy||!!running} onChange={e=>{setBackgroundAssetId(e.target.value);setPrepared(null);setConfirmed(false);}}><option value="">배경 없이 글자만 전달</option>{backgrounds.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <p className="text-sm text-slate-600">배경은 3:4 원본 비율을 유지합니다. Canva의 3:4 프레임에 중앙 crop을 설정하고, 문자 없는 이미지·중앙 안전영역·기관 톤을 확인하세요. 자동으로 기사에 배치하지 않습니다.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!!running} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void run("prepare")}>전달 내용 확인</button><button type="button" disabled={busy} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void run("status")}>진행 작업 확인</button></div>
    <p role="status" className="my-2 whitespace-pre-wrap break-words text-sm">{busy?(execution?.job?.status==="in_progress"?"디자인 생성 중 · 완료 여부를 확인합니다":"Canva 요청 처리 중"):notice}</p>
    {prepared && (!execution||execution.status==="uploading") && <div className="mt-3"><p className="font-bold">Canva에 다음 내용을 전달합니다.</p><dl className="my-2 space-y-2">{prepared.fields.map(f=><div key={f.field}><dt className="break-all text-sm font-bold">{f.field}</dt><dd className="whitespace-pre-wrap break-words text-sm">{f.text}</dd></div>)}</dl>
      {prepared.background&&<p className="my-2 text-sm">BACKGROUND_IMAGE · {prepared.background.name} · {prepared.background.width}×{prepared.background.height} · 비율 유지</p>}
      {prepared.imageExcluded&&<p>이미지 자동 입력은 다음 단계에서 지원합니다.</p>}
      <label className="my-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>전달 내용과 배경의 비율·안전영역·색상 조화를 확인했으며 새 Canva 디자인 생성을 승인합니다.</label>
      <button type="button" disabled={busy||!confirmed} className="rounded bg-blue-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={()=>void run("execute")}>{execution?.status==="uploading"?"업로드 확인·생성 계속":"Canva 디자인 만들기"}</button><button type="button" disabled={busy||!!running} className="ml-2 text-sm" onClick={()=>{setPrepared(null);setConfirmed(false);}}>취소</button>
    </div>}
    {execution?.status==="success"&&<div><p>Canva 디자인이 생성되었습니다.</p><p className="break-all text-sm">디자인 ID: {execution.job?.designId}</p>{execution.job?.editUrl&&<a href={execution.job.editUrl} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">Canva에서 열기</a>}{execution.job?.viewUrl&&<a href={execution.job.viewUrl} target="_blank" rel="noopener noreferrer" className="ml-3 text-blue-800 underline">Canva에서 보기</a>}</div>}
    {execution?.status==="success" && execution.job?.designId && <CanvaPngImportControls key={execution.job.designId} projectSlug={projectSlug} articleId={articleId} designId={execution.job.designId}/>}
    {execution?.status==="failed"&&<p>Canva 디자인 생성에 실패했습니다. 기존 기사에는 영향이 없습니다.</p>}
    {execution && ["success","failed"].includes(execution.status)&&<button type="button" disabled={busy} className="mt-2 text-sm underline" onClick={()=>{setExecution(null);setPrepared(null);key.current=null;}}>새 전달 내용 준비</button>}
  </section>;
}
