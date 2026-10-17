import "server-only";
import { adobeReceiptPolicy, buildAdobePostProcessingPlan, buildAdobeProcessingKey, type AdobeParameters, type AdobePostProcessOperation, type AdobeReceipt, type AdobeSource } from "@/lib/adobe-post-processing";
import { getAdobePostProcessingProvider } from "@/lib/design-processing/adobe-post-processing-provider";

// Server contract only; no public execution route or job insert until entitlement,
// private-file relay and the existing job input restrictions are resolved.
export async function executeAdobePostProcessing(input: {
  projectId: string; source: AdobeSource; operation: AdobePostProcessOperation;
  parameters?: AdobeParameters; expectedKey: string; receipt?: AdobeReceipt;
}) {
  const plan = buildAdobePostProcessingPlan(input.projectId, input.source, input.operation, input.parameters);
  if (!plan) return { status: "invalid_source" as const, message: "현재 프로젝트의 활성 이미지와 사용 가능한 승인 상태를 확인하세요." };
  const key = await buildAdobeProcessingKey(input.projectId, input.source, plan);
  if (key !== input.expectedKey) return { status: "conflict" as const, message: "원본 자산이 변경되었습니다. 후처리 계획을 다시 확인하세요." };
  const policy = adobeReceiptPolicy(input.receipt, input.projectId, input.source.id, key);
  if (policy === "reuse") return { status: "success" as const, assetId: input.receipt!.assetId, duplicate: true };
  if (policy !== "new") return { status: policy === "poll_only" ? "in_progress" as const : policy, message: policy === "unknown" ? "결과 확인 필요 · 자동으로 다시 실행하지 않습니다." : "기존 처리 상태를 확인하세요. 새 작업을 실행하지 않습니다." };
  const provider = getAdobePostProcessingProvider();
  if (!provider.getCapabilities()[plan.operation].available) return { status: "unavailable" as const, message: "현재 Adobe 자동 처리 연결을 확인 중입니다. 원본 자산은 유지됩니다." };
  // The installed provider is unavailable and cannot create a job/result. A future
  // live adapter must claim a durable job before any POST, then use shared asset
  // registration (new ID, draft, x-upsert:false) and revalidate source/result.
  return provider.execute(plan);
}
