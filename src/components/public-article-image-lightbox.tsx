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
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 text-white sm:p-6"
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
        paddingTop: "calc(1rem + env(safe-area-inset-top))",
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out bg-slate-950/82"
        aria-label="이미지 확대 보기 닫기"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-full w-full max-w-6xl flex-col items-center gap-3">
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={onClose}
            className="dd-btn dd-btn-secondary rounded-full bg-white px-4 py-2 text-sm text-[#092046] shadow-xl shadow-slate-950/30"
            aria-label="이미지 확대 보기 닫기"
          >
            닫기
          </button>
        </div>
        <div className="max-h-[calc(100dvh-8rem)] w-full overflow-auto rounded-2xl bg-slate-950/30 p-2 shadow-2xl shadow-slate-950/40 sm:p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.alt}
            className="mx-auto h-auto max-h-[calc(100dvh-10rem)] max-w-full rounded-xl object-contain"
          />
        </div>
        {image.caption ? (
          <p className="max-w-3xl rounded-full bg-slate-950/65 px-4 py-2 text-center text-sm font-bold leading-6 text-white">
            {image.caption}
          </p>
        ) : null}
      </div>
    </section>
  );
}
