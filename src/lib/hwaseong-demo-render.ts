import "server-only";
import type { ComponentProps } from "react";
import type { HwaseongProposalReader } from "@/components/hwaseong-proposal-reader";
import { DemoError, getDemoSession } from "@/lib/demo-share";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { hwaseongSampleSlug, proposalSample, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { getFontAssets, makePublicStoragePreviewHref } from "@/lib/newsletter-repository";
import { getArticleHeroBackgroundReferences, getArticleTextDesigns } from "@/lib/article-composition-repository";
import { prepareSampleCover } from "@/lib/hwaseong-sample-cover-server";
import { prepareSampleMap, prepareSampleToc } from "@/lib/hwaseong-sample-toc-server";
import { splitAudioIndex, splitTtsDelivery } from "@/lib/hwaseong-sample-split-tts-server";
import { qualityDelivery } from "@/lib/hwaseong-sample-quality-tts-server";
import { actingDelivery } from "@/lib/hwaseong-cartoon-acting-server";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";

const projectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
export function isHwaseongDemo(slug: string) { return slug === hwaseongSampleSlug && stagingEnvironmentConfigured(); }
export async function getHwaseongDemoAccess(slug: string) {
  if (!isHwaseongDemo(slug)) throw new DemoError(404, "시연 자료를 찾지 못했습니다.");
  const access = await getDemoSession(slug);
  const samples = access.articles.map(a => proposalSample(a, projectId)).filter((s): s is ProposalSample => !!s && !s.editorTest);
  if (access.project.id !== projectId || access.articles.length !== 7 || samples.length !== 7 || new Set(samples.map(s => s.kind)).size !== 7) throw new DemoError(404, "승인된 7개 기사 시연 링크가 필요합니다.");
  return { ...access, samples };
}
export function sampleDemoAudioHref(slug: string, article: string, part: string, segment?: number) {
  return `/api/demo-share/sample-audio?${new URLSearchParams({ project: slug, article, part, ...(segment === undefined ? {} : { segment: String(segment) }) })}`;
}
export async function getHwaseongDemoData(slug: string, prepareMedia = true) {
  const access = await getHwaseongDemoAccess(slug), { project, samples } = access;
  const ids = samples.map(s => s.article.id);
  const sourceCover = project.coverImagePath ? makePublicStoragePreviewHref("mobile-assets", project.coverImagePath) : project.coverImageUrl;
  const [fontData, textDesigns, references, currentAudio, inlineCover, thumbnailIndex, mapImage] = await Promise.all([
    getFontAssets({ activeOnly: true }), getArticleTextDesigns(projectId, ids, true), getArticleHeroBackgroundReferences(projectId, ids, true),
    prepareMedia ? splitAudioIndex(samples) : {} as Record<string,SampleAudio>, prepareMedia && sourceCover ? prepareSampleCover(projectId, slug, sourceCover) : null,
    prepareMedia ? prepareSampleToc(projectId, slug, samples) : {}, prepareMedia ? prepareSampleMap(projectId, slug, samples) : undefined,
  ]);
  const usedFontIds = JSON.stringify([textDesigns, samples, project.bodyFontAssetId, project.titleFontAssetId]);
  const fonts = fontData.fonts.filter(f => usedFontIds.includes(f.id));
  const fontPaths = new Set(fonts.map(f => f.filePath));
  const files = new Set<string>();
  function register(bucket: string, path: string) {
    if (!path || path.includes("..") || path.startsWith("/") || path.endsWith("/") || /[\\\x00-\x1f]/.test(path)) return "";
    if (bucket === "fonts" ? !fontPaths.has(path) : !["design-production-assets", "mobile-assets", "page-images"].includes(bucket) || !path.startsWith(`projects/${projectId}/`)) return "";
    files.add(`${bucket}:${path}`);
    return `/api/demo-share/sample-files?${new URLSearchParams({ project: slug, bucket, path })}`;
  }
  function rewrite(value: string) {
    if (!value.startsWith("/")) return value;
    try {
      const url = new URL(value, "https://demo.invalid");
      if (["/api/project-files/preview", "/api/public-files/preview"].includes(url.pathname) && url.searchParams.getAll("bucket").length === 1 && url.searchParams.getAll("path").length === 1) return register(url.searchParams.get("bucket")!, url.searchParams.get("path")!);
    } catch { /* No administrative URL passes through. */ }
    return "";
  }
  function map<T>(value: T): T {
    if (typeof value === "string") return rewrite(value) as T;
    if (Array.isArray(value)) return value.map(v => map(v)) as T;
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,map(v)])) as T;
    return value;
  }
  const renderedSamples = samples.map(s => map({ ...s, article: { ...s.article, audioFile: null, audioSource: "none" as const,
    blocks: s.article.blocks.filter(b => b.isVisible || b.metadata.proposal_sample).map(b => ({ ...b, metadata: Object.fromEntries(Object.entries(b.metadata).filter(([k]) => ["proposal_sample", "proposal_editorial", "proposal_tourism_feature", "source", "proposal_original_text"].includes(k) || k === "proposal_original_article").map(([k,v]) => [k,k === "proposal_original_article" && v && typeof v === "object" ? { body: (v as Record<string,unknown>).body } : v])) })),
  } }));
  const audioIndex: Record<string,SampleAudio> = Object.fromEntries(samples.flatMap(s => {
    const audio = currentAudio[s.article.id]; if (!audio?.detail) return [];
    return [[s.article.id, { ...audio, manifestHref: sampleDemoAudioHref(slug, s.article.id, "summary"), detail: { ...audio.detail, manifestHref: sampleDemoAudioHref(slug, s.article.id, "detail") } }]];
  }));
  const backgrounds = Object.fromEntries(Object.entries(references).map(([id,r]) => [id,{ url: register("design-production-assets",r.path), settings:r.settings, visible:true }]));
  const cover = project.coverEnabled && sourceCover ? { coverImageSrc: inlineCover || rewrite(sourceCover), coverFit: project.coverFit, coverLayout: project.coverLayout, coverTitle: project.coverTitle || project.title, coverSubtitle: project.coverSubtitle, coverIssueText: project.coverIssueText || project.issue, masthead: project.title } : undefined;
  const props: Omit<ComponentProps<typeof HwaseongProposalReader>,"detail"|"width"> = { slug, samples: renderedSamples, fonts: fonts.map(f => ({...f,uploadedBy:"",sourceFileName:"",fileUrl:register("fonts",f.filePath)})), backgrounds, textDesigns, cover, audioIndex, thumbnailIndex, mapImage, demo:true };
  return { access, props, files, fontPaths };
}

// Only the currently connected reader audio is deliverable. QA/probes/pending
// IDs and provider/generation endpoints are never accepted from the recipient.
export async function deliverHwaseongDemoAudio(slug: string, article: string, part: string, segment: string | null, request: Request) {
  const access = await getHwaseongDemoAccess(slug);
  if (!access.samples.some(s => s.article.id === article) || !["summary","detail"].includes(part)) return new Response(null,{status:404});
  const index = await splitAudioIndex(access.samples), source = index[article];
  const audio = part === "detail" ? source?.detail : source;
  if (!audio) return new Response(null,{status:404});
  const url = new URL(audio.manifestHref,"https://demo.invalid"), id = url.searchParams.get("audio")!;
  const result = url.pathname.endsWith("/acting") ? await actingDelivery(id,segment,request)
    : url.searchParams.get("version") === "3" ? await qualityDelivery(id,segment,request,false) : await splitTtsDelivery(id,segment,request);
  if (segment !== null || !result.ok) return result;
  const manifest = await result.json();
  return Response.json({...manifest,segments:manifest.segments.map((s:{index:number}) => ({index:s.index,url:sampleDemoAudioHref(slug,article,part,s.index)}))});
}
