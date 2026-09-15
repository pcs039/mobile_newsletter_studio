"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicAudioPlayer } from "@/components/public-audio-player";
import {
  buildTimedAudioTextSegments,
  getActiveAudioTextSegmentId,
  type AudioTextSegmentCandidate,
} from "@/lib/audio-text-sync";

type PublicAudioTextSyncPlayerProps = {
  segments: AudioTextSegmentCandidate[];
  src: string;
  title?: string;
};

const followTextStorageKey = "datadiction_audio_follow_text";

function readStoredFollowTextPreference() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(followTextStorageKey) !== "false";
  } catch {
    return true;
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PublicAudioTextSyncPlayer({ segments, src, title }: PublicAudioTextSyncPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [followText, setFollowText] = useState(readStoredFollowTextPreference);
  const timedSegments = useMemo(() => buildTimedAudioTextSegments(segments, duration), [duration, segments]);
  const activeSegmentId = useMemo(
    () => getActiveAudioTextSegmentId(timedSegments, currentTime),
    [currentTime, timedSegments],
  );
  const canFollowText = timedSegments.length > 0;

  useEffect(() => {
    try {
      window.localStorage.setItem(followTextStorageKey, String(followText));
    } catch {
      // Text follow preference is optional.
    }
  }, [followText]);

  useEffect(() => {
    document.querySelectorAll("[data-audio-segment-id]").forEach((element) => {
      element.classList.toggle(
        "public-audio-segment-active",
        canFollowText && element.getAttribute("data-audio-segment-id") === activeSegmentId,
      );
    });
  }, [activeSegmentId, canFollowText]);

  useEffect(() => {
    if (!followText || !activeSegmentId) {
      return;
    }

    const activeElement = document.querySelector<HTMLElement>(`[data-audio-segment-id="${CSS.escape(activeSegmentId)}"]`);

    activeElement?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
  }, [activeSegmentId, followText]);

  return (
    <PublicAudioPlayer
      src={src}
      title={title}
      onDurationChange={setDuration}
      onTimeUpdate={setCurrentTime}
      onPlay={() => {
        if (!canFollowText) {
          return;
        }

        try {
          if (window.localStorage.getItem(followTextStorageKey) === null) {
            setFollowText(true);
          }
        } catch {
          setFollowText(true);
        }
      }}
      actionSlot={
        canFollowText ? (
          <button
            type="button"
            onClick={() => setFollowText((currentValue) => !currentValue)}
            className={`dd-btn dd-btn-sm text-xs ${
              followText ? "bg-white text-[#092046]" : "dd-btn-ghost text-slate-100"
            }`}
            aria-pressed={followText}
          >
            자동 따라가기 {followText ? "켜짐" : "꺼짐"}
          </button>
        ) : null
      }
    />
  );
}
