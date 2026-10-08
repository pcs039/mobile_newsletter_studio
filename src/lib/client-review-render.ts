import "server-only";

import { getClientReviewCookieToken } from "@/lib/client-review";
import { getClientReviewAccess } from "@/lib/client-review-repository";
import { isArticlePubliclyVisible } from "@/lib/article-publication";
import { getDisplayArticleTitle } from "@/lib/korean-title-breaks";
import { getUsableEbookPages } from "@/lib/ebook-pages";
import {
  getProjectContent, getProjectPageImages, getProjectAudioFiles,
  getProjectWorkspace, getProjectPageHotspotLinks, getFontAssets,
} from "@/lib/newsletter-repository";

export const clientReviewResponseHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

export async function getClientReviewSession(slug: string) {
  return getClientReviewAccess(await getClientReviewCookieToken(slug), slug);
}

export function clientReviewAccessStatus(status: string) {
  if (status === "expired" || status === "revoked") return 410;
  if (status === "not_configured" || status === "migration_required" || status === "request_failed") return 503;
  return 404;
}

export function makeClientReviewFileHref(slug: string, bucket: string, path: string) {
  return `/api/client-review/files?${new URLSearchParams({ project: slug, bucket, path })}`;
}

export function parseRenderStorageHref(value: string) {
  if (!value.startsWith("/api/project-files/preview?") && !value.startsWith("/api/public-files/preview?")) return null;
  const url = new URL(value, "https://review.invalid");
  const bucket = url.searchParams.get("bucket") ?? "";
  const path = url.searchParams.get("path") ?? "";
  if (!["mobile-assets", "brand-assets", "audio-files", "page-images"].includes(bucket)
    || !path || path.includes("..") || path.startsWith("/") || path.endsWith("/")) return null;
  return { bucket, path };
}

export async function getClientReviewRenderData(slug: string) {
  const [workspace, content, pageData, audio, hotspots, fonts] = await Promise.all([
    getProjectWorkspace(slug), getProjectContent(slug), getProjectPageImages(slug),
    getProjectAudioFiles(slug), getProjectPageHotspotLinks(slug), getFontAssets({ activeOnly: true }),
  ]);
  if (!workspace.ok || content.source !== "supabase" || pageData.source !== "supabase"
    || audio.source !== "supabase" || hotspots.source !== "supabase") return null;

  const project = workspace.project;
  const files = new Set<string>();
  const register = (bucket: string, path: string) => {
    files.add(`${bucket}:${path}`);
    return makeClientReviewFileHref(slug, bucket, path);
  };
  const transform = (value: string) => {
    const reference = parseRenderStorageHref(value);
    if (reference) return register(reference.bucket, reference.path);
    // Keep external images/links, but never route a reviewer through an admin API.
    return value.startsWith("/") ? "" : value;
  };
  const articles = content.articles
    .filter((article) => getDisplayArticleTitle(article, "").trim() && isArticlePubliclyVisible(article))
    .map((article) => ({
      ...article,
      blocks: article.blocks.filter((block) => block.isVisible).map((block) => ({
        ...block,
        body: block.type === "image" || block.type === "audio" ? transform(block.body.trim()) : block.body,
      })),
      audioFile: article.audioFile ? {
        ...article.audioFile,
        previewHref: transform(article.audioFile.previewHref),
        ...(article.audioFile.sourceType === "ai_tts" ? {
          manifestHref: `/api/client-review/audio?${new URLSearchParams({ project: slug, article: article.id })}`,
        } : {}),
      } : null,
    }));
  const pages = getUsableEbookPages(pageData.pages).map((page) => ({
    ...page,
    previewHref: register("page-images", page.imagePath!),
    publicHref: makeClientReviewFileHref(slug, "page-images", page.imagePath!),
  }));
  const coverImageSrc = project.coverEnabled
    ? project.coverImagePath ? register("mobile-assets", project.coverImagePath) : transform(project.coverImageUrl)
    : "";
  const publicAudio = audio.files[0]?.filePath
    ? { src: register("audio-files", audio.files[0].filePath), title: audio.files[0].title }
    : undefined;
  return { project, articles, pages, coverImageSrc, publicAudio, files, fonts: fonts.fonts, hotspots: hotspots.links };
}
