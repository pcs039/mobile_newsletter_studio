"use client";
import {useEffect,useRef,useState} from "react";
export function DemoShareEntry(){
 const [message,setMessage]=useState("시연 링크를 확인하고 있습니다.");
 const tokenRef=useRef<string|null>(null);
 useEffect(()=>{
  const token=tokenRef.current??window.location.hash.slice(1);
  tokenRef.current=token;
  // Fragment is never sent in HTTP URLs/referrers/access logs. Remove before any request.
  window.history.replaceState(null,"","/demo");
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)){void Promise.resolve().then(()=>setMessage("유효한 시연 링크로 접속해 주세요."));return;}
  let active=true;const abort=new AbortController();
  void fetch("/api/demo-share/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),signal:abort.signal}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error();if(active)window.location.replace(`/demo?${new URLSearchParams({project:d.project})}`);}).catch(()=>{if(active)setMessage("시연 링크가 만료·회수되었거나 자료가 변경되었습니다. 새 링크를 요청하세요.");});
  return()=>{active=false;abort.abort();};
 },[]);
 return <main className="p-8 text-center" role="status">{message}</main>;
}
