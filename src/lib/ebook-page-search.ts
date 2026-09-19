import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export type EbookPageSearchStatus = {
  emptyPages: number;
  hasOriginalPdf: boolean;
  hasSearchText: boolean;
  indexedPages: number;
  message: string;
  source: "supabase" | "unconfigured" | "not_found" | "error";
  textPages: number;
  totalPages: number;
  updatedAt: string | null;
};

export type EbookPageSearchRebuildResult =
  | {
      ok: true;
      emptyPages: number;
      failedPages: number;
      extractedPages: number;
      message: string;
      textPages: number;
      totalPages: number;
    }
  | {
      ok: false;
      error:
        | "NOT_CONFIGURED"
        | "PROJECT_NOT_FOUND"
        | "PDF_NOT_FOUND"
        | "PDF_DOWNLOAD_FAILED"
        | "PDF_PASSWORD_REQUIRED"
        | "PDF_PARSE_FAILED"
        | "PAGE_MAPPING_FAILED"
        | "SEARCH_TEXT_UPDATE_FAILED";
      detail?: string;
      message: string;
      status: "not_configured" | "not_found" | "missing_pdf" | "request_failed";
      httpStatus?: number;
    };

export type PublicEbookSearchResult = {
  pageId: string;
  pageNumber: number;
  snippet: string;
};

type ProjectPdfRow = {
  id: string;
  pdf_original_path: string | null;
  slug: string;
  status?: string;
};

type PageSearchRow = {
  id: string;
  page_number: number;
  search_text: string | null;
  search_text_updated_at: string | null;
};

type PdfDownloadResult =
  | {
      ok: true;
      data: ArrayBuffer;
      size: number;
    }
  | {
      ok: false;
      error: "PDF_NOT_FOUND" | "PDF_DOWNLOAD_FAILED";
      httpStatus?: number;
      message: string;
    };

type PdfTextExtractionResult = {
  failedPages: number[];
  pageTexts: string[];
  totalPages: number;
};

type PdfTextExtractionContext = {
  byteLength: number;
  eofHint: boolean;
  pdfName: string;
  projectId: string;
};

type PromiseWithResolversCapability<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

type PromiseConstructorWithResolvers = PromiseConstructor & {
  withResolvers?: <T>() => PromiseWithResolversCapability<T>;
};

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

class PdfTextExtractionError extends Error {
  code: "PDF_PASSWORD_REQUIRED" | "PDF_PARSE_FAILED";
  detail: string;

  constructor(code: "PDF_PASSWORD_REQUIRED" | "PDF_PARSE_FAILED", message: string, detail: string) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
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

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isSafeStoragePath(path: string) {
  return path.length > 0 && !path.includes("..") && !path.startsWith("/") && !path.endsWith("/");
}

function normalizeExtractedText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSearchQuery(value: string | null) {
  const query = value?.replace(/\s+/g, " ").trim() ?? "";

  return query.slice(0, 100);
}

function formatSearchUpdatedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ensurePdfJsRuntimePolyfills() {
  const promiseConstructor = Promise as PromiseConstructorWithResolvers;

  promiseConstructor.withResolvers ??= function withResolvers<T>() {
    let resolveCapability: (value: T | PromiseLike<T>) => void = () => undefined;
    let rejectCapability: (reason?: unknown) => void = () => undefined;
    const promise = new Promise<T>((resolve, reject) => {
      resolveCapability = resolve;
      rejectCapability = reject;
    });

    return {
      promise,
      reject: rejectCapability,
      resolve: resolveCapability,
    };
  };
}

function resolvePdfJsWorkerPath() {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("pdfjs-dist/package.json");

  return path.join(path.dirname(packageJsonPath), "legacy/build/pdf.worker.mjs");
}

function configurePdfJsWorker(pdfjs: PdfJsModule, context: PdfTextExtractionContext) {
  try {
    const workerPath = resolvePdfJsWorkerPath();
    const exists = existsSync(workerPath);

    if (!exists) {
      console.error("[ebook-search-index] pdf worker not found", {
        exists,
        pdfName: context.pdfName,
        projectId: context.projectId,
        workerPath,
      });
      return;
    }

    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  } catch (error) {
    const parsedError = describePdfError(error);

    console.error("[ebook-search-index] pdf worker resolve failed", {
      errorMessage: parsedError.message,
      errorName: parsedError.name,
      pdfName: context.pdfName,
      projectId: context.projectId,
    });
  }
}

function getSafeBasename(path: string) {
  return path.split("/").pop()?.replace(/[^\p{L}\p{N}._ -]/gu, "") || "original.pdf";
}

function hasPdfEofMarker(data: ArrayBuffer) {
  const tailLength = Math.min(data.byteLength, 4096);
  const tail = Buffer.from(data.slice(data.byteLength - tailLength)).toString("latin1");

  return tail.includes("%%EOF");
}

function describePdfError(error: unknown) {
  if (error instanceof Error) {
    const name = error.name || "Error";
    const message = error.message || "Unknown error";

    return {
      detail: `${name}: ${message}`.slice(0, 240),
      message,
      name,
    };
  }

  const message = String(error);

  return {
    detail: message.slice(0, 240),
    message,
    name: "UnknownError",
  };
}

export function makeSearchSnippet(text: string, query: string) {
  const normalizedText = normalizeExtractedText(text);
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedText || !normalizedQuery) {
    return "";
  }

