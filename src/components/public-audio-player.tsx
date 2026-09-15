"use client";

import { useEffect, useRef, useState } from "react";

type PublicAudioPlayerProps = {
  label?: string;
  onDurationChange?: (duration: number) => void;
  onPause?: () => void;
  onPlay?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  src: string;
  title?: string;
  variant?: "fixed" | "desktop";
};

const volumeStorageKey = "datadiction_audio_volume";
const speedStorageKey = "datadiction_audio_speed";
const speedOptions = [0.75, 1, 1.25, 1.5, 2] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSpeedLabel(value: number) {
  return Number.isInteger(value) ? `${value.toFixed(1)}x` : `${value}x`;
}

function readStoredNumber(key: string, fallbackValue: number, min: number, max: number) {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const value = Number(window.localStorage.getItem(key));

    return Number.isFinite(value) ? clamp(value, min, max) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function PublicAudioPlayer({
  label = "음성 소식지",
  onDurationChange,
  onPause,
  onPlay,
  onTimeUpdate,
  src,
  title = "음성 파일",
  variant = "fixed",
}: PublicAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => readStoredNumber(volumeStorageKey, 0.8, 0, 1));
  const [speed, setSpeed] = useState(() => readStoredNumber(speedStorageKey, 1, 0.75, 2));

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    try {
      window.localStorage.setItem(volumeStorageKey, String(volume));
    } catch {
      // Persisting audio preferences is optional.
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }

    try {
      window.localStorage.setItem(speedStorageKey, String(speed));
    } catch {
      // Persisting audio preferences is optional.
    }
  }, [speed]);

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play().catch(() => undefined);
      return;
    }

    audio.pause();
  }

  function seekTo(value: number) {
    const audio = audioRef.current;

    if (!audio || !Number.isFinite(value)) {
      return;
    }

    const nextTime = clamp(value, 0, duration || audio.duration || 0);

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    onTimeUpdate?.(nextTime);
  }

  function skipBy(seconds: number) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    seekTo(audio.currentTime + seconds);
  }

  const shellClass =
    variant === "desktop"
      ? "public-audio-player border-t border-white/10 bg-[#071f46]/98 px-4 py-2 text-white shadow-2xl shadow-blue-950/30"
      : "public-audio-player fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-white";
  const panelClass =
    variant === "desktop"
      ? "mx-auto flex max-w-[1400px] flex-col gap-2 lg:flex-row lg:items-center"
      : "mx-auto flex max-w-[560px] flex-col gap-2 rounded-2xl border border-white/10 bg-[#071f46]/96 px-3 py-3 shadow-2xl shadow-blue-950/35 backdrop-blur";

  return (
    <aside className={shellClass} aria-label={label}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onDurationChange={(event) => {
          const nextDuration = event.currentTarget.duration;

          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
          onDurationChange?.(Number.isFinite(nextDuration) ? nextDuration : 0);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPause?.();
        }}
        onPlay={() => {
          setIsPlaying(true);
          onPlay?.();
        }}
        onTimeUpdate={(event) => {
          const nextTime = event.currentTarget.currentTime;

          setCurrentTime(nextTime);
          onTimeUpdate?.(nextTime);
        }}
      />

      <div className={panelClass}>
        <div className="min-w-0 lg:w-64">
          <p className="text-[11px] font-black uppercase tracking-wide text-sky-200">{label}</p>
          <p className="truncate text-sm font-black text-white">{title}</p>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => skipBy(-10)}
            className="dd-btn dd-btn-ghost dd-btn-sm shrink-0 text-xs"
            aria-label="10초 뒤로 이동"
          >
            -10초
          </button>
          <button
            type="button"
            onClick={() => {
              void togglePlayback();
            }}
            className="dd-btn dd-btn-primary dd-btn-sm shrink-0 text-xs"
            aria-label={isPlaying ? "음성 일시정지" : "음성 재생"}
          >
            {isPlaying ? "일시정지" : "재생"}
          </button>
          <button
            type="button"
            onClick={() => skipBy(10)}
            className="dd-btn dd-btn-ghost dd-btn-sm shrink-0 text-xs"
            aria-label="10초 앞으로 이동"
          >
            +10초
          </button>
          <span className="hidden min-w-24 text-center text-xs font-black text-slate-200 sm:inline">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={duration ? Math.min(currentTime, duration) : 0}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="h-2 min-w-0 flex-1 accent-sky-300"
            aria-label="음성 재생 위치"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-slate-200 lg:w-36 lg:flex-none">
            <span className="shrink-0">볼륨</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="h-2 min-w-20 flex-1 accent-sky-300"
              aria-label="음성 볼륨"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <span className="sr-only">재생 속도</span>
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="h-9 rounded-lg border border-white/20 bg-white/10 px-2 text-xs font-black text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label="음성 재생 속도"
            >
              {speedOptions.map((option) => (
                <option key={option} value={option} className="text-slate-950">
                  {formatSpeedLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-center text-xs font-black text-slate-200 sm:hidden">
          {formatTime(currentTime)} / {formatTime(duration)}
        </p>
      </div>
    </aside>
  );
}
