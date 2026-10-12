import "server-only";
import { buildCanonicalCanvaAutofillPayload, type CanonicalCanvaAutofillPayload, type CanvaAutofillImageBinding } from "@/lib/canva-autofill-payload";
import { getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";
import { CanvaConnectError, digest, readCanvaJob, type CanvaJob } from "@/lib/canva-connect-contract";
import { canvaSources, canvaUuid, type CanvaMapping } from "@/lib/canva-template";
import { requireStagingE2E } from "@/lib/staging-environment";
import { sameOrigin, canvaAdmin } from "@/lib/canva-api-access";
import { getProjectContent } from "@/lib/newsletter-repository";
import { getConnection, withConnectionLock, type Execution } from "@/lib/canva-connection-repository";
import { accessToken, connectedCanvaRequest } from "@/lib/canva-connect-server";
import { readCanvaBackground } from "@/lib/canva-background-repository";

export type CanvaAutofillExecutionResult = {
  ok: boolean;
  status: "created" | "in_progress" | "not_ready" | "auth_required" | "dataset_mismatch" | "canva_error";
  canvaDesignId?: string; editUrl?: string; jobId?: string; duplicate?: boolean; error?: string;
};
const fail = (status: CanvaAutofillExecutionResult["status"], error: string): CanvaAutofillExecutionResult => ({ ok: false, status, error });
function result(job: CanvaJob, duplicate = false): CanvaAutofillExecutionResult {
  if (job.status === "failed") return fail("canva_error", "Canva 디자인 생성에 실패했습니다. 자동 재실행하지 않습니다.");
  return { ok: true, status: job.status === "success" ? "created" : "in_progress", jobId: job.id,
    ...(job.designId ? { canvaDesignId: job.designId } : {}), ...(job.editUrl ? { editUrl: job.editUrl } : {}), ...(duplicate ? { duplicate: true } : {}) };
}

function datasetMatches(datasetResponse: unknown, text: readonly string[], images: readonly string[]) {
  const dataset = (datasetResponse as { dataset?: unknown } | null)?.dataset;
  if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) return false;
  const entries = Object.entries(dataset);
  return entries.length === text.length + images.length &&
    entries.every(([field, value]) => value && typeof value === "object" &&
      (text.includes(field) ? value.type === "text" : images.includes(field) && value.type === "image"));
}

