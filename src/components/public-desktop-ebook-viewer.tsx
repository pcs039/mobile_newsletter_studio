"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PublicAudioPlayer } from "@/components/public-audio-player";
import { getAudioSyncedPageNumber } from "@/lib/audio-page-sync";
import { formatPageLabel, getCustomPageTitle } from "@/lib/page-labels";

type EbookPage = {
  id: string;
  pageNumber: number;
  publicHref: string | null;
  previewHref: string | null;
  status: string;
  title: string | null;
};

type PublicDesktopEbookViewerProps = {
  initialPageNumber: number;
  isAdminPreview: boolean;
  isEmbeddedAdminPreview: boolean;
  mobileReadingHref: string;
  pageCount: number;
  pages: EbookPage[];
  pdfDownloadHref?: string | null;
  publicAudio?: {
    src: string;
    title?: string;
  };
  projectIssue: string;
  projectOrganization: string;
  projectTitle: string;
};

type PageViewMode = "single" | "double";

const soundPreferenceKey = "datadiction_desktop_ebook_sound";
const soundPreferenceChangeEvent = "datadiction-desktop-ebook-sound-change";
const zoomStep = 25;
const minZoom = 25;
const maxZoom = 600;
const zoomPresets = [100, 150, 200, 300, 400, 600] as const;
const followPagesStorageKey = "datadiction_audio_follow_pages";

let sharedAudioContext: AudioContext | null = null;
let lastSoundAt = 0;

function getAudioContext() {
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  sharedAudioContext ??= new AudioContextConstructor();

  return sharedAudioContext;
}

async function playPageFlipSound() {
  try {
    const now = Date.now();

    if (now - lastSoundAt < 90) {
      return;
    }

    lastSoundAt = now;

    const audioContext = getAudioContext();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const startTime = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(230, startTime + 0.075);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.035, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.09);
  } catch {
    // Page sound is decorative and should never interrupt navigation.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getInitialSoundEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(soundPreferenceKey) !== "false";
  } catch {
    return true;
  }
}

function subscribeToSoundPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(soundPreferenceChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(soundPreferenceChangeEvent, onStoreChange);
  };
}

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

