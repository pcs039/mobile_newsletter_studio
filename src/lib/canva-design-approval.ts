import "server-only";
import { CanvaConnectError, digest } from "@/lib/canva-connect-contract";
import type { Execution } from "@/lib/canva-connection-repository";
import type { ProjectContentArticle } from "@/lib/newsletter-repository";
import { getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";
import { buildCanonicalCanvaAutofillPayload, type CanvaAutofillImageBinding } from "@/lib/canva-autofill-payload";
import { readCanvaBackground } from "@/lib/canva-background-repository";

export function designApprovalBinding(projectId: string, userId: string, articleId: string, e: Execution, snapshot: string) {
  return JSON.stringify(["canva-design-approval-v1", projectId, userId, articleId, e.templateId, e.key, e.hash, e.job?.designId, snapshot]);
}
export async function prepareDesignApproval(project: { id: string; title: string; issue: string }, userId: string, article: ProjectContentArticle, e: Execution, templateId: string, designId: string) {
  const template = getCanonicalCanvaTemplate(templateId);
  if (!template || template.datasetStatus !== "verified" || e.templateId !== templateId || e.articleId !== article.id || e.status !== "success" || e.job?.status !== "success" || e.job.designId !== designId)
    throw new CanvaConnectError(409, "현재 기사에서 생성 완료된 디자인을 다시 확인해 주세요.");
  const images: CanvaAutofillImageBinding[] = [];
  const upload = e.backgroundUpload;
  if (upload?.status === "success") {
    const background = await readCanvaBackground(project.id, upload.sourceAssetId);
    images.push({ field: "MAIN_IMAGE", sourceHash: background.hash, upload, asset: { id: background.id, projectId: project.id, approvalStatus: "approved", isActive: true, mimeType: "image/png" } });
  }
  const fresh = buildCanonicalCanvaAutofillPayload({ templateId, project, article, images });
  if (!fresh.isReady || digest(JSON.stringify(fresh.payload)) !== e.hash)
    throw new CanvaConnectError(409, "기사 내용 또는 디자인 자산이 변경되었습니다. 현재 결과를 다시 검토하세요.");
  const snapshot = digest(JSON.stringify(article));
  if (e.articleSnapshotHash && e.articleSnapshotHash !== snapshot)
    throw new CanvaConnectError(409, "기사 내용이 변경되었습니다. 현재 결과를 다시 검토하세요.");
  return { snapshot, binding: designApprovalBinding(project.id, userId, article.id, e, snapshot) };
}
export function requireDesignApproval(e: Execution, snapshot: string, designId: string) {
  const a = e.designReview;
  if (!a || a.status !== "approved" || a.designId !== designId || a.articleId !== e.articleId || a.templateId !== e.templateId || a.snapshotHash !== snapshot || a.executionHash !== e.hash)
    throw new CanvaConnectError(409, "이 디자인 사용으로 현재 결과를 먼저 승인해 주세요.");
}
