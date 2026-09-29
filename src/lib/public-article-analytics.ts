"use client";

import type { ArticleEventType } from "@/lib/article-analytics-types";

export type { ArticleEventType } from "@/lib/article-analytics-types";

type TrackArticleEventInput = {
  articleId: string;
  eventType: ArticleEventType;
  linkActionId?: string | null;
  slug: string;
  surveyId?: string | null;
};

const analyticsSessionKey = "datadiction-analytics-session";
const dedupedEventTypes = new Set<ArticleEventType>(["article_view", "audio_play"]);
const recentClicks = new Map<string, number>();

function makeTemporarySessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getTemporarySessionId() {
  try {
    const stored = window.sessionStorage.getItem(analyticsSessionKey);

    if (stored) {
      return stored;
    }

    const created = makeTemporarySessionId();
    window.sessionStorage.setItem(analyticsSessionKey, created);
    return created;
  } catch {
    return makeTemporarySessionId();
  }
}

function shouldSkipEvent(input: TrackArticleEventInput) {
  const eventKey = `${input.slug}:${input.articleId}:${input.eventType}`;

  if (dedupedEventTypes.has(input.eventType)) {
    const storageKey = `datadiction-article-event:${eventKey}`;

    try {
      if (window.sessionStorage.getItem(storageKey)) {
        return true;
      }

      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Server-side dedupe remains the final guard when storage is unavailable.
    }

    return false;
  }

  const clickKey = `${eventKey}:${input.linkActionId ?? input.surveyId ?? "none"}`;
  const now = Date.now();
  const previous = recentClicks.get(clickKey) ?? 0;

  if (now - previous < 600) {
    return true;
  }

  recentClicks.set(clickKey, now);
  return false;
}

export function trackArticleEvent(input: TrackArticleEventInput) {
  if (typeof window === "undefined" || !input.slug || !input.articleId || shouldSkipEvent(input)) {
    return;
  }

  void fetch("/api/analytics/article-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      routePath: window.location.pathname,
      sessionId: getTemporarySessionId(),
    }),
    keepalive: true,
  }).catch(() => undefined);
}
