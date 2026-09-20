"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import type { ArticleTtsProjectStatus, ArticleTtsStatusItem } from "@/lib/article-tts-audio";

type GenerateResult = {
  ok?: boolean;
  message?: string;
};

const statusLabels: Record<ArticleTtsStatusItem["state"], string> = {
  current: "최신",
  empty_text: "원문 없음",
  needs_generation: "생성 필요",
  not_ai: "AI 미사용",
  stale: "재생성 필요",
};

function isGeneratable(item: ArticleTtsStatusItem) {
  return item.state === "needs_generation" || item.state === "stale";
}

export function ProjectArticleTtsGenerationPanel({
  projectSlug,
  status,
}: {
  projectSlug: string;
  status: ArticleTtsProjectStatus;
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const pendingItems = status.items.filter(isGeneratable);

  async function generateItem(item: ArticleTtsStatusItem, force = false) {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/articles/${encodeURIComponent(item.articleId)}/tts/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          force,
          voice: item.voice,
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as GenerateResult | null;

    if (!response.ok || result?.ok !== true) {
      throw new Error(result?.message ?? `${item.articleTitle} AI 음성 생성에 실패했습니다.`);
    }

    return result.message ?? `${item.articleTitle} AI 음성을 생성했습니다.`;
  }

  async function generateAllPending() {
    if (pendingItems.length === 0) {
      return;
    }

    setIsGenerating(true);
    setMessage(`AI 음성 ${pendingItems.length}건을 순차 생성합니다.`);

    try {
      for (const [index, item] of pendingItems.entries()) {
        setMessage(`${index + 1}/${pendingItems.length} 생성 중: ${item.articleTitle}`);
        await generateItem(item, item.state === "stale");
      }

      setMessage("AI 음성 생성이 완료되었습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 음성 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <article className="rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">AI 음성 자동 생성</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">AI TTS 기사 음성</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            기사 작성 화면에서 “AI 음성 자동 생성”으로 선택한 기사만 생성 대상입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void generateAllPending();
          }}
          disabled={pendingItems.length === 0 || isGenerating}
          className="dd-btn dd-btn-primary dd-btn-sm self-start disabled:pointer-events-none disabled:opacity-50"
        >
          {isGenerating ? "생성 중..." : "필요한 AI 음성 생성"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <StatusPill value={`AI 선택 ${status.totalAiArticles}건`} />
        <StatusPill value={`최신 ${status.completed}건`} />
        <StatusPill value={`생성/재생성 ${status.needsGeneration + status.stale}건`} />
        <StatusPill value={`원문 없음 ${status.emptyText}건`} />
      </div>

      {status.items.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {status.items.map((item) => (
            <div key={item.articleId} className="flex flex-col gap-2 rounded-lg bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#092046]">{item.articleTitle}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">음색 {item.voice}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill value={statusLabels[item.state]} />
                {isGeneratable(item) ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsGenerating(true);
                      setMessage(`${item.articleTitle} AI 음성을 생성하는 중입니다.`);
                      try {
                        const nextMessage = await generateItem(item, item.state === "stale");
                        setMessage(nextMessage);
                        router.refresh();
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "AI 음성 생성에 실패했습니다.");
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    disabled={isGenerating}
                    className="dd-btn dd-btn-secondary dd-btn-sm disabled:pointer-events-none disabled:opacity-50"
                  >
                    생성
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-600">
          AI 음성 자동 생성으로 선택된 기사가 없습니다.
        </p>
      )}

      {message ? <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#184a88]">{message}</p> : null}
    </article>
  );
}
