"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { ArticleCompositionAnchor } from "@/lib/article-composition";
import type { ArticleHeroBackground } from "@/lib/article-hero-background";

const positions: Record<ArticleCompositionAnchor, CSSProperties> = {
  center: { left: "50%", top: "50%" }, top: { left: "50%", top: 0 }, bottom: { bottom: 0, left: "50%" },
  left: { left: 0, top: "50%" }, right: { right: 0, top: "50%" }, top_left: { left: 0, top: 0 },
  top_right: { right: 0, top: 0 }, bottom_left: { bottom: 0, left: 0 }, bottom_right: { bottom: 0, right: 0 },
};

function placementStyle(settings: ArticleHeroBackground["settings"]): CSSProperties {
  const anchor = settings.anchor ?? "center";
  const x = ["center", "top", "bottom"].includes(anchor) ? "-50%" : "0";
  const y = ["center", "left", "right"].includes(anchor) ? "-50%" : "0";
  return { ...positions[anchor], objectFit: settings.fit ?? "contain", objectPosition: "center",
    transform: `translate(${x}, ${y}) translate(${settings.offsetX ?? 0}px, ${settings.offsetY ?? 0}px) rotate(${settings.rotation ?? 0}deg) scale(${settings.scale ?? 1})`,
    transformOrigin: "center", opacity: settings.opacity ?? 1, zIndex: Math.min(settings.zIndex ?? 0, 20) };
}

export function ArticleHeroBackgroundLayer({ background, illustration, contentVisible = true, children, body }: {
  background?: ArticleHeroBackground; illustration?: ArticleHeroBackground; contentVisible?: boolean; children: ReactNode; body?: ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [failedIllustrationUrl, setFailedIllustrationUrl] = useState<string | null>(null);
  const showBackground = background?.visible && background.url && failedUrl !== background.url;
  const showIllustration = illustration?.visible && illustration.url && failedIllustrationUrl !== illustration.url;
  const fluidFrame = background?.visible && background.settings.renderMode === "fluid_frame";
  if (!showBackground && !showIllustration && !fluidFrame) return <>{children}{body}</>;
  return (
    <>
    <div data-article-hero="" className={fluidFrame ? "relative isolate mb-3 min-w-0" : "relative isolate -mx-5 -mt-5 mb-3 overflow-hidden rounded-t-2xl px-5 pb-3 pt-5"}>
      {/* Decorative images have no action or semantic content; HTML stays above every layer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {showBackground && !fluidFrame && background ? <img src={background.url} alt="" aria-hidden="true" draggable={false}
        onError={() => setFailedUrl(background.url)}
        data-article-hero-background=""
        className="pointer-events-none absolute h-full w-full select-none"
        style={placementStyle(background.settings)} /> : null}
      {showIllustration && illustration ? (
        // A bounded stacking context keeps every illustration above the background and below HTML.
        <div data-article-top-illustration-region="" className="relative z-[21] mb-3 h-36 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={illustration.url} alt="" aria-hidden="true" draggable={false}
            onError={() => setFailedIllustrationUrl(illustration.url)} data-article-top-illustration=""
            className="pointer-events-none absolute h-full w-full select-none"
            style={placementStyle(illustration.settings)} />
        </div>
      ) : null}
      {fluidFrame && background ? (
        <div data-article-fluid-frame="" className="relative z-30 min-w-0 p-4"
          style={{ backgroundColor: background.settings.surfaceColor ?? "#F4F8FF", borderColor: background.settings.borderColor ?? "#B8D7FF",
            borderWidth: background.settings.borderWidth ?? 2, borderStyle: "solid", borderRadius: background.settings.borderRadius ?? 16 }}>
          {/* Stable light content surface protects existing text contrast; future text tokens belong here. */}
          <div data-article-hero-content="" className="min-w-0 rounded-xl bg-white/95 p-3 [overflow-wrap:anywhere]">{children}{body}</div>
        </div>
      ) : contentVisible ? <div data-article-hero-content="" className="relative z-30 rounded-xl bg-white/90 p-3">{children}</div> : children}
    </div>
    {!fluidFrame ? body : null}
    </>
  );
}
