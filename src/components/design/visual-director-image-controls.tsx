"use client";
import { directorStyleLabels, headlineSafeAreaLabels } from "@/lib/director-image-quality";
import { visualArticleSnapshot } from "@/lib/article-visual-source-snapshot";
import { stageFromExecution, type HybridStage } from "@/lib/hybrid-visual-plan";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { buildDirectorImageSpec, type DirectorGenerationResult } from "@/lib/visual-director-image-spec";
import type { VisualDirectorArticle } from "@/lib/article-visual-director";
import { useStagingE2E, StagingE2ENotice } from "./staging-e2e-status";

function VisualDirectorImageSession({article,articleId,projectSlug,disabled,onBusy,context,onStage}: {
  article: VisualDirectorArticle; articleId:string; projectSlug:string; disabled:boolean; onBusy:(value:boolean)=>void;context?:"hybrid";onStage?:(stage:HybridStage)=>void;
}) {
  const [variantIndex,setVariantIndex]=useState(1);
  const spec = buildDirectorImageSpec(article,context,variantIndex);
  const e2e=useStagingE2E();
  const [current,setCurrent]=useState<DirectorGenerationResult|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const locked=useRef(false),mounted=useRef(true),key=useRef("");
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onBusy(false);};},[onBusy]);
  async function call(action:"prepare"|"generate"|"status",index:number) {
    const r=await fetch("/api/project-content/visual-asset-generation",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({projectSlug,articleId,action:`director_${action}`,...(index>1?{variantIndex:index}:{}),...(context?{context}:{}),...(action!=="prepare"?{generationKey:key.current}:{})})});
    const data=await r.json(); if(!r.ok||!data.ok)throw new Error(data.message||"생성 상태를 확인하지 못했습니다.");
    key.current=data.generationKey;return data as DirectorGenerationResult;
  }
  async function run(generate:boolean,index=variantIndex) {
    if(locked.current||disabled||e2e!=="enabled"||!spec||!articleId)return;
    const alive=()=>mounted.current;
    locked.current=true;setBusy(true);onBusy(true);setMessage("");
    try{
      let value=await call("prepare",index);
      if(!alive())return;
      setVariantIndex(index);
      if(generate&&value.status==="ready")value=await call("generate",index);
      if(alive()){setCurrent(value);onStage?.(stageFromExecution(value.status,value.asset?.id,value.generationKey));}
      // Status-only polling; no second generation POST on timeout or uncertainty.
      for(let count=0;value.status==="in_progress"&&count<30&&alive();count++){
        await new Promise(resolve=>setTimeout(resolve,3000));if(!alive())break;
        value=await call("status",index);if(alive()){setCurrent(value);onStage?.(stageFromExecution(value.status,value.asset?.id,value.generationKey));}
      }
    }catch(error){if(alive()){onStage?.({status:"needs_input"});setMessage(error instanceof Error?error.message:"생성 결과가 미확정입니다. 진행 상태만 확인하세요.");setVariantIndex(index);setCurrent({status:"unknown",generationKey:key.current,specification:buildDirectorImageSpec(article,context,index)!});}}
    finally{locked.current=false;if(mounted.current){setBusy(false);onBusy(false);}}
  }
  if(!spec)return null;
  const unresolved=["unknown","in_progress"].includes(current?.status??"");
  return <section aria-label="AI 이미지 생성" className="mt-3 min-w-0 rounded border border-slate-200 bg-white p-3">
    <h4 className="font-bold">AI 이미지 생성</h4>
    <p className="mt-1">실제 기록사진보다 개념 이미지가 적합합니다.</p>
    <p className="mt-1 text-xs">스타일: {directorStyleLabels[spec.stylePreset]} · 비율: {spec.aspectRatio} · 제목 여백: {headlineSafeAreaLabels[spec.headlineSafeArea]} · 개념 표현</p>
    <p className="mt-1 text-xs text-slate-600">텍스트 없는 개념 이미지입니다. 생성 후 미승인 자산으로 등록되며, 승인·기사 적용은 별도입니다.</p>
    {e2e==="blocked"?<StagingE2ENotice/>:null}
    <div role="status" aria-live="polite" className="mt-2">
      {busy?<p>생성 중…</p>:<p>{current?.status==="failed"?"생성 실패":current?.status==="unknown"?"결과 미확정":current?.status==="in_progress"?"생성 중":current?.status!=="success"&&e2e==="enabled"?"생성 가능":""}</p>}{message?<p>{message}</p>:null}
      {current?.status==="success"&&current.asset?<>
        <p>{current.duplicate?"기존 결과를 재사용했습니다.":"생성 완료 · 자산으로 등록됨"}</p>
        <Image unoptimized src={current.asset.previewHref} width={spec.targetSize.width} height={spec.targetSize.height} alt="생성된 개념 이미지" className="mt-2 h-auto max-h-72 max-w-full rounded object-contain"/>
        <p className="mt-1 break-words">{current.asset.name}</p><p className="text-xs">기사 적용 후보 · 자산 관리에서 확인 후 승인하세요. 아직 기사에 적용되지 않았습니다.</p>
        <a className="dd-btn dd-btn-secondary mt-2" href={`/projects/${projectSlug}/design`}>자산 관리에서 확인</a>
      </>:current?.message?<p>{current.message}</p>:null}
    </div>
    {current?.status==="success"&&variantIndex<3?<button type="button" className="dd-btn dd-btn-secondary mt-2 max-w-full whitespace-normal" disabled={disabled||busy||e2e!=="enabled"} onClick={()=>void run(true,variantIndex+1)}>다른 시안 생성</button>:null}
    <p className="mt-1 text-xs">한 번에 1장 · 다른 시안은 직접 요청할 때만 생성합니다. 최대 3개 시안이며 기존 자산은 유지됩니다.</p>
    {current?.status!=="success"?<button type="button" className="dd-btn dd-btn-primary mt-2 max-w-full whitespace-normal" disabled={disabled||busy||e2e!=="enabled"||!articleId||current?.status==="failed"}
      onClick={()=>void run(!unresolved)}>{unresolved?"진행 상태 확인":"AI 이미지 생성"}</button>:null}
  </section>;
}

export function VisualDirectorImageControls(props: Parameters<typeof VisualDirectorImageSession>[0]) {
  if (!buildDirectorImageSpec(props.article,props.context)) return null;
  const sourceKey=JSON.stringify([props.projectSlug,props.articleId,visualArticleSnapshot(props.article)]);
  return <VisualDirectorImageSession key={sourceKey} {...props}/>;
}
