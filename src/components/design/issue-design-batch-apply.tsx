"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type IssueDesignBatchArticle = {
  hasComposition: boolean;
  id: string;
  orderLabel: string;
  statusLabel: string;
  title: string;
};

type RequestState = {
  message: string;
  status: "idle" | "loading" | "success" | "error";
};

type BatchCopyResponse = {
  message?: string;
  ok?: boolean;
  result?: {
    targetArticleCount?: number;
  } | null;
};

export function IssueDesignBatchApply({
  articles,
  projectSlug,
}: {
  articles: IssueDesignBatchArticle[];
  projectSlug: string;
}) {
  const router = useRouter();
  const [sourceArticleId, setSourceArticleId] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [requestState, setRequestState] = useState<RequestState>({ status: "idle", message: "" });
  const sourceArticles = useMemo(() => articles.filter((article) => article.hasComposition), [articles]);
  const targetArticles = useMemo(
    () => articles.filter((article) => article.id !== sourceArticleId),
    [articles, sourceArticleId],
  );
  const isLoading = requestState.status === "loading";

  function selectSource(articleId: string) {
    setSourceArticleId(articleId);
    setSelectedTargetIds((current) => current.filter((targetId) => targetId !== articleId));
    setRequestState({ status: "idle", message: "" });
  }

  function toggleTarget(articleId: string) {
    setSelectedTargetIds((current) =>
      current.includes(articleId)
        ? current.filter((targetId) => targetId !== articleId)
        : [...current, articleId],
    );
    setRequestState({ status: "idle", message: "" });
  }

  function selectAllTargets() {
    if (!sourceArticleId || isLoading) return;
    setSelectedTargetIds(targetArticles.map((article) => article.id));
    setRequestState({ status: "idle", message: "" });
  }

  async function applyBatchDesign() {
    if (!sourceArticleId || selectedTargetIds.length === 0 || isLoading) return;

    const sourceArticle = sourceArticles.find((article) => article.id === sourceArticleId);
    if (!sourceArticle) {
      setRequestState({ status: "error", message: "디자인이 저장된 원본 기사를 다시 선택해 주세요." });
      return;
    }

    const confirmed = window.confirm(
      `“${sourceArticle.title}”의 디자인을 선택한 ${selectedTargetIds.length}개 기사에 적용할까요?\n기존 디자인 배치는 교체되며 기사 콘텐츠와 상태는 유지됩니다.`,
    );
    if (!confirmed) return;

    setRequestState({
      status: "loading",
      message: `선택한 ${selectedTargetIds.length}개 기사에 디자인을 적용하고 있습니다.`,
    });

    const response = await fetch("/api/project-article-composition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "copy_compositions_batch",
        projectSlug,
        sourceArticleId,
        targetArticleIds: selectedTargetIds,
      }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as BatchCopyResponse | null)
      : null;

    if (!response || !response.ok || !result?.ok) {
      setRequestState({
        status: "error",
        message: `${result?.message ?? "기사 디자인을 일괄 적용하지 못했습니다."} Atomic transaction이 취소되어 어떤 기사에도 일부 적용되지 않았으며 기존 디자인은 그대로 유지됩니다.`,
      });
      return;
    }

    const appliedCount = result.result?.targetArticleCount ?? selectedTargetIds.length;
    setSelectedTargetIds([]);
    setRequestState({
      status: "success",
      message: `${result.message ?? `${appliedCount}개 기사에 디자인을 적용했습니다.`} 적용된 디자인은 각 기사에서 개별 조정할 수 있습니다.`,
    });
    router.refresh();
  }

  return (
    <details className="group rounded-lg border border-[#b8d7ff] bg-[#f7fbff] shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
        <span>
          <span className="block text-xs font-black uppercase tracking-wide text-[#184a88]">공통 디자인 일괄 적용</span>
          <span className="mt-1 block text-base font-black text-[#092046]">기사 디자인을 여러 기사에 적용</span>
        </span>
        <span className="shrink-0 text-sm font-black text-[#184a88] group-open:hidden">열기</span>
        <span className="hidden shrink-0 text-sm font-black text-[#184a88] group-open:inline">닫기</span>
      </summary>

      <div className="border-t border-[#d8e8ff] px-4 py-5 sm:px-5">
        <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          디자인 구성이 저장된 기사 하나를 기준으로 같은 발행호의 여러 기사에 배경, 이미지와 장식 배치를 함께 적용합니다.
        </p>

        <label className="mt-5 block text-sm font-black text-slate-700">
          원본 기사
          <select
            value={sourceArticleId}
            disabled={isLoading || sourceArticles.length === 0}
            onChange={(event) => selectSource(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">디자인이 있는 기사를 선택하세요</option>
            {sourceArticles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.orderLabel} · {article.title} · {article.statusLabel} · 디자인 있음
              </option>
            ))}
          </select>
        </label>

        {sourceArticles.length === 0 ? (
          <p className="mt-3 rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-600">
            먼저 기사 제작 화면에서 원본으로 사용할 기사 디자인을 저장해 주세요.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-[#092046]">적용 대상 기사</h4>
            <p className="mt-1 text-xs font-bold text-slate-500">선택 {selectedTargetIds.length.toLocaleString("ko-KR")}개</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!sourceArticleId || isLoading || targetArticles.length === 0}
              onClick={selectAllTargets}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-[#2f73b7] hover:text-[#184a88] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              전체 선택
            </button>
            <button
              type="button"
              disabled={selectedTargetIds.length === 0 || isLoading}
              onClick={() => {
                setSelectedTargetIds([]);
                setRequestState({ status: "idle", message: "" });
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-[#2f73b7] hover:text-[#184a88] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              전체 해제
            </button>
          </div>
        </div>

        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {targetArticles.map((article) => {
            const checked = selectedTargetIds.includes(article.id);
            return (
              <label
                key={article.id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition ${
                  checked ? "border-[#2f73b7] bg-white" : "border-slate-200 bg-white/70"
                } ${!sourceArticleId || isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-[#8ab8eb]"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!sourceArticleId || isLoading}
                  onChange={() => toggleTarget(article.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#184a88]"
                />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-black text-[#092046]">{article.title}</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    {article.orderLabel} · {article.statusLabel} · {article.hasComposition ? "기존 디자인 있음" : "디자인 없음"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {articles.length < 2 ? (
          <p className="mt-3 text-sm font-bold text-slate-600">일괄 적용하려면 기사가 두 개 이상 필요합니다.</p>
        ) : null}

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold leading-6 text-amber-950">
          <p className="font-black">선택한 기사들의 기존 디자인 배치가 교체됩니다.</p>
          <p>기사 제목, 본문, 링크, 콘텐츠 블록, 기사 상태는 변경되지 않습니다.</p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-black text-[#184a88]">적용 대상 {selectedTargetIds.length.toLocaleString("ko-KR")}개</p>
          <button
            type="button"
            disabled={!sourceArticleId || selectedTargetIds.length === 0 || isLoading}
            onClick={() => void applyBatchDesign()}
            className="min-h-12 rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? `적용 중 · ${selectedTargetIds.length}개` : "선택 기사에 디자인 적용"}
          </button>
        </div>

        {requestState.status !== "idle" ? (
          <p
            role="status"
            className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold leading-6 ${
              requestState.status === "error"
                ? "bg-rose-50 text-rose-800"
                : requestState.status === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-sky-50 text-sky-800"
            }`}
          >
            {requestState.message}
          </p>
        ) : null}
      </div>
    </details>
  );
}
