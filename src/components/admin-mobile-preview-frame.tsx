"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { previewArticleContext, previewAudioNotice, readPreviewArticleMessage } from "@/lib/admin-article-preview";

const previewSizePresets = [
  { label: "소형", width: 360, height: 740 },
  { label: "일반", width: 390, height: 844 },
  { label: "대형", width: 430, height: 900 },
];

type AdminMobilePreviewFrameProps = {
  articleIds?: string[];
  allowCollapse?: boolean;
  previewHref: string;
  title?: string;
  description?: string;
  iframeTitle?: string;
};

function appendEmbeddedPreviewParams(previewHref: string, previewVersion: number, channel: string) {
  const separator = previewHref.includes("?") ? "&" : "?";

  return `${previewHref}${separator}embedded=adminPreview&previewReload=${previewVersion}&previewChannel=${encodeURIComponent(channel)}`;
}

export function AdminMobilePreviewFrame({
  articleIds = [],
  allowCollapse = true,
  previewHref,
  title = "모바일 미리보기",
  description = "저장된 내용을 기준으로 표시됩니다. 최종 확인은 새 탭의 실제 공개 화면에서도 진행하세요.",
  iframeTitle = "저장된 모바일 소식지 미리보기",
}: AdminMobilePreviewFrameProps) {
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewSize, setPreviewSize] = useState(previewSizePresets[1]);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const context = useMemo(() => previewArticleContext(previewHref), [previewHref]);
  const bridgeId = useId();
  const channel = `${bridgeId}:${previewVersion}:${context?.articleId ?? "all"}`;
  const scope = `${previewHref}:${channel}`;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [seen, setSeen] = useState<{ scope: string; articleId: string | null } | null>(null);
  const currentId = seen?.scope === scope ? seen.articleId : context?.articleId ?? null;
  const validCurrentId = currentId && articleIds.includes(currentId) ? currentId : null;
  const currentPreviewHref = context
    ? `/newsletters/${encodeURIComponent(context.project)}?preview=admin${validCurrentId ? `&articleId=${validCurrentId}` : ""}` : previewHref;
  const iframeSrc = appendEmbeddedPreviewParams(previewHref, previewVersion, channel);
  const frameWidth = Math.min(previewSize.width + 56, 480);
  const frameHeight = Math.min(previewSize.height + 70, 920);
  const frameContainerRef = useRef<HTMLDivElement>(null);
  const [compactWidth, setCompactWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!context || !isPreviewExpanded) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const message = readPreviewArticleMessage(event.data, context!.project, channel, articleIds);
      if (message) setSeen({ scope, articleId: message.articleId });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [context, channel, scope, articleIds, isPreviewExpanded]);

  useEffect(() => {
    const container = frameContainerRef.current;
    if (!container || !isPreviewExpanded) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const measure = () => setCompactWidth(desktop.matches ? null : container.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    desktop.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", measure);
    };
  }, [isPreviewExpanded]);

  // Scale the shell, not the iframe viewport: article layout retains the selected
  // phone width even when the administrator's screen is narrower than the phone.
  const compactScale = compactWidth === null ? 1 : Math.min(1, compactWidth / frameWidth);
  const compactHeight = Math.min(frameHeight, 780);

  return (
    <article className="admin-mobile-preview-panel min-w-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm md:p-4 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장본 기준</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">{title}</h3>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{description}</p>
          {context ? <p className="mt-2 text-xs leading-5 text-slate-500">{previewAudioNotice}</p> : null}
          {context ? <p className="mt-1 text-xs leading-5 text-slate-500">현재 기사 편집은 새 창에서 열어 기존 편집 입력을 유지합니다.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {allowCollapse ? (
            <button
              type="button"
              onClick={() => setIsPreviewExpanded((currentValue) => !currentValue)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              aria-expanded={isPreviewExpanded}
            >
              {isPreviewExpanded ? "접기" : "펼치기"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPreviewVersion((version) => version + 1)}
            className="rounded-lg border border-[#2f73b7] bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            미리보기 새로고침
          </button>
          <a
            href={currentPreviewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#092046] px-3 py-2 text-xs font-black text-white transition hover:bg-[#123a78]"
          >
            큰 창으로 보기
          </a>
          {context && validCurrentId ? <Link href={`/projects/${encodeURIComponent(context.project)}/reading?articleId=${validCurrentId}`} target="_blank" rel="noopener noreferrer" className="dd-btn dd-btn-secondary dd-btn-sm">현재 기사 편집</Link> : null}
        </div>
      </div>

      {isPreviewExpanded ? (
        <>
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

          <div ref={frameContainerRef} className="mt-5 flex min-w-0 justify-center overflow-hidden pb-2 md:overflow-x-auto">
            <div
              style={compactWidth === null ? { display: "contents" } : {
                position: "relative",
                flexShrink: 0,
                width: frameWidth * compactScale,
                height: compactHeight * compactScale,
              }}
            >
              <div
                className="overflow-auto rounded-[34px] border border-slate-300 bg-slate-950 p-3 shadow-xl shadow-blue-950/20 md:resize"
                style={{
                  height: compactWidth === null ? `min(${frameHeight}px, calc(100dvh - 260px))` : compactHeight,
                  maxHeight: 780,
                  maxWidth: compactWidth === null ? "min(480px, 100%)" : undefined,
                  minHeight: 520,
                  minWidth: compactWidth === null ? 320 : frameWidth,
                  width: frameWidth,
                  position: compactWidth === null ? undefined : "absolute",
                  transform: compactWidth === null ? undefined : `scale(${compactScale})`,
                  transformOrigin: "top left",
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
                      ref={iframeRef}
                      key={previewVersion}
                      title={iframeTitle}
                      src={iframeSrc}
                      className="h-full w-full border-0 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-[#f7fbff] px-3 py-2 text-xs font-bold leading-5 text-slate-600">
          미리보기를 접었습니다. 필요할 때 펼치거나 큰 창으로 열어 확인하세요.
        </p>
      )}
    </article>
  );
}
