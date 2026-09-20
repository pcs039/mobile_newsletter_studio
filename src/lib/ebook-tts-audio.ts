import { createHash } from "crypto";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export type EbookPageTtsPageState = "empty_text" | "generated" | "needs_generation" | "stale";

export type EbookPageTtsStatusPage = {
  id: string;
  pageNumber: number;
  state: EbookPageTtsPageState;
  textHash: string | null;
};

export type EbookPageTtsStatus = {
  emptyTextPages: number;
  generatedPages: number;
  message: string;
  model: string;
  needsGenerationPages: number;
  pages: EbookPageTtsStatusPage[];
  providerConfigured: boolean;
  source: "supabase" | "unconfigured" | "not_found" | "error";
  stalePages: number;
  totalPages: number;
  updatedAt: string | null;
  voice: string;
};

export type EbookPageTtsGenerateResult =
  | {
      ok: true;
      audioPaths: string[];
      message: string;
      pageNumber: number;
      segments: number;
      skipped?: boolean;
      textHash: string;
    }
  | {
      ok: false;
      error:
        | "TTS_PROVIDER_NOT_CONFIGURED"
        | "TTS_TEXT_EMPTY"
        | "TTS_GENERATION_FAILED"
        | "TTS_UPLOAD_FAILED"
        | "TTS_METADATA_UPDATE_FAILED"
        | "TTS_PAGE_NOT_FOUND"
        | "TTS_FORBIDDEN";
      detail?: string;
      httpStatus?: number;
      message: string;
    };

export type PublicEbookAudioSegment = {
  index: number;
  url: string;
};

export type PublicEbookAudioManifest = {
  hasAudio: boolean;
  model: string | null;
  pageId: string;
  pageNumber: number;
  segmentCount: number;
  segments: PublicEbookAudioSegment[];
  stale: boolean;
  voice: string | null;
};

type ProjectRow = {
  ebook_source: string | null;
  id: string;
  slug: string;
};

type PublicProjectRow = {
  id: string;
  status: string;
};

type PageTtsRow = {
  id: string;
  page_number: number;
  project_id: string;
  search_text: string | null;
  tts_audio_paths: unknown;
  tts_audio_updated_at: string | null;
  tts_model: string | null;
  tts_text_hash: string | null;
  tts_voice: string | null;
};

type GenerateOptions = {
  force?: boolean;
};

const ttsBucket = "ebook-tts-audio";
const defaultTtsModel = "gpt-4o-mini-tts";
const defaultTtsVoice = "marin";
const maxRawPageTextLength = 60_000;
const targetChunkLength = 1200;
const minimumSplitChunkLength = 400;

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

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

function getTtsModel() {
  return process.env.OPENAI_TTS_MODEL?.trim() || defaultTtsModel;
}

function getTtsVoice() {
  return process.env.OPENAI_TTS_VOICE?.trim() || defaultTtsVoice;
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isSafeStoragePath(path: string) {
  return path.length > 0 && !path.includes("..") && !path.startsWith("/") && !path.endsWith("/");
}

function normalizeTtsText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hashTtsText(text: string) {
  return createHash("sha256").update(normalizeTtsText(text), "utf8").digest("hex");
}

function getAudioPaths(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && isSafeStoragePath(item));
}

