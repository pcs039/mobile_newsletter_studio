import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { stagingEnvironmentConfigured, stagingOrigin } from "@/lib/staging-environment";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { hwaseongSampleSlug, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

const maxSource = 768 * 1024, maxTotalSource = 2 * 1024 * 1024, maxThumbnail = 48 * 1024;
// Derived bytes only, content-addressed and bounded. Authorization and current
// project/asset lookup still run BEFORE every cache read; nothing is public.
const thumbnails = new Map<string, Buffer>();

// Same viewport geometry as TocThumbnail's existing object-cover CSS. A thumbnail
// is already framed, so its client must not crop it a second time.
export function sampleTocCrop(width: number, height: number, kind: string, artVersion: number) {
  const frameW = 768, frameH = 432;
  const comic = kind === "cartoon" && artVersion === 3;
  const boxH = frameH * (comic ? 3.06 : kind === "policy" ? 1.6 : 1);
  let scale = Math.max(frameW / width, boxH / height);
  let left = (frameW - width * scale) / 2;
  const position = comic || kind === "interview" ? 0 : kind === "event" || kind === "accessible" ? 1 : 0.5;
  let top = (boxH - height * scale) * position - (kind === "policy" ? frameH * 0.4 : 0);
  if (kind === "accessible") { left = left * 1.05 - frameW * 0.025; top = top * 1.05 - frameH * 0.05; scale *= 1.05; }
  const x = Math.max(0, Math.round(-left / scale)), y = Math.max(0, Math.round(-top / scale));
  return { left: x, top: y, width: Math.max(1, Math.min(width - x, Math.round(frameW / scale))), height: Math.max(1, Math.min(height - y, Math.round(frameH / scale))) };
}

type Asset = { project_id: string; storage_path: string; storage_bucket: string; mime_type: string; file_size_bytes: number; is_active: boolean };
export async function prepareSampleToc(projectId: string, slug: string, samples: ProposalSample[]): Promise<Record<string, string>> {
  return prepareSampleImages(projectId, slug, samples, false);
}

// One full, lossless map for local article navigation; never preload all originals.
export async function prepareSampleMap(projectId: string, slug: string, samples: ProposalSample[]): Promise<string | undefined> {
  const map = samples.find(s => s.kind === "tourism");
  if (!map) return undefined;
  return (await prepareSampleImages(projectId, slug, [map], true))[map.article.id];
}

async function prepareSampleImages(projectId: string, slug: string, samples: ProposalSample[], fullMap: boolean): Promise<Record<string, string>> {
  if (!stagingEnvironmentConfigured() || slug !== hwaseongSampleSlug || !/^[a-f0-9-]{36}$/i.test(projectId) || samples.length > 7) return {};
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return {};
  const selected = samples.flatMap(sample => {
    try {
      const url = new URL(sample.cover, stagingOrigin), path = url.searchParams.get("path") ?? "";
      if (url.origin !== stagingOrigin || url.pathname !== "/api/project-files/preview" || url.hash || url.username || url.password
        || url.searchParams.getAll("bucket").length !== 1 || url.searchParams.get("bucket") !== "design-production-assets"
        || url.searchParams.getAll("path").length !== 1 || [...url.searchParams.keys()].some(k => !["bucket", "path"].includes(k))
        || !path.startsWith(`projects/${projectId}/production/`) || !/^[a-z0-9_./-]+$/i.test(path) || path.includes("..")) return [];
      return [{ sample, path }];
    } catch { return []; }
  });
  if (!selected.length) return {};
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const signal = AbortSignal.timeout(2500);
  const result: Record<string, string> = {};
  try {
    const endpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_project_design_assets?${new URLSearchParams({
      select: "project_id,storage_path,storage_bucket,mime_type,file_size_bytes,is_active", project_id: `eq.${projectId}`,
      storage_bucket: "eq.design-production-assets", is_active: "eq.true", storage_path: `in.(${selected.map(s => s.path).join(",")})`, limit: "7",
    })}`);
    if (!endpoint) return result;
    const lookup = await fetch(endpoint, { headers, cache: "no-store", redirect: "error", signal });
    if (!lookup.ok) return result;
    const assets: Asset[] = await lookup.json();
    let budget = 0;
    const jobs = selected.flatMap(item => {
      const asset = assets.find(a => a.project_id === projectId && a.storage_path === item.path && a.storage_bucket === "design-production-assets"
        && a.is_active === true && ["image/png", "image/jpeg", "image/webp"].includes(a.mime_type) && Number.isSafeInteger(a.file_size_bytes)
        && a.file_size_bytes > 0 && a.file_size_bytes <= maxSource);
      if (!asset || budget + asset.file_size_bytes > maxTotalSource) return [];
      budget += asset.file_size_bytes;
      return [{ ...item, asset }];
    });
    let next = 0, outputBytes = 0;
    async function worker() {
      while (next < jobs.length && !signal.aborted) {
        const { sample, path, asset } = jobs[next++];
        try {
          const url = getSupabaseStorageEndpoint(`/object/design-production-assets/${path.split("/").map(encodeURIComponent).join("/")}`);
          if (!url) continue;
          const response = await fetch(url, { headers, cache: "no-store", redirect: "error", signal });
          if (!response.ok || !response.body) continue;
          const reader = response.body.getReader(), chunks: Uint8Array[] = [];
          let length = 0;
          try {
            while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > maxSource) { await reader.cancel(); break; } chunks.push(part.value); }
          } finally { reader.releaseLock(); }
          if (length > maxSource || length !== asset.file_size_bytes) continue;
          const bytes = Buffer.concat(chunks);
          const hash = createHash("sha256").update(bytes).update(`${asset.mime_type}:${sample.kind}:${sample.artDirectionVersion}:${fullMap ? "map-v1" : "toc-v1"}`).digest("hex");
          let thumbnail = thumbnails.get(hash);
          if (!thumbnail) {
            const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: "error" });
            const meta = await image.metadata();
            if (!meta.width || !meta.height || (meta.orientation && meta.orientation !== 1) || (meta.pages ?? 1) > 1
              || `image/${meta.format === "jpeg" ? "jpeg" : meta.format}` !== asset.mime_type) continue;
            if (fullMap) {
              // Original 1024×700 coordinate system and decoded pixels are preserved.
              if (meta.width !== 1024 || meta.height !== 700) continue;
              thumbnail = await image.webp({ lossless: true, effort: 3 }).timeout({ seconds: 1 }).toBuffer();
            } else {
              const cropped = image.extract(sampleTocCrop(meta.width, meta.height, sample.kind, sample.artDirectionVersion));
              for (const [width, height, quality] of [[768, 432, 82], [640, 360, 76], [512, 288, 74]]) {
                thumbnail = await cropped.clone().resize(width, height).webp({ quality, effort: 3 }).timeout({ seconds: 1 }).toBuffer();
                if (thumbnail.length <= maxThumbnail) break;
              }
            }
            if (!thumbnail || thumbnail.length > (fullMap ? 512 * 1024 : maxThumbnail)) continue;
            if (thumbnails.size >= 16) thumbnails.delete(thumbnails.keys().next().value!);
            thumbnails.set(hash, thumbnail);
          }
          if (outputBytes + thumbnail.length > (fullMap ? 512 * 1024 : 256 * 1024)) continue;
          outputBytes += thumbnail.length;
          result[sample.article.id] = `data:image/webp;base64,${thumbnail.toString("base64")}`;
        } catch { /* Keep this card's original, authenticated image on failure. */ }
      }
    }
    await Promise.all([worker(), worker()]);
  } catch { /* Preserve the existing TOC if metadata or Storage is unavailable. */ }
  return result;
}
