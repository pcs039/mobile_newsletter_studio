"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EbookPageTtsStatus, EbookPageTtsStatusPage } from "@/lib/ebook-tts-audio";

type ProjectEbookTtsAudioPanelProps = {
  projectSlug: string;
  status: EbookPageTtsStatus;
};

type GenerateResult = {
  detail?: string;
  error?: string;
  message?: string;
  ok?: boolean;
  pageNumber?: number;
  segments?: number;
  skipped?: boolean;
};

type FailedPage = {
  id: string;
  pageNumber: number;
  message: string;
};

function getGenerateTargets(pages: EbookPageTtsStatusPage[], force: boolean, failedPages: FailedPage[]) {
  if (failedPages.length > 0 && !force) {
    const failedIds = new Set(failedPages.map((page) => page.id));

    return pages.filter((page) => failedIds.has(page.id));
  }

  if (force) {
    return pages.filter((page) => page.state !== "empty_text");
  }

  return pages.filter((page) => page.state === "needs_generation" || page.state === "stale");
}

export function ProjectEbookTtsAudioPanel({ projectSlug, status }: ProjectEbookTtsAudioPanelProps) {
  const router = useRouter();
  const [failedPages, setFailedPages] = useState<FailedPage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const targets = useMemo(
    () => getGenerateTargets(status.pages, forceRegenerate, failedPages),
    [failedPages, forceRegenerate, status.pages],
  );
  const canGenerate = status.source === "supabase" && status.providerConfigured && targets.length > 0 && !isSubmitting;
  const primaryLabel =
    failedPages.length > 0 && !forceRegenerate
      ? "실패한 쪽 다시 시도"
      : status.generatedPages > 0 || status.stalePages > 0
        ? "읽어주기 음성 다시 생성"
        : "읽어주기 음성 생성";

  async function generateSequentially() {
    setIsSubmitting(true);
    setMessage("");
    setProgress("");

    const currentTargets = getGenerateTargets(status.pages, forceRegenerate, failedPages);
    const failures: FailedPage[] = [];
    let completed = 0;
    let skipped = 0;

    try {
      for (const [index, page] of currentTargets.entries()) {
        setProgress(`${page.pageNumber}쪽 음성을 생성하는 중입니다. (${index + 1}/${currentTargets.length})`);

        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectSlug)}/ebook/tts/pages/${encodeURIComponent(page.id)}/generate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ force: forceRegenerate }),
          },
        );
        const result = (await response.json().catch(() => null)) as GenerateResult | null;

        if (!response.ok || !result?.ok) {
          failures.push({
            id: page.id,
            pageNumber: page.pageNumber,
            message: result?.message ?? "음성 생성에 실패했습니다.",
          });
          continue;
        }

        if (result.skipped) {
          skipped += 1;
        } else {
          completed += 1;
        }
      }

      setFailedPages(failures);

      if (failures.length > 0) {
        setMessage(
          `완료 ${completed}쪽, 건너뜀 ${skipped}쪽, 실패 ${failures.length}쪽: ${failures
            .map((page) => `${page.pageNumber}쪽`)
            .join(", ")}`,
        );
      } else {
        setMessage(`읽어주기 음성 생성이 끝났습니다. 완료 ${completed}쪽, 건너뜀 ${skipped}쪽`);
        setForceRegenerate(false);
      }

      router.refresh();
    } catch {
      setMessage("읽어주기 음성을 생성하지 못했습니다.");
    } finally {
      setProgress("");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-[#c9d8ef] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">e-book 읽어주기 음성</p>
          <h4 className="mt-1 text-base font-black text-[#092046]">{status.message}</h4>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            검색 텍스트를 기반으로 e-book 읽어주기용 AI 음성을 생성합니다.
          </p>
          <p className="mt-1 text-xs font-bold text-slate-400">
            모델 {status.model} · 음성 {status.voice}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void generateSequentially()}
            disabled={!canGenerate}
            className="dd-btn dd-btn-primary h-11 px-4 text-sm disabled:opacity-50"
          >
            {isSubmitting ? "생성 중..." : primaryLabel}
          </button>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <input
              type="checkbox"
              checked={forceRegenerate}
              onChange={(event) => {
                setForceRegenerate(event.target.checked);
                setFailedPages([]);
              }}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-slate-300"
            />
            최신 음성도 다시 생성
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3">
          <p className="text-xs font-black text-slate-500">전체 페이지</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.totalPages}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3">
          <p className="text-xs font-black text-slate-500">음성 생성 완료</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.generatedPages}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3">
          <p className="text-xs font-black text-slate-500">생성 필요</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.needsGenerationPages}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3">
          <p className="text-xs font-black text-slate-500">텍스트 없음</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.emptyTextPages}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3">
          <p className="text-xs font-black text-slate-500">오래된 음성</p>
          <p className="mt-1 text-lg font-black text-[#092046]">{status.stalePages}</p>
        </div>
      </div>

      {!status.providerConfigured ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
          AI 음성 생성 API가 설정되지 않았습니다.
        </p>
      ) : null}
      {status.updatedAt ? <p className="mt-3 text-xs font-bold text-slate-500">최근 생성: {status.updatedAt}</p> : null}
      {progress ? <p className="mt-3 text-sm font-bold text-[#184a88]">{progress}</p> : null}
      {message ? <p className="mt-3 text-sm font-bold text-[#184a88]">{message}</p> : null}
      {failedPages.length > 0 ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          <p>실패한 페이지: {failedPages.map((page) => `${page.pageNumber}쪽`).join(", ")}</p>
          <p className="mt-1 text-xs font-semibold text-rose-800">
            실패한 쪽만 다시 시도하거나, 최신 음성도 다시 생성을 선택해 전체를 다시 만들 수 있습니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
