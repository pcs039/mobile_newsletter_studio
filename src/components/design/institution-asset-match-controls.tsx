"use client";
import type { InstitutionPlacementLink } from "@/lib/institution-asset-placement";
import { hybridStrategyAllowed, type HybridStage } from "@/lib/hybrid-visual-plan";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { buildVisualDirectorResult, type VisualDirectorArticle } from "@/lib/article-visual-director";
import { institutionArticleSnapshot, institutionAssetKindLabels, type InstitutionAssetRecommendation } from "@/lib/institution-asset-matching";

type MatchResult=Omit<InstitutionAssetRecommendation,"candidates"> & {matchKey:string;candidates:Array<InstitutionAssetRecommendation["candidates"][number]&{previewHref:string}>};
type Props={institutionPlacement?:InstitutionPlacementLink;article:VisualDirectorArticle;articleId:string;projectSlug:string;disabled:boolean;context?:"hybrid";onStage?:(stage:HybridStage)=>void};
export function InstitutionAssetMatchControls(props:Props) {
  const director=buildVisualDirectorResult(props.article);
  if(!props.articleId||!(director.primaryStrategy==="institution_asset"||(props.context==="hybrid"&&hybridStrategyAllowed(props.article,"institution_asset")))||!director.needsRealPhoto)return null;
  const sourceKey=JSON.stringify([props.projectSlug,props.articleId,institutionArticleSnapshot(props.article)]);
  return <InstitutionAssetCandidates key={sourceKey} {...props}/>;
}
function InstitutionAssetCandidates({articleId,projectSlug,disabled,context,onStage,institutionPlacement}:Props) {
  const [result,setResult]=useState<MatchResult|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[selected,setSelected]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
  const previousKey=useRef(""),selectedRef=useRef<string|null>(null);
  useEffect(()=>{
    if(disabled)return;
    const controller=new AbortController();let alive=true;
    void fetch(`/api/project-content/institution-assets?${new URLSearchParams({projectSlug,articleId,...(context?{context}:{})})}`,{signal:controller.signal,cache:"no-store"}).then(async r=>{
      const p=await r.json();if(!r.ok||!p.ok)throw new Error(p.message||"후보를 확인하지 못했습니다.");
      if(alive){const sameKey=previousKey.current===p.matchKey;setSelected(s=>sameKey&&p.candidateAssetIds.includes(s)?s:null);selectedRef.current=sameKey&&p.candidateAssetIds.includes(selectedRef.current)?selectedRef.current:null;previousKey.current=p.matchKey;setResult(p);onStage?.({status:selectedRef.current?"completed":p.candidates.length?"ready":"needs_input",assetId:selectedRef.current??undefined,recommendationKey:p.matchKey});}
    }).catch(e=>{if(alive&&e.name!=="AbortError"){setError("기관 자산을 확인하지 못했습니다. 자산 관리에서 확인하세요.");setResult(null);setSelected(null);selectedRef.current=null;onStage?.({status:"failed"});}}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;controller.abort();};
  },[articleId,projectSlug,disabled,refresh,context,onStage]);
  return <section aria-label="기관 자산 추천" className="mt-3 min-w-0 rounded border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]">
    <h4 className="font-bold">기관 자산 추천</h4><p className="mt-1">실제 사진 사용이 적합합니다. 기관 보유 자료에서 관련 후보를 확인하세요.</p>
    <p role="status" className="mt-2">{loading?"기관 자산을 확인하고 있습니다…":error||(result?.status==="not_supported"?"저장된 기사의 시각 전략을 다시 확인하세요.":!result?.candidates.length?"적합한 기관 자산을 찾지 못했습니다. 실제 대상의 사진을 추가해 주세요.":result.status==="strong_match"?"대상명이 일치하는 후보입니다. 사진 내용을 최종 확인하세요.":"관련 후보입니다. 실제 대상과 촬영 시점을 확인하세요.")}</p>
    {result?.candidates.length?<div className="mt-3 grid min-w-0 gap-3 md:grid-cols-3">{result.candidates.map(a=><article key={a.assetId} className={`min-w-0 rounded border p-3 ${selected===a.assetId?"border-sky-700 bg-sky-50 ring-2 ring-sky-300":"border-slate-200"}`}>
      <Image unoptimized src={a.previewHref} width={320} height={240} alt={a.name} className="h-36 w-full object-contain"/>
      <h5 className="mt-2 font-bold">{a.name}</h5><p className="text-xs">{institutionAssetKindLabels[a.kind]} · {a.approvalStatus==="approved"?"승인됨":"승인 필요"} · 관련도 {Math.round(a.score*100)}점</p>
      <ul className="mt-2 list-disc pl-4 text-xs">{a.reasons.map(r=><li key={r}>{r}</li>)}</ul><ul className="mt-2 text-xs text-amber-900">{a.warnings.map(w=><li key={w}>{w}</li>)}</ul>
      <button type="button" aria-pressed={selected===a.assetId} disabled={disabled||loading} onClick={()=>{setSelected(a.assetId);selectedRef.current=a.assetId;onStage?.({status:"completed",assetId:a.assetId,recommendationKey:result.matchKey});}} className="dd-btn dd-btn-secondary mt-2 max-w-full whitespace-normal">{selected===a.assetId?"선택됨":"이 자산 선택"}</button>
      {selected===a.assetId&&institutionPlacement ? institutionPlacement.assetIds.includes(a.assetId) ? <button type="button" disabled={disabled||loading} onClick={()=>institutionPlacement.onRequest(a.assetId)} className="dd-btn dd-btn-secondary mt-2 max-w-full whitespace-normal">배치 위치 확인</button> : <p className="mt-2 text-xs text-amber-900">이 후보는 현재 공개 지원 배치와 호환되는 웹용 제작 자산이 아닙니다. 자산 관리에서 확인하세요.</p> : null}
    </article>)}</div>:null}
    {selected?<p className="mt-2 text-xs">확인 후보로 선택했습니다. 기사에는 적용되지 않았습니다.</p>:null}
    <p className="mt-2 text-xs">대상·촬영 시점·회차·사용 승인·저작권과 초상권은 사람이 최종 확인해야 합니다.</p>
    <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="dd-btn dd-btn-secondary max-w-full whitespace-normal" disabled={disabled||loading} onClick={()=>{setLoading(true);setError("");setRefresh(n=>n+1);}}>후보 다시 확인</button><a className="dd-btn dd-btn-secondary max-w-full whitespace-normal" href={`/projects/${projectSlug}/design`}>자산 관리에서 확인</a></div>
  </section>;
}
