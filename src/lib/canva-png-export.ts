import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { createHash } from "node:crypto";
import { CanvaConnectError } from "@/lib/canva-connect-contract";

export const canvaPngMaxBytes = 10 * 1024 * 1024;
export const canvaImportAssetTypes = ["background", "illustration", "icon", "card_frame", "banner", "pattern", "decoration"] as const;
export type CanvaImportAssetType = typeof canvaImportAssetTypes[number];

// This first rollout deliberately accepts only the approved Staging database.
// A later Production rollout needs an explicit change/review, not an env typo.
export function canvaPngImportEnabled() { return stagingEnvironmentConfigured(); }

export function canvaImportAssetId(projectId: string, designId: string) {
  const hash = createHash("sha256").update(JSON.stringify(["canva-png-v1", projectId, designId])).digest("hex").slice(0, 32);
  // Stable UUID with version/variant bits; the existing asset PK enforces uniqueness.
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`;
}

export function requireSinglePagePng(formats: unknown, design: unknown) {
  const f = (formats as { formats?: { png?: { page_numbers?: unknown } } })?.formats;
  const pageCount = (design as { design?: { page_count?: unknown } })?.design?.page_count;
  if (!f?.png || typeof f.png !== "object" || Array.isArray(f.png)) throw new CanvaConnectError(409, "이 Canva 디자인은 PNG로 가져올 수 없습니다.");
  if (pageCount !== 1) throw new CanvaConnectError(409, "이번 단계에서는 한 페이지 Canva 디자인만 가져올 수 있습니다.");
  if (f.png.page_numbers !== undefined && (!Array.isArray(f.png.page_numbers) || !f.png.page_numbers.includes(1))) {
    throw new CanvaConnectError(409, "첫 페이지를 PNG로 내보낼 수 없습니다.");
  }
}

export function readCanvaExportJob(value: unknown) {
  const j = (value as { job?: { id?: unknown; status?: unknown; urls?: unknown } })?.job;
  if (!j || typeof j.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(j.id) || !["in_progress", "success", "failed"].includes(String(j.status))) {
    throw new CanvaConnectError(502, "Canva 내보내기 응답 형식을 확인하지 못했습니다.");
  }
  if (j.status !== "success") return { id: j.id, status: j.status as "in_progress" | "failed", url: null };
  if (!Array.isArray(j.urls) || j.urls.length !== 1 || typeof j.urls[0] !== "string") {
    throw new CanvaConnectError(502, "한 개의 PNG 내보내기 파일을 확인하지 못했습니다.");
  }
  return { id: j.id, status: "success" as const, url: safeCanvaDownloadUrl(j.urls[0]) };
}

export function safeCanvaDownloadUrl(value: string) {
  try {
    const u = new URL(value);
    // Only Canva's export host; no arbitrary client URL, IP, credential, port or redirect.
    if (u.protocol === "https:" && u.hostname === "export-download.canva.com" && !u.username && !u.password && !u.port && !u.hash) return u.toString();
  } catch { /* Invalid URL is rejected below. */ }
  throw new CanvaConnectError(502, "Canva 다운로드 주소를 확인하지 못했습니다.");
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function validateCanvaPng(bytes: Uint8Array, mime: string) {
  const invalid = () => { throw new CanvaConnectError(502, "유효한 PNG 파일을 확인하지 못했습니다."); };
  if (mime.split(";")[0].trim().toLowerCase() !== "image/png" || bytes.length < 57 || bytes.length > canvaPngMaxBytes ||
    !Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8, idat = false, width = 0, height = 0;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at), end = at + 12 + length;
    if (end > bytes.length) return invalid();
    const type = Buffer.from(bytes.subarray(at + 4, at + 8)).toString("ascii");
    if (crc32(bytes.subarray(at + 4, at + 8 + length)) !== view.getUint32(at + 8 + length)) return invalid();
    if (at === 8) {
      if (type !== "IHDR" || length !== 13) return invalid();
      width = view.getUint32(at + 8); height = view.getUint32(at + 12);
      if (!width || !height || width > 25000 || height > 25000 || width * height > 40000000) return invalid();
    } else if (type === "IHDR") return invalid();
    if (type === "IDAT" && length > 0) idat = true;
    if (type === "IEND") {
      if (length !== 0 || end !== bytes.length || !idat) return invalid();
      return { width, height, size: bytes.length };
    }
    at = end;
  }
  return invalid();
}

export async function downloadCanvaPng(url: string) {
  let response: Response;
  try {
    // Never forward OAuth credentials and never follow redirects to another origin.
    response = await fetch(safeCanvaDownloadUrl(url), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch { throw new CanvaConnectError(504, "PNG 다운로드를 완료하지 못했습니다. 진행 작업을 다시 확인하세요."); }
  if (!response.ok || !response.body) throw new CanvaConnectError(502, "Canva PNG 파일을 다운로드하지 못했습니다.");
  const mime = response.headers.get("content-type") || "";
  if (mime.split(";")[0].trim().toLowerCase() !== "image/png") {
    await response.body.cancel(); throw new CanvaConnectError(502, "Canva 파일이 PNG 형식이 아닙니다.");
  }
  const sizeHeader = Number(response.headers.get("content-length"));
  if (sizeHeader > canvaPngMaxBytes) { await response.body.cancel(); throw new CanvaConnectError(413, "PNG 파일은 10MB 이하만 가져올 수 있습니다."); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > canvaPngMaxBytes) { await reader.cancel(); throw new CanvaConnectError(413, "PNG 파일은 10MB 이하만 가져올 수 있습니다."); }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof CanvaConnectError) throw error;
    throw new CanvaConnectError(504, "PNG 다운로드가 중단되었습니다. 진행 작업을 다시 확인하세요.");
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks); const info = validateCanvaPng(bytes, mime);
  return { file: new File([bytes], "canva-design.png", { type: "image/png" }), ...info };
}
