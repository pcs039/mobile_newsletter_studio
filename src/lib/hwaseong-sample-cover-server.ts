import "server-only";
import { stagingEnvironmentConfigured, stagingOrigin } from "@/lib/staging-environment";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { hwaseongSampleSlug } from "@/lib/hwaseong-proposal-sample";

const maxInlineBytes = 256 * 1024;

// Call only AFTER project preview access succeeds. This is request-local, never
// a public image cache or signed URL. The original Storage object is unchanged.
export async function prepareSampleCover(projectId: string, slug: string, source: string): Promise<string | null> {
  if (!stagingEnvironmentConfigured() || slug !== hwaseongSampleSlug || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return null;
  try {
    const url = new URL(source, stagingOrigin);
    const path = url.searchParams.get("path") ?? "";
    // Only the existing local cover reference, never arbitrary URLs or projects.
    if (url.origin !== stagingOrigin || url.pathname !== "/api/project-files/preview" || url.hash || url.username || url.password
      || url.searchParams.getAll("bucket").length !== 1 || url.searchParams.get("bucket") !== "design-production-assets"
      || url.searchParams.getAll("path").length !== 1 || [...url.searchParams.keys()].some(k => !["bucket", "path"].includes(k))
      || !path.startsWith(`projects/${projectId}/production/`) || !/^[a-z0-9_./-]+$/i.test(path) || path.includes("..") || !path.endsWith(".webp")) return null;
    const metadataUrl = getSupabaseRestEndpoint(`/rest/v1/newsletter_project_design_assets?${new URLSearchParams({
      select: "project_id,storage_bucket,storage_path,mime_type,file_size_bytes,is_active", project_id: `eq.${projectId}`,
      storage_bucket: "eq.design-production-assets", storage_path: `eq.${path}`, is_active: "eq.true", limit: "1",
    })}`);
    const objectUrl = getSupabaseStorageEndpoint(`/object/design-production-assets/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (!metadataUrl || !objectUrl) return null;
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const signal = AbortSignal.timeout(2500);
    const lookup = await fetch(metadataUrl, { headers, cache: "no-store", redirect: "error", signal });
    if (!lookup.ok) return null;
    const [asset] = await lookup.json();
    if (!asset || asset.project_id !== projectId || asset.storage_bucket !== "design-production-assets" || asset.storage_path !== path
      || asset.is_active !== true || asset.mime_type !== "image/webp" || !Number.isSafeInteger(asset.file_size_bytes)
      || asset.file_size_bytes < 12 || asset.file_size_bytes > maxInlineBytes) return null;
    const response = await fetch(objectUrl, { headers, cache: "no-store", redirect: "error", signal });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxInlineBytes) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (length !== asset.file_size_bytes) return null;
    const bytes = Buffer.concat(chunks);
    if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
    return `data:image/webp;base64,${bytes.toString("base64")}`;
  } catch { return null; } // Preserve the existing authenticated URL on timeout/failure.
}
