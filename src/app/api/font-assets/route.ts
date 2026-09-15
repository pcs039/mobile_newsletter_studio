import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const fontBucket = "fonts";
const maxFontSizeBytes = 5 * 1024 * 1024;
const allowedExtensions = new Set(["woff2", "woff", "ttf", "otf"]);
const extensionToMimeType: Record<string, string> = {
  otf: "font/otf",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
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

function getSafeFileBaseName(fileName: string) {
  const baseName = fileName.split("/").pop()?.split("\\").pop() || "font";

  return baseName
    .replace(/\.[^.]+$/, "")
    .trim()
    .replace(/[^a-zA-Z0-9가-힣_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "font";
}

function getFontExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.trim().toLowerCase() ?? "";

  return allowedExtensions.has(extension) ? extension : "";
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
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
      file_size_limit: maxFontSizeBytes,
      allowed_mime_types: Object.values(extensionToMimeType),
    }),
    cache: "no-store",
  });

  return createdBucket.ok || createdBucket.status === 409;
}

function assertAdmin(user: Awaited<ReturnType<typeof requireApiUser>>) {
  return Boolean(user && user.role === "admin");
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  if (!assertAdmin(user)) {
    return NextResponse.json(
      { ok: false, message: "현재 권한 구조에서는 admin 역할만 폰트를 업로드할 수 있습니다." },
      { status: 403 },
    );
  }

  const config = getSupabaseConfigStatus();
  const headers = getServiceHeaders();

  if (!config.isConfigured || !config.hasServiceRoleKey || !headers) {
    return NextResponse.json(
      { ok: false, message: "Supabase 환경변수와 서버 저장 키 설정 후 폰트 업로드를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ ok: false, message: "폰트 업로드 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "업로드할 폰트 파일을 선택하세요." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > maxFontSizeBytes) {
    return NextResponse.json({ ok: false, message: "폰트 파일은 5MB 이하만 업로드할 수 있습니다." }, { status: 400 });
  }

  const extension = getFontExtension(file.name);

  if (!extension) {
    return NextResponse.json({ ok: false, message: "woff2, woff, ttf, otf 폰트 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const fontName = asText(formData.get("fontName")) || getSafeFileBaseName(file.name);
  const fontFamily = asText(formData.get("fontFamily")) || fontName;
  const webfontAllowed = asBoolean(formData.get("webfontAllowed"));
  const isActive = asBoolean(formData.get("isActive")) && webfontAllowed;
  const storageHeaders = getServiceHeaders(extensionToMimeType[extension]);

  if (!storageHeaders || !(await ensureFontBucket(headers))) {
    return NextResponse.json({ ok: false, message: "Supabase fonts 버킷을 준비하지 못했습니다." }, { status: 500 });
  }

  const token = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const storagePath = `font-assets/${Date.now()}-${token}-${getSafeFileBaseName(file.name)}.${extension}`;
  const uploadEndpoint = getSupabaseStorageEndpoint(`/object/${fontBucket}/${encodeStoragePath(storagePath)}`);

  if (!uploadEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase Storage 업로드 주소를 만들지 못했습니다." }, { status: 500 });
  }

  const uploadResponse = await fetch(uploadEndpoint, {
    method: "PUT",
    headers: {
      ...storageHeaders,
      "x-upsert": "false",
    },
    body: file,
    cache: "no-store",
  });

  if (!uploadResponse.ok) {
    return NextResponse.json(
      { ok: false, message: (await uploadResponse.text()) || "폰트 파일 업로드에 실패했습니다." },
      { status: uploadResponse.status },
    );
  }

  const insertEndpoint = getSupabaseRestEndpoint("/rest/v1/font_assets?select=id,font_name");

  if (!insertEndpoint) {
    return NextResponse.json({ ok: false, message: "폰트 기록 저장 주소를 만들지 못했습니다." }, { status: 500 });
  }

  const insertResponse = await fetch(insertEndpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      font_name: fontName,
      font_family: fontFamily,
      font_file_path: storagePath,
      font_file_format: extension,
      font_weight: asText(formData.get("fontWeight")) || "400",
      font_style: asText(formData.get("fontStyle")) || "normal",
      font_type: asText(formData.get("fontType")) || "uploaded",
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
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    return NextResponse.json(
      { ok: false, message: (await insertResponse.text()) || "폰트 기록 저장에 실패했습니다." },
      { status: insertResponse.status },
    );
  }

  return NextResponse.json({ ok: true, message: isActive ? "폰트를 업로드하고 활성화했습니다." : "폰트를 업로드했습니다." }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  if (!assertAdmin(user)) {
    return NextResponse.json(
      { ok: false, message: "현재 권한 구조에서는 admin 역할만 폰트 상태를 변경할 수 있습니다." },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  const isActive = payload?.isActive === true;
  const endpoint = id
    ? getSupabaseRestEndpoint(`/rest/v1/font_assets?id=eq.${encodeURIComponent(id)}&webfont_allowed=eq.true`)
    : null;
  const headers = getServiceHeaders();

  if (!id) {
    return NextResponse.json({ ok: false, message: "상태를 변경할 폰트 ID가 필요합니다." }, { status: 400 });
  }

  if (!endpoint || !headers) {
    return NextResponse.json(
      { ok: false, message: "Supabase 환경변수와 서버 저장 키 설정 후 폰트 상태를 변경할 수 있습니다." },
      { status: 503 },
    );
  }

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_active: isActive }),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, message: (await response.text()) || "폰트 상태 변경에 실패했습니다." },
      { status: response.status },
    );
  }

  return NextResponse.json({ ok: true, message: isActive ? "폰트를 활성화했습니다." : "폰트를 비활성화했습니다." });
}
