import type { ProjectDesignAsset } from "@/lib/newsletter-repository";
import { adobePostProcessLabels, getAdobeCapabilities, recommendAdobeOperations, type AdobeSource } from "@/lib/adobe-post-processing";

export function AdobePostProcessingControls({ asset }: { asset: ProjectDesignAsset }) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) return null;
  // Advisory UI only. Presence of a stored reference is not a server object check
  // or execution authority. All installed Adobe capabilities remain unavailable.
  const source: AdobeSource = { ...asset, privateImageVerified: ["design-intake-assets", "design-production-assets"].includes(asset.storageBucket) && !!asset.storagePath && !asset.externalUrl };
  const recommended = recommendAdobeOperations(asset.projectId, source), capabilities = getAdobeCapabilities();
  return <details className="mt-3 min-w-0 rounded border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]">
    <summary className="cursor-pointer text-xs font-bold">Adobe 후처리</summary>
    <p role="status" className="mt-2 text-xs">현재 Adobe 자동 처리 연결을 확인 중입니다.</p>
    <p className="mt-1 text-xs">원본은 유지하고 결과는 새로운 미승인 자산으로 등록할 계획입니다. 자동 승인·기사 적용은 하지 않습니다.</p>
    {!asset.isActive || !["draft", "approved"].includes(asset.approvalStatus) ? <p className="mt-1 text-xs">활성 자산과 사용 가능한 승인 상태를 확인하세요.</p> : null}
    <ul className="mt-2 space-y-2 text-xs">
      {Object.entries(adobePostProcessLabels).map(([key, label]) => {
        const operation = key as keyof typeof adobePostProcessLabels;
        return <li key={key} className="flex min-w-0 flex-wrap items-center gap-2">
          <button type="button" disabled={!capabilities[operation].available} className="dd-btn dd-btn-secondary dd-btn-sm max-w-full whitespace-normal">{label}</button>
          <span>{recommended.includes(operation) ? "후처리 후보 · 검토 필요" : operation === "remove_background" ? "피사체와 배경을 먼저 확인하세요." : operation === "upscale" ? "원본 해상도와 사용 크기 확인 필요" : "비율과 피사체 잘림 확인 필요"}</span>
        </li>;
      })}
    </ul>
    <p className="mt-2 text-xs">배경 제거는 인물·캐릭터·사물 후보에 적합하며, 현장 전체 사진·풍경·포스터에는 우선 권장하지 않습니다.</p>
    {asset.metadata?.adobeProcessing ? <p className="mt-2 text-xs">원본 {asset.metadata.adobeProcessing.sourceAssetId} → Adobe 후처리 결과 · 별도 사용 승인 필요</p> : null}
  </details>;
}
