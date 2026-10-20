"use client";

import Link from "next/link";
import { type ReactNode, type ReactElement, cloneElement, useCallback, useEffect, useState } from "react";
import { ArticleMobilePreviewModal } from "@/components/article-mobile-preview-modal";
import type { ArticleFontSettingsWorkspaceProps } from "@/components/article-font-settings";
import { StatusPill } from "@/components/status-pill";

export type ArticleWorkspaceTab = "content" | "composition" | "review";

type ArticleWorkspaceTabsProps = {
  articleIds?: string[];
  articleId: string | null;
  articleStatus: string;
  articleTitle: string;
  blockCount: number;
  fontSettings?: ReactElement<ArticleFontSettingsWorkspaceProps>;
  composition: ReactNode;
  content: ReactNode;
  initialTab: ArticleWorkspaceTab;
  linkCount: number;
  previewHref: string;
  publishHref: string;
  review: ReactNode;
};

const tabs: Array<{ description: string; label: string; value: ArticleWorkspaceTab }> = [
  { value: "content", label: "1. 작성", description: "기사 내용을 입력하고 저장하면 디자인 단계로 이동할 수 있습니다." },
  { value: "composition", label: "2. 디자인", description: "추천 디자인을 적용하거나 세부 디자인을 직접 조정하세요." },
  { value: "review", label: "3. 검수", description: "모바일 화면을 확인하고 기관 검토·발행 화면으로 이동하세요." },
];

function getTabFromLocation(articleId: string | null): ArticleWorkspaceTab {
  if (!articleId) return "content";

  const tab = new URL(window.location.href).searchParams.get("tab");
  return tab === "composition" || tab === "review" ? tab : "content";
}

export function ArticleWorkspaceTabs({
  articleIds,
  articleId,
  articleStatus,
  articleTitle,
  blockCount,
  composition,
  fontSettings,
  content,
  initialTab,
  linkCount,
  previewHref,
  publishHref,
  review,
}: ArticleWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState<ArticleWorkspaceTab>(articleId ? initialTab : "content");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [designUnsettled, setDesignUnsettled] = useState(false);
  const [fontDirty, setFontDirty] = useState(false);
  const [articleSaving, setArticleSaving] = useState(false);
  const [articleError, setArticleError] = useState("");
  const closePreview = useCallback(() => setIsPreviewOpen(false), []);

  useEffect(() => {
    function handleDesignState(event: Event) {
      const detail = (event as CustomEvent<{ articleId: string; unsettled: boolean }>).detail;
      if (detail?.articleId === articleId && typeof detail.unsettled === "boolean") setDesignUnsettled(detail.unsettled);
    }
    function handleArticleSave(event: Event) {
      const detail = (event as CustomEvent<{ articleId: string; saving: boolean; error: string }>).detail;
      if (detail?.articleId !== articleId || typeof detail.saving !== "boolean" || typeof detail.error !== "string") return;
      setArticleSaving(detail.saving);
      setArticleError(detail.error);
    }
    window.addEventListener("article-editor-save-state", handleArticleSave);
    window.addEventListener("article-design-save-state", handleDesignState);
    return () => { window.removeEventListener("article-editor-save-state", handleArticleSave); window.removeEventListener("article-design-save-state", handleDesignState); };
  }, [articleId]);

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
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">발행호 기사 작업</p>
              {articleId ? <StatusPill value={articleStatus} /> : <StatusPill value="신규 작성" />}
            </div>
            <h2 className="mt-2 break-words text-xl font-black leading-8 text-[#092046] sm:text-2xl">
              {articleTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {articleId ? tabs.find((tab) => tab.value === activeTab)?.description : "기사 내용을 입력하고 저장하면 디자인 단계로 이동할 수 있습니다."}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center 2xl:justify-end">
            <p className="text-xs font-semibold text-slate-500">저장본 · 블록 {blockCount}개 · 링크 {linkCount}개</p>
            {designUnsettled || fontDirty || articleSaving ? <p className="max-w-sm text-xs font-bold text-amber-900">편집 중인 디자인 변경사항은 저장본 미리보기에 반영되지 않을 수 있습니다.</p> : null}
            <button
              type="button"
              disabled={!articleId}
              onClick={() => setIsPreviewOpen(true)}
              className="h-12 max-w-full shrink-0 rounded-lg border border-[#2f73b7] bg-white px-4 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              저장본 미리보기
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        <div role="tablist" aria-label="기사 제작 영역" className="flex flex-wrap gap-2">
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
                disabled={isDisabled || articleSaving}
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
        <Link href={publishHref} className="min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#184a88] hover:bg-[#eef6ff]">4. 발행</Link>
        </div>
      </article>

      <fieldset disabled={articleSaving} className="min-w-0">
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
        <div key="article-font-settings">
          {fontSettings ? cloneElement(fontSettings, { compositionUnsettled: designUnsettled, articleSaving, articleError, onDirtyChange: setFontDirty, onInvalidArticle: () => selectTab("content") }) : null}
        </div>
        <div key="article-composition">{composition}</div>
      </div>
      <div
        id="article-workspace-panel-review"
        role="tabpanel"
        aria-labelledby="article-workspace-tab-review"
        hidden={activeTab !== "review"}
      >
        {review}
      </div>

      </fieldset>

      {articleId ? (
        <ArticleMobilePreviewModal isOpen={isPreviewOpen} onClose={closePreview} previewHref={previewHref} designUnsettled={designUnsettled || fontDirty || articleSaving} articleIds={articleIds} />
      ) : null}
    </section>
  );
}
