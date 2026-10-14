"use client";
import Image from "next/image";
import { useEffect,useRef,useState } from "react";
import { buildInformationGraphicSpec,graphicTypeLabels, type GraphicPlan } from "@/lib/article-information-graphic";
import { buildVisualDirectorResult, type VisualDirectorArticle } from "@/lib/article-visual-director";
export function InformationGraphicControls({article,articleId,projectSlug,disabled,onBusy}:{article:VisualDirectorArticle;articleId:string;projectSlug:string;disabled:boolean;onBusy:(v:boolean)=>void}){
  const plan=buildInformationGraphicSpec(article,articleId),lock=useRef(false),alive=useRef(true);
  const [current,setCurrent]=useState<{status:string;plan?:GraphicPlan;duplicate?:boolean;message?:string;asset?:{id:string;name:string;previewHref:string}}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const displayPlan=current?.plan??plan;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;onBusy(false);};},[onBusy]);
  async function run(){if(lock.current||disabled||plan.status!=="ready")return;lock.current=true;setBusy(true);onBusy(true);setError("");
    try{const call=async(action:string,generationKey?:string)=>{const r=await fetch("/api/project-content/information-graphic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectSlug,articleId,action,...(generationKey?{generationKey}:{})})});const p=await r.json();if(!r.ok||!p.ok)throw new Error(p.message||"그래픽 상태를 확인하지 못했습니다.");return p;};
      let p=await call("prepare");if(p.status==="ready"&&!["unknown","in_progress","failed"].includes(current?.status??""))p=await call("generate",p.generationKey);
      for(let n=0;p.status==="in_progress"&&n<10&&alive.current;n++){if(alive.current)setCurrent(p);await new Promise(r=>setTimeout(r,1000));if(alive.current)p=await call("status",p.generationKey);}
      if(alive.current)setCurrent(p);
    }catch(e){if(alive.current){setError(e instanceof Error?e.message:"생성 결과를 확인하지 못했습니다.");setCurrent({status:"unknown"});}}finally{lock.current=false;if(alive.current){setBusy(false);onBusy(false);}}
  }
  const director=buildVisualDirectorResult(article);
  if(director.primaryStrategy!=="information_graphic"||!director.needsInformationGraphic)return null;
  if(plan.status==="not_supported"&&!articleId)return null;
  return <section aria-label="정보그래픽 추천" className="mt-3 min-w-0 rounded border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]">
    <h4 className="font-bold">정보그래픽 추천</h4>
    {displayPlan.specification?<><p className="mt-1">유형: {graphicTypeLabels[displayPlan.specification.graphicType]} · {displayPlan.specification.aspectRatio}</p><ul className="mt-2 list-disc pl-5">{displayPlan.specification.items.map((i,n)=><li key={n}>{i.label}{i.description?` · ${i.description}`:""}</li>)}</ul></>:null}
    {displayPlan.status!=="ready"?<p role="status" className="mt-2 text-amber-900">확인 필요 · {displayPlan.issues.join(" ")}</p>:null}
    <p className="mt-2 text-xs text-slate-600">저장된 핵심 정보만 사용합니다. 미승인 자산으로 등록하며 기사에는 자동 적용하지 않습니다.</p>
    <div role="status" aria-live="polite" className="mt-2">{busy?"생성 중…":error||current?.message||(!current&&plan.status==="ready"?"생성 가능":"")}
      {current?.status==="success"&&current.asset?<><p>{current.duplicate?"기존 결과를 재사용했습니다.":"정보그래픽 생성 완료 · 자산으로 등록됨"}</p>
        <Image unoptimized src={current.asset.previewHref} width={1000} height={displayPlan.specification?.aspectRatio==="1:1"?1000:1250} alt="생성된 정보그래픽" className="mt-2 h-auto max-h-80 max-w-full object-contain"/>
        <p>{current.asset.name}</p><p className="text-xs">기사 적용 후보 · 원문 확인과 자산 승인 후 별도로 사용하세요.</p><a className="dd-btn dd-btn-secondary mt-2" href={`/projects/${projectSlug}/design`}>자산 관리에서 확인</a></>:null}
    </div>
    {current?.status!=="success"?<button type="button" className="dd-btn dd-btn-primary mt-2 max-w-full whitespace-normal" disabled={disabled||busy||displayPlan.status!=="ready"||current?.status==="failed"} onClick={()=>void run()}>{["unknown","in_progress"].includes(current?.status??"")?"진행 상태 확인":"정보그래픽 생성"}</button>:null}
  </section>;
}
