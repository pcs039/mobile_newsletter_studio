"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

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

  if (!image || typeof document === "undefined") {
    return null;
  }

  const lightbox = (
    <section
      role="dialog"
      aria-label="기사 이미지 확대 보기"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] bg-black text-white"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-zoom-out bg-black"
        aria-label="이미지 확대 닫기"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/25 bg-white px-4 text-sm font-black text-black shadow-lg shadow-black/40 transition hover:bg-slate-100"
        aria-label="이미지 확대 닫기"
      >
        닫기
      </button>
      <div className="pointer-events-none relative z-10 grid h-[100dvh] w-full grid-rows-[1fr_auto] px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(4.25rem+env(safe-area-inset-top))] sm:px-5">
        <div className="flex min-h-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.alt}
            className="pointer-events-auto max-h-[82dvh] max-w-[96vw] rounded-lg object-contain shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
        {image.caption ? (
          <div className="mt-3 flex min-h-6 justify-center px-3">
            <p className="line-clamp-2 max-w-3xl text-center text-xs font-bold leading-5 text-white/80 sm:text-sm">
              {image.caption}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );

  return createPortal(lightbox, document.body);
}
