"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PublicArticleAudioPlayerProps = {
  ariaLabel: string;
  className?: string;
  isAiGenerated?: boolean;
  manifestUrl?: string;
  src?: string;
};

type ArticleAudioManifest = {
  hasAudio: boolean;
  segments: Array<{
    index: number;
    url: string;
  }>;
  source: string;
  stale: boolean;
  voice: string | null;
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

export function PublicArticleAudioPlayer({
  ariaLabel,
  className = "",
  isAiGenerated = false,
  manifestUrl,
  src = "",
}: PublicArticleAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackRate, setPlaybackRate] = useState(readStoredPlaybackRate);
  const [segments, setSegments] = useState<ArticleAudioManifest["segments"]>([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    isAiGenerated ? "loading" : "ready",
  );

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

  useEffect(() => {
    if (!isAiGenerated || !manifestUrl) {
      return;
    }

    let isMounted = true;

    fetch(manifestUrl, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest: ArticleAudioManifest | null) => {
        if (!isMounted) {
          return;
        }

        const nextSegments = manifest?.hasAudio ? manifest.segments : [];

        setSegments(nextSegments);
        setSegmentIndex(0);
        setLoadState(nextSegments.length > 0 ? "ready" : "error");
      })
      .catch(() => {
        if (isMounted) {
          setLoadState("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAiGenerated, manifestUrl]);

  const applyPlaybackRate = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  async function toggleAiAudio() {
    const audio = audioRef.current;

    if (!audio || loadState !== "ready" || segments.length === 0) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    applyPlaybackRate();
    await audio.play().catch(() => undefined);
    setIsPlaying(!audio.paused);
  }

  function handleAiEnded() {
    if (segmentIndex < segments.length - 1) {
      setSegmentIndex((current) => current + 1);
      return;
    }

    setIsPlaying(false);
    setSegmentIndex(0);
  }

  useEffect(() => {
    if (!isAiGenerated || !isPlaying || !audioRef.current) {
      return;
    }

    applyPlaybackRate();
    void audioRef.current.play().catch(() => setIsPlaying(false));
  }, [applyPlaybackRate, isAiGenerated, isPlaying, segmentIndex]);

  if (isAiGenerated) {
    const currentSrc = segments[segmentIndex]?.url ?? "";

    return (
      <div className={`space-y-2 ${className}`}>
        <audio
          ref={audioRef}
          aria-label={ariaLabel}
          onCanPlay={applyPlaybackRate}
          onEnded={handleAiEnded}
          onLoadedMetadata={applyPlaybackRate}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          preload="metadata"
          src={currentSrc}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void toggleAiAudio();
            }}
            disabled={loadState !== "ready" || segments.length === 0}
            className="dd-btn dd-btn-primary dd-btn-sm min-w-20 justify-center disabled:pointer-events-none disabled:opacity-50"
          >
            {isPlaying ? "일시정지" : "재생"}
          </button>
          <span className="text-xs font-bold text-slate-600">
            {loadState === "loading"
              ? "AI 음성 준비 중"
              : loadState === "error"
                ? "AI 음성을 준비하지 못했습니다."
                : segments.length > 1
                  ? `${segmentIndex + 1} / ${segments.length}`
                  : "AI 음성"}
          </span>
        </div>
        <PlaybackRateSelect playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} />
      </div>
    );
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
      <PlaybackRateSelect playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} />
    </div>
  );
}

function PlaybackRateSelect({
  playbackRate,
  setPlaybackRate,
}: {
  playbackRate: number;
  setPlaybackRate: (value: number) => void;
}) {
  return (
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
  );
}
