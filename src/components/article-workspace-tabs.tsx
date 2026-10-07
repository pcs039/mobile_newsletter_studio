"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ArticleMobilePreviewModal } from "@/components/article-mobile-preview-modal";
import { StatusPill } from "@/components/status-pill";

export type ArticleWorkspaceTab = "content" | "composition" | "review";

type ArticleWorkspaceTabsProps = {
  articleId: string | null;
  articleStatus: string;
  articleTitle: string;
  blockCount: number;
  composition: ReactNode;
  content: ReactNode;
  initialTab: ArticleWorkspaceTab;
  linkCount: number;
  previewHref: string;
  review: ReactNode;
  totalArticleCount: number;
};

const tabs: Array<{ description: string; label: string; value: ArticleWorkspaceTab }> = [
  { value: "content", label: "내용 작성", description: "기사 내용과 연결 정보를 편집합니다." },
  { value: "composition", label: "화면 구성", description: "기관 디자인 자산을 기사에 배치합니다." },
  { value: "review", label: "검수·발행", description: "저장된 구성과 발행 상태를 확인합니다." },
];

function getTabFromLocation(articleId: string | null): ArticleWorkspaceTab {
  if (!articleId) return "content";

  const tab = new URL(window.location.href).searchParams.get("tab");
  return tab === "composition" || tab === "review" ? tab : "content";
}

export function ArticleWorkspaceTabs({
  articleId,
  articleStatus,
  articleTitle,
  blockCount,
  composition,
  content,
  initialTab,
  linkCount,
  previewHref,
  review,
  totalArticleCount,
}: ArticleWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState<ArticleWorkspaceTab>(articleId ? initialTab : "content");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const closePreview = useCallback(() => setIsPreviewOpen(false), []);

  useEffect(() => {
    function handlePopState() {
      setActiveTab(getTabFromLocation(articleId));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [articleId]);

  function selectTab(tab: ArticleWorkspaceTab) {
    if (!articleId && tab !== "content") return;

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("tab", tab);
    window.history.pushState(null, "", nextUrl);
    setActiveTab(tab);
  }

  return (
    <section className="min-w-0 space-y-5">
      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기사 작업</p>
              {articleId ? <StatusPill value={articleStatus} /> : <StatusPill value="신규 작성" />}
            </div>
            <h2 className="mt-2 break-words text-xl font-black leading-8 text-[#092046] sm:text-2xl">
              {articleTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {articleId ? tabs.find((tab) => tab.value === activeTab)?.description : "새 기사의 내용을 작성하고 저장하세요."}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center 2xl:justify-end">
            <div className="grid w-full grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600 sm:min-w-[240px] sm:flex-1">
              <div className="rounded-lg bg-[#eef6ff] px-3 py-2">
                기사
                <strong className="mt-1 block text-base text-[#092046]">{totalArticleCount}</strong>
              </div>
              <div className="rounded-lg bg-[#eef6ff] px-3 py-2">
                블록
                <strong className="mt-1 block text-base text-[#092046]">{blockCount}</strong>
              </div>
              <div className="rounded-lg bg-[#eef6ff] px-3 py-2">
                링크
                <strong className="mt-1 block text-base text-[#092046]">{linkCount}</strong>
              </div>
            </div>
            <button
              type="button"
              disabled={!articleId}
              onClick={() => setIsPreviewOpen(true)}
              className="h-12 shrink-0 rounded-lg border border-[#2f73b7] bg-white px-4 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              모바일 미리보기
            </button>
          </div>
        </div>

        <div role="tablist" aria-label="기사 작업 단계" className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            const isDisabled = !articleId && tab.value !== "content";

            return (
              <button
                key={tab.value}
                id={`article-workspace-tab-${tab.value}`}
                type="button"
                role="tab"
                aria-controls={`article-workspace-panel-${tab.value}`}
                aria-selected={isActive}
                disabled={isDisabled}
                onClick={() => selectTab(tab.value)}
                className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-sky-100 ${
                  isActive
                    ? "bg-[#092046] text-white shadow-sm"
                    : "border border-slate-200 bg-white text-[#184a88] hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </article>

      <div
        id="article-workspace-panel-content"
        role="tabpanel"
        aria-labelledby="article-workspace-tab-content"
        hidden={activeTab !== "content"}
      >
        {content}
      </div>
      <div
        id="article-workspace-panel-composition"
        role="tabpanel"
        aria-labelledby="article-workspace-tab-composition"
        hidden={activeTab !== "composition"}
      >
        {composition}
      </div>
      <div
        id="article-workspace-panel-review"
        role="tabpanel"
        aria-labelledby="article-workspace-tab-review"
        hidden={activeTab !== "review"}
      >
        {review}
      </div>

      {articleId ? (
        <ArticleMobilePreviewModal isOpen={isPreviewOpen} onClose={closePreview} previewHref={previewHref} />
      ) : null}
    </section>
  );
}
