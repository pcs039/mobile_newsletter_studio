import type { ProjectDesignAsset } from "@/lib/newsletter-repository";
import { readDesignAssetMetadata, type DesignAssetMetadata } from "@/lib/design-asset-metadata";
import { classifyInstitutionAsset } from "@/lib/institution-asset-matching";

export const adobePostProcessLabels = { remove_background: "배경 제거", upscale: "고해상도 변환", extend_canvas: "캔버스 확장" } as const;
export type AdobePostProcessOperation = keyof typeof adobePostProcessLabels;
export const adobeAdapterVersion = "post-processing-v1";
export type AdobeSource = Pick<ProjectDesignAsset, "id" | "projectId" | "assetType" | "isActive" | "approvalStatus" | "mimeType" | "updated" | "name" | "altText" | "usageNote" | "metadata" | "language" | "variant"> & {
  // Execution callers must establish this on the server using ownership, private
  // bucket and object checks. A client-side candidate is never that attestation.
  privateImageVerified: boolean;
  dimensions?: { width: number; height: number };
};
export type AdobeParameters = { targetWidth?: number; targetHeight?: number; cropWouldCutSubject?: boolean };
export type AdobePostProcessingPlan = {
  version: "v1"; sourceAssetId: string; operation: AdobePostProcessOperation; reason: string;
  outputFormat: "png"; preserveSource: true; humanReviewRequired: true; parameters: AdobeParameters;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isAdobeOperation = (v: unknown): v is AdobePostProcessOperation => typeof v === "string" && Object.hasOwn(adobePostProcessLabels, v);
const size = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 8192;
export function validAdobeParameters(operation: AdobePostProcessOperation, p: AdobeParameters) {
  if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).some(k => !["targetWidth", "targetHeight", "cropWouldCutSubject"].includes(k))) return false;
  if (operation === "remove_background") return Object.keys(p).length === 0;
  return size(p.targetWidth) && size(p.targetHeight) && (p.cropWouldCutSubject === undefined || typeof p.cropWouldCutSubject === "boolean");
}
export function adobeSourceEligible(projectId: string, a: AdobeSource) {
  return uuid.test(projectId) && uuid.test(a.id) && a.projectId === projectId && a.isActive &&
    ["draft", "approved"].includes(a.approvalStatus) && ["image/png", "image/jpeg", "image/webp"].includes(a.mimeType) && a.privateImageVerified;
}
export function adobeSafeSourceSnapshot(a: AdobeSource) {
  const m = readDesignAssetMetadata(a.metadata);
  return { id: a.id, projectId: a.projectId, assetType: a.assetType, isActive: a.isActive, approvalStatus: a.approvalStatus,
    mimeType: a.mimeType, updated: /^\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?$/.test(a.updated) ? a.updated : null,
    dimensions: a.dimensions && size(a.dimensions.width) && size(a.dimensions.height) ? { width: a.dimensions.width, height: a.dimensions.height } : null,
    kind: classifyInstitutionAsset({ ...a, hasPrivateImage: a.privateImageVerified }),
    metadata: m ? { source: m.source ?? null, usageTags: [...(m.usageTags ?? [])].sort(), reuseScope: m.reuseScope ?? null, transparency: m.transparency ?? null } : null };
}
export function recommendAdobeOperations(projectId: string, a: AdobeSource, p: AdobeParameters = {}): AdobePostProcessOperation[] {
  if (!adobeSourceEligible(projectId, a)) return [];
  const snapshot = adobeSafeSourceSnapshot(a), operations: AdobePostProcessOperation[] = [];
  const standaloneSubject = ["real_person_photo", "character"].includes(snapshot.kind) || /제품|사물/.test(a.altText + " " + a.usageNote);
  if (standaloneSubject && !["poster", "event_photo", "place_photo", "facility_photo"].includes(snapshot.kind) && snapshot.metadata?.transparency !== "yes") operations.push("remove_background");
  if (snapshot.dimensions && size(p.targetWidth) && size(p.targetHeight)) {
    if (snapshot.dimensions.width < p.targetWidth || snapshot.dimensions.height < p.targetHeight) operations.push("upscale");
    if (p.cropWouldCutSubject === true && Math.abs(snapshot.dimensions.width / snapshot.dimensions.height - p.targetWidth / p.targetHeight) > 0.01) operations.push("extend_canvas");
  }
  return operations;
}
export function buildAdobePostProcessingPlan(projectId: string, a: AdobeSource, operation: AdobePostProcessOperation, p: AdobeParameters = {}): AdobePostProcessingPlan | null {
  if (!isAdobeOperation(operation) || !adobeSourceEligible(projectId, a) || !validAdobeParameters(operation, p)) return null;
  return { version: "v1", sourceAssetId: a.id, operation, reason: recommendAdobeOperations(projectId, a, p).includes(operation) ? `${adobePostProcessLabels[operation]} 후보입니다. 실제 대상과 품질을 검토하세요.` : "추천 근거 또는 사용 크기를 확인한 뒤 작업자가 판단해야 합니다.",
    outputFormat: "png", preserveSource: true, humanReviewRequired: true,
    parameters: operation === "remove_background" ? {} : { targetWidth: p.targetWidth, targetHeight: p.targetHeight, ...(p.cropWouldCutSubject === undefined ? {} : { cropWouldCutSubject: p.cropWouldCutSubject }) } };
}
export async function buildAdobeProcessingKey(projectId: string, a: AdobeSource, plan: AdobePostProcessingPlan) {
  const checked = buildAdobePostProcessingPlan(projectId, a, plan.operation, plan.parameters);
  if (!checked || plan.sourceAssetId !== a.id) throw new Error("Adobe processing source is invalid");
  const safe = { projectId, source: adobeSafeSourceSnapshot(a), operation: checked.operation, parameters: checked.parameters, adapterVersion: adobeAdapterVersion };
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(safe)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export type AdobeCapability = { provider: "adobe"; available: boolean; reason: "available" | "entitlement_not_verified" | "adapter_unavailable" };
export type AdobeCapabilities = Record<AdobePostProcessOperation, AdobeCapability>;
export function getAdobeCapabilities(state?: Partial<Record<AdobePostProcessOperation, { entitlementVerified: boolean; adapterReady: boolean }>>): AdobeCapabilities {
  const capability = (operation: AdobePostProcessOperation): AdobeCapability => {
    const s = state?.[operation];
    return { provider: "adobe", available: s?.entitlementVerified === true && s.adapterReady === true,
      reason: !s?.entitlementVerified ? "entitlement_not_verified" : !s.adapterReady ? "adapter_unavailable" : "available" };
  };
  return { remove_background: capability("remove_background"), upscale: capability("upscale"), extend_canvas: capability("extend_canvas") };
}
export type AdobeReceipt = { projectId: string; sourceAssetId: string; processingKey: string; status: "success" | "in_progress" | "unknown" | "failed"; assetId?: string };
export function adobeReceiptPolicy(receipt: AdobeReceipt | undefined, projectId: string, sourceAssetId: string, key: string) {
  if (!receipt) return "new" as const;
  if (receipt.projectId !== projectId || receipt.sourceAssetId !== sourceAssetId || receipt.processingKey !== key) return "conflict" as const;
  if (!["success", "in_progress", "unknown", "failed"].includes(receipt.status)) return "unknown" as const;
  if (receipt.status === "success") return receipt.assetId && uuid.test(receipt.assetId) && receipt.assetId !== sourceAssetId ? "reuse" as const : "unknown" as const;
  return receipt.status === "in_progress" ? "poll_only" as const : receipt.status;
}
export async function buildAdobeResultRegistration(projectId: string, source: AdobeSource, plan: AdobePostProcessingPlan, key: string, resultAssetId: string) {
  if (!adobeSourceEligible(projectId, source) || source.id !== plan.sourceAssetId || !isAdobeOperation(plan.operation) || !/^[a-f0-9]{64}$/.test(key) || !uuid.test(resultAssetId) || resultAssetId === source.id || key !== await buildAdobeProcessingKey(projectId, source, plan)) throw new Error("Adobe result registration is invalid");
  const metadata: DesignAssetMetadata = { source: "adobe", reuseScope: "project", transparency: plan.operation === "remove_background" ? "yes" : "unknown", adobeProcessing: { sourceAssetId: source.id, operation: plan.operation, operationVersion: "v1", processingKey: key } };
  // Existing FK/trigger permits source_design only. Raster input lineage remains
  // explicit in JSON; never force a reference/production ID into that FK.
  return { id: resultAssetId, project_id: projectId, parent_source_asset_id: source.assetType === "source_design" ? source.id : null, approval_status: "draft" as const, is_active: true, metadata };
}
