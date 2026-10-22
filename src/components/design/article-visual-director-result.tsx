import type { ReactNode } from "react";
import { adobeTaskLabels, visualStrategies, type VisualDirectorResult } from "@/lib/article-visual-director";

export function ArticleVisualDirectorResult({ result, children }: { result: VisualDirectorResult; children?: ReactNode }) {
  return <section aria-label="AI 시각 전략" className="mb-3 min-w-0 rounded-lg bg-slate-50 p-3 text-sm [overflow-wrap:anywhere]">
    <h3 className="font-bold text-[#092046]">기사에 맞는 디자인 방식</h3>
    <p className="mt-1 font-bold">추천: {visualStrategies[result.primaryStrategy]}</p>
    <p className="mt-1 text-xs text-slate-600">추천 단계 · 아직 생성하거나 기사에 적용한 결과가 아닙니다.</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    {result.secondaryStrategy ? <p className="mt-2">보조: {visualStrategies[result.secondaryStrategy]}</p> : null}
    {result.needsRealPhoto ? <p className="mt-2">실제 대상의 사진이 필요합니다. AI 이미지로 대체하지 마세요.</p> : null}
    {result.humanInputRequired ? <p role="status" className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-950">자료 확인 필요 · {result.humanInputReason}</p> : null}
    {result.adobeTasks.length ? <p className="mt-2">후처리 후보: {result.adobeTasks.map(task => adobeTaskLabels[task]).join(", ")}</p> : null}
    <details className="mt-3 rounded border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer font-bold">어떤 방식을 선택하면 좋을까요?</summary>
      <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <div><dt className="font-bold">기관 사진 활용</dt><dd className="mt-1 text-xs leading-5">현장·인물·시설 기사에 적합합니다. 기관 제공 사진과 이미지 설명을 준비하세요. 실제 대상을 AI 이미지로 대체하지 않습니다.</dd></div>
        <div><dt className="font-bold">정보 중심 HTML 디자인</dt><dd className="mt-1 text-xs leading-5">긴 기사·긴급 안내·신청 정보에 적합합니다. 제목·요약·대상·기간·연락처·행동 버튼 링크를 확인하세요. 절차·수치는 정보 시각화도 검토할 수 있습니다.</dd></div>
        <div><dt className="font-bold">Canva 디자인</dt><dd className="mt-1 text-xs leading-5">행사·정책·모집의 시각 요약에 적합합니다. 등록 템플릿, 핵심 문구와 이미지를 준비하세요. 제작 → 결과 검토 → PNG 가져오기 → 자산 승인·적용은 별도 단계입니다.</dd></div>
        <div><dt className="font-bold">GPT 이미지 기반 배경</dt><dd className="mt-1 text-xs leading-5">계절·문화·개념 표현에 적합합니다. 기사 내용과 원하는 분위기를 확인하세요. 제목·날짜 등 중요한 정보는 HTML로 유지합니다.</dd></div>
      </dl>
      <p className="mt-3 text-xs text-slate-600">한 기사에서 사진과 HTML을 함께 사용할 수 있습니다. Canva·GPT의 생성·가져오기·적용 일부는 고정 Staging에서만 실행됩니다.</p>
    </details>
    {children}
    <p className="mt-2 text-xs text-slate-600">저장된 기사 기반의 규칙 추천입니다. 추천만으로 생성·제작·저장하지 않습니다.</p>
  </section>;
}