export function PublicDesktopEbookViewer({
  initialPageNumber,
  isAdminPreview,
  isEmbeddedAdminPreview,
  mobileReadingHref,
  pageCount,
  pages,
  pdfDownloadHref,
  publicAudio,
  projectIssue,
  projectOrganization,
  projectTitle,
}: PublicDesktopEbookViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const initialIndex = Math.max(
    0,
    pages.findIndex((page) => page.pageNumber === initialPageNumber),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [viewMode, setViewMode] = useState<PageViewMode>("single");
  const [zoom, setZoom] = useState(100);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isThumbnailPanelOpen, setIsThumbnailPanelOpen] = useState(true);
  const [pageInputValue, setPageInputValue] = useState(String(initialPageNumber));
  const [utilityMessage, setUtilityMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [followPages, setFollowPages] = useState(getInitialFollowPagesEnabled);
  const [followPagesMessage, setFollowPagesMessage] = useState("");
  const soundEnabled = useSyncExternalStore(subscribeToSoundPreference, getInitialSoundEnabled, () => true);
  const currentPage = pages[currentIndex] ?? null;
  const coverPage = pages.find((page) => page.previewHref) ?? pages[0] ?? null;
  const currentPageCustomTitle = currentPage ? getCustomPageTitle(currentPage.title, currentPage.pageNumber) : "";
  const getPageImageHref = useCallback((page: EbookPage) => {
    return isAdminPreview ? page.previewHref : page.publicHref ?? page.previewHref;
  }, [isAdminPreview]);
  const visiblePages = useMemo(() => {
    if (!currentPage) {
      return [];
    }

    return viewMode === "double" ? pages.slice(currentIndex, currentIndex + 2) : [currentPage];
  }, [currentIndex, currentPage, pages, viewMode]);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < pages.length - 1;
  const pageStep = viewMode === "double" ? 2 : 1;
  const canFollowPages = Boolean(publicAudio) && pages.length > 0 && audioDuration > 0;

  useEffect(() => {
    const button = currentPage ? thumbnailRefs.current[currentPage.id] : null;

    button?.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  const syncPageToUrl = useCallback((pageNumber: number) => {
    const url = new URL(window.location.href);

    url.searchParams.set("page", String(pageNumber));
    window.history.replaceState(null, "", url);
  }, []);

  const goToIndex = useCallback((nextIndex: number, withSound: boolean) => {
    if (pages.length === 0) {
      return;
    }

    const clampedIndex = clamp(nextIndex, 0, pages.length - 1);
    const nextPage = pages[clampedIndex];

    setCurrentIndex(clampedIndex);
    setPageInputValue(String(nextPage.pageNumber));
    syncPageToUrl(nextPage.pageNumber);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });

    if (withSound && soundEnabled) {
      void playPageFlipSound();
    }
  }, [pages, soundEnabled, syncPageToUrl]);

  const getIndexForSyncedPage = useCallback((pageNumber: number) => {
    const targetIndex = pages.findIndex((page) => page.pageNumber === pageNumber);

    if (targetIndex < 0) {
      return -1;
    }

    if (viewMode === "single") {
      return targetIndex;
    }

    return targetIndex % 2 === 0 ? targetIndex : Math.max(0, targetIndex - 1);
  }, [pages, viewMode]);

  const syncPageToAudioTime = useCallback((nextTime: number) => {
    const syncedPageNumber = getAudioSyncedPageNumber(nextTime, audioDuration, pages.length);

    if (!syncedPageNumber) {
      return;
    }

    const nextIndex = getIndexForSyncedPage(syncedPageNumber);

    if (nextIndex < 0) {
      return;
    }

    if (viewMode === "double" && (currentIndex === nextIndex || currentIndex + 1 === nextIndex)) {
      return;
    }

    if (currentIndex === nextIndex) {
      return;
    }

    goToIndex(nextIndex, false);
  }, [audioDuration, currentIndex, getIndexForSyncedPage, goToIndex, pages.length, viewMode]);

  const disableFollowPagesForManualNavigation = useCallback(() => {
    if (!followPages) {
      return;
    }

    setFollowPages(false);
    setFollowPagesMessage("사용자가 직접 페이지를 이동해 자동 넘김을 껐습니다.");
  }, [followPages]);

  const handleAudioDurationChange = useCallback((nextDuration: number) => {
    setAudioDuration(nextDuration);
  }, []);

  const handleAudioTimeUpdate = useCallback((nextTime: number) => {
    setAudioCurrentTime(nextTime);

    if (canFollowPages && followPages) {
      syncPageToAudioTime(nextTime);
    }
  }, [canFollowPages, followPages, syncPageToAudioTime]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        disableFollowPagesForManualNavigation();
        goToIndex(currentIndex - pageStep, true);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        disableFollowPagesForManualNavigation();
        goToIndex(currentIndex + pageStep, true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, disableFollowPagesForManualNavigation, goToIndex, pageStep]);

  useEffect(() => {
    try {
      window.localStorage.setItem(followPagesStorageKey, String(followPages));
    } catch {
      // Page follow preference is optional.
    }
  }, [followPages]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();

    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function submitPageInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pages.length === 0) {
      return;
    }

    const requestedPageNumber = Number.parseInt(pageInputValue, 10);
    const clampedPageNumber = clamp(Number.isNaN(requestedPageNumber) ? currentPage?.pageNumber ?? 1 : requestedPageNumber, 1, pages.length);
    const targetIndex = pages.findIndex((page) => page.pageNumber === clampedPageNumber);

    if (targetIndex < 0) {
      setPageInputValue(String(currentPage?.pageNumber ?? 1));
      return;
    }

    disableFollowPagesForManualNavigation();
    goToIndex(viewMode === "double" && targetIndex % 2 === 1 ? Math.max(0, targetIndex - 1) : targetIndex, true);
  }

  async function shareViewer() {
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${projectTitle} ${projectIssue}`.trim(),
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setUtilityMessage("링크를 복사했습니다.");
    } catch {
      setUtilityMessage("공유를 완료하지 못했습니다.");
    }
  }

  function updateFollowPages(nextValue: boolean) {
    setFollowPages(nextValue);
    setFollowPagesMessage(nextValue ? "" : "자동 넘김을 껐습니다.");

    if (nextValue) {
      syncPageToAudioTime(audioCurrentTime);
    }
  }

  function updateSoundPreference(nextValue: boolean) {
    try {
      window.localStorage.setItem(soundPreferenceKey, String(nextValue));
      window.dispatchEvent(new Event(soundPreferenceChangeEvent));
    } catch {
      // Sound preference is optional and should not interrupt the viewer.
    }
  }

  function requestFullscreen() {
    try {
      const element = document.documentElement;

      if (document.fullscreenElement) {
        void document.exitFullscreen();
        return;
      }

      void element.requestFullscreen();
    } catch {
      // Fullscreen is optional and can be blocked in some browsers or iframes.
    }
  }

  const thumbnailPanel = (
    <aside
      className={`hidden min-h-0 border-r border-white/10 bg-[#082041]/95 text-white shadow-2xl shadow-blue-950/30 transition-[width] duration-200 lg:flex ${
        isThumbnailPanelOpen ? "w-[220px] xl:w-[260px]" : "w-12"
      }`}
      aria-label="페이지 썸네일"
    >
      {isThumbnailPanelOpen ? (
        <div className="flex min-h-0 w-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
            <p className="text-xs font-black uppercase tracking-wide text-sky-200">페이지 목록</p>
            <button
              type="button"
              onClick={() => setIsThumbnailPanelOpen(false)}
              className="dd-btn dd-btn-ghost dd-btn-sm min-h-9 rounded-lg px-2 text-xs"
              aria-label="썸네일 패널 접기"
            >
              ◀
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {pages.map((page, index) => {
              const href = getPageImageHref(page);
              const isActive = index === currentIndex || (viewMode === "double" && index === currentIndex + 1);

              return (
                <button
                  key={page.id}
                  ref={(element) => {
                    thumbnailRefs.current[page.id] = element;
                  }}
                  type="button"
                  onClick={() => {
                    disableFollowPagesForManualNavigation();
                    goToIndex(viewMode === "double" && index % 2 === 1 ? Math.max(0, index - 1) : index, true);
                  }}
                  className={`w-full rounded-xl border p-2 text-left transition ${
                    isActive
                      ? "border-white bg-white text-[#092046] shadow-lg"
                      : "border-white/10 bg-white/8 text-slate-200 hover:border-white/30 hover:bg-white/15"
                  }`}
                  aria-label={`${page.pageNumber}쪽으로 이동`}
                >
                  <span className="mb-2 block text-xs font-black">{page.pageNumber}쪽</span>
                  <span className="block overflow-hidden rounded-lg border border-black/10 bg-white">
                    {href ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={href}
                        alt={`${page.pageNumber}쪽 썸네일`}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[3/4] w-full object-contain"
                      />
                    ) : (
                      <span className="grid aspect-[3/4] place-items-center text-[11px] font-bold text-slate-500">이미지 없음</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsThumbnailPanelOpen(true)}
          className="grid h-full w-full place-items-start px-2 py-3 text-xs font-black text-white"
          aria-label="썸네일 패널 펼치기"
        >
          ▶
        </button>
      )}
    </aside>
  );

  function fitToScreen() {
    setZoom(75);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }

  function fitToWidth() {
    setZoom(100);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }

  function updateZoom(nextZoom: number) {
    setZoom(clamp(nextZoom, minZoom, maxZoom));
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }

  return (
    <main className="public-newsletter-screen public-desktop-ebook-viewer flex h-screen min-h-screen flex-col overflow-hidden bg-[#071f46] text-slate-950">
      <header className="z-40 border-b border-white/10 bg-[#071f46]/95 px-3 py-2 text-white shadow-xl shadow-blue-950/30 backdrop-blur">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsThumbnailPanelOpen((value) => !value);
                } else {
                  setIsDrawerOpen(true);
                }
              }}
              className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
              aria-expanded={isThumbnailPanelOpen || isDrawerOpen}
              aria-label="페이지 썸네일 열기"
            >
              썸네일
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black leading-tight">
                {projectTitle} {projectIssue}
              </h1>
              <p className="truncate text-xs font-semibold text-slate-300">{projectOrganization}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-center">
            <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => {
                  disableFollowPagesForManualNavigation();
                  goToIndex(currentIndex - pageStep, true);
                }}
                disabled={!canGoPrevious}
                className="dd-btn dd-btn-ghost dd-btn-sm rounded-md px-2 text-xs text-slate-100 disabled:opacity-40"
                aria-label="이전 페이지"
              >
                ‹
              </button>
              <form onSubmit={submitPageInput} className="flex items-center gap-1">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pageInputValue}
                  onChange={(event) => setPageInputValue(event.target.value.replace(/\D/g, ""))}
                  className="h-8 w-14 rounded-md border border-white/25 bg-white px-2 text-center text-xs font-black text-[#092046] outline-none focus:ring-2 focus:ring-white/70"
                  aria-label="이동할 페이지 번호"
                />
                <span className="text-xs font-black text-white">/ {pages.length}</span>
                <button type="submit" className="dd-btn dd-btn-ghost dd-btn-sm rounded-md px-2 text-xs text-slate-100">
                  이동
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  disableFollowPagesForManualNavigation();
                  goToIndex(currentIndex + pageStep, true);
                }}
                disabled={!canGoNext}
                className="dd-btn dd-btn-ghost dd-btn-sm rounded-md px-2 text-xs text-slate-100 disabled:opacity-40"
                aria-label="다음 페이지"
              >
                ›
              </button>
            </div>
            <div className="flex rounded-lg border border-white/15 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setViewMode("single")}
                className={`dd-btn dd-btn-sm rounded-md text-xs ${
                  viewMode === "single" ? "bg-white text-[#092046] ring-1 ring-white/80" : "dd-btn-ghost text-slate-200"
                }`}
              >
                1쪽
              </button>
              <button
                type="button"
                onClick={() => setViewMode("double")}
                className={`dd-btn dd-btn-sm rounded-md text-xs ${
                  viewMode === "double" ? "bg-white text-[#092046] ring-1 ring-white/80" : "dd-btn-ghost text-slate-200"
                }`}
              >
                2쪽
              </button>
            </div>
            <button
              type="button"
              onClick={fitToScreen}
              className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
            >
              화면 맞춤
            </button>
            <button
              type="button"
              onClick={fitToWidth}
              className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
            >
              폭 맞춤
            </button>
            <button
              type="button"
              onClick={requestFullscreen}
              className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
              aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
            >
              {isFullscreen ? "전체화면 종료" : "전체화면"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
            <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => updateZoom(zoom - zoomStep)}
                className="dd-btn dd-btn-ghost dd-btn-sm rounded-md text-xs text-slate-100"
              >
                축소
              </button>
              <span className="min-w-12 text-center text-xs font-black text-white">{zoom}%</span>
              <button
                type="button"
                onClick={() => updateZoom(zoom + zoomStep)}
                className="dd-btn dd-btn-ghost dd-btn-sm rounded-md text-xs text-slate-100"
              >
                확대
              </button>
            </div>
            <button
              type="button"
              onClick={() => updateSoundPreference(!soundEnabled)}
              className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
            >
              효과음 {soundEnabled ? "켜짐" : "꺼짐"}
            </button>
            <button
              type="button"
              onClick={() => void shareViewer()}
              className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
              aria-label="e-book 공유"
            >
              공유
            </button>
            {pdfDownloadHref ? (
              <a href={pdfDownloadHref} className="dd-btn dd-btn-ghost dd-btn-sm text-xs" aria-label="원본 PDF 다운로드">
                PDF
              </a>
            ) : null}
            {!isEmbeddedAdminPreview ? (
              <Link
                href={mobileReadingHref}
                className="dd-btn dd-btn-sm rounded-lg bg-white text-xs text-[#092046] hover:bg-sky-50"
              >
                모바일 읽기
              </Link>
            ) : null}
          </div>
        </div>
        {utilityMessage ? <p className="mt-2 text-center text-[11px] font-bold text-sky-100">{utilityMessage}</p> : null}
      </header>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55"
            aria-label="목차 닫기"
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(360px,92vw)] flex-col border-r border-white/10 bg-[#092046] text-white shadow-2xl shadow-blue-950/40">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-sky-200">목차</p>
                  <h2 className="mt-1 text-base font-black leading-tight">{projectTitle}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-300">{projectIssue}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
                >
                  닫기
                </button>
              </div>
              {coverPage && getPageImageHref(coverPage) ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-white/20 bg-white/10 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getPageImageHref(coverPage) ?? ""} alt="소식지 표지 미리보기" className="mx-auto max-h-48 rounded-lg object-contain" />
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-300">
                <span>등록 {pages.length}쪽</span>
                <span>기준 {pageCount}쪽</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {pages.length > 0 ? (
                pages.map((page, index) => {
                  const isActive = index === currentIndex || (viewMode === "double" && index === currentIndex + 1);

                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        disableFollowPagesForManualNavigation();
                        goToIndex(index, true);
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-left text-xs font-black transition ${
                        isActive
                          ? "border-white bg-white text-[#092046]"
                          : "border-white/10 bg-white/8 text-slate-200 hover:bg-white/15"
                      }`}
                    >
                      <span className="block">{formatPageLabel(page.pageNumber, page.title)}</span>
                      <span className={`mt-1 block text-[10px] font-bold ${isActive ? "text-[#184a88]" : "text-slate-400"}`}>
                        {page.status}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-lg border border-white/10 bg-white/8 px-3 py-5 text-center text-xs font-bold text-slate-300">
                  등록된 페이지가 없습니다.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 bg-[radial-gradient(circle_at_top,#315c88_0%,#102b52_42%,#071f46_100%)]">
        {thumbnailPanel}
        <section className="relative flex min-h-0 flex-1 flex-col">
          {zoom >= 300 ? (
            <div className="absolute left-1/2 top-4 z-20 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-xl border border-amber-200/40 bg-amber-50/95 px-4 py-3 text-sm font-bold text-amber-950 shadow-xl shadow-blue-950/20 backdrop-blur">
              <p>고배율 확대 중입니다. 이미지가 흐릿하게 보일 수 있습니다.</p>
              {viewMode === "double" ? <p className="mt-1">고배율 확인은 1페이지 보기를 권장합니다.</p> : null}
            </div>
          ) : null}

        <button
          type="button"
          onClick={() => {
            disableFollowPagesForManualNavigation();
            goToIndex(currentIndex - pageStep, true);
          }}
          disabled={!canGoPrevious}
          className="public-ebook-side-nav dd-btn dd-btn-ghost absolute left-4 top-1/2 z-20 !hidden h-16 w-16 rounded-full text-sm backdrop-blur disabled:opacity-25 lg:!flex"
        >
          이전
        </button>
        <button
          type="button"
          onClick={() => {
            disableFollowPagesForManualNavigation();
            goToIndex(currentIndex + pageStep, true);
          }}
          disabled={!canGoNext}
          className="public-ebook-side-nav dd-btn dd-btn-ghost absolute right-4 top-1/2 z-20 !hidden h-16 w-16 rounded-full text-sm backdrop-blur disabled:opacity-25 lg:!flex"
        >
          다음
        </button>

        <div
          ref={viewportRef}
          className="public-desktop-ebook-scroll-container min-h-0 flex-1 overflow-auto overscroll-contain px-5 pb-8 pt-6 lg:px-24"
        >
          {visiblePages.length > 0 ? (
            <div
              key={`${currentIndex}-${viewMode}`}
              className={`public-desktop-ebook-spread mx-auto flex min-h-full items-center justify-center gap-5 ${
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
                  className="public-desktop-ebook-page min-w-0 shrink-0 rounded-xl border border-white/80 bg-white p-3 shadow-2xl shadow-blue-950/50"
                  style={{ width: viewMode === "double" ? "50%" : "100%" }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 px-1">
                    <h2 className="text-sm font-black text-[#092046]">{formatPageLabel(page.pageNumber, page.title)}</h2>
                    <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#184a88]">{page.status}</span>
                  </div>
                  {getPageImageHref(page) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getPageImageHref(page) ?? ""}
                      alt={formatPageLabel(page.pageNumber, page.title)}
                      className="mx-auto h-auto w-full rounded-lg border border-slate-200 bg-white object-contain shadow-lg shadow-slate-950/10"
                    />
                  ) : (
                    <div className="grid h-[60vh] min-w-80 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                      <p className="text-sm font-black text-[#092046]">페이지 이미지를 불러오지 못했습니다.</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-full place-items-center">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-8 py-12 text-center text-white shadow-2xl">
                <p className="text-xl font-black">등록된 e-book 페이지 이미지가 없습니다.</p>
                <p className="mt-3 text-sm font-semibold text-slate-200">원본 자료 화면에서 페이지 이미지를 업로드하면 뷰어가 표시됩니다.</p>
              </div>
            </div>
          )}
        </div>

        <div className="z-30 shrink-0 border-t border-white/10 bg-[#071f46]/95 px-4 py-3 text-white shadow-2xl shadow-blue-950/40 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 lg:w-72">
              <p className="truncate text-xs font-black">{currentPage ? `${currentPage.pageNumber}쪽 / ${pages.length}쪽` : `0쪽 / ${pages.length}쪽`}</p>
              {currentPageCustomTitle ? <p className="truncate text-xs font-semibold text-slate-300">{currentPageCustomTitle}</p> : null}
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(pages.length - 1, 0)}
              value={currentIndex}
              onChange={(event) => {
                disableFollowPagesForManualNavigation();
                goToIndex(Number(event.target.value), false);
              }}
              disabled={pages.length === 0}
              className="h-2 min-w-0 flex-1 accent-sky-300"
              aria-label="e-book 페이지 이동"
            />
            <div className="flex flex-wrap items-center gap-1 lg:justify-end">
              {zoomPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateZoom(preset)}
                  className={`dd-btn dd-btn-sm rounded-md px-2.5 py-2 text-xs ${
                    zoom === preset ? "bg-white text-[#092046] ring-1 ring-white/80" : "dd-btn-ghost text-slate-100"
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
        </div>
        </section>
      </div>
      {publicAudio ? (
        <PublicAudioPlayer
          src={publicAudio.src}
          title={publicAudio.title}
          variant="desktop"
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
    </main>
  );
}
