import JSZip from "jszip";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const fontBucket = "fonts";
const maxZipSizeBytes = 30 * 1024 * 1024;
const maxEntryCount = 60;
const maxFontCount = 20;
const maxFontSizeBytes = 10 * 1024 * 1024;
const maxTotalExtractedBytes = 80 * 1024 * 1024;
const fontExtensions = new Set(["woff2", "woff", "ttf", "otf"]);
const documentExtensions = new Set(["txt", "md", "pdf", "doc", "docx", "hwp", "hwpx"]);
const extensionToMimeType: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwp: "application/x-hwp",
  hwpx: "application/vnd.hancom.hwpx",
  md: "text/markdown",
  otf: "font/otf",
  pdf: "application/pdf",
  ttf: "font/ttf",
  txt: "text/plain",
  woff: "font/woff",
  woff2: "font/woff2",
  zip: "application/zip",
};

type ExtractedFile = {
  bytes: Uint8Array;
  detectedStyle: string;
  detectedWeight: string;
  extension: string;
  fileName: string;
  kind: "font" | "license";
  originalPath: string;
  size: number;
  storagePath: string;
};

function getServiceHeaders(contentType = "application/json") {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType,
  };
}

function asText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

function getSafeFileName(value: string) {
  const fileName = value.split("/").pop()?.split("\\").pop() || "file";
  const [name, ...extensionParts] = fileName.split(".");
  const extension = extensionParts.pop()?.toLowerCase();
  const safeName =
    name
      .trim()
      .replace(/[^a-zA-Z0-9가-힣_-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "file";

  return extension ? `${safeName}.${extension.replace(/[^a-z0-9]/g, "")}` : safeName;
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

function isUnsafeZipPath(path: string) {
  if (!path || path.startsWith("/") || path.startsWith("\\") || /^[a-zA-Z]:[\\/]/.test(path)) {
    return true;
  }

  return path.split(/[\\/]+/).some((part) => part === "..");
}

function shouldIgnoreZipPath(path: string) {
  const parts = path.split(/[\\/]+/).filter(Boolean);

  return parts.some((part) => part === "__MACOSX" || part === ".DS_Store" || part.startsWith("."));
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toArrayBuffer(bytes: Uint8Array | ArrayBuffer) {
  if (bytes instanceof ArrayBuffer) {
    return bytes;
  }

  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

function makeCssFamilyName(familyId: string) {
  return `DD_FontFamily_${familyId.replace(/-/g, "_")}`;
}

function normalizeFamilyName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || "font-family"
  );
}

function detectWeight(fileName: string) {
  const normalized = fileName.toLowerCase().replace(/[\s_-]+/g, "");

  if (/(extrabold|ultrabold)/.test(normalized)) return "800";
  if (/(semibold|demibold)/.test(normalized)) return "600";
  if (/(extralight|ultralight)/.test(normalized)) return "200";
  if (/(black|heavy)/.test(normalized)) return "900";
  if (/thin/.test(normalized)) return "100";
  if (/light/.test(normalized)) return "300";
  if (/medium/.test(normalized)) return "500";
  if (/bold/.test(normalized)) return "700";

  return "400";
}

function detectStyle(fileName: string) {
  return /(italic|oblique)/i.test(fileName) ? "italic" : "normal";
}

async function ensureFontBucket(headers: Record<string, string>) {
  const bucketEndpoint = getSupabaseStorageEndpoint(`/bucket/${encodeURIComponent(fontBucket)}`);

  if (!bucketEndpoint) {
    return false;
  }

  const existingBucket = await fetch(bucketEndpoint, {
    headers,
    cache: "no-store",
  });

  if (existingBucket.ok) {
    return true;
  }

  if (existingBucket.status !== 404) {
    return false;
  }

  const createBucketEndpoint = getSupabaseStorageEndpoint("/bucket");

  if (!createBucketEndpoint) {
    return false;
  }

  const createdBucket = await fetch(createBucketEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: fontBucket,
      name: fontBucket,
      public: true,
      file_size_limit: maxTotalExtractedBytes,
    }),
    cache: "no-store",
  });

  return createdBucket.ok || createdBucket.status === 409;
}

async function uploadStorageObject(path: string, bytes: Uint8Array | ArrayBuffer, contentType: string) {
  const endpoint = getSupabaseStorageEndpoint(`/object/${fontBucket}/${encodeStoragePath(path)}`);
  const headers = getServiceHeaders(contentType);

  if (!endpoint || !headers) {
    return { ok: false, message: "Supabase Storage 업로드 설정을 확인하지 못했습니다.", status: 503 };
  }

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      ...headers,
      "x-upsert": "false",
    },
    body: new Blob([toArrayBuffer(bytes)], { type: contentType }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { ok: false, message: (await response.text()) || "Storage 업로드에 실패했습니다.", status: response.status };
  }

  return { ok: true, message: "uploaded", status: response.status };
}

