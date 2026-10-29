"use client";
import { useEffect, useRef, useState } from "react";
import { demoClientRequestId, demoFailureCode, demoMessages, type DemoFailureCode } from "@/lib/demo-share-status";

type Failure={code:DemoFailureCode;requestId:string;stage?:string};
export function DemoShareEntry({initialToken,project}:{initialToken?:string;project?:string}={}) {
  const tokenRef=useRef(initialToken??"");
  const busy=useRef(false),controller=useRef<AbortController|null>(null);
  const [valid,setValid]=useState<boolean|null>(initialToken? /^[A-Za-z0-9_-]{43}$/.test(initialToken):null);
  const [loading,setLoading]=useState(false),[failure,setFailure]=useState<Failure|null>(null);
  useEffect(()=>{
    const token=initialToken??window.location.hash.slice(1);
    tokenRef.current=token;
    let alive=true;
    void Promise.resolve().then(()=>{if(alive)setValid(/^[A-Za-z0-9_-]{43}$/.test(token));});
    // No exchange on GET/mount: preview bots never create a reader session.
    return()=>{alive=false;controller.current?.abort();};
  },[initialToken]);
  async function open() {
    if(busy.current)return;
    if(!/^[A-Za-z0-9_-]{43}$/.test(tokenRef.current)){setFailure({code:"INVALID_LINK",requestId:""});return;}
    busy.current=true;setLoading(true);setFailure(null);
    const abort=new AbortController();controller.current=abort;
    let requestId=demoClientRequestId();let stage:"exchange"|"check"="exchange";
    try {
      // Clear legacy fragments before requests; the stable /open link stays intact.
      if(window.location.hash)window.history.replaceState(null,"","/demo");
      const headers={"Content-Type":"application/json","X-Demo-Request-Id":requestId};
      const exchanged=await fetch("/api/demo-share/session",{method:"POST",headers,credentials:"same-origin",cache:"no-store",redirect:"error",signal:abort.signal,body:JSON.stringify({token:tokenRef.current,...(project?{project}:{})})});
      const result=await exchanged.json().catch(()=>{throw {code:"INVALID_RESPONSE"};});
      if(!exchanged.ok||!result.ok){setFailure({code:demoFailureCode(result.code),requestId:result.requestId??requestId});return;}
      if(typeof result.requestId==="string")requestId=result.requestId;
      if(typeof result.project!=="string"||!/^[a-z0-9-]{1,100}$/.test(result.project)||typeof result.shareId!=="string")throw Error();
      stage="check";
      const checked=await fetch(`/api/demo-share/session?${new URLSearchParams({project:result.project})}`,{headers:{"X-Demo-Request-Id":requestId},credentials:"same-origin",cache:"no-store",redirect:"error",signal:abort.signal});
      const session=await checked.json().catch(()=>{throw {code:"INVALID_RESPONSE"};});
      if(!checked.ok||!session.ok){setFailure({code:demoFailureCode(session.code),requestId:session.requestId??requestId});return;}
      if(session.shareId!==result.shareId){setFailure({code:"SESSION_MISMATCH",requestId});return;}
      window.location.replace(`/demo?${new URLSearchParams({project:result.project})}`);
    } catch(error) {
      const code=demoFailureCode(error&&typeof error==="object"&&"code" in error?error.code:null,"NETWORK_ERROR");
      if(!abort.signal.aborted)setFailure({code,requestId,stage:stage==="check"?"쿠키 확인":"세션 발급"});
    } finally {busy.current=false;if(!abort.signal.aborted)setLoading(false);}
  }
  return <main className="mx-auto flex min-h-[80dvh] max-w-lg flex-col justify-center gap-5 px-6 py-10 text-slate-800">
    <p className="text-sm font-bold text-emerald-800">비공개 · 읽기 전용 시연</p>
    <h1 className="text-2xl font-bold">{project==="hwaseong-2026-10-samples"?"화성시 모바일 소식지":"모바일 소식지 시연"}</h1>
    <p className="text-sm leading-7">소식지 열기를 누르면 이 브라우저의 열람 세션을 확인합니다. 관리자 로그인은 필요하지 않습니다. 정식 발행물이 아닙니다.</p>
    <button type="button" className="min-h-12 rounded-xl bg-[#234e43] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={valid!==true||loading} onClick={()=>void open()}>{loading?"열람 세션 확인 중…":"소식지 열기"}</button>
    {valid===false?<p role="alert">{demoMessages.INVALID_LINK}</p>:null}
    {failure?<div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-7"><p>{demoMessages[failure.code]}</p><p className="mt-2 text-xs break-all">오류 코드: {failure.code}{failure.stage?` · 단계: ${failure.stage}`:""}{failure.requestId?<> · 확인 번호: {failure.requestId}</>:null}</p></div>:null}
    <p className="text-xs leading-6 text-slate-600">쿠키가 차단되거나 앱 안에서 열리지 않으면 메뉴의 ‘외부 브라우저로 열기’를 선택하세요. 또는 전달받은 원본 링크 전체를 복사해 Chrome·삼성 인터넷 주소창에 붙여넣어 주세요. 연결 후 주소창의 단축된 주소는 다른 기기에 공유하지 마세요.</p>
  </main>;
}
