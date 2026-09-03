"use client";

type PublicSurveyCloseButtonProps = {
  fallbackHref: string;
};

export function PublicSurveyCloseButton({ fallbackHref }: PublicSurveyCloseButtonProps) {
  function handleClose() {
    window.close();

    window.setTimeout(() => {
      if (!window.closed) {
        window.location.href = fallbackHref;
      }
    }, 150);
  }

  return (
    <button
      type="button"
      onClick={handleClose}
      className="inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:bg-slate-100"
    >
      창 닫기
    </button>
  );
}