  const index = normalizedText.toLocaleLowerCase().indexOf(normalizedQuery.toLocaleLowerCase());

  if (index < 0) {
    return normalizedText.slice(0, 120);
  }

  const contextLength = 54;
  const start = Math.max(0, index - contextLength);
  const end = Math.min(normalizedText.length, index + normalizedQuery.length + contextLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";

  return `${prefix}${normalizedText.slice(start, end)}${suffix}`;
}

async function findProjectBySlug(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,slug,status,pdf_original_path&slug=eq.${encodeURIComponent(
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
    console.error("[ebook-search-index] project lookup failed", {
      projectSlug,
      status: response.status,
    });
    return null;
  }

  const rows = (await response.json().catch(() => [])) as ProjectPdfRow[];

  return rows[0] ?? null;
}

async function getProjectPageSearchRows(projectId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,page_number,search_text,search_text_updated_at&project_id=eq.${encodeURIComponent(
      projectId,
    )}&order=page_number.asc`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");

    console.error("[ebook-search-index] page mapping lookup failed", {
      projectId,
      status: response.status,
      responseText: responseText.slice(0, 300),
    });
    return null;
  }

  return (await response.json().catch(() => [])) as PageSearchRow[];
}

async function downloadProjectPdf(pdfPath: string, headers: Record<string, string>): Promise<PdfDownloadResult> {
  if (!isSafeStoragePath(pdfPath)) {
    console.error("[ebook-search-index] unsafe pdf storage path");
    return {
      ok: false,
      error: "PDF_NOT_FOUND",
      message: "PDF Storage 경로를 확인하세요.",
    };
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/pdf-originals/${encodeStoragePath(pdfPath)}`);

  if (!endpoint) {
    return {
      ok: false,
      error: "PDF_DOWNLOAD_FAILED",
      message: "Supabase Storage URL 설정을 확인하세요.",
    };
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");

    console.error("[ebook-search-index] pdf download failed", {
      status: response.status,
      responseText: responseText.slice(0, 300),
    });

    return {
      ok: false,
      error: response.status === 404 ? "PDF_NOT_FOUND" : "PDF_DOWNLOAD_FAILED",
      httpStatus: response.status,
      message: response.status === 404 ? "PDF 파일을 찾지 못했습니다." : "PDF 파일을 읽지 못했습니다.",
    };
  }

  const data = await response.arrayBuffer();

  if (data.byteLength < 8) {
    console.error("[ebook-search-index] pdf download returned empty file", {
      byteLength: data.byteLength,
    });

    return {
      ok: false,
      error: "PDF_DOWNLOAD_FAILED",
      message: "PDF 파일이 비어 있거나 손상됐습니다.",
    };
  }

  const header = Buffer.from(data.slice(0, 5)).toString("utf8");

  if (header !== "%PDF-") {
    console.error("[ebook-search-index] downloaded file is not a pdf", {
      byteLength: data.byteLength,
      header,
    });

    return {
      ok: false,
      error: "PDF_DOWNLOAD_FAILED",
      message: "PDF 파일 형식을 확인하지 못했습니다.",
    };
  }

  return {
    ok: true,
    data,
    size: data.byteLength,
  };
}

export async function extractPdfPageTexts(data: ArrayBuffer, context: PdfTextExtractionContext): Promise<PdfTextExtractionResult> {
  let pdfjs: PdfJsModule;

  try {
    ensurePdfJsRuntimePolyfills();
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    configurePdfJsWorker(pdfjs, context);
  } catch (error) {
    const parsedError = describePdfError(error);

    console.error("[ebook-search-index] pdfjs import failed", {
      byteLength: context.byteLength,
      errorMessage: parsedError.message,
      errorName: parsedError.name,
      eofHint: context.eofHint,
      pdfName: context.pdfName,
      projectId: context.projectId,
    });
    throw new PdfTextExtractionError("PDF_PARSE_FAILED", "PDF 텍스트 추출 라이브러리를 불러오지 못했습니다.", parsedError.detail);
  }

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise.catch((error: unknown) => {
    const parsedError = describePdfError(error);

    console.error("[ebook-search-index] pdf parse failed", {
      byteLength: context.byteLength,
      errorMessage: parsedError.message,
      errorName: parsedError.name,
      eofHint: context.eofHint,
      pdfName: context.pdfName,
      projectId: context.projectId,
    });

    if (parsedError.name === "PasswordException" || /password/i.test(parsedError.message)) {
      throw new PdfTextExtractionError(
        "PDF_PASSWORD_REQUIRED",
        "암호가 설정된 PDF는 검색 텍스트를 생성할 수 없습니다.",
        parsedError.detail,
      );
    }

    throw new PdfTextExtractionError("PDF_PARSE_FAILED", "PDF 텍스트 추출에 실패했습니다.", parsedError.detail);
  });
  const pageTexts: string[] = [];
  const failedPages: number[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      try {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" ");

        pageTexts.push(normalizeExtractedText(text));
      } catch (error) {
        console.error("[ebook-search-index] page text extraction failed", {
          message: error instanceof Error ? error.message : String(error),
          pageNumber,
        });
        failedPages.push(pageNumber);
        pageTexts.push("");
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return {
    failedPages,
    pageTexts,
    totalPages: pdf.numPages,
  };
}

export async function getProjectEbookSearchStatus(projectSlug: string): Promise<EbookPageSearchStatus> {
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      emptyPages: 0,
      hasOriginalPdf: false,
      hasSearchText: false,
      indexedPages: 0,
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 검색 데이터를 확인할 수 있습니다.",
      source: "unconfigured",
      textPages: 0,
      totalPages: 0,
      updatedAt: null,
    };
  }

  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return {
      emptyPages: 0,
      hasOriginalPdf: false,
      hasSearchText: false,
      indexedPages: 0,
      message: "프로젝트를 찾지 못했습니다.",
      source: "not_found",
      textPages: 0,
      totalPages: 0,
      updatedAt: null,
    };
  }

  const rows = await getProjectPageSearchRows(project.id, headers);

  if (!rows) {
    return {
      emptyPages: 0,
      hasOriginalPdf: Boolean(project.pdf_original_path),
      hasSearchText: false,
      indexedPages: 0,
      message: "검색 데이터 조회에 실패했습니다. DB migration 적용 여부를 확인하세요.",
      source: "error",
      textPages: 0,
      totalPages: 0,
      updatedAt: null,
    };
  }

  const indexedRows = rows.filter((row) => row.search_text_updated_at);
  const textPages = rows.filter((row) => row.search_text?.trim()).length;
  const updatedAt = indexedRows
    .map((row) => row.search_text_updated_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    emptyPages: Math.max(0, indexedRows.length - textPages),
    hasOriginalPdf: Boolean(project.pdf_original_path),
    hasSearchText: textPages > 0,
    indexedPages: indexedRows.length,
    message:
      textPages > 0
        ? `검색 가능 ${textPages} / ${rows.length}쪽`
        : indexedRows.length > 0
          ? "PDF에 검색 가능한 텍스트 레이어가 없습니다."
          : "검색 텍스트를 아직 생성하지 않았습니다.",
    source: "supabase",
    textPages,
    totalPages: rows.length,
    updatedAt: formatSearchUpdatedAt(updatedAt),
  };
}

