import { canvaAdmin, canvaFailure, canvaJson, sameOrigin } from "@/lib/canva-api-access";
import { stagingRequestAllowed, requireStagingE2E } from "@/lib/staging-environment";
import { getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";
import { buildCanonicalCanvaAutofillPayload, type CanvaAutofillImageBinding } from "@/lib/canva-autofill-payload";
import { prepareCanvaContentFit } from "@/lib/canva-content-fit";
import { executeCanonicalCanvaAutofill } from "@/lib/canva-autofill-execution";
import { getConnection } from "@/lib/canva-connection-repository";
import { getProjectContent } from "@/lib/newsletter-repository";
import { readCanvaBackground } from "@/lib/canva-background-repository";
import { CanvaConnectError, digest } from "@/lib/canva-connect-contract";
import { canvaUuid } from "@/lib/canva-template";
import { createCanvaConfirmation, verifyCanvaConfirmation } from "@/lib/canva-confirmation";
import type { CanvaRecommendationPreparation } from "@/lib/canva-recommendation-execution";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const p = await request.json();
    if (!p || Object.keys(p).some(k => !["action", "projectSlug", "articleId", "templateId", "requestKey", "confirmation"].includes(k)) ||
      !["prepare", "execute", "poll"].includes(p.action) || typeof p.projectSlug !== "string" || !canvaUuid.test(p.articleId ?? "") || typeof p.templateId !== "string")
      throw new CanvaConnectError(400, "저장된 기사와 추천 디자인을 확인하세요.");
    const access = await canvaAdmin(p.projectSlug); if (!access.ok) return access.response;
    const template = getCanonicalCanvaTemplate(p.templateId);
    if (!template || template.datasetStatus !== "verified") throw new CanvaConnectError(400, "검증된 추천 디자인을 선택하세요.");
    const supported = template.id === "event_festival_02" && template.canvaBrandTemplateId === "EAHXxCyfpSI";
    const allowed = stagingRequestAllowed(request);
    // Never inspect Production connection/image data for external E2E readiness.
    if (p.action === "prepare" && (!allowed || !supported)) return canvaJson({ ok: true, supported, connected: false,
      stagingAllowed: allowed, isReady: false, visualReady: false, missingFields: [], visualIssues: [] } satisfies CanvaRecommendationPreparation);
    requireStagingE2E(request); sameOrigin(request);
    if (!supported) throw new CanvaConnectError(409, "이 템플릿은 Canva 제작 검증 준비 중입니다.");
    const content = await getProjectContent(access.project.slug);
    const article = content.source === "supabase" ? content.articles.find(a => a.id === p.articleId) : null;
    if (!article) throw new CanvaConnectError(404, "현재 프로젝트의 저장된 기사를 선택하세요.");
    const row = await getConnection(access.project.id, access.user.id);
    const connected = !!row?.access_token && !!row.refresh_token && !!row.expires_at && Number.isFinite(Date.parse(row.expires_at));
    const images: CanvaAutofillImageBinding[] = [];
    const upload = row?.execution?.backgroundUpload;
    if (upload?.status === "success") {
      try {
        const background = await readCanvaBackground(access.project.id, upload.sourceAssetId);
        images.push({ field: "MAIN_IMAGE", sourceHash: background.hash, upload,
          asset: { id: background.id, projectId: access.project.id, approvalStatus: "approved", isActive: true, mimeType: "image/png" } });
      } catch { /* A missing, revoked or inaccessible asset remains a missing field. */ }
    }
    const prepared = buildCanonicalCanvaAutofillPayload({ templateId: template.id, project: access.project, article, images });
    const fit = prepareCanvaContentFit(prepared);
    const hash = digest(JSON.stringify(prepared.payload));
    const binding = JSON.stringify(["canonical-recommendation", access.project.id, access.user.id, article.id, template.id, hash]);
    const readiness: CanvaRecommendationPreparation = { ok: true, supported: fit.supported, connected, stagingAllowed: true,
      isReady: prepared.isReady, visualReady: fit.visualReady, missingFields: prepared.missingFields.map(f => f.field),
      visualIssues: fit.fields.flatMap(f => f.fitStatus === "overflow" ? [{ field: f.field, fitStatus: f.fitStatus }] : []),
      ...(connected && fit.visualReady && prepared.isReady ? { confirmation: createCanvaConfirmation(binding) } : {}) };
    if (p.action === "prepare") return canvaJson(readiness);
    if (!canvaUuid.test(p.requestKey ?? "")) throw new CanvaConnectError(400, "제작 요청을 확인하세요.");
    if (!prepared.isReady) return canvaJson({ ok: false, status: "not_ready" });
    if (!fit.visualReady) return canvaJson({ ok: false, status: "visual_not_ready", visualIssues: readiness.visualIssues });
    if (!connected) return canvaJson({ ok: false, status: "auth_required" });
    if (!verifyCanvaConfirmation(p.confirmation, binding)) throw new CanvaConnectError(409, "기사 또는 확인 시간이 변경되었습니다. 제작 준비를 다시 확인하세요.");
    if (p.action === "poll") {
      // A status request may NEVER initiate creation, even with a forged key.
      const previous = row?.execution;
      if (!previous?.job || !["in_progress", "success"].includes(previous.job.status) || previous.key !== p.requestKey ||
        previous.hash !== hash || previous.articleId !== article.id || previous.templateId !== template.id)
        throw new CanvaConnectError(409, "기존 제작 상태를 확인하세요. 새 제작은 실행하지 않았습니다.");
    }
    return canvaJson(await executeCanonicalCanvaAutofill(request, { projectSlug: access.project.slug, articleId: article.id,
      canvaBrandTemplateId: template.canvaBrandTemplateId, requestKey: p.requestKey, prepared, pollOnly: p.action === "poll" }));
  } catch (error) { return canvaFailure(error); }
}
