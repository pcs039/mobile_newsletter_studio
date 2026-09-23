"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { PublicArticleImageLightbox, type PublicArticleLightboxImage } from "@/components/public-article-image-lightbox";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
import { PublicAudioTextSyncPlayer } from "@/components/public-audio-text-sync-player";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { ScrollMotionReveal } from "@/components/scroll-motion-reveal";
import {
  buildAudioTextSegmentCandidates,
  getArticleBodyParagraphs,
  makeArticleBodySegmentId,
  makeArticleSummarySegmentId,
  makeArticleTitleSegmentId,
} from "@/lib/audio-text-sync";
import { getFontAssetById, getFontFamilyValue } from "@/lib/font-css";
import {
  getDisplayArticleTitle,
  tokenizeKoreanTitleForBreaks,
  renderKoreanTitleWithBreaks,
} from "@/lib/korean-title-breaks";
import {
  getArticlePublicPresentation,
  getArticleUrgencyLabel,
  isArticleUrgencyCurrentlyRelevant,
  type ArticlePublicPresentation,
} from "@/lib/article-public-presentation";
import { getArticlePublicInfoEntries, getArticlePublicInfoFieldGroup } from "@/lib/article-public-info-fields";
import { getAvailableInterestTags, getInterestOrderedArticles } from "@/lib/article-interest-order";
import {
  enablePageTurnSoundWithPreview,
  playPageTurnSound,
  readPageTurnSoundPreference,
  savePageTurnSoundPreference,
  subscribeToPageTurnSoundPreference,
} from "@/lib/page-turn-sound";
import type {
  ArticleElementMotionEffect,
  ArticleElementMotionSpeed,
  ArticleMotionPreset,
  ArticleMotionSpeed,
  ArticleTextAlignment,
  FontAsset,
  ProjectContentArticle,
  ProjectContentBlock,
  ProjectSurveyItem,
} from "@/lib/newsletter-repository";
import { getArticleLinkButtonLabel, getValidArticleUrl } from "@/lib/public-article-url";

type PublicMobileArticleReaderProps = {
  articles: ProjectContentArticle[];
  cover?: {
    coverFit: "contain" | "cover";
    coverImageSrc: string;
    coverIssueText: string;
    coverLayout: "image" | "image_info" | "image_overlay";
    coverSubtitle: string;
    coverTitle: string;
  } | null;
  fontAssets?: FontAsset[];
  hasCoverPage?: boolean;
  initialArticleId?: string | null;
  issue?: string | null;
  publicationTitle: string;
  headerColor?: string | null;
  projectBodyFontAssetId?: string | null;
  projectTitleFontAssetId?: string | null;
  ebookDesktopHref?: string;
  ebookLinkRel?: string;
  ebookLinkTarget?: "_blank";
  ebookMobileHref?: string;
  publicAudio?: {
    src: string;
    title?: string;
  };
  publicSurveyLinks?: ProjectSurveyItem[];
  showSurveyConnectionStatus?: boolean;
  surveys?: ProjectSurveyItem[];
  showAdminPreviewControls: boolean;
  slug: string;
};

type SwipeStart = {
  isMultiTouch?: boolean;
  lockedAxis?: "horizontal" | "vertical";
  x: number;
  y: number;
} | null;

type PageSlideDirection = "next" | "previous" | null;
type MobileArticleSearchResult = {
  article: ProjectContentArticle;
  index: number;
  snippet: string;
  title: string;
};

type ArticleMotionTarget = "title" | "textBox" | "image" | "link";

type ResolvedArticleElementMotion = {
  effect: ArticleElementMotionEffect;
  speed: ArticleMotionSpeed;
};

type ResolvedArticleMotionSettings = {
  image: ResolvedArticleElementMotion;
  link: ResolvedArticleElementMotion;
  textBox: ResolvedArticleElementMotion;
  title: ResolvedArticleElementMotion;
};

const mobileReaderQuery = "(max-width: 767px)";
const openMobileArticleTocEventName = "datadiction:open-mobile-article-toc";
const stopArticleAudioEventName = "datadiction:stop-article-audio";
const swipeThreshold = 70;
const articleMotionPresetClassNames: Record<ArticleMotionPreset, string> = {
  none: "article-motion-preset-none",
  calm: "article-motion-preset-calm",
  image_focus: "article-motion-preset-image-focus",
  promotion: "article-motion-preset-promotion",
  dynamic: "article-motion-preset-dynamic",
};
const articleMotionSpeedClassNames: Record<ArticleMotionSpeed, string> = {
  slow: "article-motion-speed-slow",
  normal: "article-motion-speed-normal",
  fast: "article-motion-speed-fast",
};
const articleMotionSpeedSettings: Record<ArticleMotionSpeed, { characterDelayMs: number; maxDelayMs: number }> = {
  slow: { characterDelayMs: 50, maxDelayMs: 1450 },
  normal: { characterDelayMs: 36, maxDelayMs: 1000 },
  fast: { characterDelayMs: 20, maxDelayMs: 650 },
};
const newsletterInterestStorageKeyPrefix = "datadiction_newsletter_interests:";
const newsletterInterestPreferenceEventName = "datadiction:newsletter-interest-preference";
const pageControlsAutoHideMs = 2800;
const pageControlsTapDistance = 12;

const presetElementMotionEffects: Record<ArticleMotionPreset, Record<ArticleMotionTarget, ArticleElementMotionEffect>> = {
  none: {
    title: "none",
    textBox: "none",
    image: "none",
    link: "none",
  },
  calm: {
    title: "fade_up",
    textBox: "fade_up",
    image: "fade_in",
    link: "none",
  },
  image_focus: {
    title: "fade_up",
    textBox: "fade_up",
    image: "blur_clear",
    link: "none",
  },
  promotion: {
    title: "char_by_char",
    textBox: "card_lift",
    image: "reveal_up",
    link: "soft_emphasis",
  },
  dynamic: {
    title: "char_by_char",
    textBox: "fade_up",
    image: "reveal_up",
    link: "soft_emphasis",
  },
};

function subscribeToMobileReader(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(mobileReaderQuery);

  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function readMobileReaderSnapshot() {
  return window.matchMedia(mobileReaderQuery).matches;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getNewsletterInterestStorageKey(slug: string) {
  return `${newsletterInterestStorageKeyPrefix}${slug}`;
}

function subscribeToNewsletterInterestPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(newsletterInterestPreferenceEventName, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(newsletterInterestPreferenceEventName, onStoreChange);
  };
}

function readNewsletterInterestSnapshot(slug: string) {
  if (typeof window === "undefined") {
    return "[]";
  }

  try {
    return window.localStorage.getItem(getNewsletterInterestStorageKey(slug)) ?? "[]";
  } catch {
    return "[]";
  }
}

function sanitizeSelectedInterests(value: unknown, availableInterestTags: string[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  const availableTagSet = new Set(availableInterestTags);
  const selected: string[] = [];
  const seen = new Set<string>();

  value.forEach((item) => {
    if (typeof item !== "string") {
      return;
    }

    const tag = item.trim();

    if (!tag || !availableTagSet.has(tag) || seen.has(tag)) {
      return;
    }

    seen.add(tag);
    selected.push(tag);
  });

  return selected;
}

function saveStoredNewsletterInterests(slug: string, selectedInterests: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = getNewsletterInterestStorageKey(slug);

    if (selectedInterests.length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(selectedInterests));
    }
  } catch {
    // localStorage may be unavailable in private browsing or embedded previews.
  }

  window.dispatchEvent(new Event(newsletterInterestPreferenceEventName));
}

function parseNewsletterInterestSnapshot(snapshot: string, availableInterestTags: string[]) {
  try {
    return sanitizeSelectedInterests(JSON.parse(snapshot), availableInterestTags);
  } catch {
    return [];
  }
}

function isInteractiveTouchTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, select, textarea, audio, video, details, summary, [data-swipe-navigation-ignore]"))
  );
}

