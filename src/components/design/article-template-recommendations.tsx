"use client";

import { CanvaRecommendationExecutionControls } from "@/components/design/canva-recommendation-execution-controls";
import { useState } from "react";
import type { ArticleDesignTemplateRecommendation } from "@/lib/article-design-template-recommendation";
import { canvaTemplateFamilies } from "@/lib/canva-template-registry";

export function ArticleTemplateRecommendations({ recommendations, disabled = false, projectSlug, articleId, articleVersion }: {
  recommendations: readonly ArticleDesignTemplateRecommendation[] | null;
  disabled?: boolean;
  projectSlug?: string; articleId?: string; articleVersion?: string;
}) {
  const resultKey = JSON.stringify(recommendations);
  const [selection, setSelection] = useState<{ id: string | null; resultKey: string }>({ id: null, resultKey });
  // Reconcile during render (only when the list changes), so removed IDs never
  // survive an empty/error result or reappear selected when old results return.
  const currentSelection = selection.resultKey === resultKey ? selection : {
    id: recommendations?.some(item => item.templateId === selection.id) ? selection.id : null,
    resultKey,
  };
  if (currentSelection !== selection) setSelection(currentSelection);
  const selected = recommendations?.find(item => item.templateId === currentSelection.id);

  return <div className="mt-3 min-w-0">
    <p className="text-sm font-bold text-[#092046]">추천 디자인 Top 3</p>
    <p className="mt-1 text-xs text-slate-600">기사 내용의 규칙 기반 점수입니다. 점수는 확률이 아니며, 선택만으로 Canva가 실행되지 않습니다.</p>
    {!recommendations?.length ? <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">추천 디자인을 확인할 수 없습니다. 기존 디자인 편집은 계속 사용할 수 있습니다.</p> : <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-3">
      {recommendations.map(item => {
        const active = selected?.templateId === item.templateId;
        const needsCheck = item.score === 0;
        return <article key={item.templateId} aria-label={`${item.rank}위 ${item.displayName}`} className={`min-w-0 rounded-lg border p-3 [overflow-wrap:anywhere] ${active ? "border-[#184a88] bg-sky-50 ring-2 ring-[#184a88]" : "border-slate-200 bg-white"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600">{item.rank}위</span>
            {needsCheck ? <span className="rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">확인 필요</span> : null}
            {active ? <span className="text-xs font-bold text-[#184a88]">선택됨</span> : null}
          </div>
          <h4 className="mt-2 text-sm font-black text-[#092046]">{item.displayName}</h4>
          <p className="mt-1 text-xs text-slate-600">{canvaTemplateFamilies[item.family]} · 유형 {item.variant}</p>
          <p className="mt-2 text-xs text-slate-600">추천 점수: {item.score}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{item.reason}</p>
          <button type="button" aria-pressed={active} disabled={disabled} onClick={() => setSelection({ id: item.templateId, resultKey })} className="dd-btn dd-btn-secondary mt-3 max-w-full" style={{ whiteSpace: "normal" }}>이 디자인 선택</button>
        </article>;
      })}
    </div>}
    <p role="status" aria-live="polite" className="mt-2 text-xs text-slate-600">{selected ? `선택한 디자인: ${selected.displayName}. 선택만으로 적용되거나 저장되지 않습니다.` : "아직 선택한 디자인이 없습니다."}</p>
    {selected && projectSlug && articleId ? <CanvaRecommendationExecutionControls key={`${projectSlug}:${articleId}:${articleVersion}:${selected.templateId}`} projectSlug={projectSlug} articleId={articleId} templateId={selected.templateId} disabled={disabled} /> : null}
  </div>;
}
