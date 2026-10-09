"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isArticleProductionPattern, productionPatternDescriptions } from "@/lib/article-production-pattern";
import type { ArticlePatternRecommendation } from "@/lib/article-pattern-recommendation";

export function ArticleSavedDesignRecommendation({ projectSlug, articleId, onDismiss }: { projectSlug: string; articleId: string; onDismiss: () => void }) {
  const [status, setStatus] = useState<"idle" | "analyzing" | "complete" | "error">("idle");
  const [recommendation, setRecommendation] = useState<ArticlePatternRecommendation | null>(null);
  const [hidden, setHidden] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function dismiss() {
    request.current?.abort();
    setHidden(true);
    onDismiss();
  }

  async function recommend() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStatus("analyzing");
    setRecommendation(null);
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch("/api/project-content/pattern-recommendation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug, articleId }), signal: controller.signal,
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; recommendation?: ArticlePatternRecommendation } | null;
      if (!response.ok || !result?.ok || !result.recommendation || !isArticleProductionPattern(result.recommendation.pattern)) throw new Error("recommendation unavailable");
      setRecommendation(result.recommendation);
      setStatus("complete");
    } catch {
      setStatus("error");
    } finally {
      clearTimeout(timeout);
      request.current = null;
    }
  }

  if (hidden) return null;
  const designHref = recommendation ? `/projects/${encodeURIComponent(projectSlug)}/reading?${new URLSearchParams({ articleId, tab: "composition", recommendedPattern: recommendation.pattern })}` : "";
  return <section aria-label="저장 후 AI 디자인 추천" className="min-w-0 rounded-lg border border-sky-200 bg-sky-50 p-4 [overflow-wrap:anywhere]">
    <p className="text-sm font-bold text-[#092046]">기사 저장이 완료되었습니다.</p>
    <div role="status" aria-live="polite" aria-busy={status === "analyzing"}>
      {status === "idle" ? <p className="mt-2 text-sm text-slate-600">AI가 저장된 기사에 어울리는 디자인을 추천할 수 있습니다.</p> : null}
      {status === "analyzing" ? <p className="mt-2 text-sm">기사 내용을 분석하고 있습니다...</p> : null}
      {status === "error" ? <p className="mt-2 text-sm text-rose-800">추천을 불러오지 못했습니다. 기사 저장에는 영향이 없습니다.</p> : null}
      {recommendation ? <div className="mt-2">
        <p className="font-bold">추천: {productionPatternDescriptions[recommendation.pattern].name}</p>
        <p className="mt-1 text-sm">{recommendation.pattern === "manual" ? "현재 내용으로는 특정 디자인을 추천하기 어렵습니다. 직접 디자인을 선택할 수 있습니다." : recommendation.reason}</p>
      </div> : null}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {recommendation ? <Link href={designHref} className="dd-btn dd-btn-primary">디자인에 적용하러 가기</Link> : <button type="button" onClick={() => void recommend()} disabled={status === "analyzing"} className="dd-btn dd-btn-primary">{status === "analyzing" ? "분석 중…" : "AI 디자인 추천 받기"}</button>}
      <button type="button" onClick={dismiss} className="dd-btn dd-btn-secondary">{recommendation ? "다른 작업 계속" : "나중에"}</button>
    </div>
  </section>;
}
