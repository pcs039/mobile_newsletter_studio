"use client";

import { useEffect, useRef } from "react";
import { AdminMobilePreviewFrame } from "@/components/admin-mobile-preview-frame";

type ArticleMobilePreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  previewHref: string;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "iframe",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ArticleMobilePreviewModal({ isOpen, onClose, previewHref }: ArticleMobilePreviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute("disabled"));
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-mobile-preview-title"
        className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-lg bg-[#f4f8ff] p-3 shadow-2xl sm:p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장본 기준</p>
            <h2 id="article-mobile-preview-title" className="mt-1 text-xl font-black text-[#092046]">
              모바일 미리보기
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff] focus:outline-none focus:ring-4 focus:ring-sky-200"
          >
            닫기
          </button>
        </div>

        <AdminMobilePreviewFrame
          allowCollapse={false}
          previewHref={previewHref}
          title="저장된 기사 전체 화면"
          description="저장된 기사와 화면 구성을 실제 관리자 공개 화면 기준으로 확인합니다."
          iframeTitle="저장된 기사 모바일 미리보기"
        />
      </div>
    </div>
  );
}
