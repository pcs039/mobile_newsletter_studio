"use client";

import { useEffect, useSyncExternalStore } from "react";

type PublicTextScale = "normal" | "large" | "xlarge";

const STORAGE_KEY = "datadiction_public_text_scale";
const LEGACY_STORAGE_KEY = "datadiction_public_large_text";
const textScaleListeners = new Set<() => void>();
const textScaleOptions: { value: PublicTextScale; label: string }[] = [
  { value: "normal", label: "기본" },
  { value: "large", label: "크게" },
  { value: "xlarge", label: "아주 크게" },
];

function isPublicTextScale(value: string | null): value is PublicTextScale {
  return value === "normal" || value === "large" || value === "xlarge";
}

function applyTextScale(scale: PublicTextScale) {
  document.documentElement.dataset.publicTextScale = scale;
  delete document.documentElement.dataset.publicLargeText;
}

function readTextScalePreference(): PublicTextScale {
  if (typeof window === "undefined") {
    return "normal";
  }

  try {
    const savedValue = window.localStorage.getItem(STORAGE_KEY);

    if (isPublicTextScale(savedValue)) {
      return savedValue;
    }

    const legacyValue = window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacyValue === "true") {
      return "large";
    }

    return "normal";
  } catch {
    return "normal";
  }
}

function subscribeToTextScalePreference(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) {
      listener();
    }
  }

  textScaleListeners.add(listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    textScaleListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function saveTextScalePreference(scale: PublicTextScale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, scale);
  } catch {
    // The visual state can still update even if storage is unavailable.
  }

  applyTextScale(scale);
  textScaleListeners.forEach((listener) => listener());
}

export function PublicTextSizeToggle() {
  const textScale = useSyncExternalStore(subscribeToTextScalePreference, readTextScalePreference, () => "normal");

  useEffect(() => {
    applyTextScale(textScale);
  }, [textScale]);

  return (
    <div className="public-text-size-toggle w-full max-w-[360px] rounded-2xl border border-[#2f73b7] bg-white p-2 shadow-sm shadow-blue-950/10">
      <p className="px-1 pb-2 text-xs font-black text-[#184a88]">글자 크기</p>
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="글자 크기">
        {textScaleOptions.map((option) => {
          const isSelected = option.value === textScale;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => saveTextScalePreference(option.value)}
              className={`public-text-size-option inline-flex min-h-10 items-center justify-center rounded-xl px-2 py-2 text-sm font-black transition focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#2f73b7] ${
                isSelected ? "bg-[#092046] text-white" : "bg-[#eaf3ff] text-[#092046] hover:bg-[#d8eaff]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
