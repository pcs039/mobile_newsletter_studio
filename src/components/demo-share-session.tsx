"use client";
import { useEffect,useState,type ReactNode } from "react";
export function DemoShareSession({slug,shareId,expiresAt,children}:{slug:string;shareId:string;expiresAt:string|null;children:ReactNode}){
 const [blocked,setBlocked]=useState(false);
 useEffect(()=>{let alive=true;const controller=new AbortController();
  async function check(){try{const r=await fetch(`/api/demo-share/session?${new URLSearchParams({project:slug})}`,{cache:"no-store",signal:controller.signal});const d=await r.json();if(alive&&(!r.ok||d.shareId!==shareId))setBlocked(true);}catch{if(alive&&!controller.signal.aborted)setBlocked(true);}}
  const expiry=expiresAt===null?null:setTimeout(()=>setBlocked(true),Math.max(0,Math.min(2147483647,Date.parse(expiresAt)-Date.now())));
  const timer=setInterval(()=>void check(),15000);const focus=()=>void check();window.addEventListener("focus",focus);
  return()=>{alive=false;controller.abort();if(expiry!==null)clearTimeout(expiry);clearInterval(timer);window.removeEventListener("focus",focus);};
 },[slug,shareId,expiresAt]);
 if(blocked)return <p role="alert" className="p-6 text-center">시연이 종료되었거나 자료가 변경되었습니다. 담당자에게 새 링크를 요청하세요.</p>;
 return <>{children}</>;
}
