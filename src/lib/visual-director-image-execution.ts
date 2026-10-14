import "server-only";
import { visualArticleSnapshot } from "@/lib/article-visual-source-snapshot";
import { createHash } from "node:crypto";
import type { VisualDirectorArticle } from "@/lib/article-visual-director";
import { buildVisualDirectorResult } from "@/lib/article-visual-director";
import { buildDirectorImageSpec, buildDirectorImagePrompt, type DirectorGenerationResult } from "@/lib/visual-director-image-spec";
import { ImageGenerationError, imageGenerationEnabled, validateGeneratedImage, type GeneratedImageProof } from "@/lib/article-image-generation";
import { guardedImageGeneration, requestArticleImage } from "@/lib/article-image-provider";
import { findGeneratedImageAsset, registerGeneratedImageAsset } from "@/lib/generated-image-asset-repository";
import { claimImageProcessingJob, finishImageProcessingJob, readImageProcessingJob } from "@/lib/design-processing/repository";

import { isArticleHexColor } from "@/lib/article-text-colors";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
function uuid(value: string) { const h = hash(value); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; }
export function prepareDirectorImage(projectId: string, articleId: string, article: VisualDirectorArticle, palette: string[],context?:"hybrid") {
  const specification = buildDirectorImageSpec(article,context);
  if (!specification) throw new ImageGenerationError(409, "현재 기사에는 AI 개념 이미지 생성이 적합하지 않습니다.");
  const colors = palette.filter(isArticleHexColor).slice(0, 4);
  // Hash only stable article inputs. Signed preview URLs/private metadata never
  // enter the key, prompt or persisted request; source copy itself is not stored.
  const sourceSnapshot = hash(context==="hybrid"?visualArticleSnapshot(article):{ title:article.title,summary:article.summary,body:article.body,articleType:article.articleType,
    publicInfo:article.publicInfo,institutionPriority:article.institutionPriority,urgency:article.urgency,publicationKind:article.publicationKind,
    blocks:article.blocks.map(b=>({id:b.id,type:b.type,isVisible:b.isVisible,title:b.title,body:b.type==="paragraph"?b.body:undefined})),
    links:article.links?.map(l=>({id:l.id,label:l.label,targetValue:l.targetValue,isVisible:l.isVisible})) });
  const generationKey = hash({ projectId, articleId, sourceSnapshot, director: buildVisualDirectorResult(article), specification, colors, ...(context?{context}:{}) });
  return { specification, generationKey, jobId: uuid(`director-job:${generationKey}`), assetId: uuid(`director-asset:${generationKey}`),
    payload: { model: "gpt-image-2.5-flare", prompt: buildDirectorImagePrompt(specification, colors), n: 1,
      size: `${specification.targetSize.width}x${specification.targetSize.height}`, quality: "medium", output_format: "png", background: "opaque" } };
}
export async function executeDirectorImage(input: { projectId: string; articleId: string; article: VisualDirectorArticle; adminId: string; palette: string[]; action: "prepare" | "generate" | "status"; expectedKey?: string;context?:"hybrid" }): Promise<DirectorGenerationResult> {
  if (!imageGenerationEnabled()) throw new ImageGenerationError(403, "고정 Staging에서만 이미지 생성과 등록을 사용할 수 있습니다.");
  const plan = prepareDirectorImage(input.projectId, input.articleId, input.article, input.palette,input.context);
  const base = { specification: plan.specification, generationKey: plan.generationKey };
  if (input.action !== "prepare" && input.expectedKey !== plan.generationKey) throw new ImageGenerationError(409, "기사가 변경되었습니다. 생성 계획을 다시 확인하세요.");
  const provenance = { generatedForArticleId: input.articleId, visualStrategy: "ai_generated_image" as const, generationPurpose: "article_visual" as const,
    promptVersion: "v1" as const, generationKey: plan.generationKey, factualityMode: "conceptual" as const, textInImage: false as const };
  const proof: GeneratedImageProof = { assetId: plan.assetId, projectId: input.projectId, articleId: input.articleId, adminId: input.adminId,
    role: "hero_background", pattern: "event", hash: plan.generationKey, expires: 0, model: "gpt-image-2.5-flare" };
  const resolve = async (): Promise<DirectorGenerationResult | null> => {
    const job = await readImageProcessingJob(input.projectId, plan.jobId);
    if (!job) return null;
    if (job.request_payload.articleId !== input.articleId || job.request_payload.generationKey !== plan.generationKey) throw new ImageGenerationError(409, "생성 기록의 기사 정보가 다릅니다.");
    if (job.status === "succeeded") {
      if (job.result_payload.assetId !== plan.assetId) throw new ImageGenerationError(409, "생성 결과 참조가 다릅니다.");
      const asset = await findGeneratedImageAsset(proof, provenance);
      if (!asset) return { ...base, status: "failed", message: "기존 생성 자산을 찾지 못했습니다. 새 이미지를 자동 생성하지 않습니다." };
      return { ...base, status: "success", duplicate: true, asset: { ...asset, previewHref: `/api/project-files/preview?designAssetId=${asset.id}` } };
    }
    if (job.status === "failed" || job.status === "cancelled") return { ...base, status: job.error_code === "unknown" ? "unknown" : "failed", message: "이 요청을 자동으로 다시 생성하지 않습니다. 자산 관리에서 결과를 확인하세요." };
    const elapsed = job.started_at ? Date.now() - Date.parse(job.started_at) : Infinity;
    return { ...base, status: elapsed > 6 * 60_000 ? "unknown" : "in_progress", message: elapsed > 6 * 60_000 ? "생성 결과가 미확정입니다. 추가 생성 없이 자산 관리에서 확인하세요." : "이미지 생성 중입니다." };
  };
  const existing = await resolve();
  if (existing) return existing;
  if (input.action !== "generate") return { ...base, status: "ready" };
  return guardedImageGeneration(`${input.adminId}:${input.projectId}`, plan.jobId, plan.generationKey, async () => {
    const claimed = await claimImageProcessingJob(input.projectId, plan.jobId, input.articleId, plan.generationKey);
    if (!claimed) return await resolve() ?? { ...base, status: "unknown" };
    let stage: "provider" | "validation" | "registration" = "provider";
    try {
      const base64 = await requestArticleImage(plan.payload);
      stage = "validation";
      const png = validateGeneratedImage(base64, "hero_background", plan.specification.targetSize);
      stage = "registration";
      const asset = await registerGeneratedImageAsset(proof, png.bytes, `${input.article.title.trim().slice(0,130) || "기사"} · 개념 이미지 · GPT Images`, provenance);
      await finishImageProcessingJob(input.projectId, plan.jobId, asset.id);
      return { ...base, status: "success", duplicate: asset.duplicate, asset: { ...asset, previewHref: `/api/project-files/preview?designAssetId=${asset.id}` } };
    } catch (error) {
      const unknown = stage === "registration" || (stage === "provider" && (!(error instanceof ImageGenerationError) || error.status >= 500));
      // Persistence ambiguity is deliberately terminal/unknown; never issue another provider request.
      await finishImageProcessingJob(input.projectId, plan.jobId, undefined, unknown).catch(() => undefined);
      return { ...base, status: unknown ? "unknown" : "failed", message: unknown ? "생성·등록 결과가 미확정입니다. 자동 재시도하지 않습니다." : "생성 결과를 등록하지 못했습니다. 자동 재시도하지 않습니다." };
    }
  });
}
