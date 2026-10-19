import { create } from "fontkit";

export const MAX_BATCH_FONT_BYTES = 16 * 1024 * 1024;
export const FONT_MIMES = { ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2" } as const;
export type FontFormat = keyof typeof FONT_MIMES;
export type FontClassification = {
  family: string;
  weight: string;
  style: "normal" | "italic";
  version: string;
  format: FontFormat;
  needsConfirmation: boolean;
  reason: string;
};

export function normalizeFontPath(path: string) {
  return path.normalize("NFC").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

export function fontFormat(path: string): FontFormat | null {
  const normalized = normalizeFontPath(path);
  if (normalized.split("/").some((part) => part.startsWith(".") || part === "__MACOSX")) return null;
  const extension = normalized.split(".").pop()?.toLowerCase() || "";
  return Object.hasOwn(FONT_MIMES, extension) ? extension as FontFormat : null;
}

function cleanName(value: string) {
  return value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
}

const weights: Array<[RegExp, string]> = [
  [/extra[-_ ]?bold|ultra[-_ ]?bold/i, "800"], [/semi[-_ ]?bold|demi[-_ ]?bold/i, "600"],
  [/extra[-_ ]?light|ultra[-_ ]?light/i, "200"], [/black|heavy/i, "900"], [/thin/i, "100"],
  [/light|(?:[-_]|^[a-e])lt$/i, "300"], [/medium/i, "500"], [/bold|[-_]bd$/i, "700"], [/regular|normal|book/i, "400"],
];
function namedWeight(name: string) { return weights.find(([pattern]) => pattern.test(name))?.[1]; }
function stripStyle(name: string) {
  return name.replace(/(?:[-_ ]?(?:extra[-_ ]?light|extra[-_ ]?bold|semi[-_ ]?bold|ultra[-_ ]?light|ultra[-_ ]?bold|regular|normal|bold|light|medium|thin|black|italic|oblique|heavy))+$/ig, "").trim();
}

// Only confirmed Naver suffix conventions are special-cased. No general family inference engine.
function naverName(base: string) {
  const neo = base.match(/^(NanumSquareNeo)(?:OTF)?[-_](?:[a-e])?(Lt|Rg|Bd|Eb|Hv)$/i);
  if (neo) return { family: "NanumSquare Neo", weight: ({ lt: "300", rg: "400", bd: "700", eb: "800", hv: "900" } as Record<string, string>)[neo[2].toLowerCase()] };
  const pen = base.match(/^(NanumBarunpen)([BR])$/);
  if (pen) return { family: "NanumBarunpen", weight: pen[2] === "B" ? "700" : "400" };
  return null;
}

export function classifyFont(bytes: Uint8Array, filePath: string): FontClassification {
  const format = fontFormat(filePath);
  if (!format || bytes.length < 48 || bytes.length > MAX_BATCH_FONT_BYTES) throw new Error("지원 형식과 파일당 16MiB 제한을 확인하세요.");
  const signature = String.fromCharCode(...bytes.slice(0, 4));
  if (signature === "ttcf") throw new Error("TTC는 이번 등록에서 제외합니다.");
  const valid = format === "ttf" ? (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) || signature === "true"
    : signature === ({ otf: "OTTO", woff: "wOFF", woff2: "wOF2" } as Record<string, string>)[format];
  if (!valid) throw new Error("확장자와 실제 폰트 형식이 일치하지 않습니다.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === "woff" || format === "woff2") {
    if (view.getUint32(8) !== bytes.length || view.getUint32(16) > 80 * 1024 * 1024 || view.getUint16(12) > 128) throw new Error("폰트 컨테이너 크기가 허용 범위를 벗어납니다.");
  } else if (view.getUint16(4) > 128) throw new Error("폰트 테이블 수가 허용 범위를 벗어납니다.");
  const font = create(bytes);
  if (font.directory?.tables?.fvar || Object.keys(font.variationAxes || {}).length) throw new Error("가변 폰트는 이번 등록에서 제외합니다. 고정 굵기 파일을 선택하세요.");
  if (!font.familyName || !font.numGlyphs) throw new Error("폰트 내부 이름과 글리프 정보를 확인하지 못했습니다.");
  const path = normalizeFontPath(filePath);
  const base = path.split("/").pop()!.replace(/\.[^.]+$/, "");
  const known = naverName(base);
  const fromName = known?.weight || namedWeight(base);
  const internalWeight = font["OS/2"]?.usWeightClass;
  const fromInternal = internalWeight && internalWeight >= 1 && internalWeight <= 1000 ? String(internalWeight) : namedWeight(font.subfamilyName || "");
  const internalFamily = stripStyle(cleanName(font.familyName).replace(/(?:OTF|TTF)$/i, "")).trim();
  const candidate = known?.family || stripStyle(base).replace(/(?:TTF|OTF)$/i, "").trim();
  const normalize = (value: string) => value.replace(/[\s_-]/g, "").toLowerCase();
  const sameFamily = normalize(candidate) === normalize(internalFamily);
  const mismatch = Boolean(fromName && fromInternal && fromName !== fromInternal);
  const family = cleanName(known?.family || (sameFamily ? candidate : internalFamily));
  const italicName = /italic|oblique/i.test(base);
  const italicInternal = Boolean(font["OS/2"]?.fsSelection?.italic || /italic|oblique/i.test(font.subfamilyName || ""));
  const needsConfirmation = mismatch || !fromInternal || !sameFamily && !known || italicName && !italicInternal;
  return {
    family, weight: fromName || fromInternal || "400", style: italicInternal || italicName ? "italic" : "normal",
    // Ignore converter build strings; a family release can contain both TTF and OTF.
    version: font.version?.match(/^Version\s+([\d.]+)/i)?.[1] || cleanName(font.version || "unknown"), format, needsConfirmation,
    reason: mismatch ? `파일명 굵기 ${fromName} / 내부 굵기 ${fromInternal} — 확인 필요` : needsConfirmation ? "파일명과 내부 분류 확인 필요" : "파일명·내부 정보 확인",
  };
}

export function faceKey(font: FontClassification) {
  return [font.family.normalize("NFC").replace(/[\s_-]/g, "").toLowerCase(), font.weight, font.style, font.version].join("|");
}

export function defaultFontSelection(fonts: FontClassification[]) {
  const rank: Record<FontFormat, number> = { woff2: 0, woff: 1, ttf: 2, otf: 3 };
  const selected = new Set<number>();
  const groups = new Map<string, number>();
  fonts.forEach((font, index) => {
    const key = faceKey(font), previous = groups.get(key);
    if (previous === undefined || rank[font.format] < rank[fonts[previous].format]) groups.set(key, index);
  });
  groups.forEach((index) => selected.add(index));
  return selected;
}
