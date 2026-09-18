import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

const downloadableBuckets = new Set(["mobile-assets", "page-images"]);
const textEncoder = new TextEncoder();
const zipCrcTable = makeCrc32Table();

type NewsletterProjectDownloadRow = {
  id: string;
  cover_image_path: string | null;
};

type NewsletterPageDownloadRow = {
  id: string;
  image_path: string | null;
  page_number: number;
};

type ZipCentralDirectoryEntry = {
  compressedSize: number;
  crc: number;
  fileNameBytes: Uint8Array;
  localHeaderOffset: number;
  uncompressedSize: number;
};

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

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

function sanitizeFileName(value: string) {
  const fallbackName = "newsletter-image";
  const fileName = value.split("/").pop()?.trim() || fallbackName;

  return fileName.replace(/[^\w가-힣 ._-]/g, "_") || fallbackName;
}

function sanitizeZipBaseName(value: string) {
  return value.trim().replace(/[^\w가-힣.-]/g, "_") || "newsletter";
}

function getPathExtension(path: string) {
  const fileName = path.split("/").pop() ?? "";
  const match = fileName.match(/\.([a-z0-9]{2,5})$/i);

  return match?.[1]?.toLowerCase() ?? "png";
}

function getPageDownloadFileName(projectSlug: string, page: NewsletterPageDownloadRow) {
  const pageNumber = String(page.page_number).padStart(3, "0");
  const extension = getPathExtension(page.image_path ?? "");

  return `${sanitizeZipBaseName(projectSlug)}-page-${pageNumber}.${extension}`;
}

function getZipEntryFileName(page: NewsletterPageDownloadRow) {
  const pageNumber = String(page.page_number).padStart(3, "0");
  const extension = getPathExtension(page.image_path ?? "");

  return `${pageNumber}.${extension}`;
}

function makeCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  return table;
}

function updateCrc32(crc: number, chunk: Uint8Array) {
  let nextCrc = crc;

  for (let index = 0; index < chunk.length; index += 1) {
    nextCrc = zipCrcTable[(nextCrc ^ chunk[index]) & 0xff] ^ (nextCrc >>> 8);
  }

  return nextCrc >>> 0;
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosDate, dosTime };
}

function concatBytes(...parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }

  return output;
}

function makeLocalFileHeader(fileNameBytes: Uint8Array) {
  const { dosDate, dosTime } = getDosDateTime();
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0808, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  view.setUint16(26, fileNameBytes.byteLength, true);

  return concatBytes(header, fileNameBytes);
}

function makeDataDescriptor(crc: number, size: number) {
  const descriptor = new Uint8Array(16);
  const view = new DataView(descriptor.buffer);

  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc >>> 0, true);
  view.setUint32(8, size >>> 0, true);
  view.setUint32(12, size >>> 0, true);

  return descriptor;
}

function makeCentralDirectoryHeader(entry: ZipCentralDirectoryEntry) {
  const { dosDate, dosTime } = getDosDateTime();
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0808, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, dosTime, true);
  view.setUint16(14, dosDate, true);
  view.setUint32(16, entry.crc >>> 0, true);
  view.setUint32(20, entry.compressedSize >>> 0, true);
  view.setUint32(24, entry.uncompressedSize >>> 0, true);
  view.setUint16(28, entry.fileNameBytes.byteLength, true);
  view.setUint32(42, entry.localHeaderOffset >>> 0, true);

  return concatBytes(header, entry.fileNameBytes);
}

function makeEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize >>> 0, true);
  view.setUint32(16, centralDirectoryOffset >>> 0, true);

  return footer;
}

async function findProjectBySlug(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,cover_image_path&slug=eq.${encodeURIComponent(
      projectSlug,
    )}&deleted_at=is.null&limit=1`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json().catch(() => [])) as NewsletterProjectDownloadRow[];

  return rows[0] ?? null;
}

async function isProjectMobileAsset(projectId: string, path: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_assets?select=id&project_id=eq.${encodeURIComponent(
      projectId,
    )}&file_path=eq.${encodeURIComponent(path)}&limit=1`,
  );

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;

  return rows.length > 0;
}

async function findProjectPageImageByPath(projectId: string, path: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,page_number,image_path&project_id=eq.${encodeURIComponent(
      projectId,
    )}&image_path=eq.${encodeURIComponent(path)}&limit=1`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json().catch(() => [])) as NewsletterPageDownloadRow[];

  return rows[0] ?? null;
}

function parsePageIds(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f-]{32,36}$/i.test(id)),
    ),
  );
}

async function getProjectPageImagesByIds(projectId: string, pageIds: string[], headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,page_number,image_path&project_id=eq.${encodeURIComponent(
      projectId,
    )}&id=in.(${pageIds.map(encodeURIComponent).join(",")})&order=page_number.asc`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json().catch(() => [])) as NewsletterPageDownloadRow[];
}

function getStorageObjectEndpoint(bucket: string, path: string) {
  return getSupabaseStorageEndpoint(`/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`);
}

