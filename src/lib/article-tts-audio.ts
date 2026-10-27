import { createHash, randomUUID } from "crypto";
import { SpeechRequestError, speechFailure, type TtsDiagnostics } from "@/lib/tts-request-diagnostics";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const articleTtsVoices = ["marin", "cedar", "onyx", "coral"] as const;
export type ArticleTtsVoice = (typeof articleTtsVoices)[number];
export type ArticleAudioSource = "uploaded" | "ai_tts" | "none";

export type ArticleTtsStatusState = "current" | "needs_generation" | "stale" | "empty_text" | "not_ai";

export type ArticleTtsStatusItem = {
  articleId: string;
  articleTitle: string;
  state: ArticleTtsStatusState;
  voice: ArticleTtsVoice;
};

export type ArticleTtsProjectStatus = {
  completed: number;
  emptyText: number;
  items: ArticleTtsStatusItem[];
  needsGeneration: number;
  stale: number;
  totalAiArticles: number;
};

type ProjectRow = {
  article_tts_voice: string | null;
  id: string;
  slug: string;
  status?: string;
};

type ArticleRow = {
  ai_audio_id: string | null;
  article_tts_voice: string | null;
  audio_id: string | null;
  audio_source: string | null;
  body: string | null;
  display_title: string | null;
  id: string;
  project_id: string;
  summary: string | null;
  title: string;
};

type AudioRow = {
  ai_tts_audio_paths: unknown;
  ai_tts_generated_at: string | null;
  ai_tts_model: string | null;
  ai_tts_text_hash: string | null;
  ai_tts_voice: string | null;
  file_path: string;
  id: string;
  script_text: string | null;
  source_type: string | null;
  title: string;
  transcript_type: string | null;
};

type BlockRow = {
  block_type: string;
  body: string | null;
  is_visible: boolean;
  sort_order: number;
  title: string | null;
};

const audioBucket = "audio-files";
const defaultTtsModel = "gpt-4o-mini-tts";
const defaultVoice: ArticleTtsVoice = "marin";
const targetChunkLength = 1200;
export const ARTICLE_TTS_NORMALIZATION_VERSION = "ko-v1";

export function normalizeArticleAudioSource(value: string | null | undefined, hasUploadedAudio: boolean): ArticleAudioSource {
  if (value === "uploaded" || value === "ai_tts" || value === "none") {
    return value;
  }

  return hasUploadedAudio ? "uploaded" : "none";
}

export function normalizeArticleTtsVoice(value: string | null | undefined): ArticleTtsVoice {
  return articleTtsVoices.includes(value as ArticleTtsVoice) ? (value as ArticleTtsVoice) : defaultVoice;
}

export function getArticleTtsVoiceLabel(voice: ArticleTtsVoice) {
  const labels: Record<ArticleTtsVoice, string> = {
    marin: "Marin",
    cedar: "Cedar",
    onyx: "Onyx",
    coral: "Coral",
  };

  return labels[voice];
}

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

