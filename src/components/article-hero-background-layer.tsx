"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { ArticleCompositionAnchor } from "@/lib/article-composition";
import type { ArticleHeroBackground } from "@/lib/article-hero-background";

const positions: Record<ArticleCompositionAnchor, CSSProperties> = {
  center: { left: "50%", top: "50%" }, top: { left: "50%", top: 0 }, bottom: { bottom: 0, left: "50%" },
  left: { left: 0, top: "50%" }, right: { right: 0, top: "50%" }, top_left: { left: 0, top: 0 },
  top_right: { right: 0, top: 0 }, bottom_left: { bottom: 0, left: 0 }, bottom_right: { bottom: 0, right: 0 },
};

export function ArticleHeroBackgroundLayer({ background, children }: {
  background?: ArticleHeroBackground; children: ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!background?.visible || !background.url || failedUrl === background.url) return children;
  const settings = background.settings;
  const anchor = settings.anchor ?? "center";
  const x = ["center", "top", "bottom"].includes(anchor) ? "-50%" : "0";
  const y = ["center", "left", "right"].includes(anchor) ? "-50%" : "0";
  return (
    <div data-article-hero="" className="relative isolate -mx-5 -mt-5 mb-3 overflow-hidden rounded-t-2xl px-5 pb-3 pt-5">
      {/* Decorative images have no action or semantic content; HTML stays above every layer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={background.url} alt="" aria-hidden="true" draggable={false}
        onError={() => setFailedUrl(background.url)}
        data-article-hero-background=""
        className="pointer-events-none absolute h-full w-full select-none"
        style={{ ...positions[anchor], objectFit: settings.fit ?? "contain", objectPosition: "center",
          transform: `translate(${x}, ${y}) translate(${settings.offsetX ?? 0}px, ${settings.offsetY ?? 0}px) rotate(${settings.rotation ?? 0}deg) scale(${settings.scale ?? 1})`,
          transformOrigin: "center", opacity: settings.opacity ?? 1, zIndex: Math.min(settings.zIndex ?? 0, 20) }} />
      <div data-article-hero-content="" className="relative z-30 rounded-xl bg-white/90 p-3">{children}</div>
    </div>
  );
}