function formatUpdatedAt(value: string | null) {
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

function getPageState(page: PageTtsRow, model: string, voice: string): EbookPageTtsPageState {
  const text = normalizeTtsText(page.search_text ?? "");

  if (!text) {
    return "empty_text";
  }

  const hash = hashTtsText(text);
  const audioPaths = getAudioPaths(page.tts_audio_paths);

  if (audioPaths.length === 0 || !page.tts_text_hash) {
    return "needs_generation";
  }

  if (page.tts_text_hash !== hash || page.tts_model !== model || page.tts_voice !== voice) {
    return "stale";
  }

  return "generated";
}

async function findProjectBySlug(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,slug,ebook_source&slug=eq.${encodeURIComponent(
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
    console.error("[ebook-tts-audio] project lookup failed", {
      projectSlug,
      status: response.status,
    });
    return null;
  }

  const rows = (await response.json().catch(() => [])) as ProjectRow[];

  return rows[0] ?? null;
}

async function findPublishedProject(slug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,status&slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&limit=1`,
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

  const rows = (await response.json().catch(() => [])) as PublicProjectRow[];
  const project = rows[0] ?? null;

  return project?.status === "published" ? project : null;
}

async function getProjectTtsPages(projectId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,project_id,page_number,search_text,tts_audio_paths,tts_audio_updated_at,tts_text_hash,tts_voice,tts_model&project_id=eq.${encodeURIComponent(
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

    console.error("[ebook-tts-audio] page lookup failed", {
      projectId,
      responseText: responseText.slice(0, 300),
      status: response.status,
    });
    return null;
  }

  return (await response.json().catch(() => [])) as PageTtsRow[];
}

async function getProjectPage(projectId: string, pageId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?select=id,project_id,page_number,search_text,tts_audio_paths,tts_audio_updated_at,tts_text_hash,tts_voice,tts_model&project_id=eq.${encodeURIComponent(
      projectId,
    )}&id=eq.${encodeURIComponent(pageId)}&limit=1`,
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

    console.error("[ebook-tts-audio] page ownership lookup failed", {
      pageId,
      projectId,
      responseText: responseText.slice(0, 300),
      status: response.status,
    });
    return null;
  }

  const rows = (await response.json().catch(() => [])) as PageTtsRow[];

  return rows[0] ?? null;
}

export function chunkEbookTtsText(text: string, maxLength = targetChunkLength) {
  const normalized = normalizeTtsText(text);

  if (!normalized) {
    return [];
  }

  const sentences = normalized.match(/[^.!?。！？\n]+[.!?。！？]?/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const value = sentence.trim();

    if (!value) {
      continue;
    }

    if (value.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      for (let index = 0; index < value.length; index += maxLength) {
        chunks.push(value.slice(index, index + maxLength).trim());
      }

      continue;
    }

    const candidate = current ? `${current} ${value}` : value;

    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = value;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function isInputLengthError(status: number, body: string) {
  const value = body.toLowerCase();

  return status === 400 && (value.includes("maximum") || value.includes("too long") || value.includes("length"));
}

async function requestOpenAiSpeech(input: string, model: string, voice: string) {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    return {
      ok: false as const,
      error: "TTS_PROVIDER_NOT_CONFIGURED" as const,
      message: "AI 음성 생성 API가 설정되지 않았습니다.",
      httpStatus: 503,
    };
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      model,
      response_format: "mp3",
      voice,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");

    return {
      ok: false as const,
      error: "TTS_GENERATION_FAILED" as const,
      httpStatus: response.status,
      isInputTooLong: isInputLengthError(response.status, responseText),
      message: "AI 음성 생성에 실패했습니다.",
      detail: responseText.slice(0, 300),
    };
  }

  return {
    ok: true as const,
    data: await response.arrayBuffer(),
  };
}

async function generateAudioForChunk(input: string, model: string, voice: string, chunkLength: number) {
  const firstAttempt = await requestOpenAiSpeech(input, model, voice);

  if (firstAttempt.ok || !firstAttempt.isInputTooLong || chunkLength <= minimumSplitChunkLength) {
    return firstAttempt;
  }

  const smallerChunks = chunkEbookTtsText(input, Math.max(minimumSplitChunkLength, Math.floor(chunkLength / 2)));
  const buffers: ArrayBuffer[] = [];

  for (const chunk of smallerChunks) {
    const retry = await requestOpenAiSpeech(chunk, model, voice);

    if (!retry.ok) {
      return retry;
    }

    buffers.push(retry.data);
  }

  return {
    ok: true as const,
    data: buffers,
  };
}

async function uploadTtsSegment(path: string, audio: ArrayBuffer, headers: Record<string, string>) {
  const endpoint = getSupabaseStorageEndpoint(`/object/${ttsBucket}/${encodeStoragePath(path)}`);

  if (!endpoint) {
    return {
      ok: false,
      message: "Supabase Storage URL 설정을 확인하세요.",
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "audio/mpeg",
      "cache-control": "31536000",
      "x-upsert": "true",
    },
    body: new Blob([audio], { type: "audio/mpeg" }),
    cache: "no-store",
  });

  if (response.ok) {
    return {
      ok: true,
    };
  }

  return {
    ok: false,
    httpStatus: response.status,
    message: (await response.text().catch(() => "")) || "TTS 음성 파일 업로드에 실패했습니다.",
  };
}

async function deleteTtsSegments(paths: string[], headers: Record<string, string>) {
  const safePaths = paths.filter(isSafeStoragePath);

  if (safePaths.length === 0) {
    return;
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${encodeURIComponent(ttsBucket)}`);

  if (!endpoint) {
    return;
  }

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: safePaths }),
    cache: "no-store",
  });

  if (!response.ok && response.status !== 404) {
    const responseText = await response.text().catch(() => "");

    console.error("[ebook-tts-audio] best-effort segment cleanup failed", {
      responseText: responseText.slice(0, 300),
      status: response.status,
    });
  }
}

async function updatePageTtsMetadata(
  page: PageTtsRow,
  projectId: string,
  metadata: {
    model: string;
    paths: string[];
    textHash: string;
    voice: string;
  },
  headers: Record<string, string>,
) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_pages?id=eq.${encodeURIComponent(page.id)}&project_id=eq.${encodeURIComponent(projectId)}`,
  );

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      tts_audio_paths: metadata.paths,
      tts_audio_updated_at: new Date().toISOString(),
      tts_model: metadata.model,
      tts_text_hash: metadata.textHash,
      tts_voice: metadata.voice,
    }),
    cache: "no-store",
  });

  if (response.ok) {
    return true;
  }

  const responseText = await response.text().catch(() => "");

  console.error("[ebook-tts-audio] metadata update failed", {
    pageId: page.id,
    pageNumber: page.page_number,
    responseText: responseText.slice(0, 300),
    status: response.status,
  });

  return false;
}