function createPageImagesZipStream({
  pages,
  storageHeaders,
}: {
  pages: NewsletterPageDownloadRow[];
  storageHeaders: Record<string, string>;
}) {
  let bytesWritten = 0;
  const centralDirectoryEntries: ZipCentralDirectoryEntry[] = [];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const page of pages) {
          const imagePath = page.image_path;

          if (!imagePath || !isSafeStoragePath(imagePath)) {
            throw new Error(`${page.page_number}쪽 이미지 경로를 확인하세요.`);
          }

          const storageEndpoint = getStorageObjectEndpoint("page-images", imagePath);

          if (!storageEndpoint) {
            throw new Error("Supabase Storage URL 설정을 확인하세요.");
          }

          const storageResponse = await fetch(storageEndpoint, {
            headers: storageHeaders,
            cache: "no-store",
          });

          if (!storageResponse.ok || !storageResponse.body) {
            throw new Error(`${page.page_number}쪽 파일을 다운로드하지 못했습니다.`);
          }

          const fileNameBytes = textEncoder.encode(getZipEntryFileName(page));
          const localHeaderOffset = bytesWritten;
          const localHeader = makeLocalFileHeader(fileNameBytes);
          let crc = 0xffffffff;
          let size = 0;

          controller.enqueue(localHeader);
          bytesWritten += localHeader.byteLength;

          const reader = storageResponse.body.getReader();

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            crc = updateCrc32(crc, value);
            size += value.byteLength;
            bytesWritten += value.byteLength;
            controller.enqueue(value);
          }

          const finalCrc = (crc ^ 0xffffffff) >>> 0;
          const descriptor = makeDataDescriptor(finalCrc, size);

          controller.enqueue(descriptor);
          bytesWritten += descriptor.byteLength;
          centralDirectoryEntries.push({
            compressedSize: size,
            crc: finalCrc,
            fileNameBytes,
            localHeaderOffset,
            uncompressedSize: size,
          });
        }

        const centralDirectoryOffset = bytesWritten;
        let centralDirectorySize = 0;

        for (const entry of centralDirectoryEntries) {
          const header = makeCentralDirectoryHeader(entry);

          controller.enqueue(header);
          bytesWritten += header.byteLength;
          centralDirectorySize += header.byteLength;
        }

        controller.enqueue(
          makeEndOfCentralDirectory(
            centralDirectoryEntries.length,
            centralDirectorySize,
            centralDirectoryOffset,
          ),
        );
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function GET(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket")?.trim() ?? "";
  const path = searchParams.get("path")?.trim() ?? "";
  const projectSlug = searchParams.get("projectSlug")?.trim() ?? "";
  const requestedFileName = searchParams.get("fileName")?.trim() ?? "";
  const isZipRequest = bucket === "page-images" && searchParams.get("zip") === "1";
  const serviceHeaders = getServiceHeaders();
  const storageHeaders = getStorageHeaders();

  if (!downloadableBuckets.has(bucket) || !projectSlug || (!isZipRequest && !isSafeStoragePath(path))) {
    return NextResponse.json({ ok: false, message: "다운로드할 파일 정보를 확인하세요." }, { status: 400 });
  }

  if (!serviceHeaders || !storageHeaders) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 파일 다운로드를 사용할 수 있습니다." },
      { status: 503 },
    );
  }

  const project = await findProjectBySlug(projectSlug, serviceHeaders);

  if (!project) {
    return NextResponse.json({ ok: false, message: "프로젝트를 찾지 못했습니다." }, { status: 404 });
  }

  if (isZipRequest) {
    const pageIds = parsePageIds(searchParams.get("pageIds") ?? "");
    const requestedZipFileName = sanitizeFileName(requestedFileName || `${projectSlug}-pages.zip`);

    if (pageIds.length === 0) {
      return NextResponse.json({ ok: false, message: "선택한 페이지 정보를 확인하세요." }, { status: 400 });
    }

    const pages = await getProjectPageImagesByIds(project.id, pageIds, serviceHeaders);

    if (!pages || pages.length !== pageIds.length || pages.some((page) => !page.image_path)) {
      return NextResponse.json(
        { ok: false, message: "선택한 페이지 파일을 준비하지 못했습니다." },
        { status: 404 },
      );
    }

    const fileName = requestedZipFileName.toLowerCase().endsWith(".zip")
      ? requestedZipFileName
      : `${requestedZipFileName}.zip`;

    return new NextResponse(createPageImagesZipStream({ pages, storageHeaders }), {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Type": "application/zip",
      },
    });
  }

  const pageImage = bucket === "page-images" ? await findProjectPageImageByPath(project.id, path, serviceHeaders) : null;
  const isCoverImage = bucket === "mobile-assets" && project.cover_image_path === path;
  const isAssetImage = bucket === "mobile-assets" && (await isProjectMobileAsset(project.id, path, serviceHeaders));
  const isPageImage = Boolean(pageImage);

  if (!isCoverImage && !isAssetImage && !isPageImage) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 이미지 파일이 아닙니다." }, { status: 404 });
  }

  const storageEndpoint = getStorageObjectEndpoint(bucket, path);

  if (!storageEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase Storage URL 설정을 확인하세요." }, { status: 503 });
  }

  const storageResponse = await fetch(storageEndpoint, {
    headers: storageHeaders,
    cache: "no-store",
  });

  if (!storageResponse.ok || !storageResponse.body) {
    return NextResponse.json(
      { ok: false, message: "파일을 다운로드하지 못했습니다." },
      { status: storageResponse.status || 500 },
    );
  }

  const fileName = sanitizeFileName(
    requestedFileName || (pageImage ? getPageDownloadFileName(projectSlug, pageImage) : path),
  );

  return new NextResponse(storageResponse.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Type": storageResponse.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
}
