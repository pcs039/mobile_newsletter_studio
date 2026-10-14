import { deliverAuthorizedPng } from "@/lib/image-delivery-server";
import "server-only";
import { NextResponse } from "next/server";
import { getProjectContent, getProjectDesignAssets, type ProjectContentArticle } from "@/lib/newsletter-repository";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { ImageGenerationError } from "@/lib/article-image-generation";
import { prepareDirectorImage } from "@/lib/visual-director-image-execution";
import { directorStyleLabels } from "@/lib/director-image-quality";
import { isArticlePubliclyVisible } from "@/lib/article-publication";
import { aiImageSourceArticle, isArticleAiImageAsset, readAiImageBlock, type AiImageRole, type AiImageApplyState } from "@/lib/ai-image-article";

export async function aiImageArticleRpc(projectId: string, articleId: string, action: "snapshot" | "apply" | "revoke", role: AiImageRole,
  assetId?: string, expected?: string, generationKey?: string, variantIndex?: number | null) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), url = getSupabaseRestEndpoint("/rest/v1/rpc/apply_newsletter_ai_image_article_atomic");
  if (!key || !url) throw new ImageGenerationError(503, "서버 설정을 확인하세요.");
  const r = await fetch(url, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_project_id: projectId, p_article_id: articleId, p_action: action, p_role: role, p_asset_id: assetId ?? null,
      p_expected: expected ?? null, p_generation_key: generationKey ?? null, p_variant_index: variantIndex ?? null }), cache: "no-store" });
  if (!r.ok) {
    const error = await r.json().catch(() => null);
    throw new ImageGenerationError(error?.code === "PGRST202" ? 503 : error?.code === "PT409" ? 409 : r.status === 403 ? 403 : 404,
      error?.code === "PGRST202" ? "AI 이미지 적용 함수의 Staging migration 승인이 필요합니다." :
        error?.code === "PT409" ? "기사나 적용 상태가 변경되었습니다. 다시 확인하세요. Canva 전체 디자인이 적용된 경우 먼저 해제하세요." : "자산 승인 상태와 현재 기사 정보를 확인하세요.");
  }
  return r.json();
}

export async function getAiImageApplyState(projectId: string, slug: string, articleId: string, palette: string[]): Promise<AiImageApplyState> {
  const [content, assets, state] = await Promise.all([
    getProjectContent(slug), getProjectDesignAssets(slug), aiImageArticleRpc(projectId, articleId, "snapshot", "hero"),
  ]);
  const article = content.source === "supabase" ? content.articles.find(a => a.id === articleId) : null;
  if (!article || !assets.ok) throw new ImageGenerationError(404, "현재 프로젝트의 기사와 자산을 확인하세요.");
  const plans: ReturnType<typeof prepareDirectorImage>[] = [];
  for (const context of [undefined, "hybrid"] as const) for (const index of [1, 2, 3]) {
    try { plans.push(prepareDirectorImage(projectId, articleId, aiImageSourceArticle(article), palette, context, index)); } catch { /* Existing images remain candidates when source strategy changes. */ }
  }
  return { snapshot: state.snapshot, connections: state.connections,
    conflict: article.contentPresentation === "image" || article.blocks.some(b => b.isVisible && b.metadata.presentation_mode === "full_layout"),
    candidates: assets.assets.filter(a => isArticleAiImageAsset(a, projectId, articleId)).map(asset => {
      const generationKey = asset.metadata!.imageGeneration!.generationKey, plan = plans.find(p => p.generationKey === generationKey);
      return { id: asset.id, name: asset.name, approvalStatus: asset.approvalStatus, previewHref: `/api/project-files/preview?designAssetId=${asset.id}`,
        generationKey, variantIndex: plan?.specification.variantIndex ?? null,
        styleLabel: plan ? directorStyleLabels[plan.specification.stylePreset] : "등록 당시 스타일 재확인 필요",
        aspectRatio: plan?.specification.aspectRatio ?? "등록 자산 확인", stale: !plan };
    }) };
}

async function reference(projectId: string, slug: string, articleId: string, blockId: string, preview: boolean) {
  const [content, assets] = await Promise.all([getProjectContent(slug), getProjectDesignAssets(slug)]);
  const article = content.source === "supabase" ? content.articles.find(a => a.id === articleId) : null;
  if (!article || (!preview && !isArticlePubliclyVisible(article))) return null;
  const block = article.blocks.find(b => b.id === blockId && b.isVisible), managed = block && readAiImageBlock(block);
  const asset = managed && assets.assets.find(a => a.id === managed.assetId);
  if (!managed || managed.articleId !== articleId || !asset || !isArticleAiImageAsset(asset, projectId, articleId) ||
    asset.approvalStatus !== "approved" || asset.metadata?.imageGeneration?.generationKey !== managed.generationKey ||
    !asset.storagePath || !asset.storagePath.startsWith(`projects/${projectId}/`) || asset.storagePath.includes("..") || asset.storagePath.endsWith("/")) return null;
  return asset.storagePath;
}
export async function mapAiImageArticles(projectId: string, slug: string, articles: ProjectContentArticle[], mode: "public" | "preview" | "review") {
  return Promise.all(articles.map(async article => ({ ...article, blocks: await Promise.all(article.blocks.map(async block => {
    if (block.metadata.managed_by !== "ai_image_article_v1") return block;
    let permitted = false;
    try { permitted = !!await reference(projectId, slug, article.id, block.id, mode === "preview"); } catch { /* Hide unavailable managed images; original HTML remains. */ }
    return { ...block, body: permitted ? `${mode === "review" ? "/api/client-review/files" : "/api/public-files/preview"}?${new URLSearchParams({
      project: slug, articleId: article.id, aiImageBlock: block.id, ...(mode === "preview" ? { preview: "admin" } : {}),
    })}` : "", isVisible: permitted };
  })) })));
}
export async function serveAiArticleImage(projectId: string, slug: string, articleId: string, blockId: string, preview: boolean, request?: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  try {
    const path = await reference(projectId, slug, articleId, blockId, preview), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!path || !key) throw Error();
    const url = getSupabaseStorageEndpoint(`/object/design-production-assets/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (!url) throw Error();
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!r.ok || !r.body || r.headers.get("content-type")?.split(";")[0] !== "image/png") throw Error();
    return await deliverAuthorizedPng(r, request, "gpt", headers);
  } catch { return NextResponse.json({ ok: false, message: "기사 이미지를 찾지 못했습니다." }, { status: 404, headers }); }
}