// Server function only: no UI action, new OAuth/client or public payload route.
export async function executeCanonicalCanvaAutofill(request: Request, input: {
  projectSlug: string; articleId: string; canvaBrandTemplateId: string; requestKey: string;
  prepared: CanonicalCanvaAutofillPayload;
}): Promise<CanvaAutofillExecutionResult> {
  try {
    requireStagingE2E(request); sameOrigin(request);
    const prepared = input.prepared;
    const template = prepared && getCanonicalCanvaTemplate(prepared.templateId);
    if (!template || template.datasetStatus !== "verified" || !template.requiredFields || !template.imageFields ||
      prepared.datasetStatus !== "verified" || prepared.isReady !== true || prepared.missingFields?.length !== 0 || !prepared.payload ||
      input.canvaBrandTemplateId !== template.canvaBrandTemplateId || prepared.canvaBrandTemplateId !== template.canvaBrandTemplateId ||
      prepared.payload.brand_template_id !== template.canvaBrandTemplateId || prepared.payload.type !== "create_from_brand_template" ||
      !prepared.payload.data || typeof prepared.payload.data !== "object" || Array.isArray(prepared.payload.data) ||
      !prepared.textFields || !prepared.imageFields ||
      !canvaUuid.test(input.articleId) || !canvaUuid.test(input.requestKey)) return fail("not_ready", "검증된 템플릿과 완전 채움 payload 및 실행 식별자를 확인하세요.");
    const keys = Object.keys(prepared.payload.data);
    if (keys.length !== template.requiredFields.length + template.imageFields.length ||
      Object.keys(prepared.textFields).length !== template.requiredFields.length || Object.keys(prepared.imageFields).length !== template.imageFields.length ||
      template.requiredFields.some(field => {
        const value = prepared.payload!.data[field], trace = prepared.textFields[field];
        return !Object.hasOwn(prepared.payload!.data, field) || value?.type !== "text" || typeof value.text !== "string" || !value.text.trim() || value.text.length > 10000 ||
          trace?.type !== "text" || trace.status !== "ready" || trace.text !== value.text;
      }) || template.imageFields.some(field => {
        const value = prepared.payload!.data[field], trace = prepared.imageFields[field];
        return !Object.hasOwn(prepared.payload!.data, field) || value?.type !== "image" || trace?.type !== "image" || trace.status !== "ready" ||
          trace.asset_id !== value.asset_id || !trace.sourceAssetId;
      })) return fail("not_ready", "registry 필드와 글자·이미지 payload가 일치하지 않습니다.");

    const access = await canvaAdmin(input.projectSlug);
    if (!access.ok) return fail("auth_required", "현재 프로젝트의 관리자 인증이 필요합니다.");
    const content = await getProjectContent(access.project.slug);
    const article = content.source === "supabase" ? content.articles.find(a => a.id === input.articleId) : null;
    if (!article) return fail("not_ready", "현재 프로젝트의 저장된 기사를 선택하세요.");
    const connection = await getConnection(access.project.id, access.user.id);
    if (!connection?.access_token || !connection.refresh_token || !connection.expires_at) return fail("auth_required", "Canva에 다시 연결해 주세요.");

    return await withConnectionLock(access.project.id, access.user.id, async (row, update) => {
      if (!row.access_token || !row.refresh_token || !row.expires_at) return fail("auth_required", "Canva에 다시 연결해 주세요.");
      const mappings: CanvaMapping[] = [];
      for (const field of template.requiredFields!) {
        const trace = prepared.textFields[field];
        if (trace.source === "article.links.label") continue; // Re-resolve the single visible CTA.
        if (!trace.source || !Object.hasOwn(canvaSources, trace.source)) return fail("not_ready", "기사 source 연결을 확인하세요.");
        mappings.push({ field, type: "text", source: trace.source, ...(trace.blockId ? { blockId: trace.blockId } : {}) });
      }
      const images: CanvaAutofillImageBinding[] = [];
      // Reuse the current single approved GPT-background upload receipt. No
      // arbitrary caller Canva asset IDs and no new upload are accepted here.
      for (const field of template.imageFields!) {
        const trace = prepared.imageFields[field], upload = row.execution?.backgroundUpload;
        if (upload?.status !== "success" || upload.sourceAssetId !== trace.sourceAssetId || upload.assetId !== trace.asset_id)
          return fail("not_ready", "현재 연결의 승인 배경 업로드 성공 참조가 필요합니다.");
        const background = await readCanvaBackground(access.project.id, trace.sourceAssetId!);
        images.push({ field, sourceHash: background.hash, upload,
          asset: { id: background.id, projectId: access.project.id, approvalStatus: "approved", isActive: true, mimeType: "image/png" } });
      }
      const fresh = buildCanonicalCanvaAutofillPayload({ templateId: template.id, project: access.project, article, fieldMappings: mappings, images });
      if (!fresh.isReady || !fresh.payload || digest(JSON.stringify(fresh.payload)) !== digest(JSON.stringify(prepared.payload)))
        return fail("not_ready", "저장된 기사·이미지 또는 전달 값이 변경되었습니다. payload를 다시 확인하세요.");
      const payload = fresh.payload, hash = digest(JSON.stringify(payload)), previous = row.execution;
      const same = previous?.articleId === article.id && previous.templateId === template.id && previous.hash === hash;
      if (previous?.key === input.requestKey && !same) return fail("not_ready", "이미 사용한 실행 식별자의 입력이 변경되었습니다.");
      if (same && previous?.job?.status === "success") return result(previous.job, true);
      if (same && previous?.status === "success" && !previous.job) return fail("canva_error", "기존 성공 결과 식별자가 없습니다. Canva에서 먼저 확인하세요.");
      if (previous?.pngImport && ["sending", "unknown", "in_progress", "ready"].includes(previous.pngImport.status))
        return fail("canva_error", "기존 PNG 가져오기를 먼저 확인하세요.");
      if (previous && ["sending", "unknown", "uploading", "in_progress"].includes(previous.status) && !(same && previous.job))
        return fail("canva_error", "이전 생성 결과가 미확정입니다. Canva에서 확인하기 전에는 재실행하지 않습니다.");
      if (same && previous?.status === "failed") return fail("canva_error", "이전 요청이 실패했습니다. 자동 재실행하지 않습니다.");
      const token = await accessToken(row, update);
      const dataset = await connectedCanvaRequest(`/brand-templates/${encodeURIComponent(template.canvaBrandTemplateId)}/dataset`, token, update);
      if (!datasetMatches(dataset, template.requiredFields!, template.imageFields!)) return fail("dataset_mismatch", "live dataset 필드명·타입이 registry와 다릅니다. 재검증하세요.");
      if (same && previous?.job) {
        const job = readCanvaJob(await connectedCanvaRequest(`/autofills/${encodeURIComponent(previous.job.id)}`, token, update));
        if (job.id !== previous.job.id) return fail("canva_error", "Canva 작업 식별자가 다릅니다.");
        await update({ execution: { ...previous, status: job.status, job } });
        return result(job, true);
      }
      // Persist sending BEFORE the single POST. A crash or uncertain response
      // blocks both same-key and new-key replay under the existing DB lease.
      const execution: Execution = { key: input.requestKey, hash, articleId: article.id, templateId: template.id, status: "sending",
        ...(images.length ? { backgroundUpload: row.execution!.backgroundUpload } : {}) };
      await update({ execution });
      try {
        const job = readCanvaJob(await connectedCanvaRequest("/autofills", token, update, payload));
        await update({ execution: { ...execution, status: job.status, job } });
        // Canva jobs are async. Return in_progress; a later explicit invocation
        // polls the saved job once, and never repeats the creation POST.
        return result(job);
      } catch (error) {
        const rejected = error instanceof CanvaConnectError && [401, 403, 404, 429].includes(error.status);
        await update({ execution: { ...execution, status: rejected ? "failed" : "unknown" } });
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof CanvaConnectError && error.status === 401) return fail("auth_required", "Canva 인증을 확인하고 다시 연결해 주세요.");
    return fail("canva_error", "Canva 실행 결과를 확인하지 못했습니다. 자동 재시도하지 않습니다.");
  }
}
