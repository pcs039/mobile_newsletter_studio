"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "datadiction_public_large_text";
const largeTextListeners = new Set<() => void>();

function applyLargeTextMode(enabled: boolean) {
  document.documentElement.dataset.publicLargeText = enabled ? "true" : "false";
}

function readLargeTextPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

function subscribeToLargeTextPreference(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  }

  largeTextListeners.add(listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    largeTextListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function saveLargeTextPreference(enabled: boolean) {
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
  applyLargeTextMode(enabled);
  largeTextListeners.forEach((listener) => listener());
}

export function PublicTextSizeToggle() {
  const isLargeText = useSyncExternalStore(subscribeToLargeTextPreference, readLargeTextPreference, () => false);

  useEffect(() => {
    applyLargeTextMode(isLargeText);
  }, [isLargeText]);

  function handleToggle() {
    const nextValue = !isLargeText;

    saveLargeTextPreference(nextValue);
  }

  return (
    <button
      type="button"
      aria-pressed={isLargeText}
      onClick={handleToggle}
      className="public-text-size-toggle inline-flex min-h-11 items-center justify-center rounded-full border border-[#2f73b7] bg-white px-4 py-2 text-sm font-black text-[#092046] shadow-sm shadow-blue-950/10 transition hover:bg-[#eaf3ff] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#2f73b7]"
    >
      {isLargeText ? "기본 크기로 보기" : "글자 크게 보기"}
    </button>
  );
}
