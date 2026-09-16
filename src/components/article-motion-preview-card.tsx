"use client";

import { Fragment, useMemo, useState } from "react";
import { renderKoreanTitleWithBreaks, tokenizeKoreanTitleForBreaks } from "@/lib/korean-title-breaks";
import type {
  ArticleElementMotionEffect,
  ArticleElementMotionSpeed,
  ArticleMotionPreset,
  ArticleMotionSpeed,
} from "@/lib/newsletter-repository";

type ArticleMotionPreviewCardProps = {
  imageEffect: ArticleElementMotionEffect;
  imageSpeed: ArticleElementMotionSpeed;
  linkEffect: ArticleElementMotionEffect;
  linkSpeed: ArticleElementMotionSpeed;
  preset: ArticleMotionPreset;
  speed: ArticleMotionSpeed;
  summary: string;
  textBoxEffect: ArticleElementMotionEffect;
  textBoxSpeed: ArticleElementMotionSpeed;
  title: string;
  titleEffect: ArticleElementMotionEffect;
  titleSpeed: ArticleElementMotionSpeed;
};

type MotionTitleToken = {
  kind: "space";
  value: string;
} | {
  kind: "text";
  segments: Array<Array<{ char: string; delayMs: number }>>;
  value: string;
};

const fallbackTitle = "무안군, 첨단산업 기반 미래도시로 도약";
const fallbackSummary = "제목과 이미지, 버튼이 선택한 효과에 따라 표시됩니다.";

type ArticleMotionTarget = "title" | "textBox" | "image" | "link";

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

function makeMotionTitleTokens(title: string, speed: ArticleMotionSpeed): MotionTitleToken[] {
  const { characterDelayMs, maxDelayMs } = articleMotionSpeedSettings[speed];
  const tokens = tokenizeKoreanTitleForBreaks(title);
  let characterIndex = 0;

  return tokens.map((token) => {
    if (token.kind === "space") {
      return token;
    }

    return {
      kind: "text",
      segments: token.segments.map((segment) =>
        Array.from(segment).map((char) => {
          const delayMs = Math.min(characterIndex * characterDelayMs, maxDelayMs);
          characterIndex += 1;

          return { char, delayMs };
        }),
      ),
      value: token.value,
    };
  });
}

function resolveElementMotionEffect(
  value: ArticleElementMotionEffect,
  preset: ArticleMotionPreset,
  target: ArticleMotionTarget,
) {
  return value === "inherit" ? presetElementMotionEffects[preset][target] : value;
}

function resolveElementMotionSpeed(value: ArticleElementMotionSpeed, speed: ArticleMotionSpeed) {
  return value === "inherit" ? speed : value;
}

