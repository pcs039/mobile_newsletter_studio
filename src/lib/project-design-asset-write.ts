import "server-only";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

// Shared transport for the existing upload flow and server-side Canva imports.
// Callers must authorize the project and validate the file/record first.
export function uploadProjectDesignAssetFile(bucket: string, path: string, file: File, headers: Record<string, string>, signal?: AbortSignal) {
  const endpoint = getSupabaseStorageEndpoint(`/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
  if (!endpoint) throw new Error("Design storage is not configured");
  return fetch(endpoint, { method: "POST", headers: { ...headers, "x-upsert": "false" }, body: file, cache: "no-store", signal });
}

export function insertProjectDesignAssetRecord(record: Record<string, unknown>, headers: Record<string, string>, signal?: AbortSignal) {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_project_design_assets?select=*");
  if (!endpoint) throw new Error("Design repository is not configured");
  return fetch(endpoint, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(record), cache: "no-store", signal });
}
