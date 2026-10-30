"use client";
import { sampleDemoHref } from "@/lib/hwaseong-demo-navigation";
import { demoClientRequestId, demoFailureCode, demoMessages, type DemoFailureCode } from "@/lib/demo-share-status";
import { useEffect,useState,type ReactNode } from "react";
export function DemoShareSession({slug,shareId,expiresAt,children,confirmOnMount=false}:{slug:string;shareId:string;expiresAt:string|null;children:ReactNode;confirmOnMount?:boolean}){
 const [checking,setChecking]=useState(confirmOnMount);
 const [failure,setFailure]=useState<{code:DemoFailureCode;requestId:string}|null>(null);
 useEffect(()=>{let alive=true,failed=false,inFlight=false;const controller=new AbortController();
  async function check(){
    if(!alive||failed||inFlight)return;
    inFlight=true;
    const requestId=demoClientRequestId();
    try{
      const r=await fetch(`/api/demo-share/session?${new URLSearchParams({project:slug})}`,{cache:"no-store",credentials:"same-origin",headers:{"X-Demo-Request-Id":requestId},signal:controller.signal});
      const d=await r.json();
      if(alive&&(!r.ok||!d.ok)){failed=true;setFailure({code:demoFailureCode(d.code),requestId:d.requestId??requestId});}
      else if(alive&&d.shareId!==shareId){failed=true;setFailure({code:"SESSION_MISMATCH",requestId});}
      else if(alive&&confirmOnMount&&window.location.pathname.startsWith("/demo/open/")){
        // Cookie storage is confirmed before removing the bearer from history.
        // Same document: no redirect, extra SSR, audio or form remount.
        window.history.replaceState(null,"",sampleDemoHref(slug,window.location.href));
      }
    }catch{if(alive&&!controller.signal.aborted){failed=true;setFailure({code:"NETWORK_ERROR",requestId});}}
    finally{inFlight=false;if(alive)setChecking(false);}
  }
  if(confirmOnMount)void check();
  const expiry=expiresAt===null?null:setTimeout(()=>setFailure({code:"EXPIRED",requestId:""}),Math.max(0,Math.min(2147483647,Date.parse(expiresAt)-Date.now())));
  const timer=setInterval(()=>void check(),15000);const focus=()=>void check();window.addEventListener("focus",focus);
  return()=>{alive=false;controller.abort();if(expiry!==null)clearTimeout(expiry);clearInterval(timer);window.removeEventListener("focus",focus);};
 },[slug,shareId,expiresAt,confirmOnMount]);
 if(failure)return <div role="alert" className="p-6 text-center text-sm leading-7"><p>{demoMessages[failure.code]}</p><p className="text-xs">오류 코드: {failure.code}{failure.requestId?` · 확인 번호: ${failure.requestId}`:""}</p></div>;
 if(!confirmOnMount)return <>{children}</>;
 return <><div inert={checking||undefined} aria-busy={checking||undefined}>{children}</div>{checking?<p role="status" className="fixed bottom-4 left-1/2 z-[10000] -translate-x-1/2 rounded-full bg-[#234e43] px-4 py-2 text-sm text-white shadow-lg">소식지 준비 중…</p>:null}</>;
}
