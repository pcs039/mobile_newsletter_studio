import "server-only";
import { getProjectDesignAssets } from "@/lib/newsletter-repository";
import { getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { adobeSourceEligible, type AdobeSource } from "@/lib/adobe-post-processing";

// Internal read-only preparation boundary. An eventual API caller must first
// require admin/project access; never accept a client-supplied source attestation.
export async function readAdobePostProcessingSource(projectSlug: string, projectId: string, sourceAssetId: string): Promise<AdobeSource | null> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(projectId) || !uuid.test(sourceAssetId)) return null;
  const result = await getProjectDesignAssets(projectSlug);
  const asset = result.ok ? result.assets.find(a => a.id === sourceAssetId && a.projectId === projectId) : undefined;
  if (!asset || asset.externalUrl || !["design-intake-assets", "design-production-assets"].includes(asset.storageBucket) ||
    !asset.storagePath.startsWith(projectId + "/") || asset.storagePath.includes("..") || asset.storagePath.includes("\\")) return null;
  const source: AdobeSource = {
    id: asset.id, projectId: asset.projectId, assetType: asset.assetType, name: asset.name, altText: asset.altText, usageNote: asset.usageNote,
    metadata: asset.metadata, language: asset.language, variant: asset.variant, approvalStatus: asset.approvalStatus,
    isActive: asset.isActive, mimeType: asset.mimeType, updated: asset.updated, privateImageVerified: true,
  };
  if (!adobeSourceEligible(projectId, source)) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = getSupabaseStorageEndpoint(`/bucket/${asset.storageBucket}`);
  const object = getSupabaseStorageEndpoint(`/object/${asset.storageBucket}/${asset.storagePath.split("/").map(encodeURIComponent).join("/")}`);
  if (!key || !bucket || !object) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const configuration = await fetch(bucket, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!configuration.ok || (await configuration.json()).public !== false) return null;
    const file = await fetch(object, { method: "HEAD", headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!file.ok || file.headers.get("content-type")?.split(";")[0] !== source.mimeType) return null;
    return source;
  } catch { return null; }
}
