"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ArticleDesignConcept } from "@/lib/article-design-concept";
import type { VisualAssetSpecification } from "@/lib/article-visual-asset-spec";

type Preview={base64:string;proof:string;width:number;height:number;size:number};
export function ArticleVisualAssetGenerator({projectSlug,articleId,concept,specification,disabled,onBusy}:{
  projectSlug:string;articleId:string;concept:ArticleDesignConcept;specification:VisualAssetSpecification;disabled:boolean;onBusy:(busy:boolean)=>void;
}){
  const [preview,setPreview]=useState<Preview|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState<{id:string;name:string}|null>(null);
  const [approvalAttempted,setApprovalAttempted]=useState(false);
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  const enabled=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"")==="https://mvrkpmffuhcqwisqvpqi.supabase.co";
  if(!enabled||!["hero_background","hero_illustration"].includes(specification.assetRole))return null;
  async function perform(action:"generate"|"approve"){
    if(pending.current||disabled||saved)return;
    if(action==="generate"&&approvalAttempted)return;
    if(action==="generate"&&preview&&!window.confirm("다시 생성하면 새 API 비용이 발생하며 현재 미리보기는 교체됩니다. 계속할까요?"))return;
    if(action==="approve")setApprovalAttempted(true);
    const controller=new AbortController();pending.current=controller;setBusy(true);onBusy(true);setMessage("");
    const timer=setTimeout(()=>controller.abort(),270_000);
    try{
      const response=await fetch("/api/project-content/visual-asset-generation",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,
        body:JSON.stringify({projectSlug,articleId,action,...(action==="generate"?{concept,role:specification.assetRole,requestKey:crypto.randomUUID()}:{base64:preview?.base64,proof:preview?.proof})})});
      const body=await response.json().catch(()=>null);
      if(!response.ok||!body?.ok)throw new Error(body?.message||"이미지 결과를 확인하지 못했습니다. 자동 재시도하지 않습니다.");
      if(action==="generate"){setPreview(body);setMessage("생성 완료. 글자·로고가 없는지, 안전영역이 비어 있는지 확인한 후 승인하세요.");}
      else{setSaved(body.asset);setPreview(null);setMessage("승인된 디자인 자산으로 등록했습니다. 새로고침 후 기사 디자인에서 선택해 사용하세요. 자동 배치하지 않습니다.");}
    }catch(error){setMessage(error instanceof Error&&error.name!=="AbortError"?error.message:"응답이 지연되거나 연결이 끊겼습니다. 자동 재시도하지 않습니다. 승인 중이었다면 먼저 자산 목록을 확인하세요.");}
    finally{clearTimeout(timer);pending.current=null;setBusy(false);onBusy(false);}
  }
  return <div className="mt-2 min-w-0">
    <p className="text-xs text-slate-600">Staging 이미지 생성 · 요청당 1장 · API 비용 발생 · 승인 전 저장하지 않음</p>
    {preview?<Image unoptimized width={preview.width} height={preview.height} src={`data:image/png;base64,${preview.base64}`} alt="생성된 자산 미리보기" className="mt-2 block h-auto max-h-80 max-w-full rounded border border-slate-200 object-contain" style={{backgroundColor:"#f1f5f9",backgroundImage:"conic-gradient(#cbd5e1 25%,transparent 0 50%,#cbd5e1 0 75%,transparent 0)",backgroundSize:"16px 16px"}}/>:null}
    {preview?<p className="mt-1 text-xs">{preview.width} × {preview.height}px · PNG · 승인 유효시간 15분</p>:null}
    <p role="status" className="mt-2 text-sm [overflow-wrap:anywhere]">{busy?"처리 중… 생성은 최대 4분 정도 걸릴 수 있습니다.":message}</p>
    {saved?<p className="mt-2 text-sm font-bold">등록 자산: {saved.name}</p>:<div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={disabled||busy||approvalAttempted} className="dd-btn dd-btn-secondary" onClick={()=>void perform("generate")}>{preview?"다시 생성":"이미지 생성"}</button>
      {preview?<button type="button" disabled={disabled||busy} className="dd-btn dd-btn-primary" onClick={()=>void perform("approve")}>자산으로 승인</button>:null}
      {preview?<button type="button" disabled={busy||approvalAttempted} className="dd-btn dd-btn-secondary" onClick={()=>{setPreview(null);setMessage("미리보기를 취소했습니다. 등록된 파일이나 자산은 없습니다.");}}>취소</button>:null}
    </div>}
    {approvalAttempted&&!saved&&!busy?<p className="mt-2 text-xs text-slate-600">승인을 시작한 결과는 교체하지 않습니다. 자산 목록을 먼저 확인하고, 같은 결과의 승인 버튼으로 등록을 다시 확인하세요.</p>:null}
  </div>;
}
