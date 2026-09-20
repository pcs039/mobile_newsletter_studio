"use client";

import type { useEbookTts } from "@/hooks/use-ebook-tts";

type EbookTtsControls = ReturnType<typeof useEbookTts>;

type EbookTtsPanelProps = {
  onClose?: () => void;
  title?: string;
  tts: EbookTtsControls;
  variant: "desktop" | "mobile";
};

function formatRateLabel(rate: number) {
  return Number.isInteger(rate) ? `${rate.toFixed(1)}x` : `${rate}x`;
}

export function EbookTtsPanel({ onClose, title = "읽어주기", tts, variant }: EbookTtsPanelProps) {
  const isCompact = variant === "mobile";
  const currentPageLabel = tts.currentSpeakingPage ? `${tts.currentSpeakingPage.pageNumber}쪽` : "현재 페이지";

  return (
    <section
      className={
        isCompact
          ? "relative z-10 mx-auto flex max-h-[78dvh] w-full max-w-[520px] min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-950/30"
          : "fixed right-4 top-20 z-[70] w-[min(380px,calc(100vw-2rem))] max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-blue-950/30"
      }
      aria-label="e-book 읽어주기"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#092046] px-5 py-4 text-white">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-sky-200">Text to Speech</p>
          <h2 className="mt-1 text-lg font-black">{title}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-300">현재 {currentPageLabel}</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="dd-btn dd-btn-ghost dd-btn-sm text-xs">
            닫기
          </button>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        {!tts.isSupported ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
            이 브라우저에서는 읽어주기를 지원하지 않습니다.
          </p>
        ) : null}

        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700" aria-live="polite">
          {tts.message || "페이지 텍스트를 음성으로 읽습니다."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {tts.status === "paused" ? (
            <button
              type="button"
              onClick={tts.resume}
              disabled={!tts.isSupported}
              className="dd-btn dd-btn-primary dd-btn-sm min-h-11 justify-center rounded-xl text-xs"
              aria-label="읽기 계속"
            >
              ▶ 계속
            </button>
          ) : (
            <button
              type="button"
              onClick={tts.playCurrentPage}
              disabled={!tts.canPlayCurrentPage}
              className="dd-btn dd-btn-primary dd-btn-sm min-h-11 justify-center rounded-xl text-xs"
              aria-label="읽기 시작"
            >
              {tts.currentPageTextState === "loading" ? "텍스트 준비 중" : "▶ 읽기 시작"}
            </button>
          )}
          <button
            type="button"
            onClick={tts.pause}
            disabled={!tts.isSupported || tts.status !== "playing"}
            className="dd-btn dd-btn-secondary dd-btn-sm min-h-11 justify-center rounded-xl text-xs"
            aria-label="일시정지"
          >
            ⏸ 일시정지
          </button>
          <button
            type="button"
            onClick={() => tts.cancel("읽기를 중지했습니다.")}
            disabled={!tts.isSupported || tts.status === "idle"}
            className="dd-btn dd-btn-danger dd-btn-sm min-h-11 justify-center rounded-xl text-xs"
            aria-label="읽기 중지"
          >
            ■ 정지
          </button>
          <button
            type="button"
            onClick={() => tts.setAutoAdvance(!tts.autoAdvance)}
            className={`dd-btn dd-btn-sm min-h-11 justify-center rounded-xl text-xs ${tts.autoAdvance ? "dd-btn-primary" : "dd-btn-secondary"}`}
            aria-pressed={tts.autoAdvance}
          >
            자동 다음 {tts.autoAdvance ? "ON" : "OFF"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={tts.readPreviousPage}
            disabled={!tts.isSupported || !tts.canReadPrevious}
            className="dd-btn dd-btn-secondary dd-btn-sm min-h-11 justify-center rounded-xl text-xs disabled:pointer-events-none disabled:opacity-40"
            aria-label="이전 페이지 읽기"
          >
            ◀ 이전 페이지
          </button>
          <button
            type="button"
            onClick={tts.readNextPage}
            disabled={!tts.isSupported || !tts.canReadNext}
            className="dd-btn dd-btn-secondary dd-btn-sm min-h-11 justify-center rounded-xl text-xs disabled:pointer-events-none disabled:opacity-40"
            aria-label="다음 페이지 읽기"
          >
            다음 페이지 ▶
          </button>
        </div>

        <label className="block text-sm font-black text-[#092046]" htmlFor={`ebook-tts-rate-${variant}`}>
          읽기 속도
        </label>
        <select
          id={`ebook-tts-rate-${variant}`}
          value={tts.rate}
          onChange={(event) => tts.setRate(Number(event.target.value))}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none focus:ring-2 focus:ring-[#2f73b7]"
          aria-label="읽기 속도"
        >
          {tts.rates.map((rate) => (
            <option key={rate} value={rate}>
              {formatRateLabel(rate)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
