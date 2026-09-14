"use client";

import { useEffect } from "react";

let sharedAudioContext: AudioContext | null = null;
let lastPlayedAt = 0;

const soundTargetSelector = [
  "button",
  "[role='button']",
  "input[type='button']",
  "input[type='submit']",
  "input[type='reset']",
  "a[href]",
].join(", ");

const editingControlSelector = [
  "input[type='text']",
  "input[type='search']",
  "input[type='email']",
  "input[type='password']",
  "textarea",
  "select",
  "[contenteditable='true']",
].join(", ");

function getAudioContext() {
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  sharedAudioContext ??= new AudioContextConstructor();

  return sharedAudioContext;
}

async function playClickTick() {
  try {
    const now = Date.now();

    if (now - lastPlayedAt < 45) {
      return;
    }

    lastPlayedAt = now;

    const audioContext = getAudioContext();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const startTime = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(740, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(420, startTime + 0.045);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.04, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.055);
  } catch {
    // Audio feedback is decorative and should never block the UI.
  }
}

function isButtonLikeLink(element: Element) {
  if (!(element instanceof HTMLAnchorElement)) {
    return true;
  }

  return Boolean(
    element.closest("[role='button']") ||
      element.className.includes("rounded") ||
      element.className.includes("bg-") ||
      element.className.includes("border") ||
      element.className.includes("shadow") ||
      element.className.includes("px-") ||
      element.className.includes("py-"),
  );
}

function isSoundTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest(editingControlSelector)) {
    return false;
  }

  const interactiveElement = target.closest(soundTargetSelector);

  if (!interactiveElement) {
    return false;
  }

  return !interactiveElement.closest(".public-newsletter-screen") && isButtonLikeLink(interactiveElement);
}

export function AdminInteractionSound() {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (isSoundTarget(event.target)) {
        void playClickTick();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  return null;
}
