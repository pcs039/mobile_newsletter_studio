"use client";
import { demoClientRequestId, demoFailureCode, demoMessages, type DemoFailureCode } from "@/lib/demo-share-status";
import { useEffect,useState,type ReactNode } from "react";
export function DemoShareSession({slug,shareId,expiresAt,children}:{slug:string;shareId:string;expiresAt:string|null;children:ReactNode}){
 const [failure,setFailure]=useState<{code:DemoFailureCode;requestId:string}|null>(null);
 useEffect(()=>{let alive=true;const controller=new AbortController();
  async function check(){
    const requestId=demoClientRequestId();
    try{
      const r=await fetch(`/api/demo-share/session?${new URLSearchParams({project:slug})}`,{cache:"no-store",credentials:"same-origin",headers:{"X-Demo-Request-Id":requestId},signal:controller.signal});
      const d=await r.json();
      if(alive&&(!r.ok||!d.ok))setFailure({code:demoFailureCode(d.code),requestId:d.requestId??requestId});
      else if(alive&&d.shareId!==shareId)setFailure({code:"SESSION_MISMATCH",requestId});
    }catch{if(alive&&!controller.signal.aborted)setFailure({code:"NETWORK_ERROR",requestId});}
  }
  const expiry=expiresAt===null?null:setTimeout(()=>setFailure({code:"EXPIRED",requestId:""}),Math.max(0,Math.min(2147483647,Date.parse(expiresAt)-Date.now())));
  const timer=setInterval(()=>void check(),15000);const focus=()=>void check();window.addEventListener("focus",focus);
  return()=>{alive=false;controller.abort();if(expiry!==null)clearTimeout(expiry);clearInterval(timer);window.removeEventListener("focus",focus);};
 },[slug,shareId,expiresAt]);
 if(failure)return <div role="alert" className="p-6 text-center text-sm leading-7"><p>{demoMessages[failure.code]}</p><p className="text-xs">오류 코드: {failure.code}{failure.requestId?` · 확인 번호: ${failure.requestId}`:""}</p></div>;
 return <>{children}</>;
}
