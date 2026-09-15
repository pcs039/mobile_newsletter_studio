"use client";

import { useEffect } from "react";

export type PublicArticleLightboxImage = {
  alt: string;
  caption?: string;
  src: string;
};

type PublicArticleImageLightboxProps = {
  image: PublicArticleLightboxImage | null;
  onClose: () => void;
};

export function PublicArticleImageLightbox({ image, onClose }: PublicArticleImageLightboxProps) {
  useEffect(() => {
    if (!image) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  return (
    <section
      role="dialog"
      aria-label="기사 이미지 확대 보기"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950/95 text-white"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-zoom-out bg-black/40"
        aria-label="이미지 확대 닫기"
        onClick={onClose}
      />
      <div className="pointer-events-none relative z-10 grid h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3 px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
        <div className="flex min-h-12 w-full items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="dd-btn pointer-events-auto min-h-11 rounded-full border border-white/30 bg-white px-4 py-2 text-sm font-black text-[#092046] shadow-2xl shadow-black/40 transition hover:bg-sky-50"
            aria-label="이미지 확대 닫기"
          >
            닫기 ×
          </button>
        </div>
        <div className="flex min-h-0 w-full items-center justify-center px-1 py-2">
          <div className="pointer-events-auto max-h-[78dvh] max-w-[94vw] overflow-auto rounded-xl shadow-2xl shadow-black/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              className="mx-auto h-auto max-h-[78dvh] max-w-[94vw] object-contain"
            />
          </div>
        </div>
        {image.caption ? (
          <div className="flex min-h-10 w-full justify-center">
            <p className="pointer-events-auto line-clamp-2 max-w-3xl rounded-2xl bg-black/70 px-4 py-2 text-center text-sm font-bold leading-6 text-white shadow-lg shadow-black/30">
              {image.caption}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