export async function getProjectEbookTtsStatus(projectSlug: string): Promise<EbookPageTtsStatus> {
  const headers = getServiceHeaders();
  const model = getTtsModel();
  const voice = getTtsVoice();

  if (!headers) {
    return {
      emptyTextPages: 0,
      generatedPages: 0,
      message: "Supabase 환경변수 설정 후 e-book 읽어주기 음성 상태를 표시합니다.",
      model,
      needsGenerationPages: 0,
      pages: [],
      providerConfigured: Boolean(getOpenAiApiKey()),
      source: "unconfigured",
      stalePages: 0,
      totalPages: 0,
      updatedAt: null,
      voice,
    };
  }

  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return {
      emptyTextPages: 0,
      generatedPages: 0,
      message: "프로젝트를 찾지 못했습니다.",
      model,
      needsGenerationPages: 0,
      pages: [],
      providerConfigured: Boolean(getOpenAiApiKey()),
      source: "not_found",
      stalePages: 0,
      totalPages: 0,
      updatedAt: null,
      voice,
    };
  }

  if (project.ebook_source === "external") {
    return {
      emptyTextPages: 0,
      generatedPages: 0,
      message: "외부 e-book 연결 프로젝트는 내부 e-book 읽어주기 음성 생성 대상이 아닙니다.",
      model,
      needsGenerationPages: 0,
      pages: [],
      providerConfigured: Boolean(getOpenAiApiKey()),
      source: "supabase",
      stalePages: 0,
      totalPages: 0,
      updatedAt: null,
      voice,
    };
  }

  const rows = await getProjectTtsPages(project.id, headers);

  if (!rows) {
    return {
      emptyTextPages: 0,
      generatedPages: 0,
      message: "e-book 읽어주기 음성 상태 조회에 실패했습니다. DB migration 적용 여부를 확인하세요.",
      model,
      needsGenerationPages: 0,
      pages: [],
      providerConfigured: Boolean(getOpenAiApiKey()),
      source: "error",
      stalePages: 0,
      totalPages: 0,
      updatedAt: null,
      voice,
    };
  }

  const pages = rows.map((row) => {
    const normalized = normalizeTtsText(row.search_text ?? "");

    return {
      id: row.id,
      pageNumber: row.page_number,
      state: getPageState(row, model, voice),
      textHash: normalized ? hashTtsText(normalized) : null,
    };
  });
  const updatedAt =
    rows
      .map((row) => row.tts_audio_updated_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const generatedPages = pages.filter((page) => page.state === "generated").length;
  const stalePages = pages.filter((page) => page.state === "stale").length;
  const emptyTextPages = pages.filter((page) => page.state === "empty_text").length;
  const needsGenerationPages = pages.filter((page) => page.state === "needs_generation").length + stalePages;

  return {
    emptyTextPages,
    generatedPages,
    message:
      generatedPages > 0
        ? `읽어주기 음성 생성 완료 ${generatedPages} / ${rows.length}쪽`
        : "e-book 읽어주기 음성을 아직 생성하지 않았습니다.",
    model,
    needsGenerationPages,
    pages,
    providerConfigured: Boolean(getOpenAiApiKey()),
    source: "supabase",
    stalePages,
    totalPages: rows.length,
    updatedAt: formatUpdatedAt(updatedAt),
    voice,
  };
}

