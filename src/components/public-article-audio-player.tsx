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

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
    setCurrentTime(0);
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
      setCurrentTime(0);
      setDuration(0);
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

  function handleStop() {
    stopAudio();
  }

  function seekTo(value: number) {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(value)) {
      return;
    }

    const safeDuration = duration || audio.duration || 0;
    const nextTime = Math.max(0, Math.min(value, safeDuration || 0));

    try {
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    } catch {
      // Some mobile browsers can reject currentTime while metadata is not ready.
    }
  }

  function skipBy(seconds: number) {
    seekTo(currentTime + seconds);
  }

  function handleLoadedMetadata() {
    applyPlaybackRate();
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
  }

  function handleEnded() {
    setCurrentTime(0);

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
  const progressValue = duration > 0 ? Math.min(currentTime, duration) : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <audio
        ref={audioRef}
        aria-label={ariaLabel}
        onCanPlay={applyPlaybackRate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        preload="metadata"
        src={currentSrc}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            void toggleAudio();
          }}
          disabled={!isReady}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#b8d7ff] bg-white text-sm font-black text-[#092046] shadow-sm transition hover:bg-[#eef6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f73b7] disabled:pointer-events-none disabled:opacity-45"
          aria-label={isPlaying ? "기사 음성 일시정지" : "기사 음성 재생"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={!isReady}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[13px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f73b7] disabled:pointer-events-none disabled:opacity-45"
          aria-label="기사 음성 정지"
        >
          ■
        </button>
        <button
          type="button"
          onClick={() => skipBy(-10)}
          disabled={!isReady}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f73b7] disabled:pointer-events-none disabled:opacity-45"
          aria-label="10초 뒤로 이동"
        >
          -10
        </button>
        <button
          type="button"
          onClick={() => skipBy(10)}
          disabled={!isReady}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f73b7] disabled:pointer-events-none disabled:opacity-45"
          aria-label="10초 앞으로 이동"
        >
          +10
        </button>
        <div className="min-w-0 flex-1 px-1">
          <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 0}
            step="0.1"
            value={progressValue}
            disabled={!isReady || duration <= 0}
            onChange={(event) => seekTo(Number(event.currentTarget.value))}
            className="h-2 w-full min-w-0 accent-[#2f73b7] disabled:opacity-45"
            aria-label="기사 음성 재생 위치"
          />
        </div>
        <PlaybackRateSelect playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} />
      </div>
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-bold text-slate-500">
        <span>
          {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
        </span>
        {segments.length > 1 ? <span>{segmentIndex + 1} / {segments.length}</span> : null}
        {loadState === "loading" ? <span>준비 중</span> : loadState === "error" ? <span>재생 불가</span> : null}
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
    <label className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#184a88]">
      <span className="sr-only">재생 속도</span>
      <select
        value={playbackRate}
        onChange={(event) => setPlaybackRate(normalizePlaybackRate(Number(event.target.value)))}
        className="h-9 rounded-lg border border-[#b8d7ff] bg-white px-2 text-xs font-black text-[#092046] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f73b7]"
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
