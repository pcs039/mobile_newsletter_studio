import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const allowedBuckets = new Set([
  "pdf-originals",
  "page-images",
  "mobile-assets",
  "audio-files",
  "brand-assets",
  "design-intake-assets",
]);
const allowedDesignIntakeMimeTypes = new Set([
  "application/pdf",
  "application/postscript",
  "application/octet-stream",
  "image/svg+xml",
  "image/vnd.adobe.photoshop",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const inlineDesignIntakeMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type ProjectFileReference = {
  projectId: string;
  originalFileName: string;
  mimeType: string;
};

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function getStorageHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function isSafeStoragePath(path: string) {
  return path.length > 0 && !path.includes("..") && !path.startsWith("/") && !path.endsWith("/");
}

function sanitizeDownloadFileName(fileName: string) {
  const withoutControlCharacters = Array.from(fileName)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      return codePoint >= 32 && codePoint !== 127;
    })
    .join("");

  return withoutControlCharacters.replace(/[\\/"]/g, "_").trim().slice(0, 180) || "design-asset";
}

function encodeContentDispositionFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function makeAttachmentContentDisposition(fileName: string) {
  const safeFileName = sanitizeDownloadFileName(fileName);
  const asciiFileName = safeFileName.replace(/[^\x20-\x7e]/g, "_");

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeContentDispositionFileName(safeFileName)}`;
}

async function findProjectIdByFile(bucket: string, path: string, headers: Record<string, string>) {
  const encodedPath = encodeURIComponent(path);
  const candidates =
    bucket === "pdf-originals"
      ? [{ table: "newsletter_projects", pathColumn: "pdf_original_path", projectColumn: "id" }]
      : bucket === "page-images"
        ? [{ table: "newsletter_pages", pathColumn: "image_path", projectColumn: "project_id" }]
        : bucket === "audio-files"
          ? [{ table: "newsletter_audio_files", pathColumn: "file_path", projectColumn: "project_id" }]
          : bucket === "brand-assets" || bucket === "design-intake-assets"
            ? [
                {
                  table: "newsletter_project_design_assets",
                  pathColumn: "storage_path",
                  projectColumn: "project_id",
                  metadataColumns: ",original_file_name,mime_type",
                  extraFilter: `&storage_bucket=eq.${encodeURIComponent(bucket)}`,
                },
              ]
            : [
                { table: "newsletter_projects", pathColumn: "cover_image_path", projectColumn: "id" },
                { table: "newsletter_assets", pathColumn: "file_path", projectColumn: "project_id" },
              ];

  for (const candidate of candidates) {
    const endpoint = getSupabaseRestEndpoint(
      `/rest/v1/${candidate.table}?select=${candidate.projectColumn}${"metadataColumns" in candidate ? candidate.metadataColumns : ""}&${candidate.pathColumn}=eq.${encodedPath}${"extraFilter" in candidate ? candidate.extraFilter : ""}&limit=1`,
    );

    if (!endpoint) {
      return null;
    }

    const response = await fetch(endpoint, { headers, cache: "no-store" });

    if (!response.ok) {
      continue;
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    const row = rows[0];
    const projectId = row?.[candidate.projectColumn];

    if (typeof projectId === "string" && projectId) {
      return {
        projectId,
        originalFileName: typeof row.original_file_name === "string" ? row.original_file_name : "",
        mimeType: typeof row.mime_type === "string" ? row.mime_type.trim().toLowerCase() : "",
      } satisfies ProjectFileReference;
    }
  }

  return null;
}

export async function GET(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket")?.trim() ?? "";
  const path = searchParams.get("path")?.trim() ?? "";
  const headers = getStorageHeaders();

  if (!allowedBuckets.has(bucket) || !isSafeStoragePath(path)) {
    return NextResponse.json({ ok: false, message: "파일 경로를 확인하세요." }, { status: 400 });
  }

  if (!headers) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 파일 미리보기를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const fileReference = await findProjectIdByFile(bucket, path, headers);

  if (!fileReference) {
    return NextResponse.json({ ok: false, message: "프로젝트에 연결된 파일을 찾지 못했습니다." }, { status: 404 });
  }

  const access = await requireProjectApiAccess({ projectId: fileReference.projectId });

  if (!access.ok) {
    return access.response;
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`);

  if (!endpoint) {
    return NextResponse.json({ ok: false, message: "Supabase Storage URL 설정을 확인하세요." }, { status: 503 });
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { ok: false, message: "Supabase Storage에서 파일을 불러오지 못했습니다." },
      { status: response.status || 500 },
    );
  }

  const responseMimeType = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
  const isDesignIntakeAsset = bucket === "design-intake-assets";
  const contentType = isDesignIntakeAsset
    ? allowedDesignIntakeMimeTypes.has(fileReference.mimeType)
      ? fileReference.mimeType
      : "application/octet-stream"
    : responseMimeType;
  const canRenderInline = !isDesignIntakeAsset || inlineDesignIntakeMimeTypes.has(contentType);
  const originalFileName = fileReference.originalFileName || path.split("/").pop() || "design-asset";

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Cache-Control": isDesignIntakeAsset ? "private, no-store" : "private, max-age=300",
      "Content-Disposition": canRenderInline ? "inline" : makeAttachmentContentDisposition(originalFileName),
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
