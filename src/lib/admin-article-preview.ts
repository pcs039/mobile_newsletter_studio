import type { ProjectContentArticle } from "@/lib/newsletter-repository";

export const previewArticleMessage = "datadiction:admin-preview-article";
export const previewAudioNotice = "음성은 마지막으로 저장·생성된 자료입니다. 미저장 본문이나 디자인 변경사항은 음성에 반영되지 않습니다.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function adminArticleAudioHref(slug: string, articleId: string, segment?: number) {
  return `/api/project-article-preview/audio?${new URLSearchParams({ project: slug, article: articleId, ...(segment === undefined ? {} : { segment: String(segment) }) })}`;
}

export function mapAdminArticleAudio(slug: string, articles: ProjectContentArticle[]) {
  return articles.map(article => article.audioFile?.sourceType === "ai_tts"
    ? { ...article, audioFile: { ...article.audioFile, manifestHref: adminArticleAudioHref(slug, article.id) } }
    : article);
}

export function readPreviewArticleMessage(data: unknown, project: string, channel: string, articleIds: readonly string[]) {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (value.type !== previewArticleMessage || value.project !== project || value.channel !== channel) return null;
  if (value.articleId === null) return { articleId: null };
  return typeof value.articleId === "string" && uuid.test(value.articleId) && articleIds.includes(value.articleId)
    ? { articleId: value.articleId } : null;
}

export function previewArticleContext(href: string) {
  // Only the existing relative admin article reader URL can enable the bridge.
  if (!href.startsWith("/newsletters/")) return null;
  const url = new URL(href, "https://preview.invalid");
  const match = /^\/newsletters\/([^/]+)$/.exec(url.pathname);
  if (!match || url.searchParams.get("preview") !== "admin") return null;
  const articleId = url.searchParams.get("articleId");
  try {
    return { project: decodeURIComponent(match[1]), articleId: articleId && uuid.test(articleId) ? articleId : null };
  } catch { return null; }
}