export async function generateProjectEbookPageTtsAudio(
  projectSlug: string,
  pageId: string,
  options: GenerateOptions = {},
): Promise<EbookPageTtsGenerateResult> {
  const headers = getServiceHeaders();
  const model = getTtsModel();
  const voice = getTtsVoice();

  if (!getOpenAiApiKey()) {
    return {
      ok: false,
      error: "TTS_PROVIDER_NOT_CONFIGURED",
      httpStatus: 503,
      message: "AI 음성 생성 API가 설정되지 않았습니다.",
    };
  }

  if (!headers) {
    return {
      ok: false,
      error: "TTS_GENERATION_FAILED",
      httpStatus: 503,
      message: "Supabase Storage 설정을 확인하세요.",
    };
  }

  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return {
      ok: false,
      error: "TTS_PAGE_NOT_FOUND",
      httpStatus: 404,
      message: "프로젝트를 찾지 못했습니다.",
    };
  }

  if (project.ebook_source === "external") {
    return {
      ok: false,
      error: "TTS_FORBIDDEN",
      httpStatus: 400,
      message: "외부 e-book 연결 프로젝트는 내부 e-book 읽어주기 음성 생성 대상이 아닙니다.",
    };
  }

  const page = await getProjectPage(project.id, pageId, headers);

  if (!page) {
    return {
      ok: false,
      error: "TTS_PAGE_NOT_FOUND",
      httpStatus: 404,
      message: "e-book 페이지를 찾지 못했습니다.",
    };
  }

  const text = normalizeTtsText(page.search_text ?? "");

  if (!text) {
    return {
      ok: false,
      error: "TTS_TEXT_EMPTY",
      httpStatus: 400,
      message: "검색 텍스트가 없어 읽어주기 음성을 생성할 수 없습니다.",
    };
  }

  if (text.length > maxRawPageTextLength) {
    return {
      ok: false,
      error: "TTS_GENERATION_FAILED",
      httpStatus: 400,
      message: `페이지 텍스트가 너무 깁니다. ${maxRawPageTextLength.toLocaleString("ko-KR")}자 이하로 줄인 뒤 다시 시도하세요.`,
    };
  }

  const textHash = hashTtsText(text);
  const oldPaths = getAudioPaths(page.tts_audio_paths);

  if (
    !options.force &&
    oldPaths.length > 0 &&
    page.tts_text_hash === textHash &&
    page.tts_model === model &&
    page.tts_voice === voice
  ) {
    return {
      ok: true,
      audioPaths: oldPaths,
      message: "이미 최신 읽어주기 음성이 생성되어 있습니다.",
      pageNumber: page.page_number,
      segments: oldPaths.length,
      skipped: true,
      textHash,
    };
  }

  const chunks = chunkEbookTtsText(text, targetChunkLength);

  if (chunks.length === 0) {
    return {
      ok: false,
      error: "TTS_TEXT_EMPTY",
      httpStatus: 400,
      message: "검색 텍스트가 없어 읽어주기 음성을 생성할 수 없습니다.",
    };
  }

  const generatedSegments: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const generated = await generateAudioForChunk(chunk, model, voice, targetChunkLength);

    if (!generated.ok) {
      return {
        ok: false,
        error: generated.error,
        detail: generated.detail,
        httpStatus: generated.httpStatus,
        message: generated.message,
      };
    }

    if (Array.isArray(generated.data)) {
      generatedSegments.push(...generated.data);
    } else {
      generatedSegments.push(generated.data);
    }
  }

  const newPaths: string[] = [];

  for (const [index, audio] of generatedSegments.entries()) {
    const path = `${project.id}/${page.id}/${textHash}-${String(index + 1).padStart(3, "0")}.mp3`;
    const upload = await uploadTtsSegment(path, audio, headers);

    if (!upload.ok) {
      await deleteTtsSegments(newPaths, headers);

      return {
        ok: false,
        error: "TTS_UPLOAD_FAILED",
        detail: (upload.message ?? "TTS 음성 파일 업로드에 실패했습니다.").slice(0, 300),
        httpStatus: upload.httpStatus,
        message: "TTS 음성 파일을 Storage에 업로드하지 못했습니다.",
      };
    }

    newPaths.push(path);
  }

  const metadataUpdated = await updatePageTtsMetadata(
    page,
    project.id,
    {
      model,
      paths: newPaths,
      textHash,
      voice,
    },
    headers,
  );

  if (!metadataUpdated) {
    await deleteTtsSegments(newPaths, headers);

    return {
      ok: false,
      error: "TTS_METADATA_UPDATE_FAILED",
      httpStatus: 500,
      message: "TTS 음성 메타데이터를 저장하지 못했습니다.",
    };
  }

  await deleteTtsSegments(oldPaths.filter((path) => !newPaths.includes(path)), headers);

  return {
    ok: true,
    audioPaths: newPaths,
    message: `${page.page_number}쪽 읽어주기 음성을 생성했습니다.`,
    pageNumber: page.page_number,
    segments: newPaths.length,
    textHash,
  };
}

