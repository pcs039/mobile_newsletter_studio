import { notFound } from "next/navigation";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { requireProjectAdminPreviewAccess } from "@/lib/project-admin-preview-access";
import { getProjectWorkspace, getProjectContent, getFontAssets, makePublicStoragePreviewHref } from "@/lib/newsletter-repository";
import { getArticleHeroBackgrounds, getArticleTextDesigns } from "@/lib/article-composition-repository";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { HwaseongProposalReader } from "@/components/hwaseong-proposal-reader";
import { hwaseongSampleSlug, proposalSample, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { normalizeSampleInterest } from "@/lib/hwaseong-sample-interest";

export const dynamic = "force-dynamic";
export const metadata = { title: "화성 10월호 · 비공개 제안 샘플", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function Samples({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ articleId?: string; view?: string; width?: string; qa?: string; interest?: string | string[] }>;
}) {
  const { projectId } = await params;
  // No route activation on Production or a general Preview, even after a future merge.
  if (!stagingEnvironmentConfigured() || projectId !== hwaseongSampleSlug) notFound();
  const { project } = await getProjectWorkspace(projectId);
  if (!project || !(await requireProjectAdminPreviewAccess(project, `/projects/${projectId}/samples`))) notFound();
  const [content, fontData, query] = await Promise.all([getProjectContent(projectId), getFontAssets({ activeOnly: true }), searchParams]);
  if (content.source !== "supabase") notFound();
  const samples = content.articles.map(a => proposalSample(a, project.id)).filter((s): s is ProposalSample => s !== null);
  const ids = samples.map(s => s.article.id);
  const [backgrounds, textDesigns] = await Promise.all([getArticleHeroBackgrounds(project.id, projectId, ids, "preview"), getArticleTextDesigns(project.id, ids, true)]);
  // Uploaded audio still uses the authenticated existing project-file proxy.
  for (const s of samples) if (s.article.audioFile?.sourceType === "uploaded") {
    const u = new URL(s.article.audioFile.previewHref, "https://sample.invalid");
    s.article = { ...s.article, audioFile: { ...s.article.audioFile, previewHref: `/api/project-files/preview?${u.searchParams}` } };
  }
  const coverImageSrc = project.coverImagePath ? makePublicStoragePreviewHref("mobile-assets", project.coverImagePath) : project.coverImageUrl;
  const cover = project.coverEnabled && coverImageSrc ? {
    coverImageSrc, coverFit: project.coverFit, coverLayout: project.coverLayout,
    coverTitle: project.coverTitle || project.title, coverSubtitle: project.coverSubtitle,
    coverIssueText: project.coverIssueText || project.issue, masthead: project.title,
  } : undefined;
  return <><PublicFontFaceStyle fonts={fontData.fonts} /><HwaseongProposalReader slug={projectId} samples={samples} fonts={fontData.fonts} backgrounds={backgrounds} textDesigns={textDesigns} cover={cover}
    selectedId={ids.includes(query.articleId ?? "") ? query.articleId : undefined} detail={query.view === "detail"} contents={query.view === "contents"} qa={query.qa === "1"} interest={normalizeSampleInterest(query.interest)} width={query.width === "520" ? 520 : 390} /></>;
}