export function ArticleMotionPreviewCard({
  imageEffect,
  imageSpeed,
  linkEffect,
  linkSpeed,
  preset,
  speed,
  summary,
  textBoxEffect,
  textBoxSpeed,
  title,
  titleEffect,
  titleSpeed,
}: ArticleMotionPreviewCardProps) {
  const [previewRun, setPreviewRun] = useState(0);
  const previewTitle = title.trim() || fallbackTitle;
  const previewSummary = summary.trim() || fallbackSummary;
  const resolvedTitleEffect = resolveElementMotionEffect(titleEffect, preset, "title");
  const resolvedTitleSpeed = resolveElementMotionSpeed(titleSpeed, speed);
  const resolvedTextBoxEffect = resolveElementMotionEffect(textBoxEffect, preset, "textBox");
  const resolvedTextBoxSpeed = resolveElementMotionSpeed(textBoxSpeed, speed);
  const resolvedImageEffect = resolveElementMotionEffect(imageEffect, preset, "image");
  const resolvedImageSpeed = resolveElementMotionSpeed(imageSpeed, speed);
  const resolvedLinkEffect = resolveElementMotionEffect(linkEffect, preset, "link");
  const resolvedLinkSpeed = resolveElementMotionSpeed(linkSpeed, speed);
  const shouldRenderCharacterMotion = resolvedTitleEffect === "char_by_char";
  const titleTokens = useMemo(
    () => (shouldRenderCharacterMotion ? makeMotionTitleTokens(previewTitle, resolvedTitleSpeed) : []),
    [previewTitle, resolvedTitleSpeed, shouldRenderCharacterMotion],
  );

  return (
    <div className="rounded-xl border border-[#bfd8f7] bg-white p-4 shadow-sm shadow-blue-950/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">효과 미리보기</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">저장 전 선택한 효과를 확인합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewRun((currentRun) => currentRun + 1)}
          className="dd-btn dd-btn-secondary dd-btn-sm"
        >
          다시 보기
        </button>
      </div>

      <div className="public-mobile-article-reader overflow-hidden rounded-[1.65rem] border border-slate-200 bg-[#eef4fb] p-3">
        <article
          key={`${preset}-${speed}-${resolvedTitleEffect}-${resolvedTitleSpeed}-${resolvedTextBoxEffect}-${resolvedTextBoxSpeed}-${resolvedImageEffect}-${resolvedImageSpeed}-${resolvedLinkEffect}-${resolvedLinkSpeed}-${previewRun}`}
          className={`article-motion-preview-card ${articleMotionPresetClassNames[preset]} ${articleMotionSpeedClassNames[speed]} rounded-[1.35rem] border border-[#d8e8ff] bg-white p-4 shadow-lg shadow-blue-950/10`}
          data-motion-preset={preset}
          data-motion-speed={speed}
        >
          <div
            className={`article-title-motion ${articleMotionSpeedClassNames[resolvedTitleSpeed]}`}
            data-motion-effect={resolvedTitleEffect}
            data-motion-speed={resolvedTitleSpeed}
          >
            <h4
              aria-label={previewTitle}
              title={previewTitle}
              className="whitespace-pre-wrap text-xl font-black leading-tight text-[#092046] [line-break:strict] [overflow-wrap:anywhere] [text-wrap:balance]"
            >
              {shouldRenderCharacterMotion
                ? titleTokens.map((token, tokenIndex) => {
                    if (token.kind === "space") {
                      return token.value;
                    }

                    return (
                      <span key={`${token.value}-${tokenIndex}`} className="article-title-motion-token" aria-hidden="true">
                        {token.segments.map((segment, segmentIndex) => (
                          <Fragment key={`${token.value}-${tokenIndex}-${segmentIndex}`}>
                            {segment.map((item, charIndex) => (
                              <span
                                key={`${token.value}-${segmentIndex}-${charIndex}-${item.char}`}
                                className="article-title-motion-char"
                                style={{ animationDelay: `${item.delayMs}ms` }}
                              >
                                {item.char}
                              </span>
                            ))}
                            {segmentIndex < token.segments.length - 1 ? <wbr /> : null}
                          </Fragment>
                        ))}
                      </span>
                    );
                  })
                : renderKoreanTitleWithBreaks(previewTitle)}
            </h4>
          </div>

          <p
            className={`article-motion-summary ${articleMotionSpeedClassNames[resolvedTextBoxSpeed]} mt-3 rounded-xl bg-[#f4f8ff] px-3 py-3 text-sm font-bold leading-6 text-[#092046]`}
            data-motion-effect={resolvedTextBoxEffect}
            data-motion-speed={resolvedTextBoxSpeed}
          >
            {previewSummary}
          </p>

          <div
            className={`article-motion-image ${articleMotionSpeedClassNames[resolvedImageSpeed]} mt-4 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-[#dceeff] via-white to-[#e8f7ff]`}
            data-motion-effect={resolvedImageEffect}
            data-motion-speed={resolvedImageSpeed}
          >
            <div className="flex aspect-[16/9] items-center justify-center px-4 text-center">
              <div>
                <span className="inline-flex rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">
                  이미지 예시
                </span>
                <p className="mt-3 text-sm font-black text-[#184a88]">사진·포스터·지도 영역</p>
              </div>
            </div>
            <p
              className={`article-motion-caption ${articleMotionSpeedClassNames[resolvedImageSpeed]} border-t border-slate-200 bg-white/85 px-3 py-2 text-xs font-bold leading-5 text-slate-600`}
              data-motion-effect={resolvedImageEffect}
              data-motion-speed={resolvedImageSpeed}
            >
              이미지 설명 예시
            </p>
          </div>

          <div
            className={`article-motion-content-block ${articleMotionSpeedClassNames[resolvedTextBoxSpeed]} mt-4 rounded-xl border border-[#d8e8ff] bg-[#f7fbff] px-3 py-3`}
            data-motion-effect={resolvedTextBoxEffect}
            data-motion-speed={resolvedTextBoxSpeed}
          >
            <p className="text-xs font-black text-[#184a88]">핵심 내용</p>
            <p className="mt-1 text-sm font-bold leading-6 text-[#092046]">
              핵심 내용이 카드 형태로 부드럽게 나타납니다.
            </p>
          </div>

          <button
            type="button"
            className={`article-motion-link-button ${articleMotionSpeedClassNames[resolvedLinkSpeed]} dd-btn dd-btn-primary dd-btn-sm mt-4 w-full`}
            data-motion-effect={resolvedLinkEffect}
            data-motion-speed={resolvedLinkSpeed}
          >
            관련 링크 보기
          </button>
        </article>
      </div>
    </div>
  );
}
