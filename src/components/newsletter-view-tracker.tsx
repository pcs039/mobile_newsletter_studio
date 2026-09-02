"use client";

import { useEffect } from "react";

type NewsletterViewTrackerProps = {
  slug: string;
  viewMode: "reading" | "ebook";
  disabled?: boolean;
};

export function NewsletterViewTracker({ slug, viewMode, disabled = false }: NewsletterViewTrackerProps) {
  useEffect(() => {
    if (disabled || !slug) {
      return;
    }

    const minuteBucket = Math.floor(Date.now() / 60000);
    const dedupeKey = `datadiction-newsletter-view:${slug}:${viewMode}:${window.location.pathname}:${minuteBucket}`;

    if (window.sessionStorage.getItem(dedupeKey)) {
      return;
    }

    window.sessionStorage.setItem(dedupeKey, "1");

    void fetch("/api/analytics/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug,
        viewMode,
        routePath: window.location.pathname,
      }),
      keepalive: true,
    });
  }, [disabled, slug, viewMode]);

  return null;
}
