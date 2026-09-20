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
const stopArticleAudioEventName = "datadiction:stop-article-audio";
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
  const shouldContinueSegmentRef = useRef(false);
  const playerSourceKey = `${isAiGenerated ? "ai" : "uploaded"}:${manifestUrl || src}`;

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

  const applyPlaybackRate = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const stopAudio = useCallback((options: { clearSource?: boolean } = {}) => {
    const audio = audioRef.current;

    shouldContinueSegmentRef.current = false;

    if (audio) {
      audio.pause();

      try {
        audio.currentTime = 0;
      } catch {
        // Some mobile browsers can reject currentTime before metadata is ready.
      }

      if (options.clearSource) {
        audio.removeAttribute("src");
        audio.load();
      }
    }

    setIsPlaying(false);
    setSegmentIndex(0);
  }, []);

  useEffect(() => {
    function stopRequestedArticleAudio() {
      stopAudio();
    }

    window.addEventListener(stopArticleAudioEventName, stopRequestedArticleAudio);

    return () => {
      window.removeEventListener(stopArticleAudioEventName, stopRequestedArticleAudio);
      stopAudio({ clearSource: true });
    };
  }, [stopAudio]);

  useEffect(() => {
    let isMounted = true;

    const resetTimer = window.setTimeout(() => {
      if (!isMounted) {
        return;
      }

      stopAudio();
      setSegments([]);
      setSegmentIndex(0);
      setLoadState(isAiGenerated ? "loading" : src ? "ready" : "error");

      if (!isAiGenerated) {
        setSegments(src ? [{ index: 0, url: src }] : []);
        return;
      }

      if (!manifestUrl) {
        setLoadState("error");
        return;
      }

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
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(resetTimer);
    };
  }, [isAiGenerated, manifestUrl, playerSourceKey, src, stopAudio]);

  async function toggleAudio() {
    const audio = audioRef.current;

    if (!audio || loadState !== "ready" || segments.length === 0) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    shouldContinueSegmentRef.current = false;
    applyPlaybackRate();
    await audio.play().catch(() => undefined);
    setIsPlaying(!audio.paused);
  }

  function handleEnded() {
    if (segmentIndex < segments.length - 1) {
      shouldContinueSegmentRef.current = true;
      setSegmentIndex((current) => current + 1);
      return;
    }

    shouldContinueSegmentRef.current = false;
    setIsPlaying(false);
    setSegmentIndex(0);
  }

  useEffect(() => {
    if (!shouldContinueSegmentRef.current || !isPlaying || !audioRef.current) {
      return;
    }

    shouldContinueSegmentRef.current = false;
    applyPlaybackRate();
    void audioRef.current.play().catch(() => setIsPlaying(false));
  }, [applyPlaybackRate, isPlaying, segmentIndex]);

  const currentSrc = segments[segmentIndex]?.url ?? "";
  const isReady = loadState === "ready" && segments.length > 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <audio
        ref={audioRef}
        aria-label={ariaLabel}
        onCanPlay={applyPlaybackRate}
        onEnded={handleEnded}
        onLoadedMetadata={applyPlaybackRate}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        preload="metadata"
        src={currentSrc}
      />
      <div className="flex min-h-10 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void toggleAudio();
          }}
          disabled={!isReady}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#b8d7ff] bg-white text-sm font-black text-[#092046] shadow-sm transition hover:bg-[#eef6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f73b7] disabled:pointer-events-none disabled:opacity-45"
          aria-label={isPlaying ? "기사 음성 일시정지" : "기사 음성 재생"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#092046]">
            {loadState === "loading" ? "음성 준비 중" : loadState === "error" ? "음성 준비 실패" : isPlaying ? "듣는 중" : "기사 듣기"}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full bg-[#2f73b7] ${isPlaying ? "w-2/3" : "w-0"} transition-all duration-300`} />
          </div>
        </div>
        <PlaybackRateSelect playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} />
      </div>
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
