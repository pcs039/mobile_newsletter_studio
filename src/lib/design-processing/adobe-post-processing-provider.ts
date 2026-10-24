import "server-only";
import { adobeAdapterVersion, getAdobeCapabilities, type AdobeCapabilities, type AdobePostProcessingPlan } from "@/lib/adobe-post-processing";
import { getDesignProcessingProviderAdapter } from "@/lib/design-processing/provider";

export type AdobeProviderResult = { status: "unavailable"; message: string };
export interface AdobePostProcessingProvider {
  readonly version: string;
  getCapabilities(): AdobeCapabilities;
  execute(plan: AdobePostProcessingPlan): Promise<AdobeProviderResult>;
}
// Descriptive operation support in the existing adapter is not API entitlement.
// No credentials, endpoint guesses, uploads, fake output or mock success here.
export function getAdobePostProcessingProvider(): AdobePostProcessingProvider {
  const existing = getDesignProcessingProviderAdapter("adobe_photoshop");
  return {
    version: adobeAdapterVersion,
    getCapabilities: () => getAdobeCapabilities(existing.supportedOperations.includes("adobe_photoshop_remove_background")
      ? { remove_background: { entitlementVerified: false, adapterReady: false } } : undefined),
    async execute() { return { status: "unavailable", message: "현재 Adobe 자동 처리 연결을 확인 중입니다. 원본 자산은 유지됩니다." }; },
  };
}
