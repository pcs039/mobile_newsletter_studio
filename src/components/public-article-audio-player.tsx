"use client";

import { useEffect, useRef, useState } from "react";

type PublicArticleAudioPlayerProps = {
  ariaLabel: string;
  className?: string;
  src: string;
};

const playbackRateStorageKey = "datadiction_audio_playback_rate";
const legacyPlaybackRateStorageKey = "datadiction_audio_speed";
const playbackRateOptions = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function normalizePlaybackRate(value: number) {
  return playbackRateOptions.includes(value as (typeof playbackRateOptions)[number]) ? value : 1;
}

function readStoredPlaybackRate() {
  if (typeof window === "undefined") {
    return 1;
  }

  try {
    const storedValue = window.localStorage.getItem(playbackRateStorageKey)
      ?? window.localStorage.getItem(legacyPlaybackRateStorageKey);

    return normalizePlaybackRate(Number(storedValue));
  } catch {
    return 1;
  }
}

function formatPlaybackRate(value: number) {
  return `${value.toFixed(value === 1 ? 1 : 2).replace(/0$/, "")}×`;
}

export function PublicArticleAudioPlayer({ ariaLabel, className = "", src }: PublicArticleAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState(readStoredPlaybackRate);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }

    try {
      window.localStorage.setItem(playbackRateStorageKey, String(playbackRate));
    } catch {
      // Persisting playback speed is optional.
    }
  }, [playbackRate]);

  function applyPlaybackRate() {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <audio
        ref={audioRef}
        aria-label={ariaLabel}
        className="h-9 w-full rounded-md"
        controls
        onCanPlay={applyPlaybackRate}
        onLoadedMetadata={applyPlaybackRate}
        preload="metadata"
        src={src}
      />
      <label className="inline-flex items-center gap-2 text-xs font-bold text-[#184a88]">
        <span className="shrink-0">재생 속도</span>
        <select
          value={playbackRate}
          onChange={(event) => setPlaybackRate(normalizePlaybackRate(Number(event.target.value)))}
          className="h-8 rounded-lg border border-[#b8d7ff] bg-white px-2 text-xs font-black text-[#092046] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f73b7]"
          aria-label="음성 재생 속도"
        >
          {playbackRateOptions.map((option) => (
            <option key={option} value={option}>
              {formatPlaybackRate(option)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
