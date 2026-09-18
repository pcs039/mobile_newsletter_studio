"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PublicAudioPlayer } from "@/components/public-audio-player";
import { getAudioSyncedPageNumber } from "@/lib/audio-page-sync";
import { formatPageLabel, getCustomPageTitle } from "@/lib/page-labels";

type MobileEbookPage = {
  id: string;
  pageNumber: number;
  previewHref: string | null;
  status: string;
  title: string | null;
};

type PublicMobileEbookViewerProps = {
  desktopEbookHref: string;
  initialPageNumber: number;
  isAdminPreview: boolean;
  isEmbeddedAdminPreview: boolean;
  mobileReadingHref: string;
  pages: MobileEbookPage[];
  projectIssue: string;
  projectTitle: string;
  publicAudio?: {
    src: string;
    title?: string;
  };
  slug: string;
};

const followPagesStorageKey = "datadiction_audio_follow_pages";
const mobileZoomStep = 25;
const mobileMinZoom = 50;
const mobileMaxZoom = 400;

type MobileEbookViewMode = "single" | "double";

function getInitialFollowPagesEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(followPagesStorageKey) !== "false";
  } catch {
    return true;
  }
}

function makeMobileEbookHref(slug: string, pageNumber: number, isAdminPreview: boolean, isEmbeddedAdminPreview: boolean) {
  const searchParams = new URLSearchParams({ page: String(pageNumber) });

  if (isAdminPreview) {
    searchParams.set("preview", "admin");
  }

  if (isEmbeddedAdminPreview) {
    searchParams.set("embedded", "adminPreview");
  }

  return `/newsletters/${slug}/ebook/mobile?${searchParams.toString()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function PublicMobileEbookViewer({
  desktopEbookHref,
  initialPageNumber,
  isAdminPreview,
  isEmbeddedAdminPreview,
  mobileReadingHref,
  pages,
  projectIssue,
  projectTitle,
  publicAudio,
  slug,
}: PublicMobileEbookViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const initialIndex = Math.max(
    0,
    pages.findIndex((page) => page.pageNumber === initialPageNumber),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [viewMode, setViewMode] = useState<MobileEbookViewMode>("single");
  const [zoom, setZoom] = useState(100);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [followPages, setFollowPages] = useState(getInitialFollowPagesEnabled);
  const [followPagesMessage, setFollowPagesMessage] = useState("");
  const currentPage = pages[currentIndex] ?? null;
  const currentPageCustomTitle = currentPage ? getCustomPageTitle(currentPage.title, currentPage.pageNumber) : "";
  const pageStep = viewMode === "double" ? 2 : 1;
  const visiblePages = useMemo(() => {
    if (!currentPage) {
      return [];
    }

    return viewMode === "double" ? pages.slice(currentIndex, currentIndex + 2) : [currentPage];
  }, [currentIndex, currentPage, pages, viewMode]);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < pages.length - 1;
  const canFollowPages = Boolean(publicAudio) && pages.length > 0 && audioDuration > 0;
  const currentHref = useMemo(
    () => makeMobileEbookHref(slug, currentPage?.pageNumber ?? 1, isAdminPreview, isEmbeddedAdminPreview),
    [currentPage?.pageNumber, isAdminPreview, isEmbeddedAdminPreview, slug],
  );

  const goToIndex = useCallback((nextIndex: number) => {
    if (pages.length === 0) {
      return;
    }

    setCurrentIndex(Math.min(Math.max(nextIndex, 0), pages.length - 1));
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }, [pages.length]);

  const disableFollowPagesForManualNavigation = useCallback(() => {
    if (!followPages) {
      return;
    }

    setFollowPages(false);
    setFollowPagesMessage("사용자가 직접 페이지를 이동해 자동 넘김을 껐습니다.");
  }, [followPages]);

  const goToPageNumber = useCallback((pageNumber: number, isManual: boolean) => {
    const nextIndex = pages.findIndex((page) => page.pageNumber === pageNumber);

    if (nextIndex < 0) {
      return;
    }

    if (isManual) {
      disableFollowPagesForManualNavigation();
    }

    goToIndex(nextIndex);
  }, [disableFollowPagesForManualNavigation, goToIndex, pages]);

  const goToPreviousPage = useCallback(() => {
    disableFollowPagesForManualNavigation();
    goToIndex(currentIndex - pageStep);
  }, [currentIndex, disableFollowPagesForManualNavigation, goToIndex, pageStep]);

  const goToNextPage = useCallback(() => {
    disableFollowPagesForManualNavigation();
    goToIndex(currentIndex + pageStep);
  }, [currentIndex, disableFollowPagesForManualNavigation, goToIndex, pageStep]);

  const syncPageToAudioTime = useCallback((nextTime: number) => {
    const syncedPageNumber = getAudioSyncedPageNumber(nextTime, audioDuration, pages.length);

    if (!syncedPageNumber) {
      return;
    }

    const targetIndex = pages.findIndex((page) => page.pageNumber === syncedPageNumber);

    if (targetIndex < 0) {
      return;
    }

    const nextIndex = viewMode === "double" && targetIndex % 2 === 1 ? Math.max(0, targetIndex - 1) : targetIndex;

    if (currentIndex === nextIndex || (viewMode === "double" && currentIndex + 1 === targetIndex)) {
      return;
    }

    goToIndex(nextIndex);
  }, [audioDuration, currentIndex, goToIndex, pages, viewMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(followPagesStorageKey, String(followPages));
    } catch {
      // Page follow preference is optional.
    }
  }, [followPages]);

  useEffect(() => {
    window.history.replaceState(null, "", currentHref);
  }, [currentHref]);

  const handleAudioDurationChange = useCallback((nextDuration: number) => {
    setAudioDuration(nextDuration);
  }, []);

  const handleAudioTimeUpdate = useCallback((nextTime: number) => {
    setAudioCurrentTime(nextTime);

    if (canFollowPages && followPages) {
      syncPageToAudioTime(nextTime);
    }
  }, [canFollowPages, followPages, syncPageToAudioTime]);

  function updateFollowPages(nextValue: boolean) {
    setFollowPages(nextValue);
    setFollowPagesMessage(nextValue ? "" : "자동 넘김을 껐습니다.");

    if (nextValue) {
      syncPageToAudioTime(audioCurrentTime);
    }
  }

  function updateZoom(nextZoom: number) {
    setZoom(clamp(nextZoom, mobileMinZoom, mobileMaxZoom));
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }

  function fitToScreen() {
    updateZoom(100);
  }

  function fitToWidth() {
    updateZoom(125);
  }

  return (
    <>
      <section className="mx-auto flex h-[100dvh] max-w-[560px] flex-col overflow-hidden bg-white shadow-xl shadow-blue-950/10">
        <header className="z-20 shrink-0 border-b border-slate-200 bg-white/95 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            {!isEmbeddedAdminPreview ? (
              <Link
                href={mobileReadingHref}
                className="dd-btn dd-btn-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full px-0 text-lg"
                aria-label="모바일 읽기 화면으로 돌아가기"
              >
                ←
              </Link>
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-lg font-black text-slate-300">
                ←
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#184a88]">Mobile e-book</p>
              <h1 className="truncate text-base font-black leading-tight text-[#092046]">
                {projectTitle} {projectIssue}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setIsToolsOpen((value) => !value)}
              className="dd-btn dd-btn-secondary flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-3 text-base"
              aria-expanded={isToolsOpen}
              aria-label="e-book 보기 설정 열기"
            >
              ⋯
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px_auto] items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={!canGoPrevious}
              className="dd-btn dd-btn-secondary h-11 rounded-full px-0 text-xl leading-none disabled:pointer-events-none disabled:opacity-35"
              aria-label="이전 페이지"
            >
              ‹
            </button>
            <div className="min-w-0 rounded-full border border-slate-200 bg-[#f8fbff] px-3 py-2 text-center">
              <p className="truncate text-sm font-black text-[#092046]">
                {currentPage ? `${currentPage.pageNumber}쪽 / ${pages.length}쪽` : "페이지 미등록"}
              </p>
              {currentPageCustomTitle ? <p className="truncate text-[11px] font-bold text-slate-500">{currentPageCustomTitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={goToNextPage}
              disabled={!canGoNext}
              className="dd-btn dd-btn-primary h-11 rounded-full px-0 text-xl leading-none disabled:pointer-events-none disabled:opacity-35"
              aria-label="다음 페이지"
            >
              ›
            </button>
            <span className="rounded-full border border-[#b8d7ff] bg-[#eef6ff] px-3 py-2 text-xs font-black text-[#184a88]">
              {zoom}%
            </span>
          </div>

          {isToolsOpen ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("single")}
                  className={`dd-btn dd-btn-sm min-h-11 justify-center rounded-xl text-xs ${
                    viewMode === "single" ? "dd-btn-primary" : "dd-btn-secondary"
                  }`}
                >
                  1쪽
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("double")}
                  className={`dd-btn dd-btn-sm min-h-11 justify-center rounded-xl text-xs ${
                    viewMode === "double" ? "dd-btn-primary" : "dd-btn-secondary"
                  }`}
                >
                  2쪽
                </button>
                <button type="button" onClick={fitToScreen} className="dd-btn dd-btn-secondary dd-btn-sm min-h-11 justify-center rounded-xl text-xs">
                  맞춤
                </button>
                <button type="button" onClick={fitToWidth} className="dd-btn dd-btn-secondary dd-btn-sm min-h-11 justify-center rounded-xl text-xs">
                  폭
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateZoom(zoom - mobileZoomStep)}
                  className="dd-btn dd-btn-secondary h-11 rounded-xl px-0 text-lg"
                  aria-label="축소"
                >
                  −
                </button>
                <input
                  type="range"
                  min={mobileMinZoom}
                  max={mobileMaxZoom}
                  step={mobileZoomStep}
                  value={zoom}
                  onChange={(event) => updateZoom(Number(event.target.value))}
                  className="h-2 accent-[#184a88]"
                  aria-label="확대율 조절"
                />
                <button
                  type="button"
                  onClick={() => updateZoom(zoom + mobileZoomStep)}
                  className="dd-btn dd-btn-secondary h-11 rounded-xl px-0 text-lg"
                  aria-label="확대"
                >
                  +
                </button>
              </div>
              {!isEmbeddedAdminPreview ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link href={mobileReadingHref} className="dd-btn dd-btn-secondary dd-btn-sm min-h-11 justify-center rounded-xl text-xs">
                    모바일 읽기
                  </Link>
                  <Link href={desktopEbookHref} className="dd-btn dd-btn-primary dd-btn-sm min-h-11 justify-center rounded-xl text-xs">
                    PC e-book
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        <section
          ref={viewportRef}
          className={`public-mobile-ebook-scroll-container min-h-0 flex-1 overflow-auto bg-[#e7f0f8] px-3 py-4 overscroll-contain ${
            publicAudio ? "pb-[calc(8.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(1rem+env(safe-area-inset-bottom))]"
          }`}
        >
          {visiblePages.length > 0 ? (
            <div
              key={`${currentIndex}-${viewMode}`}
              className={`public-mobile-ebook-stage mx-auto flex min-h-full items-center justify-center gap-3 ${
                viewMode === "double" ? "flex-row" : "flex-col"
              }`}
              style={{
                minWidth: zoom > 100 ? `${zoom}%` : undefined,
                width: `${zoom}%`,
              }}
            >
              {visiblePages.map((page) => (
                <article
                  key={page.id}
                  className="public-mobile-ebook-page min-w-0 shrink-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-blue-950/15"
                  style={{ width: viewMode === "double" ? "50%" : "100%" }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <h2 className="truncate text-xs font-black text-[#092046]">{formatPageLabel(page.pageNumber, page.title)}</h2>
                    <span className="shrink-0 rounded-full bg-[#eef6ff] px-2 py-1 text-[11px] font-bold text-[#184a88]">{page.status}</span>
                  </div>
                  {page.previewHref ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={page.previewHref}
                      alt={formatPageLabel(page.pageNumber, page.title)}
                      className="mx-auto h-auto w-full rounded-xl border border-slate-200 bg-white object-contain"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
                      <p className="text-sm font-black text-[#092046]">이미지 파일 경로가 없습니다.</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
              <p className="text-base font-black text-[#092046]">등록된 e-book 페이지 이미지가 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                원본 자료 화면에서 페이지 이미지를 업로드하면 모바일 e-book이 표시됩니다.
              </p>
            </div>
          )}

          {pages.length > 0 ? (
            <details data-swipe-navigation-ignore className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-black text-[#092046]">목차</summary>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-left">
                {pages.map((page, index) => {
                  const isActive = index === currentIndex || (viewMode === "double" && index === currentIndex + 1);

                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => goToPageNumber(page.pageNumber, true)}
                      className={`block w-full rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                        isActive
                          ? "border-[#092046] bg-[#092046] text-white"
                          : "border-slate-200 bg-[#f8fbff] text-[#092046]"
                      }`}
                    >
                      {formatPageLabel(page.pageNumber, page.title)}
                    </button>
                  );
                })}
              </div>
            </details>
          ) : null}
        </section>
      </section>
      {publicAudio ? (
        <PublicAudioPlayer
          src={publicAudio.src}
          title={publicAudio.title}
          onDurationChange={handleAudioDurationChange}
          onTimeUpdate={handleAudioTimeUpdate}
          actionSlot={
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => updateFollowPages(!followPages)}
                className={`dd-btn dd-btn-sm text-xs ${
                  followPages ? "bg-white text-[#092046]" : "dd-btn-ghost text-slate-100"
                }`}
                aria-pressed={followPages}
              >
                자동 넘김 {followPages ? "켜짐" : "꺼짐"}
              </button>
              {followPagesMessage ? <span className="text-[11px] font-bold text-slate-300">{followPagesMessage}</span> : null}
            </div>
          }
        />
      ) : null}
    </>
  );
}
