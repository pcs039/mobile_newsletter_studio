"use client";
import type { InstitutionPlacementLink } from "@/lib/institution-asset-placement";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisualDirectorArticle } from "@/lib/article-visual-director";
import { visualStrategies } from "@/lib/article-visual-director";
import { visualArticleSnapshot } from "@/lib/article-visual-source-snapshot";
import { buildInformationGraphicSpec } from "@/lib/article-information-graphic";
import { buildDirectorImageSpec } from "@/lib/visual-director-image-spec";
import { buildHybridVisualPlan, buildHybridRecommendation, buildHybridExecutionState, hybridCanvaRecommendations, type HybridStage, type HybridVisualPlan } from "@/lib/hybrid-visual-plan";
import { InstitutionAssetMatchControls } from "@/components/design/institution-asset-match-controls";
import { InformationGraphicControls } from "@/components/design/information-graphic-controls";
import { VisualDirectorImageControls } from "@/components/design/visual-director-image-controls";

type Context={sourceKey:string;plan:HybridVisualPlan;primary:HybridStage;secondary:HybridStage;stale:boolean};
const labels={not_started:"준비 전",ready:"준비 가능",in_progress:"준비 중",completed:"준비 완료",needs_input:"자료 입력·확인 필요",failed:"준비 실패"};
function initial(article:VisualDirectorArticle,id:string,plan:HybridVisualPlan,sourceKey:string):Context {
  const stage=(strategy:string):HybridStage=>({status:strategy==="html_first"?"completed":strategy==="institution_asset"?"not_started":strategy==="information_graphic"?buildInformationGraphicSpec(article,id,"hybrid").status==="ready"?"ready":"needs_input":strategy==="ai_generated_image"?buildDirectorImageSpec(article,"hybrid")?"ready":"needs_input":hybridCanvaRecommendations(article).length?"ready":"needs_input"});
  return {sourceKey,plan,primary:stage(plan.primary.strategy),secondary:plan.secondary?stage(plan.secondary.strategy):{status:"completed"},stale:false};
}
function update(c:Context,field:"primary"|"secondary",stage:HybridStage) {
  const previous=c[field];
  if(previous.recommendationKey&&stage.recommendationKey&&previous.recommendationKey!==stage.recommendationKey)return {...c,stale:true};
  return {...c,[field]:stage};
}
export function HybridVisualControls({article,articleId,projectSlug,disabled,institutionPlacement}:{institutionPlacement?:InstitutionPlacementLink;article:VisualDirectorArticle;articleId:string;projectSlug:string;disabled:boolean}) {
  const sourceKey=JSON.stringify([projectSlug,articleId,visualArticleSnapshot(article)]);
  const binding=useMemo(()=>{const plan=buildHybridVisualPlan(article);return plan&&articleId?initial(article,articleId,plan,sourceKey):null;},[article,articleId,sourceKey]);
  const [context,setContext]=useState<Context|null>(binding),[hybridKey,setHybridKey]=useState(""),[busy,setBusy]=useState(false);
  const active=context??binding,stale=!!active&&(active.stale||active.sourceKey!==sourceKey||!binding);
  const onPrimary=useCallback((stage:HybridStage)=>{setContext(c=>{const current=c??binding;return current&&current.sourceKey===sourceKey?update(current,"primary",stage):current;});},[binding,sourceKey]);
  const onSecondary=useCallback((stage:HybridStage)=>{setContext(c=>{const current=c??binding;return current&&current.sourceKey===sourceKey?update(current,"secondary",stage):current;});},[binding,sourceKey]);
  useEffect(()=>{
    if(!active||stale)return;
    let alive=true;
    void buildHybridRecommendation(article,articleId,active.primary,active.secondary).then(r=>{if(alive&&r){setHybridKey(r.hybridKey);setContext(c=>c??binding);}}).catch(()=>{if(alive)setHybridKey("");});
    return()=>{alive=false;};
  },[article,articleId,active,binding,stale]);
  if(!active)return null;
  const state=buildHybridExecutionState(active.plan,active.primary,active.secondary,stale);
  const secondaryAllowed=active.primary.status==="completed"||active.primary.status==="needs_input"||(active.plan.primary.strategy==="institution_asset"&&active.primary.status==="ready");
  function controls(strategy:string,secondary:boolean) {
    const onStage=secondary?onSecondary:onPrimary,blocked=disabled||busy||(secondary&&!secondaryAllowed);
    if(strategy==="institution_asset")return <InstitutionAssetMatchControls institutionPlacement={institutionPlacement} article={article} articleId={articleId} projectSlug={projectSlug} context="hybrid" disabled={blocked} onStage={onStage}/>;
    if(strategy==="information_graphic")return <InformationGraphicControls article={article} articleId={articleId} projectSlug={projectSlug} context="hybrid" disabled={blocked} onBusy={setBusy} onStage={onStage}/>;
    if(strategy==="ai_generated_image")return <VisualDirectorImageControls article={article} articleId={articleId} projectSlug={projectSlug} context="hybrid" disabled={blocked} onBusy={setBusy} onStage={onStage}/>;
    if(strategy==="html_first")return <p className="mt-2 text-xs">기사의 원문 텍스트를 보조 정보로 유지합니다. 별도 이미지 자산은 만들지 않습니다.</p>;
    const candidates=hybridCanvaRecommendations(article);
    return <div className="mt-2 text-xs"><p>Canva 템플릿은 추천 후보입니다. 작업자가 별도로 확인해야 합니다. 후보를 확인해도 디자인이 자동으로 제작·승인되거나 기사에 적용되지는 않습니다.</p><ul className="mt-1 list-disc pl-5">{candidates.map(t=><li key={t.templateId}>{t.displayName}</li>)}</ul><button type="button" className="dd-btn dd-btn-secondary mt-2 max-w-full whitespace-normal" disabled={blocked||!candidates.length} onClick={()=>onStage({status:"completed"})}>Canva 후보 확인</button></div>;
  }
  return <section aria-label="혼합 시각 구성" className="mt-3 min-w-0 rounded border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]">
    <h4 className="font-bold">혼합 시각 구성</h4>
    <p className="mt-2 text-xs">대표 시각 요소는 기사의 중심 시각 자료이며, 보조 시각 요소는 기사 이해를 돕는 추가 자료입니다.</p>
    <p className="mt-1 text-xs">실제 인물·시설·행사 현장이 있는 기사는 기관 사진을 우선 사용합니다. 사진이 없으면 자료 입력이 필요하며, AI 이미지가 실제 대상 사진을 자동 대체하지 않습니다.</p>
    {stale?<div role="status" className="mt-2 text-amber-900"><p>기사 내용 또는 추천 조건이 바뀌어 다시 확인이 필요합니다. 기존 생성 자산은 삭제하지 않고 이전 결과로 유지합니다.</p>{state.primaryAssetId?<p>이전 대표 시각 자산: {state.primaryAssetId}</p>:null}{state.secondaryAssetId?<p>이전 보조 시각 자산: {state.secondaryAssetId}</p>:null}<button type="button" disabled={disabled||busy} className="dd-btn dd-btn-secondary mt-2 max-w-full whitespace-normal" onClick={()=>{setContext(binding);setHybridKey("");}}>{binding?"현재 내용으로 다시 확인":"이전 구성 안내 닫기"}</button></div>:<>
      <div key={`${sourceKey}:primary`} className="mt-3"><h5 className="font-bold">① 대표 시각 요소 · {visualStrategies[active.plan.primary.strategy]} · {labels[active.primary.status]}</h5>{controls(active.plan.primary.strategy,false)}</div>
      {active.plan.secondary?<div key={`${sourceKey}:secondary`} className="mt-3 border-t pt-3"><h5 className="font-bold">② 보조 시각 요소 · {visualStrategies[active.plan.secondary.strategy]} · {labels[active.secondary.status]}</h5>{!secondaryAllowed&&active.plan.secondary.assetRequired?<p className="mt-1 text-xs">대표 시각 요소의 자료를 먼저 확인한 뒤 보조 시각 요소를 준비하세요.</p>:null}{controls(active.plan.secondary.strategy,true)}</div>:null}
      <p role="status" className="mt-3">{state.readyForReview?"두 요소의 준비·후보 확인이 끝났습니다. 아직 기사에 적용되지 않았습니다. 내용과 사용 권한을 검토한 뒤 별도 적용하세요.":state.status==="blocked"?"대표 시각 요소에 사용할 실제 대상의 기관 사진 입력·확인이 필요합니다. 보조 시각 요소는 별도로 준비할 수 있습니다.":state.status==="partial"?"보조 시각 요소 준비만 실패했습니다. 준비된 대표 시각 요소는 그대로 유지됩니다.":"각 요소의 후보를 확인하고 필요한 자료를 직접 준비하세요. 생성·선택·승인·기사 적용은 자동으로 실행되지 않습니다."}</p>
    </>}
    <p className="mt-2 text-xs">준비 완료는 승인·기사 적용 완료가 아닙니다. 작업자가 대상·내용·사용 권한을 최종 검토해야 합니다.</p>
    {hybridKey?<details className="mt-2 text-xs"><summary>조합 확인 정보</summary><p className="break-all">{hybridKey}</p><p>대표 시각 요소: {state.primaryAssetId||"자산 미준비"} · 보조 시각 요소: {state.secondaryAssetId||"별도 자산 없음/미준비"}</p></details>:null}
  </section>;
}
