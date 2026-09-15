"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type TouchEvent } from "react";
import { PublicArticleImageLightbox, type PublicArticleLightboxImage } from "@/components/public-article-image-lightbox";
import { PublicAudioTextSyncPlayer } from "@/components/public-audio-text-sync-player";
import {
  buildAudioTextSegmentCandidates,
  getArticleBodyParagraphs,
  makeArticleBodySegmentId,
  makeArticleSummarySegmentId,
  makeArticleTitleSegmentId,
} from "@/lib/audio-text-sync";
import type {
  ArticleMotionPreset,
  ArticleMotionSpeed,
  ProjectContentArticle,
  ProjectContentBlock,
} from "@/lib/newsletter-repository";
import { getArticleLinkButtonLabel, getValidArticleUrl } from "@/lib/public-article-url";

type PublicMobileArticleReaderProps = {
  articles: ProjectContentArticle[];
  initialArticleId?: string | null;
  publicAudio?: {
    src: string;
    title?: string;
  };
  showAdminPreviewControls: boolean;
  slug: string;
};

type SwipeStart = {
  x: number;
  y: number;
} | null;

const mobileReaderQuery = "(max-width: 767px)";
const swipeThreshold = 50;
const openingTitlePunctuation = new Set(["‘", "“", "'", "\"", "(", "[", "{"]);
const closingTitlePunctuation = new Set(["’", "”", ")", "]", "}"]);
const characterTitleMotionPresets = new Set<ArticleMotionPreset>(["promotion", "dynamic"]);
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
  slow: { characterDelayMs: 30, maxDelayMs: 700 },
  normal: { characterDelayMs: 22, maxDelayMs: 520 },
  fast: { characterDelayMs: 14, maxDelayMs: 360 },
};

