"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const initialIndex = Math.max(
    0,
    pages.findIndex((page) => page.pageNumber === initialPageNumber),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [followPages, setFollowPages] = useState(getInitialFollowPagesEnabled);
  const [followPagesMessage, setFollowPagesMessage] = useState("");
  const currentPage = pages[currentIndex] ?? null;
  const currentPageCustomTitle = currentPage ? getCustomPageTitle(currentPage.title, currentPage.pageNumber) : "";
  const previousPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;
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

  const syncPageToAudioTime = useCallback((nextTime: number) => {
    const syncedPageNumber = getAudioSyncedPageNumber(nextTime, audioDuration, pages.length);

    if (!syncedPageNumber || syncedPageNumber === currentPage?.pageNumber) {
      return;
    }

    goToPageNumber(syncedPageNumber, false);
  }, [audioDuration, currentPage?.pageNumber, goToPageNumber, pages.length]);

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

  return (
    <>
      <section className="mx-auto min-h-screen max-w-[560px] bg-white shadow-xl shadow-blue-950/10">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Mobile e-book</p>
          <h1 className="mt-1 text-xl font-black leading-tight text-[#092046]">
            {projectTitle} {projectIssue}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-600">
                {currentPage ? `${currentPage.pageNumber}쪽 / ${pages.length}쪽` : "페이지 미등록"}
              </p>
              {currentPageCustomTitle ? <p className="mt-1 truncate text-sm font-bold text-slate-500">{currentPageCustomTitle}</p> : null}
            </div>
            {!isEmbeddedAdminPreview ? (
              <div className="flex flex-wrap gap-2">
                <Link href={mobileReadingHref} className="dd-btn dd-btn-secondary dd-btn-sm rounded-full text-xs">
                  모바일 읽기
                </Link>
                <Link href={desktopEbookHref} className="dd-btn dd-btn-primary dd-btn-sm rounded-full text-xs">
                  PC e-book
                </Link>
              </div>
            ) : null}
          </div>
        </header>

        <section className={`px-4 py-5 ${publicAudio ? "pb-[calc(9rem+env(safe-area-inset-bottom))]" : ""}`}>
          {currentPage ? (
            <article className="public-mobile-ebook-page rounded-2xl bg-[#e7f0f8] p-3 shadow-inner shadow-blue-950/10">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-blue-950/15">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black text-[#092046]">{formatPageLabel(currentPage.pageNumber, currentPage.title)}</h2>
                  <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#184a88]">{currentPage.status}</span>
                </div>
                {currentPage.previewHref ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPage.previewHref}
                    alt={formatPageLabel(currentPage.pageNumber, currentPage.title)}
                    className="mx-auto w-full max-w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
                    <p className="text-sm font-black text-[#092046]">이미지 파일 경로가 없습니다.</p>
                  </div>
                )}
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
              <p className="text-base font-black text-[#092046]">등록된 e-book 페이지 이미지가 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                원본 자료 화면에서 페이지 이미지를 업로드하면 모바일 e-book이 표시됩니다.
              </p>
            </div>
          )}

          {pages.length > 0 ? (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {previousPage ? (
                <button
                  type="button"
                  onClick={() => goToPageNumber(previousPage.pageNumber, true)}
                  className="dd-btn dd-btn-secondary min-h-12 px-3 py-3 text-center text-sm"
                >
                  이전쪽
                </button>
              ) : (
                <span className="min-h-12 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-black text-slate-300">
                  이전쪽
                </span>
              )}

              <details className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-center">
                <summary className="cursor-pointer text-sm font-black text-[#092046]">목차</summary>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-left">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => goToPageNumber(page.pageNumber, true)}
                      className={`block w-full rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                        page.id === currentPage?.id
                          ? "border-[#092046] bg-[#092046] text-white"
                          : "border-slate-200 bg-[#f8fbff] text-[#092046]"
                      }`}
                    >
                      {formatPageLabel(page.pageNumber, page.title)}
                    </button>
                  ))}
                </div>
              </details>

              {nextPage ? (
                <button
                  type="button"
                  onClick={() => goToPageNumber(nextPage.pageNumber, true)}
                  className="dd-btn dd-btn-primary min-h-12 px-3 py-3 text-center text-sm"
                >
                  다음쪽
                </button>
              ) : (
                <span className="min-h-12 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-black text-slate-300">
                  다음쪽
                </span>
              )}
            </div>
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
