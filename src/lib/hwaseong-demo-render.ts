import "server-only";
import type { ComponentProps } from "react";
import type { HwaseongProposalReader } from "@/components/hwaseong-proposal-reader";
import { demoStep, demoTimed, type DemoTrace } from "@/lib/demo-share-diagnostics";
import { DemoError, getDemoAccess, getDemoSession } from "@/lib/demo-share";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { hwaseongSampleSlug, proposalSample, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { getFontAssets, makePublicStoragePreviewHref } from "@/lib/newsletter-repository";
import { getArticleHeroBackgroundReferences, getArticleTextDesigns } from "@/lib/article-composition-repository";
import { prepareSampleCover } from "@/lib/hwaseong-sample-cover-server";
import { prepareSampleMap, prepareSampleToc } from "@/lib/hwaseong-sample-toc-server";
import { splitAudioIndex } from "@/lib/hwaseong-sample-split-tts-server";
import type { SampleAudioDeliveries } from "@/lib/sample-audio-delivery";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";

const projectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
export function isHwaseongDemo(slug: string) { return slug === hwaseongSampleSlug && stagingEnvironmentConfigured(); }
export function validateHwaseongDemoAccess(access: Awaited<ReturnType<typeof getDemoSession>>, trace?: DemoTrace) {
  demoStep(trace,"approved_articles","START");
  const slug=access.project.slug;
  if (!isHwaseongDemo(slug)) throw new DemoError(404, "시연 자료를 찾지 못했습니다.", "PROJECT_MISMATCH");
  const samples = access.articles.map(a => proposalSample(a, projectId)).filter((s): s is ProposalSample => !!s && !s.editorTest);
  if (access.project.id !== projectId || access.articles.length !== 7 || samples.length !== 7 || new Set(samples.map(s => s.kind)).size !== 7) throw new DemoError(404, "승인된 7개 기사 시연 링크가 필요합니다.", "PROJECT_MISMATCH");
  demoStep(trace,"approved_articles","VALIDATED");
  return { ...access, samples };
}
export async function getHwaseongDemoAccess(slug: string, trace?: DemoTrace) {
  if (!isHwaseongDemo(slug)) throw new DemoError(404,"시연 자료를 찾지 못했습니다.","PROJECT_MISMATCH");
  return validateHwaseongDemoAccess(await demoTimed(trace,"access",()=>getDemoSession(slug,trace)),trace);
}
export function sampleDemoAudioHref(slug: string, article: string, part: string, segment?: number) {
  return `/api/demo-share/sample-audio?${new URLSearchParams({ project: slug, article, part, ...(segment === undefined ? {} : { segment: String(segment) }) })}`;
}
export async function getHwaseongDemoData(slug: string, prepareMedia = true, trace?: DemoTrace) {
  return buildHwaseongDemoData(await getHwaseongDemoAccess(slug,trace),prepareMedia,trace);
}
// The URL bearer is authoritative here, even if another valid cookie exists.
export async function getHwaseongDemoEntryData(token: string, trace?: DemoTrace) {
  if(!isHwaseongDemo(hwaseongSampleSlug))throw new DemoError(404,"시연 자료를 찾지 못했습니다.","PROJECT_MISMATCH");
  const access=validateHwaseongDemoAccess(await demoTimed(trace,"access",()=>getDemoAccess(token,hwaseongSampleSlug,trace)),trace);
  return buildHwaseongDemoData(access,true,trace);
}
async function buildHwaseongDemoData(access: Awaited<ReturnType<typeof getHwaseongDemoAccess>>, prepareMedia: boolean, trace?: DemoTrace) {
  const {project,samples}=access,slug=project.slug;
  const ids = samples.map(s => s.article.id);
  const sourceCover = project.coverImagePath ? makePublicStoragePreviewHref("mobile-assets", project.coverImagePath) : project.coverImageUrl;
  demoStep(trace,"media_prepare","START");
  const [fontData, textDesigns, references, currentAudio, inlineCover, thumbnailIndex, mapImage] = await demoTimed(trace,"media",()=>Promise.all([
    demoTimed(trace,"fonts",()=>getFontAssets({ activeOnly: true })),
    demoTimed(trace,"text_design",()=>getArticleTextDesigns(projectId, ids, true)),
    demoTimed(trace,"backgrounds",()=>getArticleHeroBackgroundReferences(projectId, ids, true)),
    prepareMedia ? demoTimed(trace,"audio_index",()=>splitAudioIndex(samples)) : {} as Record<string,SampleAudio>,
    prepareMedia && sourceCover ? demoTimed(trace,"cover",()=>prepareSampleCover(projectId, slug, sourceCover)) : null,
    prepareMedia ? demoTimed(trace,"thumbnails",()=>prepareSampleToc(projectId, slug, samples)) : {},
    prepareMedia ? demoTimed(trace,"map",()=>prepareSampleMap(projectId, slug, samples)) : undefined,
  ])).catch(()=>{throw new DemoError(503,"미디어 준비 실패","MEDIA_PREPARATION_FAILED");});
  demoStep(trace,"media_prepare","READY");
  demoStep(trace,"render","START");
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
  demoStep(trace,"render","READY");
  return { access, props, files, fontPaths, timings: trace?.timings };
}

// Only the currently connected reader audio is deliverable. QA/probes/pending
// IDs and provider/generation endpoints are never accepted from the recipient.
export async function deliverHwaseongDemoAudio(slug: string, article: string, part: string, segment: string | null, request: Request, trace?: DemoTrace) {
  const access = await getHwaseongDemoAccess(slug,trace);
  if (!access.samples.some(s => s.article.id === article) || !["summary","detail"].includes(part)) return new Response(null,{status:404});
  const deliveries: SampleAudioDeliveries = new Map();
  const index = await demoTimed(trace,"audio_index",()=>splitAudioIndex(access.samples,deliveries)), source = index[article];
  const audio = part === "detail" ? source?.detail : source;
  if (!audio) return new Response(null,{status:404});
  // The index registered a delivery only after matching the current script,
  // approved DB row and active selection. No second source/status lookup.
  const deliver=deliveries.get(audio.id);
  if(!deliver)return new Response(null,{status:404});
  const result=await demoTimed(trace,"audio_delivery",()=>deliver(segment,request));
  if (segment !== null || !result.ok) return result;
  const manifest = await result.json();
  return Response.json({...manifest,segments:manifest.segments.map((s:{index:number}) => ({index:s.index,url:sampleDemoAudioHref(slug,article,part,s.index)}))});
}