function getTtsModel() {
  return process.env.OPENAI_TTS_MODEL?.trim() || defaultTtsModel;
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

function normalizeNarrationText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const koreanWeekdayLabels: Record<string, string> = {
  금: "금요일",
  목: "목요일",
  수: "수요일",
  월: "월요일",
  일: "일요일",
  토: "토요일",
  화: "화요일",
};

function parseDatePart(value: string) {
  return Number.parseInt(value, 10);
}

function isValidYear(value: number) {
  return Number.isInteger(value) && value >= 1900 && value <= 2199;
}

function isValidMonth(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function isValidDay(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

function isValidFullDate(year: number, month: number, day: number) {
  if (!isValidYear(year) || !isValidMonth(month) || !isValidDay(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatYearMonthDay(year: number, month: number, day: number) {
  return `${year}년 ${month}월 ${day}일`;
}

function formatYearMonth(year: number, month: number) {
  return `${year}년 ${month}월`;
}

function formatMonthDay(month: number, day: number) {
  return `${month}월 ${day}일`;
}

function isLikelyCompactMonthDay(month: number, day: number) {
  return month >= 4 && day >= 13;
}

export function normalizeKoreanTtsText(text: string) {
  let value = normalizeNarrationText(text);

  value = value.replace(
    /(^|[^\d./-])((?:19|20|21)\d{2})\s*([./-])\s*(\d{1,2})\s*\3\s*(\d{1,2})\s*\.?\s*\(([월화수목금토일])\)/g,
    (match, prefix: string, yearValue: string, _separator: string, monthValue: string, dayValue: string, weekdayValue: string) => {
      const year = parseDatePart(yearValue);
      const month = parseDatePart(monthValue);
      const day = parseDatePart(dayValue);

      if (!isValidFullDate(year, month, day)) {
        return match;
      }

      return `${prefix}${formatYearMonthDay(year, month, day)} ${koreanWeekdayLabels[weekdayValue]}`;
    },
  );

  value = value.replace(
    /(^|[^\d./-])((?:19|20|21)\d{2})\s*([./-])\s*(\d{1,2})\s*\3\s*(\d{1,2})\.?(?=$|[^\d./-])/g,
    (match, prefix: string, yearValue: string, _separator: string, monthValue: string, dayValue: string) => {
      const year = parseDatePart(yearValue);
      const month = parseDatePart(monthValue);
      const day = parseDatePart(dayValue);

      if (!isValidFullDate(year, month, day)) {
        return match;
      }

      return `${prefix}${formatYearMonthDay(year, month, day)}`;
    },
  );

  value = value.replace(
    /(^|[^\d./-])((?:19|20|21)\d{2})\s*([./-])\s*(\d{1,2})\.?(?=$|[^\d./-])/g,
    (match, prefix: string, yearValue: string, _separator: string, monthValue: string) => {
      const year = parseDatePart(yearValue);
      const month = parseDatePart(monthValue);

      if (!isValidYear(year) || !isValidMonth(month)) {
        return match;
      }

      return `${prefix}${formatYearMonth(year, month)}`;
    },
  );

  value = value.replace(
    /(^|[^\d./-])(\d{1,2})(\s*)([./])(\s*)(\d{1,2})(\.?)(?=$|[^\d%배조점./-])/g,
    (
      match,
      prefix: string,
      monthValue: string,
      spacingBeforeSeparator: string,
      separator: string,
      spacingAfterSeparator: string,
      dayValue: string,
      trailingDot: string,
    ) => {
      const month = parseDatePart(monthValue);
      const day = parseDatePart(dayValue);

      if (!isValidMonth(month) || !isValidDay(day)) {
        return match;
      }

      const hasDateFormattingHint =
        separator === "/" ||
        Boolean(spacingBeforeSeparator || spacingAfterSeparator || trailingDot) ||
        isLikelyCompactMonthDay(month, day);

      if (!hasDateFormattingHint) {
        return match;
      }

      return `${prefix}${formatMonthDay(month, day)}`;
    },
  );

  return normalizeNarrationText(value);
}

export function hashNarrationText(value: string) {
  return createHash("sha256")
    .update(`${ARTICLE_TTS_NORMALIZATION_VERSION}\n${normalizeKoreanTtsText(value)}`, "utf8")
    .digest("hex");
}

function getAudioPaths(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && isSafeStoragePath(item));
}

export function chunkArticleTtsText(text: string, maxLength = targetChunkLength) {
  const normalized = normalizeKoreanTtsText(text);

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

async function findProjectBySlug(projectSlug: string, headers: Record<string, string>, publishedOnly = false) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,slug,status,article_tts_voice&slug=eq.${encodeURIComponent(
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

  const rows = (await response.json().catch(() => [])) as ProjectRow[];
  const project = rows[0] ?? null;

  if (publishedOnly && project?.status !== "published") {
    return null;
  }

  return project;
}

async function findArticle(projectId: string, articleId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_articles?select=id,project_id,title,display_title,summary,body,audio_id,audio_source,article_tts_voice,ai_audio_id&project_id=eq.${encodeURIComponent(
      projectId,
    )}&id=eq.${encodeURIComponent(articleId)}&limit=1`,
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

  const rows = (await response.json().catch(() => [])) as ArticleRow[];

  return rows[0] ?? null;
}

async function fetchArticleBlocks(articleId: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_content_blocks?select=block_type,title,body,sort_order,is_visible&article_id=eq.${encodeURIComponent(
      articleId,
    )}&order=sort_order.asc,id.asc`,
  );

  if (!endpoint) {
    return [];
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json().catch(() => [])) as BlockRow[];
}

async function findAudioById(audioId: string | null, projectId: string, headers: Record<string, string>) {
  if (!audioId) {
    return null;
  }

  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_audio_files?select=id,title,file_path,source_type,script_text,transcript_type,ai_tts_audio_paths,ai_tts_text_hash,ai_tts_voice,ai_tts_model,ai_tts_generated_at&project_id=eq.${encodeURIComponent(
      projectId,
    )}&id=eq.${encodeURIComponent(audioId)}&limit=1`,
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

  const rows = (await response.json().catch(() => [])) as AudioRow[];

  return rows[0] ?? null;
}

export async function buildArticleNarrationText(article: Pick<ArticleRow, "body">, blocks: BlockRow[], _audio: AudioRow | null) {
  void _audio;

  const paragraphParts = blocks
    .filter((block) => block.is_visible && block.block_type === "paragraph")
    .map((block) => block.body?.trim() ?? "")
    .filter(Boolean);
  const parts = paragraphParts.length > 0 ? paragraphParts : [article.body?.trim() ?? ""].filter(Boolean);

  return normalizeNarrationText(parts.join("\n\n"));
}

function getArticleTtsState(article: ArticleRow, audio: AudioRow | null, narrationText: string, voice: ArticleTtsVoice, model: string) {
  const source = normalizeArticleAudioSource(article.audio_source, Boolean(article.audio_id));

  if (source !== "ai_tts") {
    return "not_ai" as const;
  }

  if (!narrationText) {
    return "empty_text" as const;
  }

  const hash = hashNarrationText(narrationText);
  const paths = getAudioPaths(audio?.ai_tts_audio_paths);

  if (!audio || paths.length === 0 || !audio.ai_tts_text_hash) {
    return "needs_generation" as const;
  }

  if (audio.ai_tts_text_hash !== hash || audio.ai_tts_voice !== voice || audio.ai_tts_model !== model) {
    return "stale" as const;
  }

  return "current" as const;
}

function isInputLengthError(status: number, body: string) {
  const value = body.toLowerCase();

  return status === 400 && (value.includes("maximum") || value.includes("too long") || value.includes("length"));
}

export async function requestOpenAiSpeech(
  input: string,
  voice: ArticleTtsVoice,
  model: string,
  credentials?: { apiKey: string | null; captureReceipt?: boolean; signal?: AbortSignal; maxBytes?: number; diagnostics?: TtsDiagnostics; narration?: { speed: 1; instructions: string } },
): Promise<
  | { ok: false; error: string; message: string; httpStatus: number; detail?: string; isInputTooLong?: boolean; providerRequestId?: string | null }
  | { ok: true; data: ArrayBuffer; httpStatus?: number; providerRequestId?: string | null }
> {
  // Existing callers keep the general key. Explicit credentials fail closed,
  // including a missing/blank key, and never fall back to the general key.
  const apiKey = credentials === undefined ? getOpenAiApiKey() : credentials.apiKey?.trim() ?? "";

  if (!apiKey) {
    return {
      ok: false as const,
      error: "TTS_PROVIDER_NOT_CONFIGURED",
      message: "AI 음성 생성 API가 설정되지 않았습니다.",
      httpStatus: 503,
    };
  }

  const diagnostics = credentials?.diagnostics;
  let phase: "headers" | "body" = "headers";
  diagnostics?.start("request");
  diagnostics?.start("headers");
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Client-Request-Id": diagnostics?.clientRequestId ?? randomUUID(),
      },
      body: JSON.stringify({
        input,
        instructions: credentials?.narration?.instructions ?? "한국어 공공기관 모바일 소식지 기사 본문을 차분하고 또렷하며 자연스럽게 읽어주세요. 원문에 없는 내용을 추가하거나 요약하지 마세요.",
        ...(credentials?.narration ? { speed: credentials.narration.speed } : {}),
        model,
        response_format: "mp3",
        voice,
      }),
      cache: "no-store",
      ...(credentials?.signal ? { signal: credentials.signal } : {}),
      ...(credentials?.captureReceipt ? { redirect: "error" as const } : {}),
    });

    const rawRequestId = credentials?.captureReceipt || diagnostics ? response.headers.get("x-request-id") : null;
    const providerRequestId = rawRequestId && !rawRequestId.includes(apiKey) && /^[A-Za-z0-9_-]{1,200}$/.test(rawRequestId) ? rawRequestId : null;
    diagnostics?.setReceipt(response.status, providerRequestId);
    diagnostics?.complete("headers");
    phase = "body";
    diagnostics?.start("body");
    const receipt = credentials?.captureReceipt ? {
      httpStatus: response.status,
      providerRequestId,
    } : {};

    if (!response.ok) {
      const responseText = diagnostics ? await response.text() : await response.text().catch(() => "");
      diagnostics?.complete("body");
      diagnostics?.fail("request", "provider_http");

      return {
        ok: false as const,
        error: "TTS_GENERATION_FAILED",
        httpStatus: response.status,
        isInputTooLong: isInputLengthError(response.status, responseText),
        message: "AI 음성 생성에 실패했습니다.",
        // A scoped caller must not receive a provider error that echoes its key.
        detail: credentials === undefined ? responseText.slice(0, 300) : undefined,
        ...receipt,
      };
    }

    let data: ArrayBuffer;
    if (credentials?.maxBytes !== undefined) {
      const limit=credentials.maxBytes;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8*1024*1024 || !response.body) {
        if (diagnostics) throw new SpeechRequestError("invalid_response", phase, diagnostics);
        throw Error("Speech response limit");
      }
      const reader=response.body.getReader(), chunks: Uint8Array[]=[]; let size=0;
      try {
        while (true) {
          const {done,value}=await reader.read(); if (done) break;
          size+=value.byteLength;
          if (size>limit) {
            if (diagnostics) throw new SpeechRequestError("size_limit", phase, diagnostics);
            throw Error("Speech response too large");
          }
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
      const all=new Uint8Array(size); let offset=0;
      for (const chunk of chunks) { all.set(chunk,offset); offset+=chunk.length; }
      data=all.buffer;
    } else { data=await response.arrayBuffer(); }
    diagnostics?.complete("body");
    diagnostics?.complete("request");
    return {
      ok: true as const,
      data,
      ...receipt,
    };
  } catch (error) {
    // Legacy callers retain their error contract. Scoped diagnostics never serialize raw exceptions.
    if (!diagnostics) throw error;
    const failure = speechFailure(error, phase, credentials?.signal);
    diagnostics.fail(phase, failure);
    diagnostics.fail("request", failure);
    throw new SpeechRequestError(failure, phase, diagnostics);
  }
}


export async function getArticleTtsProjectStatus(projectSlug: string): Promise<ArticleTtsProjectStatus> {
  const headers = getServiceHeaders();

  if (!headers) {
    return { completed: 0, emptyText: 0, items: [], needsGeneration: 0, stale: 0, totalAiArticles: 0 };
  }

  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return { completed: 0, emptyText: 0, items: [], needsGeneration: 0, stale: 0, totalAiArticles: 0 };
  }

  const articlesEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_articles?select=id,project_id,title,display_title,summary,body,audio_id,audio_source,article_tts_voice,ai_audio_id&project_id=eq.${encodeURIComponent(
      project.id,
    )}&order=sort_order.asc`,
  );

  if (!articlesEndpoint) {
    return { completed: 0, emptyText: 0, items: [], needsGeneration: 0, stale: 0, totalAiArticles: 0 };
  }

  const response = await fetch(articlesEndpoint, { headers, cache: "no-store" });

  if (!response.ok) {
    return { completed: 0, emptyText: 0, items: [], needsGeneration: 0, stale: 0, totalAiArticles: 0 };
  }

  const articles = (await response.json().catch(() => [])) as ArticleRow[];
  const aiArticles = articles.filter((article) => normalizeArticleAudioSource(article.audio_source, Boolean(article.audio_id)) === "ai_tts");
  const items: ArticleTtsStatusItem[] = [];
  const model = getTtsModel();

  for (const article of aiArticles) {
    const [blocks, audio] = await Promise.all([
      fetchArticleBlocks(article.id, headers),
      findAudioById(article.ai_audio_id, project.id, headers),
    ]);
    const voice = normalizeArticleTtsVoice(article.article_tts_voice ?? project.article_tts_voice);
    const narrationText = await buildArticleNarrationText(article, blocks, audio);
    const state = getArticleTtsState(article, audio, narrationText, voice, model);

    items.push({
      articleId: article.id,
      articleTitle: article.title,
      state,
      voice,
    });
  }

  return {
    completed: items.filter((item) => item.state === "current").length,
    emptyText: items.filter((item) => item.state === "empty_text").length,
    items,
    needsGeneration: items.filter((item) => item.state === "needs_generation").length,
    stale: items.filter((item) => item.state === "stale").length,
    totalAiArticles: items.length,
  };
}

export async function getPublicArticleAudioManifest(slug: string, articleId: string, reviewProjectId?: string) {
  const headers = getServiceHeaders();

  if (!headers) {
    return { ok: false as const, httpStatus: 503, message: "음성을 사용할 수 없습니다." };
  }

  const project = await findProjectBySlug(slug, headers, !reviewProjectId);

  if (!project || (reviewProjectId && project.id !== reviewProjectId)) {
    return { ok: false as const, httpStatus: 404, message: "공개된 소식지를 찾지 못했습니다." };
  }

  const article = await findArticle(project.id, articleId, headers);

  if (!article) {
    return { ok: false as const, httpStatus: 404, message: "기사를 찾지 못했습니다." };
  }

  const source = normalizeArticleAudioSource(article.audio_source, Boolean(article.audio_id));

  if (source !== "ai_tts") {
    return { ok: true as const, manifest: { hasAudio: false, segments: [], source, stale: false, voice: null } };
  }

  const [blocks, audio] = await Promise.all([
    fetchArticleBlocks(article.id, headers),
    findAudioById(article.ai_audio_id, project.id, headers),
  ]);
  const voice = normalizeArticleTtsVoice(article.article_tts_voice ?? project.article_tts_voice);
  const narrationText = await buildArticleNarrationText(article, blocks, audio);
  const hash = narrationText ? hashNarrationText(narrationText) : "";
  const paths = getAudioPaths(audio?.ai_tts_audio_paths);
  const stale = Boolean(narrationText && paths.length > 0 && audio?.ai_tts_text_hash && audio.ai_tts_text_hash !== hash);
  const hasAudio = Boolean(narrationText && !stale && audio?.ai_tts_text_hash === hash && audio.ai_tts_voice === voice && paths.length > 0);

  return {
    ok: true as const,
    manifest: {
      hasAudio,
      segments: hasAudio
        ? paths.map((_path, index) => ({
            index,
            url: `/api/public/newsletters/${encodeURIComponent(slug)}/articles/${encodeURIComponent(article.id)}/audio/${index}`,
          }))
        : [],
      source: "ai_tts",
      stale,
      voice,
    },
  };
}

export async function downloadPublicArticleAudioSegment(slug: string, articleId: string, segmentIndex: number, reviewProjectId?: string) {
  const headers = getServiceHeaders();

  if (!headers) {
    return { ok: false as const, httpStatus: 503, message: "음성을 사용할 수 없습니다." };
  }

  const project = await findProjectBySlug(slug, headers, !reviewProjectId);

  if (!project || (reviewProjectId && project.id !== reviewProjectId)) {
    return { ok: false as const, httpStatus: 404, message: "공개된 소식지를 찾지 못했습니다." };
  }

  const article = await findArticle(project.id, articleId, headers);

  if (!article) {
    return { ok: false as const, httpStatus: 404, message: "기사를 찾지 못했습니다." };
  }

  const manifestResult = await getPublicArticleAudioManifest(slug, articleId, reviewProjectId);

  if (!manifestResult.ok || !manifestResult.manifest.hasAudio) {
    return { ok: false as const, httpStatus: 404, message: "음성을 찾지 못했습니다." };
  }

  const audio = await findAudioById(article.ai_audio_id, project.id, headers);
  const paths = getAudioPaths(audio?.ai_tts_audio_paths);

  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= paths.length) {
    return { ok: false as const, httpStatus: 404, message: "음성을 찾지 못했습니다." };
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${audioBucket}/${encodeStoragePath(paths[segmentIndex])}`);

  if (!endpoint) {
    return { ok: false as const, httpStatus: 503, message: "Storage 설정을 확인하세요." };
  }

  const response = await fetch(endpoint, { headers, cache: "no-store" });

  if (!response.ok || !response.body) {
    return { ok: false as const, httpStatus: response.status || 500, message: "음성을 불러오지 못했습니다." };
  }

  return {
    ok: true as const,
    body: response.body,
    contentLength: response.headers.get("Content-Length"),
  };
}
