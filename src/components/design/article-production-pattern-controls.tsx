"use client";

import { useEffect, useRef, useState } from "react";
import { articleProductionPatterns, isArticleProductionPattern, productionPatternDescriptions, type ArticleProductionPattern } from "@/lib/article-production-pattern";
import type { ArticlePatternRecommendation } from "@/lib/article-pattern-recommendation";
import { readArticleTextDesign } from "@/lib/article-text-design";

export function ArticleProductionPatternControls({ pattern, textDesign, disabled, onApply, projectSlug, articleId }: {
  projectSlug: string;
  articleId: string;
  pattern: unknown;
  textDesign: unknown;
  disabled: boolean;
  onApply: (pattern: ArticleProductionPattern) => void;
}) {
  const saved = isArticleProductionPattern(pattern) ? pattern : "manual";
  const [selected, setSelected] = useState(saved);
  const [confirming, setConfirming] = useState(false);
  const [analysis, setAnalysis] = useState<"idle" | "loading" | "complete" | "error">("idle");
  const [recommendation, setRecommendation] = useState<ArticlePatternRecommendation | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const analysisRequest = useRef<AbortController | null>(null);
  useEffect(() => () => analysisRequest.current?.abort(), []);

  async function recommend() {
    if (analysisRequest.current) return;
    const controller = new AbortController();
    analysisRequest.current = controller;
    setAnalysis("loading");
    setRecommendation(null);
    setAnalysisError("");
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("/api/project-content/pattern-recommendation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug, articleId }), signal: controller.signal,
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; recommendation?: ArticlePatternRecommendation; message?: string } | null;
      if (!response.ok || !result?.ok || !result.recommendation) throw new Error(result?.message ?? "AI 추천에 실패했습니다. 수동으로 패턴을 선택해 주세요.");
      setRecommendation(result.recommendation);
      setAnalysis("complete");
    } catch (error) {
      setAnalysisError(error instanceof Error && error.name !== "AbortError" ? error.message : "AI 분석을 완료하지 못했습니다. 수동으로 패턴을 선택해 주세요.");
      setAnalysis("error");
    } finally {
      clearTimeout(timeout);
      analysisRequest.current = null;
    }
  }

  const current = readArticleTextDesign(textDesign);
  const label = selected === "manual" ? "" : { event: "행사", policy: "정책", interview: "인터뷰" }[selected];
  return <fieldset disabled={disabled} className="mt-5 min-w-0 rounded-lg border border-slate-200 p-4">
    <legend className="px-2 font-black text-[#092046]">제작 패턴</legend>
    <p className="text-sm text-slate-600">적용된 패턴: {productionPatternDescriptions[saved].name}. 적용 후에도 모든 디자인을 직접 조정할 수 있습니다.</p>
    <div className="mt-3 rounded-lg border border-slate-200 p-3">
      <button type="button" disabled={analysis === "loading"} onClick={() => void recommend()} className="dd-btn dd-btn-secondary">{analysis === "loading" ? "분석 중…" : "AI 추천 받기"}</button>
      <p className="mt-2 text-sm text-slate-600">저장된 기사 내용으로 분석합니다. 추천은 자동 적용되지 않습니다.</p>
      <div role="status" aria-live="polite" aria-busy={analysis === "loading"}>
        {analysis === "loading" ? <p className="mt-2 text-sm">기사 내용을 분석하고 있습니다. 수동 선택은 계속 사용할 수 있습니다.</p> : null}
        {analysis === "error" ? <p className="mt-2 text-sm text-rose-800">추천 실패: {analysisError}</p> : null}
        {recommendation ? <div className="mt-3 min-w-0 rounded bg-sky-50 p-3 [overflow-wrap:anywhere]">
          <p className="text-sm font-bold">{recommendation.pattern === "manual" ? "직접 구성 추천" : "추천 완료"}</p>
          <p className="mt-1 font-black">추천 패턴: {productionPatternDescriptions[recommendation.pattern].name}</p>
          <p className="mt-2 text-sm">추천 이유: {recommendation.reason}</p>
          <button type="button" onClick={() => { setSelected(recommendation.pattern); setConfirming(true); }} className="dd-btn dd-btn-primary mt-3">이 패턴 적용</button>
        </div> : null}
      </div>
    </div>
    <label className="mt-3 block text-sm font-bold">제작 패턴 선택
      <select value={selected} onChange={e => { setSelected(e.target.value as ArticleProductionPattern); setConfirming(false); }} className="mt-1 block w-full rounded border border-slate-300 p-2">
        {articleProductionPatterns.map(value => <option key={value} value={value}>{productionPatternDescriptions[value].name}</option>)}
      </select>
    </label>
    <p className="mt-2 text-sm text-slate-600">{productionPatternDescriptions[selected].description}</p>
    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm" aria-live="polite">
      <p className="font-bold">적용 예정 항목</p>
      {selected === "manual" ? <p className="mt-1">패턴 표시만 해제합니다. 현재 개별 디자인은 유지합니다.</p> : <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>라벨 사용: {label}{current.label && current.label !== label ? ` (현재 “${current.label}”을 변경)` : ""}</li>
        <li>이미지 설명 스타일 사용: 기존 설명이 있는 이미지만 표시</li>
        <li>{selected === "interview" ? "기존 인용문 강조" : "기존 정보박스 강조"}: 없는 요소는 추가하지 않음</li>
        <li>소제목·번호 배지·정보박스 유형·인용문 사용 여부 유지</li>
      </ul>}
      <p className="mt-2">제목·본문·요약·이미지·설명 문구, 색상과 배치는 변경하지 않습니다. 편집 중인 텍스트 디자인도 함께 저장됩니다.</p>
    </div>
    {confirming ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3" role="group" aria-label="패턴 적용 확인">
      <p className="text-sm font-bold">현재 개별 디자인 설정 일부가 변경됩니다. 계속할까요?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => { setConfirming(false); onApply(selected); }} className="dd-btn dd-btn-primary">확인하고 적용</button>
        <button type="button" onClick={() => setConfirming(false)} className="dd-btn dd-btn-secondary">취소</button>
      </div>
    </div> : <button type="button" onClick={() => setConfirming(true)} className="dd-btn dd-btn-primary mt-3">패턴 적용</button>}
  </fieldset>;
}
