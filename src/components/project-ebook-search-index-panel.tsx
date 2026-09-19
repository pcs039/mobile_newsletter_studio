"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EbookPageSearchStatus } from "@/lib/ebook-page-search";

type ProjectEbookSearchIndexPanelProps = {
  projectSlug: string;
  status: EbookPageSearchStatus;
};

type RebuildResult = {
  detail?: string;
  emptyPages?: number;
  error?: string;
  extractedPages?: number;
  failedPages?: number;
  message?: string;
  ok?: boolean;
  textPages?: number;
  totalPages?: number;
};

export function ProjectEbookSearchIndexPanel({ projectSlug, status }: ProjectEbookSearchIndexPanelProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const canRebuild = status.hasOriginalPdf && status.totalPages > 0 && !isSubmitting;

  async function rebuildIndex() {
    setIsSubmitting(true);
    setMessage("검색 텍스트를 생성하는 중입니다.");

    try {
      const response = await fetch(`/api/projects/${projectSlug}/ebook/search-index`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as RebuildResult | null;

      if (!response.ok || !result?.ok) {
        const errorLabel = result?.error ? ` (${result.error})` : "";
        const detailLabel = result?.detail ? ` 세부: ${result.detail}` : "";

        setMessage(`${result?.message ?? "검색 텍스트를 생성하지 못했습니다."}${errorLabel}${detailLabel}`);
        return;
      }

      const failedNotice = result.failedPages ? ` 실패/미연결 ${result.failedPages}쪽` : "";

      setMessage(`${result.message ?? "검색 텍스트를 생성했습니다."}${failedNotice}`);
      router.refresh();
    } catch {
      setMessage("검색 텍스트를 생성하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">문서 검색 데이터</p>
          <h4 className="mt-1 text-base font-black text-[#092046]">{status.message}</h4>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            원본 PDF의 텍스트 레이어를 페이지별로 추출해 PC·모바일 e-book 검색에 사용합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void rebuildIndex()}
          disabled={!canRebuild}
          className="dd-btn dd-btn-primary h-11 shrink-0 px-4 text-sm disabled:opacity-50"
        >
          {isSubmitting ? "생성 중..." : status.indexedPages > 0 ? "검색 데이터 다시 생성" : "검색 텍스트 생성"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-black text-slate-500">전체 페이지</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.totalPages}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-black text-slate-500">생성 완료</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.indexedPages}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-black text-slate-500">검색 가능</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.textPages}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-black text-slate-500">텍스트 없음</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.emptyPages}</p>
        </div>
      </div>

      {!status.hasOriginalPdf ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
          원본 PDF가 없어 문서 검색 데이터를 생성할 수 없습니다.
        </p>
      ) : null}
      {status.updatedAt ? <p className="mt-3 text-xs font-bold text-slate-500">최근 생성: {status.updatedAt}</p> : null}
      {message ? <p className="mt-3 text-sm font-bold text-[#184a88]">{message}</p> : null}
    </div>
  );
}
