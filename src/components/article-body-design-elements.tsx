import type { ArticleTextDesign } from "@/lib/article-text-design";
import { infoBoxLabels, type ArticleBodyDesign } from "@/lib/article-body-design";
export function ArticleBodyDesignElement({ design, title, body, emphasis }: { design: ArticleBodyDesign; title?: string; body: string; emphasis?: ArticleTextDesign["bodyEmphasis"] }) {
  if (design.enabled === false || !body.trim()) return null;
  if (design.kind === "quote") return <blockquote data-article-quote="" data-emphasized={emphasis === "quote" || undefined} className="article-design-quote">{title ? <p className="font-bold">{title}</p> : null}<p>{body}</p>{design.source ? <footer className="article-design-quote-source">{design.source}</footer> : null}</blockquote>;
  return <aside data-article-info-box="" data-emphasized={emphasis === "info" || undefined} data-tone={design.tone ?? "default"} className="article-design-info"><p className="article-design-info-label">{infoBoxLabels[design.tone ?? "default"]}</p>{title ? <h3>{title}</h3> : null}<p>{body}</p></aside>;
}
export function ArticleDesignedCaption({ text }: { text: string }) {
  return text.trim() ? <figcaption data-article-designed-caption="" className="article-design-caption">{text}</figcaption> : null;
}