export function PublicMobileArticleTocButton({
  ariaLabel = "기사 목차 열기",
  children = "☰",
  className = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-3 text-xl font-black leading-none text-white shadow-sm shadow-blue-950/10 backdrop-blur transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
}: {
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  function openArticleToc() {
    window.dispatchEvent(new Event(openMobileArticleTocEventName));
  }

  return (
    <button
      type="button"
      onClick={openArticleToc}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function PublicMobileFirstArticleLink({
  children = "첫 기사 읽기",
  className,
  href = "#newsletter-articles",
}: {
  children?: ReactNode;
  className?: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        void playPageTurnSound();
      }}
    >
      {children}
    </a>
  );
}

function InterestPreferenceSelector({
  availableInterestTags,
  compact = false,
  onReset,
  onToggle,
  selectedInterests,
}: {
  availableInterestTags: string[];
  compact?: boolean;
  onReset: () => void;
  onToggle: (tag: string) => void;
  selectedInterests: string[];
}) {
  if (availableInterestTags.length === 0) {
    return null;
  }

  const selectedTagSet = new Set(selectedInterests);
  const hasSelection = selectedInterests.length > 0;

  return (
    <section
      data-swipe-navigation-ignore
      className={
        compact
          ? "rounded-2xl border border-[#d8e8ff] bg-[#f8fbff] p-3"
          : "mt-5 rounded-2xl border border-[#b8d7ff] bg-white p-4 shadow-sm"
      }
    >
      <div className={compact ? "mb-2" : "mb-3"}>
        <p className="text-xs font-black text-[#184a88]">맞춤 보기</p>
        <h2 className={`${compact ? "mt-0.5 text-sm" : "mt-1 text-lg"} font-black leading-tight text-[#092046]`}>
          어떤 소식을 먼저 볼까요?
        </h2>
        {!compact ? (
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            관심분야를 선택하면 관련 소식을 먼저 보여드립니다. 전체 기사는 그대로 유지됩니다.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReset}
          className={`min-h-9 rounded-full border px-3 text-xs font-black transition ${
            !hasSelection
              ? "border-[#092046] bg-[#092046] text-white"
              : "border-[#d8e8ff] bg-white text-[#184a88] hover:border-[#184a88]"
          }`}
          aria-pressed={!hasSelection}
        >
          전체보기
        </button>
        {availableInterestTags.map((tag) => {
          const isSelected = selectedTagSet.has(tag);

          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`min-h-9 rounded-full border px-3 text-xs font-black transition ${
                isSelected
                  ? "border-[#092046] bg-[#092046] text-white"
                  : "border-[#d8e8ff] bg-white text-[#184a88] hover:border-[#184a88]"
              }`}
              aria-pressed={isSelected}
            >
              {tag}
            </button>
          );
        })}
      </div>
      {hasSelection ? (
        <p className="mt-2 text-xs font-bold text-[#184a88]">관심분야 우선순으로 보고 있습니다.</p>
      ) : null}
      {!compact ? <p className="mt-2 text-xs font-semibold text-slate-500">선택은 이 기기에만 저장됩니다.</p> : null}
    </section>
  );
}

