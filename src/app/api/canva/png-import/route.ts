import { requireStagingE2E, stagingRequestAllowed } from "@/lib/staging-environment";
import { canvaAdmin, canvaFailure, canvaJson, sameOrigin } from "@/lib/canva-api-access";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { accessToken, connectedCanvaRequest } from "@/lib/canva-connect-server";
import { getConnection, withConnectionLock, type CanvaPngImport } from "@/lib/canva-connection-repository";
import { canvaImportAssetId, canvaImportAssetTypes, canvaPngImportEnabled, downloadCanvaPng, readCanvaExportJob, requireSinglePagePng } from "@/lib/canva-png-export";
import { findCanvaPngAsset, registerCanvaPngAsset } from "@/lib/canva-png-asset-repository";
import { canvaUuid } from "@/lib/canva-template";
import { getProjectContent } from "@/lib/newsletter-repository";

import { prepareDesignApproval, requireDesignApproval } from "@/lib/canva-design-approval";
import { createCanvaConfirmation, verifyCanvaConfirmation } from "@/lib/canva-confirmation";

export const runtime = "nodejs";
export const maxDuration = 60;

function publicImport(value: CanvaPngImport, articleId?: string, templateId?: string) {
  return { status: value.status, designId: value.designId, ...(articleId && templateId ? { articleId, templateId } : {}), ...(value.assetId ? { assetId: value.assetId, assetName: value.assetName, ...(value.status === "success" && articleId && templateId ? { candidate: { assetId: value.assetId, articleId, templateId, autoApplied: false } } : {}) } : {}) };
}

export async function GET(request: Request) {
  try {
    const u = new URL(request.url); const access = await canvaAdmin(u.searchParams.get("projectSlug") || "");
    if (!access.ok) return access.response;
    if (!stagingRequestAllowed(request) || !canvaPngImportEnabled()) return canvaJson({ ok: true, enabled: false });
    const articleId = u.searchParams.get("articleId");
    if (!canvaUuid.test(articleId || "")) throw new CanvaConnectError(400, "저장된 기사를 선택하세요.");
    const row = await getConnection(access.project.id, access.user.id);
    const current = row?.execution;
    const templateId = u.searchParams.get("templateId"), designId = u.searchParams.get("designId");
    if (templateId || designId) {
      if (!templateId || !designId || !current) throw new CanvaConnectError(409, "현재 제작 결과를 확인하세요.");
      const content = await getProjectContent(access.project.slug);
      const article = content.source === "supabase" ? content.articles.find(a => a.id === articleId) : null;
      if (!article) throw new CanvaConnectError(404, "현재 프로젝트의 저장된 기사를 선택하세요.");
      const candidate = await prepareDesignApproval(access.project, access.user.id, article, current, templateId, designId);
      let approved = false;
      try { requireDesignApproval(current, candidate.snapshot, designId); approved = true; } catch { /* Explicit approval is still required. */ }
      return canvaJson({ ok: true, enabled: true, designId, templateId, approved, confirmation: createCanvaConfirmation(candidate.binding),
        import: current.pngImport ? publicImport(current.pngImport, current.articleId, current.templateId) : null });
    }
    const value = current?.articleId === articleId && current.pngImport ? publicImport(current.pngImport, current.articleId, current.templateId) : null;
    return canvaJson({ ok: true, enabled: true, import: value, templateId: current?.templateId });
  } catch (error) { return canvaFailure(error); }
}

