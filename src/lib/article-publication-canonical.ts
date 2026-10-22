import "server-only";
import { createHash } from "node:crypto";

export type PublicationJson = null | boolean | number | string | PublicationJson[] | { [key: string]: PublicationJson };

// A bounded, cross-runtime contract, not generic JSON.stringify/PostgreSQL jsonb::text.
export function publicationCanonical(value: unknown, depth = 0): string {
  if (depth > 32) throw new Error("snapshot_depth");
  if (value === null || typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    if (/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw new Error("snapshot_unicode");
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12 || Number(value.toFixed(6)) !== value) throw new Error("snapshot_number");
    return value.toFixed(6).replace(/\.?0+$/, "") || "0";
  }
  if (Array.isArray(value)) return `[${value.map(v => publicationCanonical(v, depth + 1)).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("snapshot_json");
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort((a,b) => Buffer.compare(Buffer.from(a),Buffer.from(b))).map(k => `${publicationCanonical(k)}:${publicationCanonical(row[k], depth+1)}`).join(",")}}`;
}

export function publicationHash(value: unknown): string {
  const bytes = publicationCanonical(value);
  if (Buffer.byteLength(bytes) > 1048576) throw new Error("snapshot_size");
  return createHash("sha256").update(bytes).digest("hex");
}

export function publicationFileId(preparation: string, role: string, source: string): string {
  const hex = publicationHash([preparation,role,source]);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export function publicationRenderHash(snapshot: { [key:string]: PublicationJson }): string {
  const manifest=snapshot.mediaManifest as { [key:string]: PublicationJson }[];
  function normalize(value:PublicationJson,depth=0):PublicationJson {
    if(Array.isArray(value))return value.map(v=>normalize(v,depth+1));
    if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value)
      .filter(([key])=>depth!==0||!["provenance","mediaManifest"].includes(key))
      .map(([key,v])=>{if(key!=="fileId")return [key,normalize(v,depth+1)];
        const file=manifest.find(m=>m.fileId===v);if(!file)throw Error("snapshot_manifest_membership");
        return [key,Object.fromEntries(Object.entries(file).filter(([k])=>!["fileId","role"].includes(k)))];}));
    return value;
  }
  return publicationHash(normalize(snapshot));
}