export async function rebuildProjectEbookSearchIndex(projectSlug: string): Promise<EbookPageSearchRebuildResult> {
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      status: "not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 검색 텍스트를 생성할 수 있습니다.",
    };
  }

  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return {
      ok: false,
      error: "PROJECT_NOT_FOUND",
      status: "not_found",
      message: "프로젝트를 찾지 못했습니다.",
      httpStatus: 404,
    };
  }

  const pdfPath = project.pdf_original_path?.trim() ?? "";

  if (!pdfPath) {
    return {
      ok: false,
      error: "PDF_NOT_FOUND",
      status: "missing_pdf",
      message: "원본 PDF가 없어 문서 검색 데이터를 생성할 수 없습니다.",
      httpStatus: 400,
    };
  }

  const [pdfDownload, pages] = await Promise.all([
    downloadProjectPdf(pdfPath, headers),
    getProjectPageSearchRows(project.id, headers),
  ]);

  if (!pdfDownload.ok) {
    return {
      ok: false,
      error: pdfDownload.error,
      status: "request_failed",
      message: pdfDownload.message,
      httpStatus: pdfDownload.httpStatus ?? 500,
    };
  }

  if (!pages) {
    return {
      ok: false,
      error: "PAGE_MAPPING_FAILED",
      status: "request_failed",
      message: "페이지 연결 정보를 불러오지 못했습니다. search_text migration 적용 여부를 확인하세요.",
      httpStatus: 500,
    };
  }

  if (pages.length === 0) {
    return {
      ok: false,
      error: "PAGE_MAPPING_FAILED",
      status: "request_failed",
      message: "검색 텍스트를 연결할 e-book 페이지가 없습니다.",
      httpStatus: 400,
    };
  }

  let extraction: PdfTextExtractionResult;

  try {
    extraction = await extractPdfPageTexts(pdfDownload.data, {
      byteLength: pdfDownload.size,
      eofHint: hasPdfEofMarker(pdfDownload.data),
      pdfName: getSafeBasename(pdfPath),
      projectId: project.id,
    });
  } catch (error) {
    const extractionError =
      error instanceof PdfTextExtractionError
        ? error
        : new PdfTextExtractionError("PDF_PARSE_FAILED", "PDF 텍스트 추출에 실패했습니다.", describePdfError(error).detail);

    console.error("[ebook-search-index] pdf text extraction failed", {
      byteLength: pdfDownload.size,
      detail: extractionError.detail,
      eofHint: hasPdfEofMarker(pdfDownload.data),
      message: extractionError.message,
      pdfName: getSafeBasename(pdfPath),
      pdfSize: pdfDownload.size,
      projectId: project.id,
    });

    return {
      ok: false,
      error: extractionError.code,
      detail: extractionError.detail,
      status: "request_failed",
      message: extractionError.message,
      httpStatus: 500,
    };
  }

  const now = new Date().toISOString();
  const failedPageNumbers = new Set(extraction.failedPages);
  let textPages = 0;
  let extractedPages = 0;
  let updateFailures = 0;

  for (const page of pages) {
    const text = extraction.pageTexts[page.page_number - 1]?.trim() ?? "";
    const endpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_pages?id=eq.${encodeURIComponent(page.id)}&project_id=eq.${encodeURIComponent(project.id)}`,
    );

    if (!endpoint) {
      updateFailures += 1;
      continue;
    }

    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        ...headers,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        search_text: text || null,
        search_text_updated_at: now,
      }),
      cache: "no-store",
    });

    if (response.ok) {
      extractedPages += 1;

      if (text) {
        textPages += 1;
      }
    } else {
      const responseText = await response.text().catch(() => "");

      console.error("[ebook-search-index] search_text update failed", {
        pageNumber: page.page_number,
        responseText: responseText.slice(0, 300),
        status: response.status,
      });
      updateFailures += 1;
    }
  }

  if (extractedPages === 0 && updateFailures > 0) {
    return {
      ok: false,
      error: "SEARCH_TEXT_UPDATE_FAILED",
      status: "request_failed",
      message: "검색 텍스트를 저장하지 못했습니다. search_text migration 적용 여부를 확인하세요.",
      httpStatus: 500,
    };
  }

  const mappedPdfPages = pages.filter((page) => page.page_number <= extraction.totalPages).length;
  const unmappedPages = Math.max(0, pages.length - mappedPdfPages);
  const failedPages = failedPageNumbers.size + updateFailures + unmappedPages;

  return {
    ok: true,
    emptyPages: Math.max(0, extractedPages - textPages),
    failedPages,
    extractedPages,
    message:
      textPages > 0
        ? `검색 텍스트를 생성했습니다. (${textPages} / ${pages.length}쪽)`
        : "PDF에 검색 가능한 텍스트 레이어가 없습니다.",
    textPages,
    totalPages: pages.length,
  };
}

export async function searchPublishedEbookPages(slug: string, rawQuery: string) {
  const query = normalizeSearchQuery(rawQuery);
  const headers = getServiceHeaders();

  if (!query || query.length < 1) {
    return {
      ok: false as const,
      message: "검색어를 입력하세요.",
      status: 400,
    };
  }

  if (!headers) {
    return {
      ok: false as const,
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 문서 검색을 사용할 수 있습니다.",
      status: 503,
    };
  }

  const project = await findProjectBySlug(slug, headers);

  if (!project || project.status !== "published") {
    return {
      ok: false as const,
      message: "공개된 e-book을 찾지 못했습니다.",
      status: 404,
    };
  }

  const rows = await getProjectPageSearchRows(project.id, headers);

  if (!rows) {
    return {
      ok: false as const,
      message: "문서 검색 데이터를 불러오지 못했습니다.",
      status: 500,
    };
  }

  const lowerQuery = query.toLocaleLowerCase();
  const results = rows
    .filter((row) => row.search_text?.toLocaleLowerCase().includes(lowerQuery))
    .slice(0, 50)
    .map((row): PublicEbookSearchResult => ({
      pageId: row.id,
      pageNumber: row.page_number,
      snippet: makeSearchSnippet(row.search_text ?? "", query),
    }));

  const hasIndexedPages = rows.some((row) => row.search_text_updated_at);
  const hasSearchText = rows.some((row) => row.search_text?.trim());

  return {
    ok: true as const,
    count: results.length,
    hasIndexedPages,
    hasSearchText,
    query,
    results,
  };
}