export async function POST(request: Request) {
  try {
    requireStagingE2E(request);
    sameOrigin(request);
    const p = await request.json();
    if (!p || Object.keys(p).some(k => !["projectSlug", "articleId", "designId", "action", "assetType", "templateId", "confirmation"].includes(k)) ||
      typeof p.projectSlug !== "string" || !canvaUuid.test(p.articleId || "") || typeof p.designId !== "string" ||
      !/^D[A-Za-z0-9_-]{1,199}$/.test(p.designId) || !["start", "status", "approve", "revoke"].includes(p.action) || typeof p.templateId !== "string" ||
      (p.action === "start" && !canvaImportAssetTypes.includes(p.assetType))) throw new CanvaConnectError(400, "기사와 가져올 디자인 유형을 확인해 주세요.");
    const access = await canvaAdmin(p.projectSlug); if (!access.ok) return access.response;
    if (!canvaPngImportEnabled()) throw new CanvaConnectError(403, "PNG 디자인 자산 가져오기는 Staging에서만 사용할 수 있습니다.");
    const content = await getProjectContent(access.project.slug);
    const article = content.source === "supabase" ? content.articles.find(a => a.id === p.articleId) : null;
    if (!article) throw new CanvaConnectError(404, "현재 프로젝트의 저장된 기사를 선택하세요.");
    return await withConnectionLock(access.project.id, access.user.id, async (row, update) => {
      const e = row.execution;
      if (e?.articleId !== article.id || e.status !== "success" || e.job?.status !== "success" || e.job.designId !== p.designId) {
        throw new CanvaConnectError(404, "현재 프로젝트에서 생성 완료된 Canva 결과만 가져올 수 있습니다.");
      }
      if (e.templateId !== p.templateId) throw new CanvaConnectError(409, "선택한 템플릿이 변경되었습니다.");
      if (p.action === "revoke") {
        if (e.pngImport && ["sending", "unknown", "in_progress", "ready"].includes(e.pngImport.status))
          throw new CanvaConnectError(409, "진행 중인 가져오기를 먼저 확인하세요.");
        await update({ execution: { ...e, ...(e.designReview ? { designReview: { ...e.designReview, status: "needs_revision" } } : {}) } });
        return canvaJson({ ok: true, approved: false });
      }
      const candidate = await prepareDesignApproval(access.project, access.user.id, article, e, p.templateId, p.designId);
      if (p.action === "approve") {
        if (!verifyCanvaConfirmation(p.confirmation, candidate.binding)) throw new CanvaConnectError(409, "검토 시간이 지났거나 기사 내용이 변경되었습니다. 다시 확인하세요.");
        await update({ execution: { ...e, designReview: { status: "approved", designId: p.designId, articleId: article.id, templateId: e.templateId,
          snapshotHash: candidate.snapshot, executionHash: e.hash, approvedAt: new Date().toISOString() } } });
        return canvaJson({ ok: true, approved: true });
      }
      requireDesignApproval(e, candidate.snapshot, p.designId);
      const assetId = canvaImportAssetId(access.project.id, p.designId);
      const existing = await findCanvaPngAsset(access.project.id, assetId, p.designId);
      const previous = e.pngImport;
      async function save(value: CanvaPngImport) { await update({ execution: { ...e, pngImport: value } }); return value; }
      if (existing) {
        const done = await save({ ...previous, designId: p.designId, assetType: previous?.assetType || p.assetType || "illustration", status: "success", assetId: existing.id, assetName: existing.name });
        return canvaJson({ ok: true, import: publicImport(done, e.articleId, e.templateId), duplicate: true });
      }
      if (previous?.status === "success") throw new CanvaConnectError(409, "등록했던 디자인 자산이 삭제되었습니다. 자산 관리 화면에서 확인하세요.");
      if (previous && ["sending", "unknown", "failed"].includes(previous.status)) throw new CanvaConnectError(409, "이전 내보내기 결과가 불확실합니다. 중복 요청을 보내지 않고 Canva에서 확인해야 합니다.");
      if (p.action === "status" && !previous?.jobId) throw new CanvaConnectError(409, "확인할 내보내기 작업이 없습니다.");
      const token = await accessToken(row, update);
      let state: CanvaPngImport;
      let job: ReturnType<typeof readCanvaExportJob>;
      if (previous?.jobId && ["in_progress", "ready"].includes(previous.status)) {
        state = previous;
        job = readCanvaExportJob(await connectedCanvaRequest(`/exports/${encodeURIComponent(previous.jobId)}`, token, update));
        if (job.id !== previous.jobId) throw new CanvaConnectError(502, "Canva 내보내기 작업 식별자가 다릅니다.");
      } else {
        if (p.action !== "start") return canvaJson({ ok: true, import: previous ? publicImport(previous) : null });
        const [formats, design] = await Promise.all([
          connectedCanvaRequest(`/designs/${encodeURIComponent(p.designId)}/export-formats`, token, update),
          connectedCanvaRequest(`/designs/${encodeURIComponent(p.designId)}`, token, update),
        ]);
        if ((design as { design?: { id?: string } }).design?.id !== p.designId) throw new CanvaConnectError(502, "Canva 디자인 식별자가 다릅니다.");
        requireSinglePagePng(formats, design);
        state = await save({ designId: p.designId, assetType: p.assetType, status: "sending" });
        try {
          // Only this explicit start action creates a job. Never retry POST automatically.
          job = readCanvaExportJob(await connectedCanvaRequest("/exports", token, update, {
            design_id: p.designId, format: { type: "png", pages: [1], lossless: true, transparent_background: false },
          }));
        } catch (error) {
          const rejected = error instanceof CanvaConnectError && [401,403,404,429].includes(error.status);
          await save({ ...state, status: rejected ? "failed" : "unknown" });
          throw error;
        }
      }
      state = await save({ ...state, jobId: job.id, status: job.status === "success" ? "ready" : job.status });
      if (job.status === "failed") throw new CanvaConnectError(502, "Canva 내보내기에 실패했습니다. 기사와 원본 디자인은 그대로입니다.");
      if (job.status === "in_progress") return canvaJson({ ok: true, import: publicImport(state) });
      // Expose the completed export phase before importing bytes. The next
      // status-only request reuses this job and never creates another export.
      if (previous?.status !== "ready") return canvaJson({ ok: true, import: publicImport(state) });
      // Download URL lives only in this request; it is never persisted or returned.
      const png = await downloadCanvaPng(job.url!);
      const saved = await registerCanvaPngAsset({
        projectId: access.project.id, designId: p.designId, assetId,
        assetType: state.assetType as typeof canvaImportAssetTypes[number],
        articleId: article.id, templateId: e.templateId, importedAt: new Date().toISOString(),
        name: `${article.title.trim().slice(0,180) || "Canva 디자인"} · Canva PNG`, file: png.file,
      });
      const done = await save({ ...state, status: "success", assetId: saved.id, assetName: saved.name });
      return canvaJson({ ok: true, import: publicImport(done, e.articleId, e.templateId) });
    });
  } catch (error) { return canvaFailure(error); }
}