export async function getPublicEbookPageAudioManifest(slug: string, pageId: string) {
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      ok: false as const,
      httpStatus: 503,
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 읽어주기 음성을 사용할 수 있습니다.",
    };
  }

  const project = await findPublishedProject(slug, headers);

  if (!project) {
    return {
      ok: false as const,
      httpStatus: 404,
      message: "공개된 e-book을 찾지 못했습니다.",
    };
  }

  const page = await getProjectPage(project.id, pageId, headers);

  if (!page) {
    return {
      ok: false as const,
      httpStatus: 404,
      message: "페이지를 찾지 못했습니다.",
    };
  }

  const text = normalizeTtsText(page.search_text ?? "");
  const textHash = text ? hashTtsText(text) : "";
  const paths = getAudioPaths(page.tts_audio_paths);
  const stale = Boolean(text && paths.length > 0 && page.tts_text_hash && page.tts_text_hash !== textHash);
  const hasAudio = Boolean(text && !stale && paths.length > 0 && page.tts_text_hash === textHash);

  return {
    ok: true as const,
    manifest: {
      hasAudio,
      model: hasAudio ? page.tts_model : null,
      pageId: page.id,
      pageNumber: page.page_number,
      segmentCount: hasAudio ? paths.length : 0,
      segments: hasAudio
        ? paths.map((_path, index) => ({
            index,
            url: `/api/public/newsletters/${encodeURIComponent(slug)}/ebook/pages/${encodeURIComponent(
              page.id,
            )}/audio/${index}`,
          }))
        : [],
      stale,
      voice: hasAudio ? page.tts_voice : null,
    } satisfies PublicEbookAudioManifest,
  };
}

export async function downloadPublicEbookPageAudioSegment(slug: string, pageId: string, segmentIndex: number) {
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      ok: false as const,
      httpStatus: 503,
      message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 읽어주기 음성을 사용할 수 있습니다.",
    };
  }

  const project = await findPublishedProject(slug, headers);

  if (!project) {
    return {
      ok: false as const,
      httpStatus: 404,
      message: "공개된 e-book을 찾지 못했습니다.",
    };
  }

  const page = await getProjectPage(project.id, pageId, headers);

  if (!page) {
    return {
      ok: false as const,
      httpStatus: 404,
      message: "페이지를 찾지 못했습니다.",
    };
  }

  const text = normalizeTtsText(page.search_text ?? "");
  const textHash = text ? hashTtsText(text) : "";
  const paths = getAudioPaths(page.tts_audio_paths);
  const hasAudio = Boolean(text && paths.length > 0 && page.tts_text_hash === textHash);

  if (!hasAudio || !Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= paths.length) {
    return {
      ok: false as const,
      httpStatus: 404,
      message: "읽어주기 음성을 찾지 못했습니다.",
    };
  }

  const path = paths[segmentIndex];

  if (!isSafeStoragePath(path)) {
    return {
      ok: false as const,
      httpStatus: 404,
      message: "읽어주기 음성 경로를 확인하세요.",
    };
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${ttsBucket}/${encodeStoragePath(path)}`);

  if (!endpoint) {
    return {
      ok: false as const,
      httpStatus: 503,
      message: "Supabase Storage URL 설정을 확인하세요.",
    };
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    return {
      ok: false as const,
      httpStatus: response.status || 500,
      message: "읽어주기 음성을 불러오지 못했습니다.",
    };
  }

  return {
    ok: true as const,
    body: response.body,
    contentLength: response.headers.get("Content-Length"),
  };
}
