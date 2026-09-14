"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";

type EbookPage = {
  id: string;
  pageNumber: number;
  previewHref: string | null;
  status: string;
  title: string | null;
};

type PublicDesktopEbookViewerProps = {
  adminPagesHref: string;
  initialPageNumber: number;
  isAdminPreview: boolean;
  isEmbeddedAdminPreview: boolean;
  mobileEbookHref: string;
  mobileReadingHref: string;
  pageCount: number;
  pages: EbookPage[];
  projectIssue: string;
  projectOrganization: string;
  projectTitle: string;
};

type PageViewMode = "single" | "double";

const soundPreferenceKey = "datadiction_desktop_ebook_sound";
const soundPreferenceChangeEvent = "datadiction-desktop-ebook-sound-change";
const zoomStep = 20;
const minZoom = 60;
const maxZoom = 220;

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

function formatEbookPageLabel(pageNumber: number, title?: string | null) {
  const pageLabel = `${pageNumber}쪽`;
  const trimmedTitle = title?.trim();

  if (!trimmedTitle || trimmedTitle.replace(/\s+/g, "") === pageLabel) {
    return pageLabel;
  }

  return `${pageLabel} · ${trimmedTitle}`;
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

export function PublicDesktopEbookViewer({
  adminPagesHref,
  initialPageNumber,
  isAdminPreview,
  isEmbeddedAdminPreview,
  mobileEbookHref,
  mobileReadingHref,
  pageCount,
  pages,
  projectIssue,
  projectOrganization,
  projectTitle,
}: PublicDesktopEbookViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const initialIndex = Math.max(
    0,
    pages.findIndex((page) => page.pageNumber === initialPageNumber),
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [viewMode, setViewMode] = useState<PageViewMode>("single");
  const [zoom, setZoom] = useState(100);
  const soundEnabled = useSyncExternalStore(subscribeToSoundPreference, getInitialSoundEnabled, () => true);
  const currentPage = pages[currentIndex] ?? null;
  const visiblePages = useMemo(() => {
    if (!currentPage) {
      return [];
    }

    return viewMode === "double" ? pages.slice(currentIndex, currentIndex + 2) : [currentPage];
  }, [currentIndex, currentPage, pages, viewMode]);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < pages.length - 1;
  const pageStep = viewMode === "double" ? 2 : 1;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToIndex(currentIndex - pageStep, true);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToIndex(currentIndex + pageStep, true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function syncPageToUrl(pageNumber: number) {
    const url = new URL(window.location.href);

    url.searchParams.set("page", String(pageNumber));
    window.history.replaceState(null, "", url);
  }

  function goToIndex(nextIndex: number, withSound: boolean) {
    if (pages.length === 0) {
      return;
    }

    const clampedIndex = clamp(nextIndex, 0, pages.length - 1);
    const nextPage = pages[clampedIndex];

    setCurrentIndex(clampedIndex);
    syncPageToUrl(nextPage.pageNumber);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });

    if (withSound && soundEnabled) {
      void playPageFlipSound();
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

  function fitToScreen() {
    setZoom(100);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }

  return (
    <main className="public-newsletter-screen public-desktop-ebook-viewer min-h-screen bg-[#071f46] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071f46]/95 px-4 py-3 text-white shadow-xl shadow-blue-950/30 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-sky-200">PC e-book Viewer</p>
            <h1 className="mt-1 truncate text-lg font-black leading-tight">
              {projectTitle} {projectIssue}
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-300">
              {projectOrganization} · {currentPage ? `${currentPage.pageNumber}쪽 / ${pages.length}쪽` : `0쪽 / ${pages.length}쪽`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/15 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setViewMode("single")}
                className={`rounded-md px-3 py-2 text-xs font-black transition ${
                  viewMode === "single" ? "bg-white text-[#092046]" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                1페이지
              </button>
              <button
                type="button"
                onClick={() => setViewMode("double")}
                className={`rounded-md px-3 py-2 text-xs font-black transition ${
                  viewMode === "double" ? "bg-white text-[#092046]" : "text-slate-200 hover:bg-white/10"
                }`}
              >
                2페이지
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setZoom((value) => clamp(value - zoomStep, minZoom, maxZoom))}
                className="rounded-md px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/10"
              >
                축소
              </button>
              <span className="min-w-12 text-center text-xs font-black text-white">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((value) => clamp(value + zoomStep, minZoom, maxZoom))}
                className="rounded-md px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/10"
              >
                확대
              </button>
              <button
                type="button"
                onClick={fitToScreen}
                className="rounded-md px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/10"
              >
                화면 맞춤
              </button>
            </div>

            <button
              type="button"
              onClick={requestFullscreen}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/15"
            >
              전체화면
            </button>
            <button
              type="button"
              onClick={() => updateSoundPreference(!soundEnabled)}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/15"
            >
              효과음 {soundEnabled ? "켜짐" : "꺼짐"}
            </button>
            <PublicTextSizeToggle />
            {!isEmbeddedAdminPreview ? (
              <>
                <Link
                  href={mobileReadingHref}
                  className="rounded-lg bg-white px-3 py-2 text-xs font-black text-[#092046] shadow-sm hover:bg-sky-50"
                >
                  모바일 읽기
                </Link>
                <Link
                  href={mobileEbookHref}
                  className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black text-white hover:bg-white/10"
                >
                  모바일 e-book
                </Link>
              </>
            ) : null}
            {isAdminPreview ? (
              <Link
                href={adminPagesHref}
                className="rounded-lg border border-sky-200/40 px-3 py-2 text-xs font-black text-sky-100 hover:bg-white/10"
              >
                페이지 관리
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-73px)] grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#092046] px-4 py-4 text-white xl:max-h-[calc(100vh-73px)] xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <details open className="rounded-xl border border-white/10 bg-white/8 p-3">
            <summary className="cursor-pointer text-sm font-black">목차·썸네일</summary>
            <div className="mt-3 space-y-2">
              {pages.length > 0 ? (
                pages.map((page, index) => {
                  const isActive = index === currentIndex || (viewMode === "double" && index === currentIndex + 1);

                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => goToIndex(index, true)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-black transition ${
                        isActive
                          ? "border-white bg-white text-[#092046]"
                          : "border-white/10 bg-white/8 text-slate-200 hover:bg-white/15"
                      }`}
                    >
                      <span className="block">{formatEbookPageLabel(page.pageNumber, page.title)}</span>
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
          </details>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/8 p-3 text-xs font-semibold leading-5 text-slate-300">
            <p className="font-black text-white">페이지 정보</p>
            <p className="mt-2">등록 페이지 {pages.length}쪽</p>
            <p>프로젝트 기준 {pageCount}쪽</p>
            <p className="mt-2 text-sky-100">방향키 ← → 로 페이지를 넘길 수 있습니다.</p>
          </div>
        </aside>

        <section className="relative min-w-0 bg-[radial-gradient(circle_at_top,#315c88_0%,#102b52_42%,#071f46_100%)]">
          <button
            type="button"
            onClick={() => goToIndex(currentIndex - pageStep, true)}
            disabled={!canGoPrevious}
            className="absolute left-4 top-1/2 z-20 hidden min-h-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-black text-white shadow-xl backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-25 lg:block"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => goToIndex(currentIndex + pageStep, true)}
            disabled={!canGoNext}
            className="absolute right-4 top-1/2 z-20 hidden min-h-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-black text-white shadow-xl backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-25 lg:block"
          >
            다음
          </button>

          <div ref={viewportRef} className="h-[calc(100vh-73px)] overflow-auto px-5 py-6 lg:px-20">
            {visiblePages.length > 0 ? (
              <div
                key={`${currentIndex}-${viewMode}`}
                className={`public-desktop-ebook-spread mx-auto flex min-h-full items-center justify-center gap-5 ${
                  viewMode === "double" ? "flex-row" : "flex-col"
                }`}
                style={{ width: `${zoom}%` }}
              >
                {visiblePages.map((page) => (
                  <article
                    key={page.id}
                    className="public-desktop-ebook-page min-w-0 rounded-2xl border border-white/80 bg-white p-3 shadow-2xl shadow-blue-950/50"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3 px-1">
                      <h2 className="text-sm font-black text-[#092046]">{formatEbookPageLabel(page.pageNumber, page.title)}</h2>
                      <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#184a88]">{page.status}</span>
                    </div>
                    {page.previewHref ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.previewHref}
                        alt={formatEbookPageLabel(page.pageNumber, page.title)}
                        className="max-h-[calc(100vh-190px)] w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain shadow-lg shadow-slate-950/10"
                      />
                    ) : (
                      <div className="grid h-[60vh] min-w-80 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                        <p className="text-sm font-black text-[#092046]">이미지 파일 경로가 없습니다.</p>
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

          <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full border border-white/15 bg-[#071f46]/85 p-2 shadow-2xl shadow-blue-950/40 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => goToIndex(currentIndex - pageStep, true)}
              disabled={!canGoPrevious}
              className="rounded-full bg-white px-4 py-3 text-sm font-black text-[#092046] disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => goToIndex(currentIndex + pageStep, true)}
              disabled={!canGoNext}
              className="rounded-full bg-white px-4 py-3 text-sm font-black text-[#092046] disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
