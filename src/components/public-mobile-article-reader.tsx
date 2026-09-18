"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type TouchEvent } from "react";
import { PublicArticleImageLightbox, type PublicArticleLightboxImage } from "@/components/public-article-image-lightbox";
import { PublicAudioTextSyncPlayer } from "@/components/public-audio-text-sync-player";
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
import type {
  ArticleElementMotionEffect,
  ArticleElementMotionSpeed,
  ArticleMotionPreset,
  ArticleMotionSpeed,
  FontAsset,
  ProjectContentArticle,
  ProjectContentBlock,
} from "@/lib/newsletter-repository";
import { getArticleLinkButtonLabel, getValidArticleUrl } from "@/lib/public-article-url";

type PublicMobileArticleReaderProps = {
  articles: ProjectContentArticle[];
  fontAssets?: FontAsset[];
  initialArticleId?: string | null;
  projectBodyFontAssetId?: string | null;
  projectTitleFontAssetId?: string | null;
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
const swipeThreshold = 50;
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
  return getDisplayArticleTitle(article, `기사 ${index + 1}`);
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
          className={`article-motion-content-block ${articleMotionSpeedClassNames[motionSettings.textBox.speed]} overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm`}
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
          className={`article-motion-content-block ${articleMotionSpeedClassNames[motionSettings.textBox.speed]} block rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-4`}
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
          className={`article-motion-link-button ${articleMotionSpeedClassNames[motionSettings.link.speed]} dd-btn dd-btn-primary block rounded-xl px-4 py-3 text-center text-sm font-black`}
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

function ArticleCard({
  article,
  className = "",
  fontAssets,
  index,
  onOpenArticleImage,
  projectBodyFontAssetId,
  projectTitleFontAssetId,
  showAdminPreviewControls,
  slug,
}: {
  article: ProjectContentArticle;
  className?: string;
  fontAssets: FontAsset[];
  index: number;
  onOpenArticleImage: (image: PublicArticleLightboxImage) => void;
  projectBodyFontAssetId?: string | null;
  projectTitleFontAssetId?: string | null;
  showAdminPreviewControls: boolean;
  slug: string;
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
      <div
        key={`article-title-${article.id}-${motionPreset}-${motionSpeed}-${motionSettings.title.effect}-${motionSettings.title.speed}`}
        className={`article-title-motion ${articleMotionSpeedClassNames[motionSettings.title.speed]}`}
        data-motion-effect={motionSettings.title.effect}
        data-motion-speed={motionSettings.title.speed}
      >
        <h2
          aria-label={articleTitle}
          data-audio-segment-id={makeArticleTitleSegmentId(article.id)}
          data-public-text-scale-target="article-title"
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
      {article.summary ? (
        <ScrollMotionReveal
          motionEffect={motionSettings.textBox.effect}
          motionSpeed={motionSettings.textBox.speed}
        >
          <p
            data-audio-segment-id={makeArticleSummarySegmentId(article.id)}
            data-public-text-scale-target="article-summary"
            className={`article-motion-summary ${articleMotionSpeedClassNames[motionSettings.textBox.speed]} public-audio-sync-segment mt-3 rounded-xl bg-[#f4f8ff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]`}
            data-motion-effect={motionSettings.textBox.effect}
            data-motion-speed={motionSettings.textBox.speed}
          >
            {article.summary}
          </p>
        </ScrollMotionReveal>
      ) : null}
      {article.audioFile?.previewHref ? (
        <section className="mt-5 rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] p-4">
          <p className="text-sm font-black text-[#092046]">음성으로 듣기</p>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-600">이 기사를 음성으로 들을 수 있습니다.</p>
          <audio
            aria-label={`${articleTitle} 음성으로 듣기`}
            className="mt-3 h-10 w-full rounded-md"
            controls
            preload="metadata"
            src={article.audioFile.previewHref}
          />
          {article.audioFile.transcriptText ? (
            <details className="mt-3 rounded-xl border border-[#d8e7fb] bg-white px-3 py-2">
              <summary className="cursor-pointer text-sm font-black text-[#092046]">음성 대본 보기</summary>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                음성 파일 제작에 사용된 낭독문입니다.
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-800">
                {article.audioFile.transcriptText}
              </p>
            </details>
          ) : null}
        </section>
      ) : null}
      {visibleBlocks.length > 0 ? (
        <div className="public-article-content mt-6 space-y-6">
          {visibleBlocks.map((block) => renderContentBlock(article, block, motionSettings, onOpenArticleImage))}
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
  fontAssets = [],
  initialArticleId,
  projectBodyFontAssetId,
  projectTitleFontAssetId,
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
              fontAssets={fontAssets}
              index={safeCurrentIndex}
              onOpenArticleImage={setLightboxImage}
              projectBodyFontAssetId={projectBodyFontAssetId}
              projectTitleFontAssetId={projectTitleFontAssetId}
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
                            goToArticle(index);
                            setIsIndexOpen(false);
                          }}
                          className={`block min-w-0 w-full max-w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                            isActive
                              ? "border-[#092046] bg-[#092046] text-white shadow-md"
                              : "border-slate-200 bg-[#f8fbff] text-[#092046] hover:border-[#2f73b7]"
                          }`}
                        >
                          <span className={`text-xs font-black ${isActive ? "text-sky-100" : "text-[#184a88]"}`}>
                            {index + 1} / {articles.length}
                          </span>
                          <span className="public-article-index-title mt-1 block min-w-0 max-w-full overflow-hidden text-sm font-black leading-6">
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
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              fontAssets={fontAssets}
              index={index}
              onOpenArticleImage={setLightboxImage}
              projectBodyFontAssetId={projectBodyFontAssetId}
              projectTitleFontAssetId={projectTitleFontAssetId}
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
