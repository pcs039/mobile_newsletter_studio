import type { CSSProperties } from "react";
import type { ArticleCompositionPlacementSettings } from "./article-composition";

export const articleTextColorDefaults = { titleColor: "#092046", bodyColor: "#334155", accentColor: "#184A88" } as const;

export function isArticleHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function articleTextColorStyle(settings?: ArticleCompositionPlacementSettings): CSSProperties {
  // Scope tokens to this article; unset tokens preserve the existing presentation.
  return {
    ...(settings?.titleColor ? { "--article-title-color": settings.titleColor } : {}),
    ...(settings?.bodyColor ? { "--article-body-color": settings.bodyColor } : {}),
    ...(settings?.accentColor ? { "--article-accent-color": settings.accentColor } : {}),
  } as CSSProperties;
}

export function articleColorContrast(foreground: string, background: string) {
  if (!isArticleHexColor(foreground) || !isArticleHexColor(background)) return null;
  function luminance(hex: string) {
    const channels = [1, 3, 5].map((offset) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
