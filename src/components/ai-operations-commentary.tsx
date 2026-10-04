"use client";

import { useState } from "react";
import type {
  AiEvidenceCatalogItem,
  AiOperationsCommentary as AiOperationsCommentaryResult,
  AiOperationsCommentaryResponse,
} from "@/lib/ai-operations-commentary";
import type { AnalyticsPeriod } from "@/lib/article-analytics-types";

type AiOperationsCommentaryProps = {
  period: AnalyticsPeriod;
  projectId: string;
};

type CommentaryStatus = "idle" | "loading" | "success" | "error";

function CommentaryItems({
  emptyMessage,
  evidenceLabels,
  items,
}: {
  emptyMessage: string;
  evidenceLabels: ReadonlyMap<string, string>;
  items: AiOperationsCommentaryResult["observations"];
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm font-semibold text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-black leading-6 text-[#092046] [overflow-wrap:anywhere] [word-break:keep-all]">{item.title}</h4>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600 [overflow-wrap:anywhere] [word-break:keep-all]">{item.description}</p>
          {item.evidenceIds.length > 0 ? (
            <p
              className="mt-3 text-[11px] font-bold leading-5 text-[#184a88] [overflow-wrap:anywhere]"
              title={item.evidenceIds.join(", ")}
            >
              근거: {item.evidenceIds.map((id) => evidenceLabels.get(id) ?? "운영 지표 근거").join(", ")}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function AiOperationsCommentary({ period, projectId }: AiOperationsCommentaryProps) {
  const [status, setStatus] = useState<CommentaryStatus>("idle");
  const [commentary, setCommentary] = useState<AiOperationsCommentaryResult | null>(null);
  const [evidenceCatalog, setEvidenceCatalog] = useState<AiEvidenceCatalogItem[]>([]);
  const [error, setError] = useState("");

  async function generateCommentary() {
    if (status === "loading") return;

    setStatus("loading");
    setCommentary(null);
    setEvidenceCatalog([]);
    setError("");

    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/analytics/ai-commentary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as AiOperationsCommentaryResponse | null)
      : null;

    if (!response?.ok || !result || result.ok !== true) {
      setStatus("error");
      setError(
        result && result.ok === false
          ? result.message
          : "AI 운영 해설을 생성하지 못했습니다. 기존 운영 리포트는 정상적으로 확인할 수 있습니다.",
      );
      return;
    }

    setCommentary(result.commentary);
    setEvidenceCatalog(result.evidenceCatalog);
    setStatus("success");
  }

  const evidenceLabels = new Map(evidenceCatalog.map((item) => [item.id, item.label]));

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      aria-labelledby="ai-operations-commentary-heading"
      data-ai-commentary
      data-ai-commentary-status={status}
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">선택 생성</p>
          <h2 id="ai-operations-commentary-heading" className="mt-1 text-lg font-black text-[#092046]">AI 운영 해설</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
            집계된 운영 지표를 바탕으로 AI가 주요 흐름과 운영 검토사항을 정리합니다.
          </p>
        </div>
        <button
          type="button"
          className="dd-btn dd-btn-primary dd-btn-sm shrink-0 self-start sm:self-center"
          data-print-control
          disabled={status === "loading"}
          onClick={() => void generateCommentary()}
        >
          {status === "loading" ? "해설 생성 중..." : status === "error" ? "다시 생성" : "AI 해설 생성"}
        </button>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {status === "idle" ? (
          <div className="rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] px-4 py-6 text-center">
            <p className="text-sm font-bold leading-6 text-slate-600">버튼을 누를 때만 현재 기간의 집계값으로 해설을 생성합니다.</p>
          </div>
        ) : status === "loading" ? (
          <div className="rounded-lg bg-[#f7fbff] px-4 py-6 text-center">
            <p className="text-sm font-black text-[#092046]">운영 데이터를 해석하고 있습니다.</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">중복 요청을 막기 위해 완료될 때까지 버튼이 잠시 비활성화됩니다.</p>
          </div>
        ) : status === "error" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold leading-6 text-amber-900">
            {error} 기존 운영 리포트는 정상적으로 확인할 수 있습니다.
          </div>
        ) : commentary ? (
          <div className="space-y-5">
            <div className="rounded-lg bg-[#f4f8ff] px-4 py-4">
              <h3 className="text-base font-black leading-7 text-[#092046] [overflow-wrap:anywhere] [word-break:keep-all]">{commentary.headline}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 [overflow-wrap:anywhere] [word-break:keep-all]">{commentary.summary}</p>
            </div>

            <section>
              <h3 className="text-sm font-black text-[#092046]">관측사항</h3>
              <CommentaryItems
                items={commentary.observations}
                emptyMessage="추가로 정리할 관측사항이 없습니다."
                evidenceLabels={evidenceLabels}
              />
            </section>

            {commentary.cautions.length > 0 ? (
              <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
                <h3 className="text-sm font-black text-amber-950">해석 시 주의사항</h3>
                <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-amber-900">
                  {commentary.cautions.map((caution) => <li key={caution}>- {caution}</li>)}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="text-sm font-black text-[#092046]">다음 운영 제안</h3>
              <CommentaryItems
                items={commentary.nextActions}
                emptyMessage="현재 데이터에서 제안할 추가 운영 항목이 없습니다."
                evidenceLabels={evidenceLabels}
              />
            </section>
          </div>
        ) : null}
      </div>

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold leading-5 text-slate-600">
        AI에는 집계 숫자, 기사 제목, 외부 유입 도메인, UTM 채널과 규칙형 근거만 전달하며 원문·개별 행동 이력·개인정보는 전달하지 않습니다.
      </p>
    </section>
  );
}
