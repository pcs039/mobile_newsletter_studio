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
      extractedPages: number;
      message: string;
      textPages: number;
      totalPages: number;
    }
  | {
      ok: false;
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
    return null;
  }

  return (await response.json().catch(() => [])) as PageSearchRow[];
}

async function downloadProjectPdf(pdfPath: string, headers: Record<string, string>) {
  if (!isSafeStoragePath(pdfPath)) {
    return null;
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/pdf-originals/${encodeStoragePath(pdfPath)}`);

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

  return response.arrayBuffer();
}

export async function extractPdfPageTexts(data: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");

      pageTexts.push(normalizeExtractedText(text));
    }
  } finally {
    await loadingTask.destroy();
  }

  return pageTexts;
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
      status: "not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 검색 텍스트를 생성할 수 있습니다.",
    };
  }

  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return {
      ok: false,
      status: "not_found",
      message: "프로젝트를 찾지 못했습니다.",
      httpStatus: 404,
    };
  }

  const pdfPath = project.pdf_original_path?.trim() ?? "";

  if (!pdfPath) {
    return {
      ok: false,
      status: "missing_pdf",
      message: "원본 PDF가 없어 문서 검색 데이터를 생성할 수 없습니다.",
      httpStatus: 400,
    };
  }

  const [pdfData, pages] = await Promise.all([
    downloadProjectPdf(pdfPath, headers),
    getProjectPageSearchRows(project.id, headers),
  ]);

  if (!pdfData || !pages) {
    return {
      ok: false,
      status: "request_failed",
      message: "PDF 또는 페이지 목록을 불러오지 못했습니다.",
      httpStatus: 500,
    };
  }

  const pageTexts = await extractPdfPageTexts(pdfData);
  const now = new Date().toISOString();
  let textPages = 0;
  let extractedPages = 0;

  for (const page of pages) {
    const text = pageTexts[page.page_number - 1]?.trim() ?? "";
    const endpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_pages?id=eq.${encodeURIComponent(page.id)}&project_id=eq.${encodeURIComponent(project.id)}`,
    );

    if (!endpoint) {
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
    }
  }

  return {
    ok: true,
    emptyPages: Math.max(0, extractedPages - textPages),
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