function PublicNewsletterCoverView({
  coverFit,
  coverImageSrc,
  coverIssueText,
  coverLayout,
  coverSubtitle,
  coverTitle,
  hasArticles,
  interestSelector,
  onOpenToc,
  onStartReading,
  publicSurveyLinks = [],
  slug,
}: {
  coverFit: "contain" | "cover";
  coverImageSrc: string;
  coverIssueText: string;
  coverLayout: "image" | "image_info" | "image_overlay";
  coverSubtitle: string;
  coverTitle: string;
  hasArticles: boolean;
  interestSelector?: ReactNode;
  onOpenToc: () => void;
  onStartReading: () => void;
  publicSurveyLinks?: ProjectSurveyItem[];
  slug: string;
}) {
  const hasInfo = Boolean(coverTitle || coverSubtitle || coverIssueText);
  const imageFitClass = coverFit === "cover" || coverLayout === "image_overlay" ? "object-cover" : "object-contain";

  return (
    <section className="border-b border-slate-200 bg-[#f4f8ff] px-3 py-5">
      <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-lg shadow-blue-950/10">
        {coverLayout === "image_overlay" ? (
          <div className="relative min-h-[76vh] bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageSrc}
              alt={coverTitle || "모바일 소식지 표지"}
              className={`absolute inset-0 h-full w-full ${imageFitClass}`}
            />
            {hasInfo ? (
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent p-6 text-white">
                {coverIssueText ? <p className="text-sm font-black text-sky-100">{coverIssueText}</p> : null}
                {coverTitle ? <h2 className="mt-2 text-4xl font-black leading-tight [word-break:keep-all]">{coverTitle}</h2> : null}
                {coverSubtitle ? <p className="mt-3 text-base font-bold leading-7 text-white/90 [word-break:keep-all]">{coverSubtitle}</p> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="bg-white px-1 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageSrc}
                alt={coverTitle || "모바일 소식지 표지"}
                className={`mx-auto max-h-[82vh] w-full rounded-[1.1rem] ${imageFitClass}`}
              />
            </div>
            {coverLayout === "image_info" && hasInfo ? (
              <div className="border-t border-slate-100 px-5 py-5">
                {coverTitle ? <h2 className="text-2xl font-black leading-tight text-[#092046] [word-break:keep-all]">{coverTitle}</h2> : null}
                {coverSubtitle ? <p className="mt-2 text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">{coverSubtitle}</p> : null}
                {coverIssueText ? <p className="mt-3 text-xs font-black text-[#184a88]">{coverIssueText}</p> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onStartReading}
          disabled={!hasArticles}
          className="dd-btn dd-btn-primary min-h-11 justify-center rounded-full px-4 text-sm disabled:pointer-events-none disabled:opacity-45"
        >
          첫 기사 읽기
        </button>
        <button
          type="button"
          onClick={onOpenToc}
          disabled={!hasArticles}
          className="dd-btn dd-btn-secondary min-h-11 justify-center rounded-full px-4 text-sm disabled:pointer-events-none disabled:opacity-45"
        >
          목차 보기
        </button>
      </div>
      {interestSelector}
      {publicSurveyLinks.length > 0 ? (
        <section className="mt-5 rounded-2xl border border-[#b8d7ff] bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-[#184a88]">참여하기</p>
          <h2 className="mt-2 text-xl font-black leading-tight text-[#092046]">설문·이벤트</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">
            모바일 소식지를 읽은 뒤 만족도 조사나 이벤트에 참여할 수 있습니다.
          </p>
          <div className="mt-4 grid gap-3">
            {publicSurveyLinks.map((survey) => (
              <Link
                key={survey.id}
                href={`/newsletters/${slug}/survey/${survey.id}`}
                className="block rounded-xl border border-slate-200 bg-[#f8fbff] px-4 py-4 shadow-sm transition hover:border-[#2f73b7] hover:bg-white"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">
                    {survey.kind}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {survey.questionCount}개 문항
                  </span>
                </div>
                <h3 className="mt-3 text-base font-black leading-7 text-[#092046] [word-break:keep-all]">
                  {survey.title}
                </h3>
                {survey.description ? (
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
                    {survey.description}
                  </p>
                ) : null}
                <p className="mt-3 text-sm font-black text-[#184a88]">참여하기</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function PublicCompactPublicationHeader({
  ebookDesktopHref,
  ebookLinkRel,
  ebookLinkTarget,
  ebookMobileHref,
  headerColor,
  issue,
  onOpenSearch,
  onOpenToc,
  onGoHome,
  publicationTitle,
  showSearch,
  showHomeButton = false,
  showToc,
}: {
  ebookDesktopHref?: string;
  ebookLinkRel?: string;
  ebookLinkTarget?: "_blank";
  ebookMobileHref?: string;
  headerColor?: string | null;
  issue?: string | null;
  onGoHome?: () => void;
  onOpenSearch: () => void;
  onOpenToc: () => void;
  publicationTitle: string;
  showSearch: boolean;
  showHomeButton?: boolean;
  showToc: boolean;
}) {
  const hasEbookLinks = Boolean(ebookMobileHref || ebookDesktopHref);
  const headerUtilityButtonClassName =
    "inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3 text-xs font-black text-white shadow-sm backdrop-blur transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";
  const hasUtilityRow = hasEbookLinks || showHomeButton;

  return (
    <header
      className="px-4 pb-4 pt-[calc(0.9rem+env(safe-area-inset-top))] text-white"
      style={{ backgroundColor: headerColor || "#071f46" }}
    >
      <div className="flex min-h-14 items-start justify-between gap-2">
        <div className="min-w-[7rem] flex-1 overflow-hidden pr-1">
          <h1 className="line-clamp-2 max-w-full text-[17px] font-black leading-6 [line-break:strict] [overflow-wrap:normal] [text-wrap:balance] [word-break:keep-all]">
            {publicationTitle}
          </h1>
          {issue ? (
            <p className="mt-1 max-w-full text-sm font-bold leading-5 text-sky-100 [line-break:strict] [overflow-wrap:normal] [word-break:keep-all]">
              {issue}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pr-[env(safe-area-inset-right)]">
          {!hasUtilityRow ? (
            <PublicPageTurnSoundToggle
              compactLabel
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-2 text-[11px] font-black text-white shadow-sm backdrop-blur transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            />
          ) : null}
          {showSearch ? (
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-2 text-[13px] font-black leading-none text-white shadow-sm backdrop-blur transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="소식지 검색"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.4"
              >
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 4 4" />
              </svg>
              <span className="sr-only">검색</span>
            </button>
          ) : null}
          {showToc ? (
            <button
              type="button"
              onClick={onOpenToc}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-2.5 text-xl font-black leading-none text-white shadow-sm backdrop-blur transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="기사 목차 열기"
            >
              ☰
            </button>
          ) : null}
        </div>
      </div>
      {hasUtilityRow ? (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          {ebookMobileHref ? (
            <Link
              href={ebookMobileHref}
              target={ebookLinkTarget}
              rel={ebookLinkRel}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-white/30 bg-white px-4 text-[15px] font-bold text-[#092046] shadow-sm backdrop-blur transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 md:hidden"
            >
              e-book 보기
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          {ebookDesktopHref ? (
            <Link
              href={ebookDesktopHref}
              target={ebookLinkTarget}
              rel={ebookLinkRel}
              className="hidden min-h-10 flex-1 items-center justify-center rounded-xl border border-white/30 bg-white px-4 text-[15px] font-bold text-[#092046] shadow-sm backdrop-blur transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 md:inline-flex"
            >
              e-book 보기
            </Link>
          ) : null}
          {showHomeButton && onGoHome ? (
            <button
              type="button"
              onClick={onGoHome}
              className={headerUtilityButtonClassName}
              aria-label="첫 화면으로 이동"
            >
              처음화면
            </button>
          ) : null}
          <PublicPageTurnSoundToggle className={headerUtilityButtonClassName} />
        </div>
      ) : null}
    </header>
  );
}

export function PublicPageTurnSoundToggle({
  className = "inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-3 text-xs font-black text-white shadow-sm shadow-blue-950/10 backdrop-blur transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
  compactLabel = false,
}: {
  className?: string;
  compactLabel?: boolean;
}) {
  const enabled = useSyncExternalStore(subscribeToPageTurnSoundPreference, readPageTurnSoundPreference, () => true);

  function toggleSound() {
    const nextValue = !enabled;

    if (nextValue) {
      void enablePageTurnSoundWithPreview();
      return;
    }

    savePageTurnSoundPreference(false);
  }

  return (
    <button
      type="button"
      onClick={toggleSound}
      className={className}
      aria-label="페이지 전환 효과음"
      aria-pressed={enabled}
    >
      {compactLabel ? "효과음" : `효과음 ${enabled ? "켜짐" : "꺼짐"}`}
    </button>
  );
}

function getPreviewBody(article: ProjectContentArticle) {
  const body = article.body.trim();

  if (!body) {
    return "본문이 아직 입력되지 않았습니다.";
  }

  return body;
}

function renderArticleBody(
  value: string,
  className: string,
  audioSegmentBaseId?: string,
  textAlignment: ArticleTextAlignment = "left",
) {
  const paragraphs = getArticleBodyParagraphs(value);
  const shouldUseInlineSentenceFlow = textAlignment === "justify";

  return (
    <div
      data-public-text-scale-target="article-body"
      data-text-alignment={textAlignment}
      className={`public-article-body text-base leading-8 text-slate-700 ${className}`}
    >
      {paragraphs.map((paragraph, paragraphIndex) => (
        <div
          key={paragraphIndex}
          className={`public-article-paragraph ${shouldUseInlineSentenceFlow ? "public-article-paragraph-inline-flow" : ""}`}
        >
          {paragraph.map((sentence, sentenceIndex) => {
            const segmentId = audioSegmentBaseId
              ? makeArticleBodySegmentId(audioSegmentBaseId, paragraphIndex, sentenceIndex)
              : undefined;

            return (
              <Fragment key={`${paragraphIndex}-${sentenceIndex}`}>
                <span
                  data-audio-segment-id={segmentId}
                  className="public-article-sentence public-audio-sync-segment"
                >
                  {sentence}
                </span>
                {shouldUseInlineSentenceFlow && sentenceIndex < paragraph.length - 1 ? " " : null}
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function getVisibleBlocks(article: ProjectContentArticle) {
  return article.blocks
    .filter((block) => block.isVisible && (block.title || block.body))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getBlockLink(article: ProjectContentArticle, block: ProjectContentBlock) {
  if (block.linkActionId) {
    return article.links.find((link) => link.id === block.linkActionId) ?? null;
  }

  if (block.type === "video_link") {
    return article.links.find((link) => link.actionType === "video" && link.targetValue === block.body) ?? null;
  }

  if (block.type === "map_link") {
    return article.links.find((link) => link.actionType === "map" && link.targetValue === block.body) ?? null;
  }

  if (block.type === "button_group") {
    return article.links.find((link) => link.displayStyle === "button" && link.targetValue === block.body) ?? null;
  }

  return null;
}

function getYoutubeId(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "");
    }

    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop() ?? "";
    }
  } catch {
    return "";
  }

  return "";
}

function getArticleTitle(article: ProjectContentArticle, index: number) {
  return getDisplayArticleTitle(article, `기사 ${index + 1}`);
}

function getPlainArticleSearchText(article: ProjectContentArticle, index: number) {
  const paragraphText = article.blocks
    .filter((block) => block.isVisible && block.type === "paragraph")
    .map((block) => block.body)
    .filter(Boolean)
    .join(" ");

  return [
    getArticleTitle(article, index),
    article.title,
    article.displayTitle,
    article.summary,
    paragraphText || article.body,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildArticleSearchSnippet(text: string, query: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const matchedIndex = normalizedText.toLocaleLowerCase("ko-KR").indexOf(normalizedQuery);

  if (matchedIndex < 0) {
    return normalizedText.slice(0, 96);
  }

  const start = Math.max(0, matchedIndex - 36);
  const end = Math.min(normalizedText.length, matchedIndex + query.length + 64);

  return `${start > 0 ? "..." : ""}${normalizedText.slice(start, end)}${end < normalizedText.length ? "..." : ""}`;
}

function getSurveyAvailabilityState(survey: ProjectSurveyItem | null | undefined) {
  if (!survey) {
    return "none";
  }

  if (survey.statusCode === "draft") {
    return "draft";
  }

  if (survey.statusCode === "closed") {
    return "closed";
  }

  if (survey.questionCount <= 0) {
    return "empty";
  }

  const now = Date.now();
  const startsAt = survey.startAtRaw ? Date.parse(survey.startAtRaw) : null;
  const endsAt = survey.endAtRaw ? Date.parse(survey.endAtRaw) : null;

  if (startsAt && startsAt > now) {
    return "upcoming";
  }

  if (endsAt && endsAt < now) {
    return "ended";
  }

  return "active";
}

function normalizeArticleMotionPreset(value: string | null | undefined): ArticleMotionPreset {
  const allowed: ArticleMotionPreset[] = ["none", "calm", "image_focus", "promotion", "dynamic"];

  return allowed.includes(value as ArticleMotionPreset) ? (value as ArticleMotionPreset) : "dynamic";
}

function normalizeArticleMotionSpeed(value: string | null | undefined): ArticleMotionSpeed {
  const allowed: ArticleMotionSpeed[] = ["slow", "normal", "fast"];

  return allowed.includes(value as ArticleMotionSpeed) ? (value as ArticleMotionSpeed) : "normal";
}

function resolveElementMotionEffect(
  value: ArticleElementMotionEffect | null | undefined,
  preset: ArticleMotionPreset,
  target: ArticleMotionTarget,
): ArticleElementMotionEffect {
  return value && value !== "inherit" ? value : presetElementMotionEffects[preset][target];
}

function resolveElementMotionSpeed(
  value: ArticleElementMotionSpeed | null | undefined,
  motionSpeed: ArticleMotionSpeed,
): ArticleMotionSpeed {
  return value && value !== "inherit" ? value : motionSpeed;
}

function getResolvedArticleMotionSettings(
  article: ProjectContentArticle,
  motionPreset: ArticleMotionPreset,
  motionSpeed: ArticleMotionSpeed,
): ResolvedArticleMotionSettings {
  return {
    title: {
      effect: resolveElementMotionEffect(article.titleMotionEffect, motionPreset, "title"),
      speed: resolveElementMotionSpeed(article.titleMotionSpeed, motionSpeed),
    },
    textBox: {
      effect: resolveElementMotionEffect(article.textBoxMotionEffect, motionPreset, "textBox"),
      speed: resolveElementMotionSpeed(article.textBoxMotionSpeed, motionSpeed),
    },
    image: {
      effect: resolveElementMotionEffect(article.imageMotionEffect, motionPreset, "image"),
      speed: resolveElementMotionSpeed(article.imageMotionSpeed, motionSpeed),
    },
    link: {
      effect: resolveElementMotionEffect(article.linkMotionEffect, motionPreset, "link"),
      speed: resolveElementMotionSpeed(article.linkMotionSpeed, motionSpeed),
    },
  };
}

function getArticleTitleMotionTokens(title: string, motionSpeed: ArticleMotionSpeed) {
  const speedSettings = articleMotionSpeedSettings[motionSpeed];
  const tokens = tokenizeKoreanTitleForBreaks(title);
  let characterIndex = 0;

  return tokens.map((token) => ({
    kind: token.kind,
    segments:
      token.kind === "text"
        ? token.segments.map((segment) =>
            Array.from(segment).map((character) => {
              const delay = Math.min(characterIndex * speedSettings.characterDelayMs, speedSettings.maxDelayMs);

              characterIndex += 1;

              return { character, delay };
            }),
          )
        : [],
    value: token.value,
  }));
}

function getInitialArticleIndex(articles: ProjectContentArticle[], initialArticleId?: string | null) {
  if (!initialArticleId) {
    return 0;
  }

  const matchedIndex = articles.findIndex((article) => article.id === initialArticleId);

  return matchedIndex >= 0 ? matchedIndex : 0;
}

function renderContentBlock(
  article: ProjectContentArticle,
  block: ProjectContentBlock,
  motionSettings: ResolvedArticleMotionSettings,
  onOpenArticleImage: (image: PublicArticleLightboxImage) => void,
  presentation: ArticlePublicPresentation,
) {
  const link = getBlockLink(article, block);
  const rawHref = link?.targetValue || block.body;

  if (block.type === "paragraph") {
    return (
      <section key={block.id}>
        {block.title ? (
          <h3
            data-text-alignment={block.textAlignment || article.bodyAlignment || article.textAlignment}
            className="text-base font-black leading-7 text-[#092046]"
          >
            {block.title}
          </h3>
        ) : null}
        {block.body
          ? renderArticleBody(
              block.body,
              "mt-3",
              `article-${article.id}-block-${block.id}`,
              block.textAlignment || article.bodyAlignment || article.textAlignment,
            )
          : null}
      </section>
    );
  }

  if (block.type === "image") {
    const imageSrc = block.body.trim();
    const imageAlt = block.title || article.title || "기사 이미지";

    if (!imageSrc) {
      return null;
    }

    return (
      <ScrollMotionReveal
        key={block.id}
        motionEffect={motionSettings.image.effect}
        motionSpeed={motionSettings.image.speed}
      >
        <figure
          className={`article-motion-image ${articleMotionSpeedClassNames[motionSettings.image.speed]} overflow-hidden rounded-2xl border border-slate-200 bg-slate-50`}
          data-motion-effect={motionSettings.image.effect}
          data-motion-speed={motionSettings.image.speed}
        >
          <button
            type="button"
            className="group relative block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
            aria-label={`${imageAlt} 확대 보기`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenArticleImage({
                alt: imageAlt,
                caption: block.title || undefined,
                src: imageSrc,
              });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt={imageAlt} className="w-full object-cover transition duration-200 group-hover:scale-[1.01]" />
            <span className="absolute right-3 top-3 rounded-full bg-slate-950/72 px-3 py-1 text-xs font-black text-white shadow-sm">
              확대
            </span>
          </button>
          {block.title ? (
            <figcaption
              className={`article-motion-caption ${articleMotionSpeedClassNames[motionSettings.image.speed]} px-4 py-3 text-sm font-bold leading-6 text-slate-700`}
              data-motion-effect={motionSettings.image.effect}
              data-motion-speed={motionSettings.image.speed}
            >
              {block.title}
            </figcaption>
          ) : null}
        </figure>
      </ScrollMotionReveal>
    );
  }

  if (block.type === "video_link") {
    const href = getValidArticleUrl(rawHref);
    const youtubeId = href ? getYoutubeId(href) : "";

    if (!href || !youtubeId) {
      return null;
    }

    return (
      <ScrollMotionReveal
        key={block.id}
        motionEffect={motionSettings.textBox.effect}
        motionSpeed={motionSettings.textBox.speed}
      >
        <section
          className={`article-motion-content-block ${articleMotionSpeedClassNames[motionSettings.textBox.speed]} ${presentation.videoBlockClassName}`}
          data-motion-effect={motionSettings.textBox.effect}
          data-motion-speed={motionSettings.textBox.speed}
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            title={block.title || "영상 보기"}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <div className="px-4 py-3">
            <p className="text-xs font-black text-sky-200">영상 보기</p>
            <p className="mt-1 text-sm font-black leading-6">{block.title || link?.label || "영상 보기"}</p>
            <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-sky-100 underline">
              새 창에서 열기
            </a>
          </div>
        </section>
      </ScrollMotionReveal>
    );
  }

  if (block.type === "map_link") {
    const href = getValidArticleUrl(rawHref);

    if (!href) {
      return null;
    }

    return (
      <ScrollMotionReveal
        key={block.id}
        motionEffect={motionSettings.textBox.effect}
        motionSpeed={motionSettings.textBox.speed}
      >
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`article-motion-content-block ${articleMotionSpeedClassNames[motionSettings.textBox.speed]} ${presentation.mapLinkClassName}`}
          data-motion-effect={motionSettings.textBox.effect}
          data-motion-speed={motionSettings.textBox.speed}
        >
          <p className="text-xs font-black text-[#184a88]">지도 보기</p>
          <p className="mt-1 text-base font-black leading-7 text-[#092046]">{block.title || link?.label || "위치 확인"}</p>
        </a>
      </ScrollMotionReveal>
    );
  }

  if (block.type === "button_group") {
    const href = getValidArticleUrl(rawHref);

    if (!href) {
      return null;
    }

    return (
      <ScrollMotionReveal
        key={block.id}
        motionEffect={motionSettings.link.effect}
        motionSpeed={motionSettings.link.speed}
      >
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`article-motion-link-button ${articleMotionSpeedClassNames[motionSettings.link.speed]} ${presentation.actionLinkClassName}`}
          data-motion-effect={motionSettings.link.effect}
          data-motion-speed={motionSettings.link.speed}
        >
          {getArticleLinkButtonLabel(block.title || link?.label)}
        </a>
      </ScrollMotionReveal>
    );
  }

  if (block.type === "audio") {
    return (
      <ScrollMotionReveal
        key={block.id}
        motionEffect={motionSettings.textBox.effect}
        motionSpeed={motionSettings.textBox.speed}
      >
        <details
          className={`article-motion-content-block ${articleMotionSpeedClassNames[motionSettings.textBox.speed]} rounded-xl bg-[#f4f8ff] px-4 py-3`}
          data-motion-effect={motionSettings.textBox.effect}
          data-motion-speed={motionSettings.textBox.speed}
        >
          <summary className="cursor-pointer text-sm font-black text-[#092046]">{block.title || "음성 대본 보기"}</summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{block.body}</p>
        </details>
      </ScrollMotionReveal>
    );
  }

  return null;
}

function ArticlePublicInfoCard({
  article,
  presentation,
}: {
  article: ProjectContentArticle;
  presentation: ArticlePublicPresentation;
}) {
  if (presentation.isGeneral) {
    return null;
  }

  const entries = getArticlePublicInfoEntries(article.publicInfo, article.articleType);

  if (entries.length === 0) {
    return null;
  }

  const fieldGroup = getArticlePublicInfoFieldGroup(article.articleType);
  const isEmergency = article.articleType === "emergency";

  return (
    <section
      className={`mt-4 rounded-xl border px-4 py-4 ${
        isEmergency ? "border-amber-200 bg-amber-50" : "border-[#d8e8ff] bg-[#f8fbff]"
      }`}
    >
      <p className={isEmergency ? "text-xs font-black text-amber-800" : "text-xs font-black text-[#184a88]"}>
        {fieldGroup.cardTitle || presentation.summaryLabel || "핵심정보"}
      </p>
      <dl className="mt-3 space-y-3">
        {entries.map((entry) => (
          <div key={entry.key} className="min-w-0">
            <dt className={`text-xs font-black ${isEmergency ? "text-amber-800" : "text-[#184a88]"}`}>
              {entry.label}
            </dt>
            <dd
              data-public-text-scale-target="article-body"
              className="mt-1 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-slate-800 [overflow-wrap:anywhere] [word-break:keep-all]"
            >
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ArticleCard({
  article,
  className = "",
  fontAssets,
  index,
  onOpenArticleImage,
  projectBodyFontAssetId,
  projectTitleFontAssetId,
  showTextSizeControl = false,
  showAdminPreviewControls,
  showSurveyConnectionStatus = false,
  slug,
  survey,
}: {
  article: ProjectContentArticle;
  className?: string;
  fontAssets: FontAsset[];
  index: number;
  onOpenArticleImage: (image: PublicArticleLightboxImage) => void;
  projectBodyFontAssetId?: string | null;
  projectTitleFontAssetId?: string | null;
  showTextSizeControl?: boolean;
  showAdminPreviewControls: boolean;
  showSurveyConnectionStatus?: boolean;
  slug: string;
  survey?: ProjectSurveyItem | null;
}) {
  const visibleBlocks = getVisibleBlocks(article);
  const articleTitle = getArticleTitle(article, index);
  const motionPreset = normalizeArticleMotionPreset(article.motionPreset);
  const motionSpeed = normalizeArticleMotionSpeed(article.motionSpeed);
  const motionSettings = getResolvedArticleMotionSettings(article, motionPreset, motionSpeed);
  const shouldRenderCharacterTitleMotion = motionSettings.title.effect === "char_by_char";
  const titleMotionTokens = shouldRenderCharacterTitleMotion ? getArticleTitleMotionTokens(articleTitle, motionSettings.title.speed) : [];
  const titleFont = getFontAssetById(fontAssets, article.titleFontAssetId || projectTitleFontAssetId);
  const bodyFont = getFontAssetById(fontAssets, article.bodyFontAssetId || projectBodyFontAssetId);
  const captionFont = getFontAssetById(fontAssets, article.captionFontAssetId || article.bodyFontAssetId || projectBodyFontAssetId);
  const buttonFont = getFontAssetById(fontAssets, article.buttonFontAssetId || article.bodyFontAssetId || projectBodyFontAssetId);
  const fontStyle = {
    "--newsletter-title-font": getFontFamilyValue(titleFont),
    "--newsletter-body-font": getFontFamilyValue(bodyFont),
    "--newsletter-caption-font": getFontFamilyValue(captionFont),
    "--newsletter-button-font": getFontFamilyValue(buttonFont),
  } as CSSProperties;
  const hasUploadedArticleAudio = article.audioFile?.sourceType === "uploaded" && Boolean(article.audioFile.previewHref);
  const hasAiArticleAudio = article.audioSource === "ai_tts" && article.audioFile?.sourceType === "ai_tts";
  const shouldShowArticleAudio = hasUploadedArticleAudio || hasAiArticleAudio;
  const surveyAvailabilityState = getSurveyAvailabilityState(survey);
  const hasPublicSurveyCta = surveyAvailabilityState === "active";
  const shouldShowSurveyStatus = Boolean(survey && (hasPublicSurveyCta || showSurveyConnectionStatus));
  const presentation = getArticlePublicPresentation(article.articleType);
  const shouldShowTypeCue = !presentation.isGeneral;
  const shouldShowUrgencyCue = article.urgency !== "normal" && isArticleUrgencyCurrentlyRelevant(article);
  const urgencyLabel = shouldShowUrgencyCue ? getArticleUrgencyLabel(article.urgency) : "";
  const surveyStatusText =
    surveyAvailabilityState === "draft"
      ? "준비 중 · 실제 공개화면에는 표시되지 않습니다."
      : surveyAvailabilityState === "closed"
        ? "마감 · 실제 공개 참여가 불가합니다."
        : surveyAvailabilityState === "upcoming"
          ? "진행 예정 · 시작 일시 이후 공개됩니다."
          : surveyAvailabilityState === "ended"
            ? "운영 종료 · 실제 공개 참여가 불가합니다."
            : surveyAvailabilityState === "empty"
              ? "문항 없음 · 실제 공개화면에는 표시되지 않습니다."
              : "공개 전";

  return (
    <article
      className={`public-card public-article-card ${articleMotionPresetClassNames[motionPreset]} ${articleMotionSpeedClassNames[motionSpeed]} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      data-article-text-alignment={article.textAlignment || "left"}
      data-motion-preset={motionPreset}
      data-motion-speed={motionSpeed}
      style={fontStyle}
    >
      {showAdminPreviewControls ? (
        <div className="flex justify-end">
          <Link
            href={`/projects/${slug}/reading?articleId=${article.id}`}
            className="dd-btn dd-btn-secondary dd-btn-sm rounded-full text-xs"
          >
            수정
          </Link>
        </div>
      ) : null}
      {shouldShowTypeCue || urgencyLabel ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {shouldShowTypeCue ? (
            <span className={presentation.typeBadgeClassName}>
              {presentation.typeLabel}
            </span>
          ) : null}
          {urgencyLabel ? (
            <span className={presentation.urgencyBadgeClassName}>
              {urgencyLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        key={`article-title-${article.id}-${motionPreset}-${motionSpeed}-${motionSettings.title.effect}-${motionSettings.title.speed}`}
        className={`article-title-motion ${articleMotionSpeedClassNames[motionSettings.title.speed]}`}
        data-motion-effect={motionSettings.title.effect}
        data-motion-speed={motionSettings.title.speed}
      >
        <h2
          aria-label={articleTitle}
          data-audio-segment-id={makeArticleTitleSegmentId(article.id)}
          data-text-alignment={article.titleAlignment || "left"}
          title={articleTitle}
          className="public-article-title public-audio-sync-segment text-2xl font-black leading-tight text-[#092046]"
        >
          {shouldRenderCharacterTitleMotion
            ? titleMotionTokens.map((token, tokenIndex) => {
                if (token.kind === "space") {
                  return token.value;
                }

                return (
                  <span key={`${token.value}-${tokenIndex}`} className="article-title-motion-token" aria-hidden="true">
                    {token.segments.map((segment, segmentIndex) => (
                      <Fragment key={`${token.value}-${tokenIndex}-${segmentIndex}`}>
                        {segment.map(({ character, delay }, characterIndex) => (
                          <span
                            key={`${character}-${tokenIndex}-${segmentIndex}-${characterIndex}`}
                            className="article-title-motion-char"
                            style={{ animationDelay: `${delay}ms` }}
                          >
                            {character}
                          </span>
                        ))}
                        {segmentIndex < token.segments.length - 1 ? <wbr /> : null}
                      </Fragment>
                    ))}
                  </span>
                );
              })
            : renderKoreanTitleWithBreaks(articleTitle)}
        </h2>
      </div>
      {showTextSizeControl ? (
        <div className="mt-3">
          <PublicTextSizeToggle compact />
        </div>
      ) : null}
      {article.summary ? (
        <ScrollMotionReveal
          motionEffect={motionSettings.textBox.effect}
          motionSpeed={motionSettings.textBox.speed}
        >
          <div
            className={`article-motion-summary ${articleMotionSpeedClassNames[motionSettings.textBox.speed]} ${presentation.summaryClassName}`}
            data-motion-effect={motionSettings.textBox.effect}
            data-motion-speed={motionSettings.textBox.speed}
          >
            {presentation.summaryLabel ? (
              <p className={`${presentation.summaryLabelClassName} mb-1`}>
                {presentation.summaryLabel}
              </p>
            ) : null}
            <p
              data-audio-segment-id={makeArticleSummarySegmentId(article.id)}
              data-public-text-scale-target="article-summary"
              data-text-alignment={article.summaryAlignment || article.textAlignment || "left"}
              className="public-audio-sync-segment"
            >
              {article.summary}
            </p>
          </div>
        </ScrollMotionReveal>
      ) : null}
      <ArticlePublicInfoCard article={article} presentation={presentation} />
      {shouldShowArticleAudio && article.audioFile ? (
        <section className="mt-3 rounded-xl border border-[#d8e8ff] bg-[#f7fbff] px-2.5 py-2 shadow-sm shadow-blue-950/5">
          {hasAiArticleAudio ? (
            <p className="mb-0.5 px-1 text-[10px] font-bold leading-4 text-slate-500">
              AI가 생성한 음성입니다.
            </p>
          ) : null}
          <PublicArticleAudioPlayer
            key={`${article.id}-${article.audioSource}-${article.audioFile.id}`}
            ariaLabel={`${articleTitle} 음성으로 듣기`}
            isAiGenerated={hasAiArticleAudio}
            manifestUrl={
              hasAiArticleAudio
                ? `/api/public/newsletters/${encodeURIComponent(slug)}/articles/${encodeURIComponent(article.id)}/audio`
                : undefined
            }
            src={article.audioFile.previewHref}
          />
          {article.audioFile.transcriptText ? (
            <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <summary className="cursor-pointer text-xs font-black text-[#092046]">음성 대본 보기</summary>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                음성 파일 제작에 사용된 낭독문입니다.
              </p>
              <p
                data-public-text-scale-target="article-body"
                data-text-alignment={article.bodyAlignment || article.textAlignment || "left"}
                className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-800"
              >
                {article.audioFile.transcriptText}
              </p>
            </details>
          ) : null}
        </section>
      ) : null}
      {visibleBlocks.length > 0 ? (
        <div className="public-article-content mt-6 space-y-6">
          {visibleBlocks.map((block) => renderContentBlock(article, block, motionSettings, onOpenArticleImage, presentation))}
        </div>
      ) : (
        renderArticleBody(
          getPreviewBody(article),
          "mt-6",
          `article-${article.id}-body`,
          article.bodyAlignment || article.textAlignment,
        )
      )}
      {article.contactName || article.contactPhone ? (
        <div className={presentation.contactPanelClassName}>
          <p className={presentation.contactLabelClassName}>문의</p>
          <p className="mt-1 font-bold">
            {[article.contactName, article.contactPhone].filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : null}
      {shouldShowSurveyStatus && survey ? (
        <div className="mt-5 rounded-xl border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-4">
          <p className="text-xs font-black text-[#184a88]">참여 콘텐츠</p>
          <h3 className="mt-1 text-base font-black leading-7 text-[#092046] [word-break:keep-all]">{survey.title}</h3>
          {survey.description && hasPublicSurveyCta ? (
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">{survey.description}</p>
          ) : null}
          {hasPublicSurveyCta ? (
            <Link
              href={`/newsletters/${slug}/survey/${survey.id}`}
              className="dd-btn dd-btn-primary dd-btn-sm mt-3 rounded-full px-4"
            >
              {survey.kindCode === "event" ? "이벤트 참여하기" : "설문 참여하기"}
            </Link>
          ) : (
            <span className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
              {surveyStatusText}
            </span>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function PublicMobileArticleReader({
  articles,
  cover,
  fontAssets = [],
  hasCoverPage = false,
  headerColor,
  initialArticleId,
  issue,
  publicationTitle,
  projectBodyFontAssetId,
  projectTitleFontAssetId,
  ebookDesktopHref,
  ebookLinkRel,
  ebookLinkTarget,
  ebookMobileHref,
  publicAudio,
  publicSurveyLinks = [],
  showSurveyConnectionStatus = false,
  surveys = [],
  showAdminPreviewControls,
  slug,
}: PublicMobileArticleReaderProps) {
  const isMobileReader = useSyncExternalStore(subscribeToMobileReader, readMobileReaderSnapshot, () => false);
  const availableInterestTags = useMemo(() => getAvailableInterestTags(articles), [articles]);
  const selectedInterestSnapshot = useSyncExternalStore(
    subscribeToNewsletterInterestPreference,
    () => readNewsletterInterestSnapshot(slug),
    () => "[]",
  );
  const selectedInterests = useMemo(
    () => parseNewsletterInterestSnapshot(selectedInterestSnapshot, availableInterestTags),
    [availableInterestTags, selectedInterestSnapshot],
  );
  const orderedArticles = useMemo(
    () => getInterestOrderedArticles(articles, selectedInterests),
    [articles, selectedInterests],
  );
  const [currentArticleId, setCurrentArticleId] = useState(
    () => articles[getInitialArticleIndex(articles, initialArticleId)]?.id ?? null,
  );
  const [isCoverView, setIsCoverView] = useState(() => Boolean(hasCoverPage && !initialArticleId));
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxImage, setLightboxImage] = useState<PublicArticleLightboxImage | null>(null);
  const [pageSlideDirection, setPageSlideDirection] = useState<PageSlideDirection>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingPage, setIsDraggingPage] = useState(false);
  const [arePageControlsVisible, setArePageControlsVisible] = useState(true);
  const articleTopRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<SwipeStart>(null);
  const pageControlsTimerRef = useRef<number | null>(null);
  const currentArticleIndex = currentArticleId
    ? orderedArticles.findIndex((article) => article.id === currentArticleId)
    : -1;
  const fallbackCurrentIndex =
    orderedArticles.length === 0 ? 0 : Math.min(getInitialArticleIndex(orderedArticles, initialArticleId), orderedArticles.length - 1);
  const safeCurrentIndex = currentArticleIndex >= 0 ? currentArticleIndex : fallbackCurrentIndex;
  const currentArticle = orderedArticles[safeCurrentIndex] ?? null;
  const hasArticles = orderedArticles.length > 0;
  const surveyById = useMemo(() => new Map(surveys.map((survey) => [survey.id, survey])), [surveys]);
  const searchResults = useMemo<MobileArticleSearchResult[]>(() => {
    const query = searchQuery.trim();

    if (!query) {
      return [];
    }

    const normalizedQuery = query.toLocaleLowerCase("ko-KR");

    return orderedArticles.flatMap((article, index) => {
      const text = getPlainArticleSearchText(article, index);

      if (!text.toLocaleLowerCase("ko-KR").includes(normalizedQuery)) {
        return [];
      }

      return [
        {
          article,
          index,
          snippet: buildArticleSearchSnippet(text, query),
          title: getArticleTitle(article, index),
        },
      ];
    });
  }, [orderedArticles, searchQuery]);
  const canGoPrevious = !isCoverView && (safeCurrentIndex > 0 || hasCoverPage);
  const canGoNext = isCoverView ? hasArticles : safeCurrentIndex < orderedArticles.length - 1 || hasCoverPage;
  const activeAudioSegments = useMemo(() => {
    if (!isMobileReader || !currentArticle) {
      return buildAudioTextSegmentCandidates(orderedArticles);
    }

    return buildAudioTextSegmentCandidates([currentArticle]);
  }, [currentArticle, isMobileReader, orderedArticles]);

  useEffect(() => {
    if (!isMobileReader) {
      return;
    }

    articleTopRef.current?.scrollIntoView({ block: "start" });
  }, [isCoverView, isMobileReader, safeCurrentIndex]);

  useEffect(() => {
    if (pageControlsTimerRef.current) {
      window.clearTimeout(pageControlsTimerRef.current);
      pageControlsTimerRef.current = null;
    }

    if (!isMobileReader || isCoverView || !currentArticle || isIndexOpen || isSearchOpen || lightboxImage) {
      return;
    }

    const revealTimer = window.setTimeout(() => {
      setArePageControlsVisible(true);
      pageControlsTimerRef.current = window.setTimeout(() => {
        setArePageControlsVisible(false);
        pageControlsTimerRef.current = null;
      }, pageControlsAutoHideMs);
    }, 0);

    return () => {
      window.clearTimeout(revealTimer);
      if (pageControlsTimerRef.current) {
        window.clearTimeout(pageControlsTimerRef.current);
        pageControlsTimerRef.current = null;
      }
    };
  }, [currentArticle, currentArticle?.id, isCoverView, isIndexOpen, isMobileReader, isSearchOpen, lightboxImage, safeCurrentIndex]);

  useEffect(
    () => () => {
      if (pageControlsTimerRef.current) {
        window.clearTimeout(pageControlsTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    function openArticleToc() {
      setIsIndexOpen(true);
    }

    window.addEventListener(openMobileArticleTocEventName, openArticleToc);

    return () => window.removeEventListener(openMobileArticleTocEventName, openArticleToc);
  }, []);

  function updateSelectedInterests(nextInterests: string[]) {
    const sanitized = sanitizeSelectedInterests(nextInterests, availableInterestTags);

    saveStoredNewsletterInterests(slug, sanitized);
  }

  function toggleSelectedInterest(tag: string) {
    const selectedTagSet = new Set(selectedInterests);

    if (selectedTagSet.has(tag)) {
      selectedTagSet.delete(tag);
    } else {
      selectedTagSet.add(tag);
    }

    updateSelectedInterests([...selectedTagSet]);
  }

  function resetSelectedInterests() {
    updateSelectedInterests([]);
  }

  function revealPageControls() {
    if (!isMobileReader || isCoverView || !currentArticle || isIndexOpen || isSearchOpen || lightboxImage) {
      return;
    }

    if (pageControlsTimerRef.current) {
      window.clearTimeout(pageControlsTimerRef.current);
    }

    setArePageControlsVisible(true);
    pageControlsTimerRef.current = window.setTimeout(() => {
      setArePageControlsVisible(false);
      pageControlsTimerRef.current = null;
    }, pageControlsAutoHideMs);
  }

  const interestSelector = (
    <InterestPreferenceSelector
      availableInterestTags={availableInterestTags}
      onReset={resetSelectedInterests}
      onToggle={toggleSelectedInterest}
      selectedInterests={selectedInterests}
    />
  );
  const compactInterestSelector = (
    <InterestPreferenceSelector
      availableInterestTags={availableInterestTags}
      compact
      onReset={resetSelectedInterests}
      onToggle={toggleSelectedInterest}
      selectedInterests={selectedInterests}
    />
  );

  function stopCurrentArticleAudio() {
    window.dispatchEvent(new Event(stopArticleAudioEventName));
  }

  function scrollToReaderTop() {
    articleTopRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  function goToCoverFromArticle() {
    if (!hasCoverPage || isCoverView) {
      return false;
    }

    stopCurrentArticleAudio();
    setIsCoverView(true);
    scrollToReaderTop();
    void playPageTurnSound();
    return true;
  }

  function goToFirstArticleFromCover() {
    if (!hasArticles || !isCoverView) {
      return;
    }

    stopCurrentArticleAudio();
    setCurrentArticleId(orderedArticles[0]?.id ?? null);
    setIsCoverView(false);
    scrollToReaderTop();
    void playPageTurnSound();
  }

  function goToArticle(nextIndex: number, options: { playSound?: boolean } = {}) {
    if (orderedArticles.length === 0) {
      return false;
    }

    const clampedIndex = Math.min(Math.max(nextIndex, 0), orderedArticles.length - 1);
    const nextArticle = orderedArticles[clampedIndex];

    if (!nextArticle || (nextArticle.id === currentArticle?.id && !isCoverView)) {
      return false;
    }

    stopCurrentArticleAudio();
    setCurrentArticleId(nextArticle.id);
    setIsCoverView(false);

    if (options.playSound) {
      void playPageTurnSound();
    }

    return true;
  }

  function navigatePrevious() {
    if (safeCurrentIndex === 0 && hasCoverPage) {
      goToCoverFromArticle();
      return;
    }

    goToArticleWithSlide(safeCurrentIndex - 1, "previous");
  }

  function navigateNext() {
    if (isCoverView) {
      goToFirstArticleFromCover();
      return;
    }

    if (safeCurrentIndex >= orderedArticles.length - 1 && hasCoverPage) {
      goToCoverFromArticle();
      return;
    }

    goToArticleWithSlide(safeCurrentIndex + 1, "next");
  }

  function goToFirstScreen() {
    if (isCoverView) {
      return;
    }

    if (hasCoverPage) {
      goToCoverFromArticle();
      return;
    }

    if (safeCurrentIndex > 0 && goToArticle(0, { playSound: true })) {
      scrollToReaderTop();
    }
  }

  function goToArticleWithSlide(nextIndex: number, direction: Exclude<PageSlideDirection, null>) {
    const clampedIndex = Math.min(Math.max(nextIndex, 0), orderedArticles.length - 1);

    if (clampedIndex === safeCurrentIndex) {
      return;
    }

    stopCurrentArticleAudio();
    if (prefersReducedMotion()) {
      goToArticle(clampedIndex, { playSound: true });
      return;
    }

    setPageSlideDirection(direction);
    window.setTimeout(() => {
      goToArticle(clampedIndex, { playSound: true });
      setDragOffset(0);
      scrollToReaderTop();
    }, 150);
    window.setTimeout(() => {
      setPageSlideDirection(null);
    }, 280);
  }

  function startSwipeGesture(target: EventTarget | null, touches: TouchList) {
    if (touches.length >= 2) {
      swipeStartRef.current = { isMultiTouch: true, lockedAxis: "vertical", x: 0, y: 0 };
      setIsDraggingPage(false);
      setDragOffset(0);
      return;
    }

    if (isInteractiveTouchTarget(target)) {
      swipeStartRef.current = null;
      return;
    }

    const touch = touches[0];

    if (!touch) {
      return;
    }

    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDraggingPage(false);
    setDragOffset(0);
  }

  function moveSwipeGesture(touches: TouchList) {
    const start = swipeStartRef.current;

    if (!start || prefersReducedMotion()) {
      return;
    }

    if (start.isMultiTouch || touches.length >= 2) {
      swipeStartRef.current = { isMultiTouch: true, lockedAxis: "vertical", x: 0, y: 0 };
      setIsDraggingPage(false);
      setDragOffset(0);
      return;
    }

    const touch = touches[0];

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);

    if (start.lockedAxis === "vertical") {
      return;
    }

    if (!start.lockedAxis) {
      if (absoluteDeltaY > 10 && absoluteDeltaY > absoluteDeltaX) {
        swipeStartRef.current = { ...start, lockedAxis: "vertical" };
        setIsDraggingPage(false);
        setDragOffset(0);
        return;
      }

      if (absoluteDeltaX > 10 && absoluteDeltaX > absoluteDeltaY * 1.15) {
        swipeStartRef.current = { ...start, lockedAxis: "horizontal" };
      } else {
        return;
      }
    }

    if ((deltaX < 0 && !canGoNext) || (deltaX > 0 && !canGoPrevious)) {
      setDragOffset(deltaX * 0.18);
      return;
    }

    setIsDraggingPage(true);
    setDragOffset(Math.max(-120, Math.min(120, deltaX)));
  }

  function endSwipeGesture(touch: Touch | undefined) {
    const start = swipeStartRef.current;

    swipeStartRef.current = null;
    setIsDraggingPage(false);
    setDragOffset(0);

    if (!start || !touch || start.isMultiTouch || start.lockedAxis === "vertical") {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const tapDistance = Math.hypot(deltaX, deltaY);

    if (!start.lockedAxis && tapDistance <= pageControlsTapDistance) {
      revealPageControls();
      return;
    }

    const adaptiveThreshold =
      typeof window === "undefined" ? swipeThreshold : Math.min(90, Math.max(64, window.innerWidth * 0.16));

    if (Math.abs(deltaX) < adaptiveThreshold || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
      return;
    }

    if (deltaX < 0) {
      navigateNext();
    }

    if (deltaX > 0 && canGoPrevious) {
      navigatePrevious();
    }
  }

  function cancelSwipeGesture() {
    swipeStartRef.current = null;
    setIsDraggingPage(false);
    setDragOffset(0);
  }

  useEffect(() => {
    if (!isMobileReader || orderedArticles.length === 0) {
      return;
    }

    const shell = articleTopRef.current?.closest("[data-public-mobile-swipe-shell]");

    if (!(shell instanceof HTMLElement)) {
      return;
    }

    function onTouchStart(event: globalThis.TouchEvent) {
      startSwipeGesture(event.target, event.touches);
    }

    function onTouchMove(event: globalThis.TouchEvent) {
      moveSwipeGesture(event.touches);
    }

    function onTouchEnd(event: globalThis.TouchEvent) {
      endSwipeGesture(event.changedTouches[0]);
    }

    shell.addEventListener("touchstart", onTouchStart, { passive: true });
    shell.addEventListener("touchmove", onTouchMove, { passive: true });
    shell.addEventListener("touchend", onTouchEnd, { passive: true });
    shell.addEventListener("touchcancel", cancelSwipeGesture, { passive: true });

    return () => {
      shell.removeEventListener("touchstart", onTouchStart);
      shell.removeEventListener("touchmove", onTouchMove);
      shell.removeEventListener("touchend", onTouchEnd);
      shell.removeEventListener("touchcancel", cancelSwipeGesture);
    };
  });

  if (orderedArticles.length === 0 && !cover) {
    return null;
  }

  const pageSlideClass = pageSlideDirection ? `public-article-page-slide-${pageSlideDirection}` : "";
  const pageDragStyle = isDraggingPage
    ? ({
        "--public-article-page-drag-x": `${dragOffset}px`,
      } as CSSProperties)
    : undefined;
  const shouldShowFloatingPageControls = isMobileReader && !isCoverView && Boolean(currentArticle) && !isIndexOpen && !isSearchOpen && !lightboxImage;
  const pageControlsVisibilityClass =
    shouldShowFloatingPageControls && arePageControlsVisible
      ? "opacity-100"
      : "public-mobile-page-control-idle opacity-60";
  const canGoFirstScreen = hasArticles && !isCoverView && (hasCoverPage || safeCurrentIndex > 0);

  return (
    <>
      {isMobileReader ? (
        <section
          className={`public-mobile-article-reader pb-[calc(3.75rem+env(safe-area-inset-bottom))] ${
            publicAudio ? "pb-[calc(8.5rem+env(safe-area-inset-bottom))]" : ""
          }`}
          onClickCapture={(event) => {
            if (isInteractiveTouchTarget(event.target)) {
              return;
            }

            revealPageControls();
          }}
        >
          <div ref={articleTopRef} aria-hidden="true" />

          {isCoverView && cover ? (
            <>
              <PublicCompactPublicationHeader
                ebookDesktopHref={ebookDesktopHref}
                ebookLinkRel={ebookLinkRel}
                ebookLinkTarget={ebookLinkTarget}
                ebookMobileHref={ebookMobileHref}
                headerColor={headerColor}
                issue={issue}
                onOpenToc={() => setIsIndexOpen(true)}
                onOpenSearch={() => setIsSearchOpen(true)}
                publicationTitle={publicationTitle}
                showSearch={hasArticles}
                showHomeButton={canGoFirstScreen}
                showToc={hasArticles}
                onGoHome={goToFirstScreen}
              />
              <PublicNewsletterCoverView
                {...cover}
                hasArticles={hasArticles}
                interestSelector={interestSelector}
                onOpenToc={() => setIsIndexOpen(true)}
                onStartReading={goToFirstArticleFromCover}
                publicSurveyLinks={publicSurveyLinks}
                slug={slug}
              />
            </>
          ) : (
            <>
              <PublicCompactPublicationHeader
                headerColor={headerColor}
                issue={issue}
                onOpenSearch={() => setIsSearchOpen(true)}
                onOpenToc={() => setIsIndexOpen(true)}
                publicationTitle={publicationTitle}
                showSearch={hasArticles}
                showHomeButton={canGoFirstScreen}
                showToc={hasArticles}
                onGoHome={goToFirstScreen}
              />
              {currentArticle ? (
                <div
                  className={`public-mobile-article-page ${pageSlideClass} ${isDraggingPage ? "public-mobile-article-page-dragging" : ""}`}
                  style={pageDragStyle}
                >
                  <ArticleCard
                    article={currentArticle}
                    className="mx-5 my-5"
                    fontAssets={fontAssets}
                    index={safeCurrentIndex}
                    onOpenArticleImage={setLightboxImage}
                    projectBodyFontAssetId={projectBodyFontAssetId}
                    projectTitleFontAssetId={projectTitleFontAssetId}
                    showAdminPreviewControls={showAdminPreviewControls}
                    showSurveyConnectionStatus={showSurveyConnectionStatus}
                    showTextSizeControl
                    slug={slug}
                    survey={currentArticle.surveyId ? surveyById.get(currentArticle.surveyId) ?? null : null}
                  />
                </div>
              ) : (
                <div className="mx-5 my-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-black text-[#092046]">등록된 기사가 없습니다.</p>
                </div>
              )}
            </>
          )}

          <nav
            className="fixed left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/60 bg-white/72 p-1 shadow-lg shadow-blue-950/15 backdrop-blur-md"
            style={{
              bottom: publicAudio ? "calc(5.75rem + env(safe-area-inset-bottom))" : "calc(0.75rem + env(safe-area-inset-bottom))",
            }}
            aria-label="기사 이동"
          >
            <div className="grid w-44 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-1">
              <button
                type="button"
                onClick={navigatePrevious}
                disabled={!canGoPrevious}
                className="dd-btn dd-btn-secondary h-9 rounded-full px-0 text-lg leading-none disabled:pointer-events-none disabled:opacity-35"
                aria-label={safeCurrentIndex === 0 && hasCoverPage ? "표지로 이동" : "이전 기사"}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setIsIndexOpen(true)}
                disabled={!hasArticles}
                className="h-9 rounded-full bg-[#092046]/82 px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#092046]"
                aria-label={isCoverView ? "표지" : `기사 목차 열기, 현재 ${safeCurrentIndex + 1} / ${orderedArticles.length}`}
              >
                {isCoverView ? "표지" : `${safeCurrentIndex + 1} / ${orderedArticles.length}`}
              </button>
              <button
                type="button"
                onClick={navigateNext}
                disabled={!canGoNext}
                className="dd-btn dd-btn-secondary h-9 rounded-full px-0 text-lg leading-none disabled:pointer-events-none disabled:opacity-35"
                aria-label={
                  isCoverView
                    ? "첫 기사로 이동"
                    : safeCurrentIndex >= orderedArticles.length - 1 && hasCoverPage
                      ? "표지로 이동"
                      : "다음 기사"
                }
              >
                ›
              </button>
            </div>
          </nav>

          {shouldShowFloatingPageControls ? (
            <>
              <div
                data-swipe-navigation-ignore
                className={`public-mobile-page-controls transition-opacity duration-200 ${pageControlsVisibilityClass}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigatePrevious();
                    revealPageControls();
                  }}
                  disabled={!canGoPrevious}
                  className="public-mobile-page-arrow public-mobile-page-arrow-left"
                  aria-label="이전 기사로 이동"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigateNext();
                    revealPageControls();
                  }}
                  disabled={!canGoNext}
                  className="public-mobile-page-arrow public-mobile-page-arrow-right"
                  aria-label="다음 기사로 이동"
                >
                  ›
                </button>
              </div>
            </>
          ) : null}

          {isIndexOpen && hasArticles ? (
            <div data-swipe-navigation-ignore className="fixed inset-0 z-[70] flex justify-center bg-slate-950/55 px-4 py-6">
              <section className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-950/30">
                <div className="border-b border-slate-200 bg-[#092046] px-5 py-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-sky-200">기사 목차</p>
                      <h2 className="mt-1 text-xl font-black">
                        {isCoverView ? "표지" : `${safeCurrentIndex + 1} / ${orderedArticles.length}`}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsIndexOpen(false)}
                      className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
                    >
                      닫기
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="mb-4">
                    <PublicTextSizeToggle compact />
                  </div>
                  {availableInterestTags.length > 0 ? <div className="mb-4">{compactInterestSelector}</div> : null}
                  <div className="space-y-2">
                    {hasCoverPage && cover ? (
                      <button
                        type="button"
                        aria-label="표지로 이동"
                        title="표지"
                        onClick={() => {
                          if (!isCoverView) {
                            goToCoverFromArticle();
                          }
                          setIsIndexOpen(false);
                        }}
                        className={`block min-w-0 w-full max-w-full rounded-2xl border px-4 py-3 text-left transition ${
                          isCoverView
                            ? "border-[#092046] bg-[#092046] text-white shadow-md"
                            : "border-slate-200 bg-white text-[#092046] hover:border-[#2f73b7]"
                        }`}
                      >
                        <span
                          data-public-text-scale-target="toc-meta"
                          className={`block min-w-0 max-w-full text-xs font-black ${isCoverView ? "text-sky-100" : "text-[#184a88]"}`}
                        >
                          표지
                        </span>
                        <span
                          data-public-text-scale-target="toc-title"
                          className="public-article-index-title mt-1 block min-w-0 max-w-full whitespace-normal text-sm font-black leading-6"
                        >
                          {cover.coverTitle || publicationTitle}
                        </span>
                      </button>
                    ) : null}
                    {orderedArticles.map((article, index) => {
                      const isActive = !isCoverView && index === safeCurrentIndex;
                      const articleTitle = getArticleTitle(article, index);
                      const originalTitle = article.title.trim() || `기사 ${index + 1}`;
                      const titleDescription =
                        articleTitle === originalTitle ? articleTitle : `${articleTitle} / 원문: ${originalTitle}`;

                      return (
                        <button
                          key={article.id}
                          type="button"
                          aria-label={`${index + 1}번 기사: ${titleDescription}`}
                          title={titleDescription}
                          onClick={() => {
                            goToArticle(index, { playSound: true });
                            setIsIndexOpen(false);
                          }}
                          className={`block min-w-0 w-full max-w-full rounded-2xl border px-4 py-3 text-left transition ${
                            isActive
                              ? "border-[#092046] bg-[#092046] text-white shadow-md"
                              : "border-slate-200 bg-[#f8fbff] text-[#092046] hover:border-[#2f73b7]"
                          }`}
                        >
                          <span
                            data-public-text-scale-target="toc-meta"
                            className={`block min-w-0 max-w-full text-xs font-black ${isActive ? "text-sky-100" : "text-[#184a88]"}`}
                          >
                            {index + 1} / {orderedArticles.length}
                          </span>
                          <span
                            data-public-text-scale-target="toc-title"
                            className="public-article-index-title mt-1 block min-w-0 max-w-full whitespace-normal text-sm font-black leading-6"
                          >
                            {articleTitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      ) : (
        <section className={`space-y-5 ${publicAudio ? "pb-[calc(9rem+env(safe-area-inset-bottom))]" : ""}`}>
          <PublicCompactPublicationHeader
            ebookDesktopHref={cover ? ebookDesktopHref : undefined}
            ebookLinkRel={cover ? ebookLinkRel : undefined}
            ebookLinkTarget={cover ? ebookLinkTarget : undefined}
            ebookMobileHref={cover ? ebookMobileHref : undefined}
            headerColor={headerColor}
            issue={issue}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenToc={() => setIsIndexOpen(true)}
            publicationTitle={publicationTitle}
            showSearch={hasArticles}
            showToc={hasArticles}
          />
          {cover ? (
            <PublicNewsletterCoverView
              {...cover}
              hasArticles={hasArticles}
              interestSelector={interestSelector}
              onOpenToc={() => setIsIndexOpen(true)}
              onStartReading={() => goToArticle(0, { playSound: true })}
              publicSurveyLinks={publicSurveyLinks}
              slug={slug}
            />
          ) : null}
          {orderedArticles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              fontAssets={fontAssets}
              index={index}
              onOpenArticleImage={setLightboxImage}
              projectBodyFontAssetId={projectBodyFontAssetId}
              projectTitleFontAssetId={projectTitleFontAssetId}
              showAdminPreviewControls={showAdminPreviewControls}
              showSurveyConnectionStatus={showSurveyConnectionStatus}
              slug={slug}
              survey={article.surveyId ? surveyById.get(article.surveyId) ?? null : null}
            />
          ))}
        </section>
      )}

      {isSearchOpen ? (
        <div data-swipe-navigation-ignore className="fixed inset-0 z-[75] flex justify-center bg-slate-950/55 px-3 py-6">
          <section className="box-border flex max-h-full w-full max-w-[520px] min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-950/30">
            <div className="border-b border-slate-200 bg-[#092046] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-sky-200">소식지에서 검색</p>
                  <h2 className="mt-1 text-xl font-black">모바일 기사 검색</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="dd-btn dd-btn-ghost dd-btn-sm text-xs"
                  aria-label="검색 닫기"
                >
                  닫기
                </button>
              </div>
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder="검색어 입력"
                className="mt-4 h-11 w-full rounded-xl border border-white/30 bg-white px-4 text-sm font-bold text-[#092046] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-white"
              />
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
              {!searchQuery.trim() ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-black text-slate-500">
                  검색어를 입력하세요.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-black text-slate-500">
                  검색 결과가 없습니다.
                </p>
              ) : (
                <div className="min-w-0 max-w-full overflow-hidden">
                  <p className="mb-3 text-xs font-black text-[#184a88]">검색 결과 {searchResults.length}건</p>
                  <div className="min-w-0 max-w-full space-y-2 overflow-hidden">
                    {searchResults.map((result) => (
                      <button
                        key={result.article.id}
                        type="button"
                        onClick={() => {
                          goToArticle(result.index, { playSound: true });
                          setIsSearchOpen(false);
                          window.setTimeout(scrollToReaderTop, 0);
                        }}
                        className="box-border block w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 py-3 text-left transition hover:border-[#2f73b7] hover:bg-white"
                        aria-label={`${result.title} 검색 결과로 이동`}
                      >
                        <span className="block max-w-full text-xs font-black text-[#184a88]">{result.index + 1} / {orderedArticles.length}</span>
                        <span className="mt-1 line-clamp-3 block max-w-full whitespace-normal text-sm font-black leading-6 text-[#092046] [line-break:strict] [overflow-wrap:anywhere] [word-break:keep-all]">
                          {result.title}
                        </span>
                        <span className="mt-1 line-clamp-3 block max-w-full whitespace-normal text-xs font-semibold leading-5 text-slate-600 [line-break:strict] [overflow-wrap:anywhere] [word-break:keep-all]">
                          {result.snippet}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {publicAudio ? (
        <PublicAudioTextSyncPlayer src={publicAudio.src} title={publicAudio.title} segments={activeAudioSegments} />
      ) : null}
      <PublicArticleImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  );
}
