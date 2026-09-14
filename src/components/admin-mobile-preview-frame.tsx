"use client";

import { useState } from "react";

const previewSizePresets = [
  { label: "소형", width: 360, height: 740 },
  { label: "일반", width: 390, height: 844 },
  { label: "대형", width: 430, height: 900 },
];

type AdminMobilePreviewFrameProps = {
  previewHref: string;
  title?: string;
  description?: string;
  iframeTitle?: string;
};

function appendEmbeddedPreviewParams(previewHref: string, previewVersion: number) {
  const separator = previewHref.includes("?") ? "&" : "?";

  return `${previewHref}${separator}embedded=adminPreview&previewReload=${previewVersion}`;
}

export function AdminMobilePreviewFrame({
  previewHref,
  title = "모바일 미리보기",
  description = "저장된 내용을 기준으로 표시됩니다. 최종 확인은 새 탭의 실제 공개 화면에서도 진행하세요.",
  iframeTitle = "저장된 모바일 소식지 미리보기",
}: AdminMobilePreviewFrameProps) {
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewSize, setPreviewSize] = useState(previewSizePresets[1]);
  const [isPopupBlocked, setIsPopupBlocked] = useState(false);
  const iframeSrc = appendEmbeddedPreviewParams(previewHref, previewVersion);
  const frameWidth = Math.min(previewSize.width + 56, 480);
  const frameHeight = Math.min(previewSize.height + 70, 920);

  function openLargePreviewWindow() {
    const previewWindow = window.open(iframeSrc, "_blank", "width=430,height=900,resizable=yes,scrollbars=yes");

    if (!previewWindow) {
      setIsPopupBlocked(true);
      return;
    }

    setIsPopupBlocked(false);
    previewWindow.focus();
  }

  return (
    <article className="admin-mobile-preview-panel rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장본 기준</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">{title}</h3>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setPreviewVersion((version) => version + 1)}
            className="rounded-lg border border-[#2f73b7] bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            미리보기 새로고침
          </button>
          <button
            type="button"
            onClick={openLargePreviewWindow}
            className="rounded-lg bg-[#092046] px-3 py-2 text-xs font-black text-white transition hover:bg-[#123a78]"
          >
            큰 창으로 보기
          </button>
        </div>
      </div>

      {isPopupBlocked ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
          팝업이 차단된 경우 브라우저 팝업 허용 후 다시 시도하거나 기존 새 탭 미리보기를 사용하세요.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-slate-500">프레임 크기</span>
        {previewSizePresets.map((preset) => {
          const isActive = previewSize.label === preset.label;

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setPreviewSize(preset)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                isActive
                  ? "bg-[#092046] text-white"
                  : "border border-slate-200 bg-white text-[#092046] hover:bg-[#eaf3ff]"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex justify-center overflow-x-auto pb-2">
        <div
          className="resize overflow-auto rounded-[34px] border border-slate-300 bg-slate-950 p-3 shadow-xl shadow-blue-950/20"
          style={{
            height: frameHeight,
            maxHeight: 920,
            maxWidth: "min(480px, 100%)",
            minHeight: 600,
            minWidth: 320,
            width: frameWidth,
          }}
        >
          <div className="flex h-full min-h-0 flex-col rounded-[26px] bg-slate-900 px-4 pb-3 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-16 shrink-0 rounded-full bg-slate-700" />
            <div className="mb-2 flex shrink-0 items-center justify-between text-[10px] font-bold text-slate-400">
              <span>9:41</span>
              <span>LTE · 100%</span>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-slate-800 bg-white">
              <iframe
                key={previewVersion}
                title={iframeTitle}
                src={iframeSrc}
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
