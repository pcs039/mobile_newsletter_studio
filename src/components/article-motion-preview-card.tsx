"use client";

import { useMemo, useState } from "react";
import type { ArticleMotionPreset, ArticleMotionSpeed } from "@/lib/newsletter-repository";

type ArticleMotionPreviewCardProps = {
  preset: ArticleMotionPreset;
  speed: ArticleMotionSpeed;
  summary: string;
  title: string;
};

type MotionTitleToken = {
  chars: Array<{ char: string; delayMs: number }>;
  token: string;
};

const fallbackTitle = "무안군, 첨단산업 기반 미래도시로 도약";
const fallbackSummary = "제목과 이미지, 버튼이 선택한 효과에 따라 표시됩니다.";

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

function makeMotionTitleTokens(title: string, speed: ArticleMotionSpeed): MotionTitleToken[] {
  const { characterDelayMs, maxDelayMs } = articleMotionSpeedSettings[speed];
  let characterIndex = 0;

  return title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({
      chars: Array.from(token).map((char) => {
        const delayMs = Math.min(characterIndex * characterDelayMs, maxDelayMs);
        characterIndex += 1;

        return { char, delayMs };
      }),
      token,
    }));
}

export function ArticleMotionPreviewCard({ preset, speed, summary, title }: ArticleMotionPreviewCardProps) {
  const [previewRun, setPreviewRun] = useState(0);
  const previewTitle = title.trim() || fallbackTitle;
  const previewSummary = summary.trim() || fallbackSummary;
  const shouldRenderCharacterMotion = characterTitleMotionPresets.has(preset);
  const titleTokens = useMemo(
    () => (shouldRenderCharacterMotion ? makeMotionTitleTokens(previewTitle, speed) : []),
    [previewTitle, shouldRenderCharacterMotion, speed],
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
          key={`${preset}-${speed}-${previewRun}`}
          className={`article-motion-preview-card ${articleMotionPresetClassNames[preset]} ${articleMotionSpeedClassNames[speed]} rounded-[1.35rem] border border-[#d8e8ff] bg-white p-4 shadow-lg shadow-blue-950/10`}
          data-motion-preset={preset}
          data-motion-speed={speed}
        >
          <div className="article-title-motion">
            <h4
              aria-label={previewTitle}
              className="text-xl font-black leading-tight text-[#092046]"
            >
              {shouldRenderCharacterMotion
                ? titleTokens.map((token, tokenIndex) => (
                    <span key={`${token.token}-${tokenIndex}`} className="article-title-motion-token" aria-hidden="true">
                      {token.chars.map((item, charIndex) => (
                        <span
                          key={`${token.token}-${charIndex}-${item.char}`}
                          className="article-title-motion-char"
                          style={{ animationDelay: `${item.delayMs}ms` }}
                        >
                          {item.char}
                        </span>
                      ))}
                      {tokenIndex < titleTokens.length - 1 ? "\u00A0" : null}
                    </span>
                  ))
                : previewTitle}
            </h4>
          </div>

          <p className="article-motion-summary mt-3 rounded-xl bg-[#f4f8ff] px-3 py-3 text-sm font-bold leading-6 text-[#092046]">
            {previewSummary}
          </p>

          <div className="article-motion-image mt-4 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-[#dceeff] via-white to-[#e8f7ff]">
            <div className="flex aspect-[16/9] items-center justify-center px-4 text-center">
              <div>
                <span className="inline-flex rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">
                  이미지 예시
                </span>
                <p className="mt-3 text-sm font-black text-[#184a88]">사진·포스터·지도 영역</p>
              </div>
            </div>
            <p className="article-motion-caption border-t border-slate-200 bg-white/85 px-3 py-2 text-xs font-bold leading-5 text-slate-600">
              이미지 설명 예시
            </p>
          </div>

          <div className="article-motion-content-block mt-4 rounded-xl border border-[#d8e8ff] bg-[#f7fbff] px-3 py-3">
            <p className="text-xs font-black text-[#184a88]">핵심 내용</p>
            <p className="mt-1 text-sm font-bold leading-6 text-[#092046]">
              핵심 내용이 카드 형태로 부드럽게 나타납니다.
            </p>
          </div>

          <button type="button" className="article-motion-link-button dd-btn dd-btn-primary dd-btn-sm mt-4 w-full">
            관련 링크 보기
          </button>
        </article>
      </div>
    </div>
  );
}
