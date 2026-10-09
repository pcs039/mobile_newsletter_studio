import { articleColorContrast, articleTextColorDefaults } from "@/lib/article-text-colors";
import type { ArticleTextDesign } from "@/lib/article-text-design";

export function ArticleTextDesignElements({ settings, position, accentColor = articleTextColorDefaults.accentColor }: { settings?: ArticleTextDesign; accentColor?: string; position: "before-title" | "after-title" }) {
  if (!settings) return null;
  if (position === "after-title") return settings.subtitleEnabled && settings.subtitle
    ? <p data-article-subtitle="" className="article-design-subtitle">{settings.subtitle}</p> : null;
  const number = settings.numberEnabled && settings.number;
  const label = settings.labelEnabled && settings.label;
  if (!number && !label) return null;
  return <div className="article-design-labels">
    {number ? <span data-article-number-badge="" data-digits={String(number).length} data-shape={settings.numberShape ?? "circle"} className="article-design-number" style={{ backgroundColor: accentColor, color: (articleColorContrast("#FFFFFF", accentColor) ?? 0) >= 4.5 ? "#FFFFFF" : "#000000" }}>{number}</span> : null}
    {label ? <span data-article-pill-label="" className="article-design-pill">{label}</span> : null}
  </div>;
}
