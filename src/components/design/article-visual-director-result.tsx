import type { ReactNode } from "react";
import { adobeTaskLabels, visualStrategies, type VisualDirectorResult } from "@/lib/article-visual-director";

export function ArticleVisualDirectorResult({ result, children }: { result: VisualDirectorResult; children?: ReactNode }) {
  return <section aria-label="AI 시각 전략" className="mb-3 min-w-0 rounded-lg bg-slate-50 p-3 text-sm [overflow-wrap:anywhere]">
    <h3 className="font-bold text-[#092046]">AI 시각 전략</h3>
    <p className="mt-1 font-bold">추천: {visualStrategies[result.primaryStrategy]}</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    {result.secondaryStrategy ? <p className="mt-2">보조: {visualStrategies[result.secondaryStrategy]}</p> : null}
    {result.needsRealPhoto ? <p className="mt-2">실제 대상의 사진이 필요합니다. AI 이미지로 대체하지 마세요.</p> : null}
    {result.humanInputRequired ? <p role="status" className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-950">자료 확인 필요 · {result.humanInputReason}</p> : null}
    {result.adobeTasks.length ? <p className="mt-2">후처리 후보: {result.adobeTasks.map(task => adobeTaskLabels[task]).join(", ")}</p> : null}
    {result.primaryStrategy === "hybrid" ? <p className="mt-2">추가 시각물 생성 가능 · 자료 확인 후 별도로 진행하세요.</p> : null}
    {children}
    <p className="mt-2 text-xs text-slate-600">저장된 기사 기반의 규칙 추천입니다. 추천만으로 생성·제작·저장하지 않습니다.</p>
  </section>;
}
