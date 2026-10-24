export const directUploadMaxBytes = 10 * 1024 * 1024;
export const directUploadTypes = ["background", "illustration", "icon", "card_frame", "banner", "pattern", "decoration"] as const;
export const directUploadMimes = ["image/png", "image/jpeg", "image/webp"] as const;
export const directUploadUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function directUploadEnabled() { return process.env.DESIGN_ASSET_DIRECT_UPLOAD_ENABLED === "true"; }
export class DirectUploadError extends Error {
  constructor(public status: number, public code: string, public outcome: "rejected" | "pending" | "unknown" = "unknown") { super(code); }
}
export type UploadActor = { id: string; name: string; role: string };
export type UploadInput = { projectId: string; requestKey: string; fileName: string; assetType: string; mime: string; size: number; sha256: string };
export type UploadSession = {
  id: string; project_id: string; actor_id: string; request_key: string; phase: string; generation: number;
  temp_bucket: string; temp_path: string; final_path: string | null; asset_type: string; mime: string;
  byte_size: number; byte_hash: string; policy_version: string; lease_until: string | null;
  intent_expires: string; receipt: { assetId: string; state: string } | null; asset_exists: boolean;
};
export function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !directUploadUuid.test(value)) throw new DirectUploadError(400, "invalid_id", "rejected");
}
export function parseUploadInput(value: Record<string, unknown>): UploadInput {
  if (Object.keys(value).some(key => !["projectId", "requestKey", "fileName", "assetType", "mime", "size", "sha256"].includes(key))) throw new DirectUploadError(400, "unexpected_input", "rejected");
  assertUuid(value.projectId); assertUuid(value.requestKey);
  const name = typeof value.fileName === "string" ? value.fileName.normalize("NFC") : "";
  const mime = value.mime;
  if (!name || name.length > 180 || /[\u0000-\u001f\u007f/\\]/.test(name) ||
      !directUploadMimes.includes(mime as typeof directUploadMimes[number]) ||
      !(mime === "image/png" ? /\.png$/i : mime === "image/jpeg" ? /\.jpe?g$/i : /\.webp$/i).test(name) ||
      !directUploadTypes.includes(value.assetType as typeof directUploadTypes[number]) ||
      !Number.isInteger(value.size) || Number(value.size) < 1 || Number(value.size) > directUploadMaxBytes ||
      typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new DirectUploadError(400, "invalid_file", "rejected");
  return { projectId: value.projectId, requestKey: value.requestKey, fileName: name, assetType: String(value.assetType), mime: String(mime), size: Number(value.size), sha256: value.sha256 };
}
export function publicUploadStatus(s: UploadSession) {
  return { ok: true, sessionId: s.id, requestKey: s.request_key, state: !s.receipt && Date.parse(s.intent_expires)<=Date.now()?"expired":s.phase,
    receipt: s.receipt?{assetId:s.receipt.assetId,state:s.receipt.state}:null, assetExists: s.asset_exists, expiresAt: s.intent_expires };
}
