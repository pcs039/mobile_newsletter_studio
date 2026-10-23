"use client";

import { CompositionCopyStatus, useCompositionCopySafety } from "@/components/design/composition-copy-status";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type IssueDesignBatchArticle = {
  hasComposition: boolean;
  id: string;
  orderLabel: string;
  statusLabel: string;
  title: string;
};

export function IssueDesignBatchApply({
  articles,
  projectSlug,
}: {
  articles: IssueDesignBatchArticle[];
  projectSlug: string;
}) {
  const router = useRouter();
  const copySafety = useCompositionCopySafety(projectSlug);
  const sourceArticleId = copySafety.sourceId;
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const sourceArticles = useMemo(() => articles.filter((article) => article.hasComposition), [articles]);
  const targetArticles = useMemo(
    () => articles.filter((article) => article.id !== sourceArticleId),
    [articles, sourceArticleId],
  );
  const isLoading = copySafety.busy || copySafety.locked;

  function selectSource(articleId: string) {
    if (isLoading && copySafety.phase !== "loading") return;
    void copySafety.selectSource(articleId);
    setSelectedTargetIds((current) => current.filter((targetId) => targetId !== articleId));
  }

  function toggleTarget(articleId: string) {
    if (copySafety.busy || copySafety.locked) return;
    setSelectedTargetIds((current) =>
      current.includes(articleId)
        ? current.filter((targetId) => targetId !== articleId)
        : [...current, articleId],
    );
  }

  function selectAllTargets() {
    if (!sourceArticleId || copySafety.busy || copySafety.locked) return;
    setSelectedTargetIds(targetArticles.map((article) => article.id));
  }

  async function applyBatchDesign() {
    if (isLoading || !copySafety.canCopy || !selectedTargetIds.length) return;
    const source = sourceArticles.find(a => a.id === sourceArticleId);
    if (!source) return;
    const result = await copySafety.copy(selectedTargetIds, false, () => window.confirm(
      `“${source.title}”의 배치를 ${selectedTargetIds.length}개 기사에 적용할까요?\n기존 배치를 교체하고 Composition은 draft로 전환됩니다. 기사 내용·HTML 텍스트 디자인·글꼴·제작 패턴은 유지됩니다.`,
    ));
    if (result) { setSelectedTargetIds([]); router.refresh(); }
  }

  return (
    <details className="group rounded-lg border border-[#b8d7ff] bg-[#f7fbff] shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none">
        <span>
          <span className="block text-xs font-black uppercase tracking-wide text-[#184a88]">공통 디자인 일괄 적용</span>
          <span className="mt-1 block text-base font-black text-[#092046]">기사 디자인을 여러 기사에 적용</span>
          {copySafety.locked ? <span className="mt-1 block text-xs text-amber-900">결과 확인 필요 · 복사 잠김</span> : copySafety.busy ? <span className="mt-1 block text-xs text-sky-800">원본 확인·적용 중</span> : null}
        </span>
        <span className="shrink-0 text-sm font-black text-[#184a88] group-open:hidden">열기</span>
        <span className="hidden shrink-0 text-sm font-black text-[#184a88] group-open:inline">닫기</span>
      </summary>

      <div className="border-t border-[#d8e8ff] px-4 py-5 sm:px-5">
        <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          같은 발행호에서 원본 기사와 적용 대상 기사를 선택하세요. 원본 선택 시 저장된 배치를 조회합니다.
        </p>

        <label className="mt-5 block text-sm font-black text-slate-700">
          원본 기사
          <select
            value={sourceArticleId}
            disabled={(isLoading && copySafety.phase !== "loading") || sourceArticles.length === 0}
            onChange={(event) => selectSource(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">디자인이 있는 기사를 선택하세요</option>
            {sourceArticles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.orderLabel} · {article.title} · {article.statusLabel} · 구성 저장됨
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
                if (copySafety.busy || copySafety.locked) return;
                setSelectedTargetIds([]);
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
                    {article.orderLabel} · {article.statusLabel} · {article.hasComposition ? "기존 구성 있음 · 적용 시 배치 교체" : "구성 없음"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {articles.length < 2 ? (
          <p className="mt-3 text-sm font-bold text-slate-600">일괄 적용하려면 기사가 두 개 이상 필요합니다.</p>
        ) : null}

        <CompositionCopyStatus safety={copySafety} />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-black text-[#184a88]">적용 대상 {selectedTargetIds.length.toLocaleString("ko-KR")}개</p>
          <button
            type="button"
            disabled={!copySafety.canCopy || selectedTargetIds.length === 0 || isLoading}
            onClick={() => void applyBatchDesign()}
            className="min-h-12 rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {copySafety.locked ? "결과 확인 필요 · 재실행 잠김" : copySafety.busy ? `확인·적용 중 · ${selectedTargetIds.length}개` : "선택 기사에 디자인 적용"}
          </button>
        </div>


      </div>
    </details>
  );
}
