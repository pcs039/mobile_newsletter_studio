import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseConfigStatus } from "@/lib/supabase-config";
import { DirectUploadError, directUploadMaxBytes, type UploadSession } from "@/lib/design-asset-direct-upload-contract";

export const uploadHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export function uploadTransport(signal: AbortSignal) {
  const config = getSupabaseConfigStatus(), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config.url || !key || new URL(config.url).protocol !== "https:") throw new DirectUploadError(503, "upload_configuration", "rejected");
  const origin = new URL(config.url).origin, base = `${origin}/storage/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  async function send(url: string, init: RequestInit = {}) {
    try { return await fetch(url, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }); }
    catch { throw new DirectUploadError(502, "transport_unknown"); }
  }
  async function rpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
    const r = await send(`${origin}/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(payload) });
    if (!r.ok) {
      let code = "", message = ""; try { const error=await r.json();code=String(error.code);message=String(error.message); } catch { /* Never return provider text. */ }
      if (code === "42501") throw new DirectUploadError(403, "upload_forbidden", "rejected");
      if (code === "PT409") {
        if(["request_key_conflict","project_unavailable"].includes(message))throw new DirectUploadError(409,message,"rejected");
        if(message==="upload_quota")throw new DirectUploadError(429,"upload_quota","pending");
        throw new DirectUploadError(409, "upload_conflict", "pending");
      }
      if (code === "22023" || code === "23514") throw new DirectUploadError(400, "invalid_upload", "rejected");
      throw new DirectUploadError(502, "database_unknown");
    }
    try { return await r.json() as T; } catch { throw new DirectUploadError(502, "database_unknown"); }
  }
  function objectPath(s: UploadSession, final: boolean) {
    const ext = s.mime === "image/png" ? "png" : s.mime === "image/jpeg" ? "jpg" : s.mime === "image/webp" ? "webp" : "";
    const expected = final ? `projects/${s.project_id}/production/${s.asset_type}/direct-v1/${s.id}/${s.generation}.${ext}` : `projects/${s.project_id}/design-upload-v1/${s.id}/input.${ext}`;
    const path = final ? s.final_path : s.temp_path, bucket = final ? "design-production-assets" : "design-upload-quarantine";
    if (!ext || path !== expected || (!final && s.temp_bucket !== bucket)) throw new DirectUploadError(409, "session_path_conflict", "rejected");
    return { bucket, path: expected, encoded: expected.split("/").map(encodeURIComponent).join("/") };
  }
  async function checkBuckets() {
    for (const bucket of ["design-upload-quarantine", "design-production-assets"]) {
      const r = await send(`${base}/bucket/${bucket}`);
      if (!r.ok) throw new DirectUploadError(503, "bucket_configuration", "rejected");
      const b = await r.json();
      const mimes = ["image/png", "image/jpeg", "image/webp"];
      if (b.public !== false || b.file_size_limit !== directUploadMaxBytes || !Array.isArray(b.allowed_mime_types) ||
          mimes.some(m => !b.allowed_mime_types.includes(m)) || (bucket === "design-upload-quarantine" && b.allowed_mime_types.length !== 3)) throw new DirectUploadError(503, "bucket_configuration", "rejected");
    }
  }
  async function mint(s: UploadSession) {
    const o = objectPath(s, false), started = Date.now();
    const r = await send(`${base}/object/upload/sign/${o.bucket}/${o.encoded}`, { method: "POST", body: JSON.stringify({ upsert: false }) });
    if (!r.ok) throw new DirectUploadError(502, "capability_unknown");
    const data = await r.json(); const raw = data.signedURL || data.signedUrl || data.url;
    if (typeof raw !== "string" || Date.now() - started > 10000) throw new DirectUploadError(502, "capability_unknown");
    const url = new URL(raw.startsWith("/object/") ? `/storage/v1${raw}` : raw, base + "/");
    if (url.origin !== origin || url.username || url.password || url.hash || url.pathname !== `/storage/v1/object/upload/sign/${o.bucket}/${o.encoded}` ||
        !url.searchParams.get("token") || [...url.searchParams.keys()].some(k => k !== "token")) throw new DirectUploadError(502, "capability_unknown");
    return url.toString();
  }
  async function read(s: UploadSession, final: boolean) {
    const o = objectPath(s, final), r = await send(`${base}/object/authenticated/${o.bucket}/${o.encoded}`);
    if (!r.ok || !r.body) throw new DirectUploadError(r.status===404?409:502, "object_unconfirmed", r.status===404?"pending":"unknown");
    const invalid=(status=400)=>new DirectUploadError(final?409:status,final?"preserved_object_conflict":"invalid_uploaded_file",final?"unknown":"rejected");
    const mime = r.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (mime !== s.mime || Number(r.headers.get("content-length")) > directUploadMaxBytes) { await r.body.cancel(); throw invalid(); }
    const reader = r.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) { const {value,done} = await reader.read(); if (done) break; size += value.length;
        if (size > directUploadMaxBytes || size > s.byte_size) { await reader.cancel(); throw invalid(413); } chunks.push(value); }
    } catch (e) { if (e instanceof DirectUploadError) throw e; throw new DirectUploadError(502, "object_read_unknown"); }
    finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    if (size !== s.byte_size || uploadHash(bytes) !== s.byte_hash) throw invalid();
    return bytes;
  }
  async function preserve(s: UploadSession, bytes: Uint8Array) {
    const o = objectPath(s, true);
    // A failed/lost upload response is reconciled by reading this exact object.
    await send(`${base}/object/${o.bucket}/${o.encoded}`, { method: "POST", headers: { "Content-Type": s.mime, "x-upsert": "false" }, body: new Uint8Array(bytes) }).catch(() => undefined);
    await read(s, true); // Never accept HTTP success alone or overwrite a mismatch.
  }
  return { rpc, checkBuckets, mint, read, preserve };
}