async function extractZipFiles(zipFile: File, familyId: string) {
  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const entries = Object.values(zip.files);

  if (entries.length > maxEntryCount) {
    throw new Error(`ZIP 내부 파일은 최대 ${maxEntryCount}개까지 허용됩니다.`);
  }

  const files: ExtractedFile[] = [];
  let totalExtractedBytes = 0;
  let fontCount = 0;

  for (const entry of entries) {
    if (entry.dir || shouldIgnoreZipPath(entry.name)) {
      continue;
    }

    if (isUnsafeZipPath(entry.name)) {
      throw new Error("ZIP 내부에 안전하지 않은 경로가 포함되어 있습니다.");
    }

    const extension = getExtension(entry.name);
    const kind = fontExtensions.has(extension) ? "font" : documentExtensions.has(extension) ? "license" : null;

    if (!kind) {
      continue;
    }

    const bytes = await entry.async("uint8array");
    const size = bytes.byteLength;

    totalExtractedBytes += size;

    if (totalExtractedBytes > maxTotalExtractedBytes) {
      throw new Error("ZIP 추출 총 용량이 허용 범위를 초과했습니다.");
    }

    if (kind === "font") {
      fontCount += 1;

      if (fontCount > maxFontCount) {
        throw new Error(`패키지당 폰트 파일은 최대 ${maxFontCount}개까지 허용됩니다.`);
      }

      if (size <= 0 || size > maxFontSizeBytes) {
        throw new Error("폰트 파일 크기가 허용 범위를 벗어났습니다.");
      }
    }

    const fileName = getSafeFileName(entry.name);
    const storagePath = `families/${familyId}/${kind === "font" ? "fonts" : "licenses"}/${fileName}`;

    files.push({
      bytes,
      detectedStyle: kind === "font" ? detectStyle(fileName) : "",
      detectedWeight: kind === "font" ? detectWeight(fileName) : "",
      extension,
      fileName,
      kind,
      originalPath: entry.name,
      size,
      storagePath,
    });
  }

  if (fontCount === 0) {
    throw new Error("ZIP 안에서 사용할 수 있는 폰트 파일을 찾지 못했습니다.");
  }

  return files;
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "admin 권한만 ZIP 폰트 패키지를 업로드할 수 있습니다." }, { status: 403 });
  }

  const config = getSupabaseConfigStatus();
  const headers = getServiceHeaders();

  if (!config.isConfigured || !config.hasServiceRoleKey || !headers) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수와 서버 저장 키 설정이 필요합니다." }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ ok: false, message: "업로드 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const zipFile = formData.get("file");

  if (!(zipFile instanceof File) || !zipFile.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ ok: false, message: "ZIP 파일을 선택하세요." }, { status: 400 });
  }

  if (zipFile.size <= 0 || zipFile.size > maxZipSizeBytes) {
    return NextResponse.json({ ok: false, message: "ZIP 파일은 30MB 이하만 업로드할 수 있습니다." }, { status: 400 });
  }

  if (!(await ensureFontBucket(headers))) {
    return NextResponse.json({ ok: false, message: "Supabase fonts 버킷을 준비하지 못했습니다." }, { status: 500 });
  }

  const familyId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const displayName = asText(formData.get("displayName")) || zipFile.name.replace(/\.zip$/i, "");
  const familyName = normalizeFamilyName(asText(formData.get("familyName")) || displayName);
  const webfontAllowed = asBoolean(formData.get("webfontAllowed"));
  const isActive = asBoolean(formData.get("isActive")) && webfontAllowed;
  const cssFamilyName = makeCssFamilyName(familyId);

  let extractedFiles: ExtractedFile[];

  try {
    extractedFiles = await extractZipFiles(zipFile, familyId);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "ZIP 파일을 해제하지 못했습니다." },
      { status: 400 },
    );
  }

  const originalZipPath = `families/${familyId}/original/${getSafeFileName(zipFile.name)}`;
  const originalUpload = await uploadStorageObject(originalZipPath, await zipFile.arrayBuffer(), extensionToMimeType.zip);

  if (!originalUpload.ok) {
    return NextResponse.json({ ok: false, message: originalUpload.message }, { status: originalUpload.status });
  }

  for (const extractedFile of extractedFiles) {
    const upload = await uploadStorageObject(
      extractedFile.storagePath,
      extractedFile.bytes,
      extensionToMimeType[extractedFile.extension] ?? "application/octet-stream",
    );

    if (!upload.ok) {
      return NextResponse.json({ ok: false, message: upload.message }, { status: upload.status });
    }
  }

  const licenseFiles = extractedFiles.filter((file) => file.kind === "license");
  const fontFiles = extractedFiles.filter((file) => file.kind === "font");
  const familyEndpoint = getSupabaseRestEndpoint("/rest/v1/font_families?select=id,display_name");

  if (!familyEndpoint) {
    return NextResponse.json({ ok: false, message: "폰트 패밀리 저장 주소를 만들지 못했습니다." }, { status: 500 });
  }

  const familyResponse = await fetch(familyEndpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: familyId,
      family_name: familyName,
      display_name: displayName,
      css_family_name: cssFamilyName,
      font_type: asText(formData.get("fontType")) || "public_free",
      license_type: asText(formData.get("licenseType")) || null,
      license_note: asText(formData.get("licenseNote")) || null,
      license_url: asText(formData.get("licenseUrl")) || null,
      license_file_paths: licenseFiles.map((file) => file.storagePath),
      webfont_allowed: webfontAllowed,
      commercial_allowed: asBoolean(formData.get("commercialAllowed")),
      redistribution_allowed: asBoolean(formData.get("redistributionAllowed")),
      attribution_required: asBoolean(formData.get("attributionRequired")),
      attribution_text: asText(formData.get("attributionText")) || null,
      is_active: isActive,
      uploaded_by: user.id,
    }),
    cache: "no-store",
  });

  if (!familyResponse.ok) {
    return NextResponse.json(
      { ok: false, message: (await familyResponse.text()) || "폰트 패밀리 저장에 실패했습니다." },
      { status: familyResponse.status },
    );
  }

  const assetsEndpoint = getSupabaseRestEndpoint("/rest/v1/font_assets");

  if (!assetsEndpoint) {
    return NextResponse.json({ ok: false, message: "폰트 파일 기록 저장 주소를 만들지 못했습니다." }, { status: 500 });
  }

  const assetsResponse = await fetch(assetsEndpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(
      fontFiles.map((file) => ({
        family_id: familyId,
        font_name: `${displayName} ${file.detectedWeight}${file.detectedStyle === "italic" ? " Italic" : ""}`,
        font_family: displayName,
        font_file_path: file.storagePath,
        font_file_format: file.extension,
        font_weight: file.detectedWeight,
        font_style: file.detectedStyle,
        source_file_name: file.fileName,
        detected_weight: file.detectedWeight,
        detected_style: file.detectedStyle,
        package_source: "zip",
        font_type: asText(formData.get("fontType")) || "public_free",
        license_type: asText(formData.get("licenseType")) || null,
        license_note: asText(formData.get("licenseNote")) || null,
        license_url: asText(formData.get("licenseUrl")) || null,
        webfont_allowed: webfontAllowed,
        commercial_allowed: asBoolean(formData.get("commercialAllowed")),
        redistribution_allowed: asBoolean(formData.get("redistributionAllowed")),
        attribution_required: asBoolean(formData.get("attributionRequired")),
        attribution_text: asText(formData.get("attributionText")) || null,
        is_active: isActive,
        uploaded_by: user.id,
      })),
    ),
    cache: "no-store",
  });

  if (!assetsResponse.ok) {
    return NextResponse.json(
      { ok: false, message: (await assetsResponse.text()) || "폰트 파일 기록 저장에 실패했습니다." },
      { status: assetsResponse.status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      family: { id: familyId, displayName, isActive },
      fonts: fontFiles.map((file) => ({
        fileName: file.fileName,
        weight: file.detectedWeight,
        style: file.detectedStyle,
        path: file.storagePath,
      })),
      licenses: licenseFiles.map((file) => ({ fileName: file.fileName, path: file.storagePath })),
      message: `${displayName} 패키지에서 폰트 ${fontFiles.length}개를 등록했습니다.`,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "admin 권한만 폰트 패밀리 상태를 변경할 수 있습니다." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const familyId = typeof payload?.familyId === "string" ? payload.familyId.trim() : "";
  const isActive = payload?.isActive === true;
  const headers = getServiceHeaders();

  if (!familyId) {
    return NextResponse.json({ ok: false, message: "상태를 변경할 폰트 패밀리 ID가 필요합니다." }, { status: 400 });
  }

  if (!headers) {
    return NextResponse.json({ ok: false, message: "Supabase 서버 저장 키 설정이 필요합니다." }, { status: 503 });
  }

  const familyEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/font_families?id=eq.${encodeURIComponent(familyId)}&webfont_allowed=eq.true`,
  );
  const assetEndpoint = getSupabaseRestEndpoint(`/rest/v1/font_assets?family_id=eq.${encodeURIComponent(familyId)}`);

  if (!familyEndpoint || !assetEndpoint) {
    return NextResponse.json({ ok: false, message: "폰트 패밀리 상태 변경 주소를 만들지 못했습니다." }, { status: 500 });
  }

  const familyResponse = await fetch(familyEndpoint, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ is_active: isActive }),
    cache: "no-store",
  });

  if (!familyResponse.ok) {
    return NextResponse.json(
      { ok: false, message: (await familyResponse.text()) || "폰트 패밀리 상태 변경에 실패했습니다." },
      { status: familyResponse.status },
    );
  }

  const assetResponse = await fetch(assetEndpoint, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ is_active: isActive }),
    cache: "no-store",
  });

  if (!assetResponse.ok) {
    return NextResponse.json(
      { ok: false, message: (await assetResponse.text()) || "폰트 파일 상태 변경에 실패했습니다." },
      { status: assetResponse.status },
    );
  }

  return NextResponse.json({ ok: true, message: isActive ? "폰트 패밀리를 활성화했습니다." : "폰트 패밀리를 비활성화했습니다." });
}