function subscribeToMobileReader(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(mobileReaderQuery);

  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function readMobileReaderSnapshot() {
  return window.matchMedia(mobileReaderQuery).matches;
}

function getPreviewBody(article: ProjectContentArticle) {
  const body = article.body.trim();

  if (!body) {
    return "본문이 아직 입력되지 않았습니다.";
  }

  return body;
}

function renderArticleBody(value: string, className: string, audioSegmentBaseId?: string) {
  const paragraphs = getArticleBodyParagraphs(value);

  return (
    <div data-public-text-scale-target="article-body" className={`public-article-body text-base leading-8 text-slate-700 ${className}`}>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <div key={paragraphIndex} className="public-article-paragraph">
          {paragraph.map((sentence, sentenceIndex) => {
            const segmentId = audioSegmentBaseId
              ? makeArticleBodySegmentId(audioSegmentBaseId, paragraphIndex, sentenceIndex)
              : undefined;

            return (
              <span
                key={`${paragraphIndex}-${sentenceIndex}`}
                data-audio-segment-id={segmentId}
                className="public-article-sentence public-audio-sync-segment"
              >
                {sentence}
              </span>
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
  return article.title.trim() || `기사 ${index + 1}`;
}

function normalizeArticleMotionPreset(value: string | null | undefined): ArticleMotionPreset {
  const allowed: ArticleMotionPreset[] = ["none", "calm", "image_focus", "promotion", "dynamic"];

  return allowed.includes(value as ArticleMotionPreset) ? (value as ArticleMotionPreset) : "dynamic";
}

function normalizeArticleMotionSpeed(value: string | null | undefined): ArticleMotionSpeed {
  const allowed: ArticleMotionSpeed[] = ["slow", "normal", "fast"];

  return allowed.includes(value as ArticleMotionSpeed) ? (value as ArticleMotionSpeed) : "normal";
}

function getArticleTitleMotionTokens(title: string, motionSpeed: ArticleMotionSpeed) {
  const rawTokens = title.trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  let pendingPrefix = "";
  const speedSettings = articleMotionSpeedSettings[motionSpeed];

  rawTokens.forEach((rawToken) => {
    let token = rawToken;
    const firstCharacter = Array.from(token)[0];
    const isSingleOpeningPunctuation = Array.from(token).length === 1 && openingTitlePunctuation.has(token);
    const shouldAttachToPrevious = firstCharacter ? closingTitlePunctuation.has(firstCharacter) : false;

    if (isSingleOpeningPunctuation) {
      pendingPrefix += token;
      return;
    }

    if (pendingPrefix) {
      token = `${pendingPrefix}${token}`;
      pendingPrefix = "";
    }

    if (shouldAttachToPrevious && tokens.length > 0) {
      tokens[tokens.length - 1] = `${tokens[tokens.length - 1]}${token}`;
      return;
    }

    tokens.push(token);
  });

  if (pendingPrefix) {
    tokens.push(pendingPrefix);
  }

  let characterIndex = 0;

  return tokens.map((token) => ({
    characters: Array.from(token).map((character) => {
      const delay = Math.min(characterIndex * speedSettings.characterDelayMs, speedSettings.maxDelayMs);

      characterIndex += 1;

      return { character, delay };
    }),
    token,
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
  onOpenArticleImage: (image: PublicArticleLightboxImage) => void,
) {
  const link = getBlockLink(article, block);
  const rawHref = link?.targetValue || block.body;

  if (block.type === "paragraph") {
    return (
      <section key={block.id}>
        {block.title ? <h3 className="text-base font-black leading-7 text-[#092046]">{block.title}</h3> : null}
        {block.body ? renderArticleBody(block.body, "mt-3", `article-${article.id}-block-${block.id}`) : null}
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
      <figure key={block.id} className="article-motion-image overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
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
          <figcaption className="article-motion-caption px-4 py-3 text-sm font-bold leading-6 text-slate-700">
            {block.title}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (block.type === "video_link") {
    const href = getValidArticleUrl(rawHref);
    const youtubeId = href ? getYoutubeId(href) : "";

    if (!href || !youtubeId) {
      return null;
    }

    return (
      <section
        key={block.id}
        className="article-motion-content-block overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm"
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
    );
  }

  if (block.type === "map_link") {
    const href = getValidArticleUrl(rawHref);

    if (!href) {
      return null;
    }

    return (
      <a
        key={block.id}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="article-motion-content-block block rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-4"
      >
        <p className="text-xs font-black text-[#184a88]">지도 보기</p>
        <p className="mt-1 text-base font-black leading-7 text-[#092046]">{block.title || link?.label || "위치 확인"}</p>
      </a>
    );
  }

  if (block.type === "button_group") {
    const href = getValidArticleUrl(rawHref);

    if (!href) {
      return null;
    }

    return (
      <a
        key={block.id}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="article-motion-link-button dd-btn dd-btn-primary block rounded-xl px-4 py-3 text-center text-sm font-black"
      >
        {getArticleLinkButtonLabel(block.title || link?.label)}
      </a>
    );
  }

  if (block.type === "audio") {
    return (
      <details key={block.id} className="article-motion-content-block rounded-xl bg-[#f4f8ff] px-4 py-3">
        <summary className="cursor-pointer text-sm font-black text-[#092046]">{block.title || "음성 대본 보기"}</summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{block.body}</p>
      </details>
    );
  }

  return null;
}

function ArticleCard({
  article,
  className = "",
  index,
  onOpenArticleImage,
  showAdminPreviewControls,
  slug,
}: {
  article: ProjectContentArticle;
  className?: string;
  index: number;
  onOpenArticleImage: (image: PublicArticleLightboxImage) => void;
  showAdminPreviewControls: boolean;
  slug: string;
}) {
  const visibleBlocks = getVisibleBlocks(article);
  const articleTitle = getArticleTitle(article, index);
  const motionPreset = normalizeArticleMotionPreset(article.motionPreset);
  const motionSpeed = normalizeArticleMotionSpeed(article.motionSpeed);
  const shouldRenderCharacterTitleMotion = characterTitleMotionPresets.has(motionPreset);
  const titleMotionTokens = shouldRenderCharacterTitleMotion ? getArticleTitleMotionTokens(articleTitle, motionSpeed) : [];

  return (
    <article
      className={`public-card public-article-card ${articleMotionPresetClassNames[motionPreset]} ${articleMotionSpeedClassNames[motionSpeed]} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      data-motion-preset={motionPreset}
      data-motion-speed={motionSpeed}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black text-[#184a88]">
          {article.pageNumber ? `${article.pageNumber}쪽` : `${index + 1}번 기사`}
        </p>
        {showAdminPreviewControls ? (
          <Link
            href={`/projects/${slug}/reading?articleId=${article.id}`}
            className="dd-btn dd-btn-secondary dd-btn-sm rounded-full text-xs"
          >
            수정
          </Link>
        ) : null}
      </div>
      <div key={`article-title-${article.id}-${motionPreset}-${motionSpeed}`} className="article-title-motion">
        <h2
          aria-label={articleTitle}
          data-audio-segment-id={makeArticleTitleSegmentId(article.id)}
          data-public-text-scale-target="article-title"
          className="public-article-title public-audio-sync-segment text-2xl font-black leading-tight text-[#092046]"
        >
          {shouldRenderCharacterTitleMotion
            ? titleMotionTokens.map((token, tokenIndex) => (
                <span key={`${token.token}-${tokenIndex}`} className="article-title-motion-token" aria-hidden="true">
                  {token.characters.map(({ character, delay }, characterIndex) => (
                    <span
                      key={`${character}-${tokenIndex}-${characterIndex}`}
                      className="article-title-motion-char"
                      style={{ animationDelay: `${delay}ms` }}
                    >
                      {character}
                    </span>
                  ))}
                  {tokenIndex < titleMotionTokens.length - 1 ? "\u00A0" : null}
                </span>
              ))
            : articleTitle}
        </h2>
      </div>
      {article.summary ? (
        <p
          data-audio-segment-id={makeArticleSummarySegmentId(article.id)}
          data-public-text-scale-target="article-summary"
          className="article-motion-summary public-audio-sync-segment mt-3 rounded-xl bg-[#f4f8ff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]"
        >
          {article.summary}
        </p>
      ) : null}
      {visibleBlocks.length > 0 ? (
        <div className="public-article-content mt-6 space-y-6">
          {visibleBlocks.map((block) => renderContentBlock(article, block, onOpenArticleImage))}
        </div>
      ) : (
        renderArticleBody(getPreviewBody(article), "mt-6", `article-${article.id}-body`)
      )}
      {article.contactName || article.contactPhone ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          <p className="text-xs font-black text-[#184a88]">문의</p>
          <p className="mt-1 font-bold">
            {[article.contactName, article.contactPhone].filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : null}
    </article>
  );
}

export function PublicMobileArticleReader({
  articles,
  initialArticleId,
  publicAudio,
  showAdminPreviewControls,
  slug,
}: PublicMobileArticleReaderProps) {
  const isMobileReader = useSyncExternalStore(subscribeToMobileReader, readMobileReaderSnapshot, () => false);
  const [currentIndex, setCurrentIndex] = useState(() => getInitialArticleIndex(articles, initialArticleId));
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<PublicArticleLightboxImage | null>(null);
  const articleTopRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<SwipeStart>(null);
  const safeCurrentIndex = Math.min(currentIndex, Math.max(articles.length - 1, 0));
  const currentArticle = articles[safeCurrentIndex] ?? null;
  const canGoPrevious = safeCurrentIndex > 0;
  const canGoNext = safeCurrentIndex < articles.length - 1;
  const activeAudioSegments = useMemo(() => {
    if (!isMobileReader || !currentArticle) {
      return buildAudioTextSegmentCandidates(articles);
    }

    return buildAudioTextSegmentCandidates([currentArticle]);
  }, [articles, currentArticle, isMobileReader]);

  useEffect(() => {
    if (!isMobileReader) {
      return;
    }

    articleTopRef.current?.scrollIntoView({ block: "start" });
  }, [isMobileReader, safeCurrentIndex]);

  function goToArticle(nextIndex: number) {
    setCurrentIndex(Math.min(Math.max(nextIndex, 0), articles.length - 1));
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = swipeStartRef.current;
    const touch = event.changedTouches[0];

    swipeStartRef.current = null;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
      return;
    }

    if (deltaX < 0 && canGoNext) {
      goToArticle(safeCurrentIndex + 1);
    }

    if (deltaX > 0 && canGoPrevious) {
      goToArticle(safeCurrentIndex - 1);
    }
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <>
      {isMobileReader ? (
        <section
          className={`public-mobile-article-reader -mx-1 ${publicAudio ? "pb-[calc(11rem+env(safe-area-inset-bottom))]" : "pb-[calc(4rem+env(safe-area-inset-bottom))]"}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div ref={articleTopRef} className="mb-3 rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[#184a88]">기사 보기</p>
                <p className="mt-0.5 text-sm font-black text-[#092046]">좌우로 넘겨 읽을 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsIndexOpen(true)}
                className="dd-btn dd-btn-secondary dd-btn-sm rounded-full text-xs"
              >
                목차
              </button>
            </div>
          </div>

          {currentArticle ? (
            <ArticleCard
              article={currentArticle}
              index={safeCurrentIndex}
              onOpenArticleImage={setLightboxImage}
              showAdminPreviewControls={showAdminPreviewControls}
              slug={slug}
            />
          ) : null}

          <nav
            className={`sticky z-30 mt-3 rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-lg shadow-blue-950/10 backdrop-blur ${
              publicAudio ? "bottom-[calc(7.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]"
            }`}
            aria-label="기사 이동"
          >
            <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-1.5">
              <button
                type="button"
                onClick={() => goToArticle(safeCurrentIndex - 1)}
                disabled={!canGoPrevious}
                className="dd-btn dd-btn-secondary h-10 rounded-full px-0 text-lg leading-none"
                aria-label="이전 기사"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setIsIndexOpen(true)}
                className="dd-btn dd-btn-primary h-10 rounded-full px-3 text-sm"
              >
                목차 · {safeCurrentIndex + 1} / {articles.length}
              </button>
              <button
                type="button"
                onClick={() => goToArticle(safeCurrentIndex + 1)}
                disabled={!canGoNext}
                className="dd-btn dd-btn-secondary h-10 rounded-full px-0 text-lg leading-none"
                aria-label="다음 기사"
              >
                ›
              </button>
            </div>
          </nav>

          {isIndexOpen ? (
            <div className="fixed inset-0 z-[70] flex justify-center bg-slate-950/55 px-4 py-6">
              <section className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-950/30">
                <div className="border-b border-slate-200 bg-[#092046] px-5 py-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-sky-200">기사 목차</p>
                      <h2 className="mt-1 text-xl font-black">
                        {safeCurrentIndex + 1} / {articles.length}
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
                  <div className="space-y-2">
                    {articles.map((article, index) => {
                      const isActive = index === safeCurrentIndex;

                      return (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => {
                            goToArticle(index);
                            setIsIndexOpen(false);
                          }}
                          className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                            isActive
                              ? "border-[#092046] bg-[#092046] text-white shadow-md"
                              : "border-slate-200 bg-[#f8fbff] text-[#092046] hover:border-[#2f73b7]"
                          }`}
                        >
                          <span className={`text-xs font-black ${isActive ? "text-sky-100" : "text-[#184a88]"}`}>
                            {index + 1} / {articles.length}
                          </span>
                          <span className="mt-1 block text-sm font-black leading-6">{getArticleTitle(article, index)}</span>
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
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              index={index}
              onOpenArticleImage={setLightboxImage}
              showAdminPreviewControls={showAdminPreviewControls}
              slug={slug}
            />
          ))}
        </section>
      )}

      {publicAudio ? (
        <PublicAudioTextSyncPlayer src={publicAudio.src} title={publicAudio.title} segments={activeAudioSegments} />
      ) : null}
      <PublicArticleImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  );
}
