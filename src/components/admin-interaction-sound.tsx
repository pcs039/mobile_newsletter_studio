"use client";

import { useEffect } from "react";

let sharedAudioContext: AudioContext | null = null;
let lastPlayedAt = 0;

function getAudioContext() {
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  sharedAudioContext ??= new AudioContextConstructor();

  return sharedAudioContext;
}

function playClickTick() {
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
      void audioContext.resume();
    }

    const startTime = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(740, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(420, startTime + 0.045);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.025, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.055);
  } catch {
    // Audio feedback is decorative and should never block the UI.
  }
}

function isSoundTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveElement = target.closest("button, [role='button'], input[type='button'], input[type='submit'], input[type='reset']");

  if (!interactiveElement) {
    return false;
  }

  return !interactiveElement.closest(".public-newsletter-screen");
}

export function AdminInteractionSound() {
  useEffect(() => {
    function handlePointerUp(event: PointerEvent) {
      if (isSoundTarget(event.target)) {
        playClickTick();
      }
    }

    document.addEventListener("pointerup", handlePointerUp, true);

    return () => {
      document.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, []);

  return null;
}
