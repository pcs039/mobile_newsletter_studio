import type { ProjectContentArticle } from "@/lib/newsletter-repository";

// Shared with the ordinary reader. Keep its existing matching and excerpt contract.
export function getArticleTitle(article: ProjectContentArticle, index: number) {
  return article.title?.trim() || `기사 ${index + 1}`;
}

export function getPlainArticleSearchText(article: ProjectContentArticle, index: number) {
  const paragraphText = article.blocks
    .filter((block) => block.isVisible && block.type === "paragraph")
    .map((block) => block.body)
    .filter(Boolean)
    .join(" ");
  return [getArticleTitle(article, index), article.summary, paragraphText || article.body]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function articleSearchMatches(text: string, query: string) {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  return Boolean(normalized) && text.toLocaleLowerCase("ko-KR").includes(normalized);
}

export function buildArticleSearchSnippet(text: string, query: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const matchedIndex = normalizedText.toLocaleLowerCase("ko-KR").indexOf(normalizedQuery);
  if (matchedIndex < 0) return normalizedText.slice(0, 96);
  const start = Math.max(0, matchedIndex - 36);
  const end = Math.min(normalizedText.length, matchedIndex + query.length + 64);
  return `${start > 0 ? "..." : ""}${normalizedText.slice(start, end)}${end < normalizedText.length ? "..." : ""}`;
}
