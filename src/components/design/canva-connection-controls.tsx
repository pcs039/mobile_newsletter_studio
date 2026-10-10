"use client";
import { useEffect, useRef, useState } from "react";
export function CanvaConnectionControls({projectSlug}:{projectSlug:string}) {
  const [status,setStatus]=useState("loading"); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  const [disconnect,setDisconnect]=useState(false);const pending=useRef(false);
  useEffect(()=>{
    let active=true;
    const outcome=new URLSearchParams(window.location.search).get("canvaConnection");
    const messages:Record<string,string>={connected:"Canva 연결이 완료되었습니다.",cancelled:"Canva 연결을 취소했습니다.",failed:"Canva 연결에 실패했습니다. 다시 연결해 주세요."};
    fetch(`/api/canva/connection?${new URLSearchParams({projectSlug})}`).then(async r=>{
      const d=await r.json();if(!active)return;
      if(!r.ok){setStatus("error");setNotice(d.message);return;}setStatus(d.status);if(outcome && messages[outcome])setNotice(messages[outcome]);
    }).catch(()=>{if(active){setStatus("error");setNotice("연결 상태를 확인하지 못했습니다. 기존 디자인 작업은 계속할 수 있습니다.");}});
    return ()=>{active=false;};
  },[projectSlug]);
  async function run(remove=false){
    if(pending.current)return;pending.current=true;setBusy(true);setNotice("");
    try{
      const r=await fetch("/api/canva/connection",{method:remove?"DELETE":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectSlug,...(remove?{confirm:true}:{})}),signal:AbortSignal.timeout(30000)});
      const d=await r.json();if(!r.ok)throw Error(d.message);
      if(remove){setStatus("disconnected");setDisconnect(false);setNotice(d.message);}else{window.location.assign(d.url);}
    }catch(e){setNotice(e instanceof Error?e.message:"연결 요청을 처리하지 못했습니다.");}finally{pending.current=false;setBusy(false);}
  }
  return <section aria-label="Canva 연결" className="mb-4 rounded border border-slate-200 p-3">
    <h3 className="font-bold">Canva 연결</h3><p className="my-2 text-sm">{status==="connected"?"연결됨":status==="loading"?"확인 중":status==="setup_required"?"Canva 연결 설정 필요":"연결 필요 · 인증 실패 시 다시 연결하세요"}</p>
    <p className="text-sm text-slate-600">현재 프로젝트와 관리자 계정 전용 연결입니다. 글자 자동 입력만 지원합니다.</p>
    <p role="status" className="my-2 text-sm">{notice}</p>
    {status!=="loading" && <button type="button" disabled={busy || status==="setup_required"} className="rounded bg-blue-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={()=>void run()}>{busy?"처리 중":status==="connected"?"Canva 다시 연결":"Canva 연결"}</button>}
    {status==="connected" && <button type="button" disabled={busy} className="ml-2 rounded border px-3 py-2 text-sm" onClick={()=>setDisconnect(true)}>연결 해제</button>}
    {disconnect && <div className="mt-3 rounded bg-slate-50 p-3"><p>이 프로젝트의 Canva 연결을 해제할까요? 기사와 디자인은 유지됩니다.</p><button type="button" disabled={busy} className="mr-2 mt-2 rounded border px-3 py-2 text-sm" onClick={()=>void run(true)}>연결 해제 확인</button><button type="button" disabled={busy} onClick={()=>setDisconnect(false)}>취소</button></div>}
  </section>;
}
