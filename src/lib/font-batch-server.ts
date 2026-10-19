import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { classifyFont, fontFormat, FONT_MIMES, MAX_BATCH_FONT_BYTES, normalizeFontPath, type FontClassification } from "@/lib/font-batch";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

const intakeBucket = "design-intake-assets";
const targetBucket = "fonts";
export class FontBatchError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function key() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) throw new FontBatchError(503, "폰트 저장 설정을 확인하세요.");
  return value;
}
function headers(type = "application/json") { return { apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": type }; }
function storage(path: string) {
  const url = getSupabaseStorageEndpoint(path);
  if (!url) throw new FontBatchError(503, "Storage 설정을 확인하세요.");
  return url;
}
function rest(path: string) {
  const url = getSupabaseRestEndpoint(`/rest/v1/${path}`);
  if (!url) throw new FontBatchError(503, "폰트 DB 설정을 확인하세요.");
  return url;
}
function id(value: string) {
  const digest = createHash("sha256").update(`font-batch-v1|${value}`).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
type Intent = {
  userId: string; hash: string; size: number; path: string; name: string; expires: number;
  family: string; weight: string; style: "normal" | "italic"; confirmed: boolean;
  webfontAllowed: boolean; commercialAllowed: boolean; active: boolean;
};
function sign(payload: string) { return createHmac("sha256", key()).update(`font-batch-v1|${payload}`).digest("base64url"); }
export function readFontIntent(token: string, userId: string): Intent {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || token.length > 5000) throw new FontBatchError(403, "업로드 권한을 다시 발급받으세요.");
  const actual = Buffer.from(signature), expected = Buffer.from(sign(payload));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new FontBatchError(403, "업로드 권한이 유효하지 않습니다.");
  const intent = JSON.parse(Buffer.from(payload, "base64url").toString()) as Intent;
  if (intent.userId !== userId || intent.expires < Date.now()) throw new FontBatchError(403, "업로드 권한이 만료되었습니다.");
  return intent;
}
async function findAsset(hash: string) {
  const response = await fetch(rest(`font_assets?id=eq.${id(hash)}&select=id,family_id,font_file_path,is_active`), { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new FontBatchError(502, "기존 폰트 등록 결과를 확인하지 못했습니다. 다시 확인하세요.");
  return (await response.json()) as Array<{ id: string; family_id: string; font_file_path: string; is_active: boolean }>;
}
async function checkBuckets() {
  for (const [bucket, isPublic] of [[intakeBucket, false], [targetBucket, true]] as const) {
    const response = await fetch(storage(`/bucket/${bucket}`), { headers: headers(), cache: "no-store" });
    if (!response.ok) throw new FontBatchError(503, "기존 폰트/임시 버킷 설정 확인이 필요합니다. 자동 생성하지 않습니다.");
    const config = await response.json();
    const required = bucket === intakeBucket ? ["application/octet-stream"] : Object.values(FONT_MIMES);
    if (config.public !== isPublic || config.file_size_limit && config.file_size_limit < MAX_BATCH_FONT_BYTES || Array.isArray(config.allowed_mime_types) && required.some((mime) => !config.allowed_mime_types.includes(mime))) {
      throw new FontBatchError(503, "Storage 공개 범위·허용 형식·용량 설정을 확인하세요. 설정을 자동 변경하지 않습니다.");
    }
  }
}
function text(value: unknown) { return typeof value === "string" ? value.normalize("NFC").trim() : ""; }
export async function prepareFontUpload(input: Record<string, unknown>, userId: string) {
  const name = normalizeFontPath(text(input.name));
  if (!fontFormat(name) || name.length > 500 || name.split("/").includes("..") || !/^[a-f0-9]{64}$/.test(text(input.hash)) || !Number.isInteger(input.size) || Number(input.size) <= 0 || Number(input.size) > MAX_BATCH_FONT_BYTES) throw new FontBatchError(400, "지원하는 파일 형식·해시·용량을 확인하세요.");
  const family = text(input.family);
  if (!family || family.length > 120 || /[\u0000-\u001f\u007f]/.test(family) || !/^(?:[1-9]\d{0,2}|1000)$/.test(text(input.weight)) || !["normal", "italic"].includes(text(input.style))) throw new FontBatchError(400, "패밀리·굵기·스타일을 확인하세요.");
  await checkBuckets();
  const existing = await findAsset(text(input.hash));
  if (existing[0]) return { ok: true, status: "success", duplicate: true, assetId: existing[0].id };
  const intent: Intent = {
    userId, hash: text(input.hash), size: Number(input.size), name, family,
    weight: text(input.weight), style: input.style as Intent["style"], confirmed: input.confirmed === true,
    webfontAllowed: input.webfontAllowed === true, commercialAllowed: input.commercialAllowed === true,
    active: input.active === true && input.webfontAllowed === true,
    path: `font-batch-v1/${id(userId)}/${text(input.hash)}.${fontFormat(name)}`, expires: Date.now() + 30 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(intent)).toString("base64url");
  const response = await fetch(storage(`/object/upload/sign/${intakeBucket}/${intent.path}`), {
    method: "POST", headers: headers(), body: JSON.stringify({ upsert: false }), cache: "no-store",
  });
  if (!response.ok) throw new FontBatchError(502, "업로드 권한 발급에 실패했습니다.");
  const result = await response.json();
  const rawUrl = result.signedURL || result.signedUrl || result.url;
  if (typeof rawUrl !== "string") throw new FontBatchError(502, "업로드 주소를 확인하지 못했습니다.");
  const url = new URL(rawUrl.startsWith("/object/") ? `/storage/v1${rawUrl}` : rawUrl, storage("/"));
  if (url.origin !== new URL(storage("/")).origin) throw new FontBatchError(502, "업로드 주소가 올바르지 않습니다.");
  return { ok: true, status: "ready", token: `${payload}.${sign(payload)}`, uploadUrl: url.toString(), mimeType: "application/octet-stream" };
}
async function bytesFrom(response: Response) {
  if (!response.ok || !response.body) throw new FontBatchError(409, "업로드 결과를 확인하지 못했습니다. 같은 파일로 다시 확인하세요.");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BATCH_FONT_BYTES) { await reader.cancel(); throw new FontBatchError(400, "파일 용량 제한을 초과했습니다."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
function resolvedClassification(font: FontClassification, intent: Intent) {
  const changed = font.family !== intent.family || font.weight !== intent.weight || font.style !== intent.style;
  if ((font.needsConfirmation || changed) && !intent.confirmed) throw new FontBatchError(409, "분류가 불확실한 폰트는 목록에서 확인한 뒤 등록하세요.");
  return { ...font, family: intent.family, weight: intent.weight, style: intent.style };
}
export async function completeFontUpload(token: string, userId: string) {
  const intent = readFontIntent(token, userId);
  const existing = await findAsset(intent.hash);
  if (existing[0]) return { ok: true, status: "success", duplicate: true, assetId: existing[0].id };
  await checkBuckets();
  const bytes = await bytesFrom(await fetch(storage(`/object/authenticated/${intakeBucket}/${intent.path}`), { headers: headers(), cache: "no-store" }));
  if (bytes.length !== intent.size || createHash("sha256").update(bytes).digest("hex") !== intent.hash) throw new FontBatchError(400, "선택한 파일과 업로드된 파일이 일치하지 않습니다.");
  let font: FontClassification;
  try { font = resolvedClassification(classifyFont(bytes, intent.name), intent); }
  catch (error) { if (error instanceof FontBatchError) throw error; throw new FontBatchError(400, error instanceof Error ? error.message : "폰트 검증에 실패했습니다."); }
  const familyId = id(`family|${font.family.replace(/[\s_-]/g, "").toLowerCase()}|${font.version}`);
  const filePath = `batch-v1/${intent.hash}.${font.format}`;
  const uploaded = await fetch(storage(`/object/${targetBucket}/${filePath}`), { method: "POST", headers: { ...headers(FONT_MIMES[font.format]), "x-upsert": "false" }, body: new Uint8Array(bytes), cache: "no-store" });
  if (!uploaded.ok) {
    // A lost response or a concurrent finalization can leave the immutable object present.
    const prior = await bytesFrom(await fetch(storage(`/object/authenticated/${targetBucket}/${filePath}`), { headers: headers(), cache: "no-store" }));
    if (createHash("sha256").update(prior).digest("hex") !== intent.hash) throw new FontBatchError(409, "기존 파일이 일치하지 않아 덮어쓰지 않았습니다.");
  }
  const writeHeaders = { ...headers(), Prefer: "resolution=ignore-duplicates,return=minimal" };
  const family = await fetch(rest("font_families?on_conflict=id"), { method: "POST", headers: writeHeaders, cache: "no-store", body: JSON.stringify({
    id: familyId, family_name: font.family, display_name: font.family, css_family_name: `FontBatch_${familyId.replace(/-/g, "")}`,
    font_type: "uploaded", webfont_allowed: intent.webfontAllowed, commercial_allowed: intent.commercialAllowed, is_active: intent.active, uploaded_by: userId,
  }) });
  if (!family.ok) throw new FontBatchError(502, "파일 검증은 완료했으나 패밀리 등록 결과를 확인하지 못했습니다. 같은 파일로 재시도하세요.");
  const asset = await fetch(rest("font_assets?on_conflict=id"), { method: "POST", headers: writeHeaders, cache: "no-store", body: JSON.stringify({
    id: id(intent.hash), family_id: familyId, font_name: font.family, font_family: font.family, font_file_path: filePath,
    font_file_format: font.format, font_weight: font.weight, font_style: font.style, detected_weight: font.weight, detected_style: font.style,
    source_file_name: intent.name.split("/").pop(), package_source: "multi_file", font_type: "uploaded",
    webfont_allowed: intent.webfontAllowed, commercial_allowed: intent.commercialAllowed, is_active: intent.active, uploaded_by: userId,
  }) });
  if (!asset.ok) throw new FontBatchError(502, "등록 결과를 확인하지 못했습니다. 같은 파일로 재시도하면 중복 없이 확인합니다.");
  const saved = await findAsset(intent.hash);
  if (!saved[0]) throw new FontBatchError(502, "등록 결과를 다시 확인하세요.");
  // Only this uploader's temporary object; immutable public font and library records remain.
  await fetch(storage(`/object/${intakeBucket}`), { method: "DELETE", headers: headers(), body: JSON.stringify({ prefixes: [intent.path] }), cache: "no-store" }).catch(() => undefined);
  return { ok: true, status: "success", duplicate: false, assetId: saved[0].id };
}
