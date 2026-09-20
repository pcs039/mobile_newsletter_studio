import { createHash } from "crypto";
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
const minimumSplitChunkLength = 400;
const maxRawArticleTextLength = 80_000;

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

function hashNarrationText(value: string) {
  return createHash("sha256").update(normalizeNarrationText(value), "utf8").digest("hex");
}

function getAudioPaths(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && isSafeStoragePath(item));
}

export function chunkArticleTtsText(text: string, maxLength = targetChunkLength) {
  const normalized = normalizeNarrationText(text);

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
    )}&order=sort_order.asc`,
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

export async function buildArticleNarrationText(article: ArticleRow, blocks: BlockRow[], audio: AudioRow | null) {
  const script = audio?.script_text?.trim() ?? "";

  if (script) {
    return script;
  }

  const parts = [
    article.display_title?.trim() || article.title.trim(),
    article.summary?.trim() ?? "",
    article.body?.trim() ?? "",
    ...blocks
      .filter((block) => block.is_visible && ["paragraph", "audio"].includes(block.block_type))
      .map((block) => [block.title, block.body].filter(Boolean).join("\n").trim()),
  ].filter(Boolean);

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

async function requestOpenAiSpeech(input: string, voice: ArticleTtsVoice, model: string) {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    return {
      ok: false as const,
      error: "TTS_PROVIDER_NOT_CONFIGURED",
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
      instructions: "한국어 공공기관 모바일 소식지 기사를 차분하고 또렷하며 자연스럽게 읽어주세요. 원문에 없는 내용을 추가하거나 요약하지 마세요.",
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
      error: "TTS_GENERATION_FAILED",
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

async function generateAudioForChunk(input: string, voice: ArticleTtsVoice, model: string, chunkLength: number) {
  const firstAttempt = await requestOpenAiSpeech(input, voice, model);
  const shouldSplit =
    !firstAttempt.ok &&
    "isInputTooLong" in firstAttempt &&
    firstAttempt.isInputTooLong &&
    chunkLength > minimumSplitChunkLength;

  if (firstAttempt.ok || !shouldSplit) {
    return firstAttempt;
  }

  const smallerChunks = chunkArticleTtsText(input, Math.max(minimumSplitChunkLength, Math.floor(chunkLength / 2)));
  const buffers: ArrayBuffer[] = [];

  for (const chunk of smallerChunks) {
    const retry = await requestOpenAiSpeech(chunk, voice, model);

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

async function uploadAudioSegment(path: string, audio: ArrayBuffer, headers: Record<string, string>) {
  const endpoint = getSupabaseStorageEndpoint(`/object/${audioBucket}/${encodeStoragePath(path)}`);

  if (!endpoint) {
    return false;
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

  return response.ok;
}

async function deleteAudioSegments(paths: string[], headers: Record<string, string>) {
  const safePaths = paths.filter(isSafeStoragePath);

  if (safePaths.length === 0) {
    return;
  }

  const endpoint = getSupabaseStorageEndpoint(`/object/${encodeURIComponent(audioBucket)}`);

  if (!endpoint) {
    return;
  }

  await fetch(endpoint, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: safePaths }),
    cache: "no-store",
  }).catch(() => undefined);
}

async function upsertArticleAiAudioRow(
  projectId: string,
  article: ArticleRow,
  title: string,
  metadata: {
    model: string;
    paths: string[];
    textHash: string;
    voice: ArticleTtsVoice;
  },
  headers: Record<string, string>,
) {
  const existingAudioId = article.ai_audio_id;
  const endpoint = existingAudioId
    ? getSupabaseRestEndpoint(
        `/rest/v1/newsletter_audio_files?id=eq.${encodeURIComponent(existingAudioId)}&project_id=eq.${encodeURIComponent(projectId)}&select=id`,
      )
    : getSupabaseRestEndpoint("/rest/v1/newsletter_audio_files?select=id");

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: existingAudioId ? "PATCH" : "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ai_tts_audio_paths: metadata.paths,
      ai_tts_generated_at: new Date().toISOString(),
      ai_tts_model: metadata.model,
      ai_tts_text_hash: metadata.textHash,
      ai_tts_voice: metadata.voice,
      article_id: null,
      file_path: metadata.paths[0] ?? "",
      project_id: projectId,
      script_status: "approved",
      source_type: "ai_tts",
      title,
      transcript_type: "custom_script",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}

async function updateArticleAiAudioReference(projectId: string, articleId: string, audioId: string, voice: ArticleTtsVoice, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_articles?id=eq.${encodeURIComponent(articleId)}&project_id=eq.${encodeURIComponent(projectId)}`,
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
      ai_audio_id: audioId,
      article_tts_voice: voice,
      audio_source: "ai_tts",
    }),
    cache: "no-store",
  });

  return response.ok;
}

export async function generateArticleTtsAudio(projectSlug: string, articleId: string, voiceInput: string | null, force = false) {
  const headers = getServiceHeaders();
  const model = getTtsModel();

  if (!headers) {
    return { ok: false as const, error: "TTS_GENERATION_FAILED", message: "Supabase 설정을 확인하세요.", httpStatus: 503 };
  }

  if (!getOpenAiApiKey()) {
    return { ok: false as const, error: "TTS_PROVIDER_NOT_CONFIGURED", message: "AI 음성 생성 API가 설정되지 않았습니다.", httpStatus: 503 };
  }

  const voice = normalizeArticleTtsVoice(voiceInput);
  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return { ok: false as const, error: "TTS_ARTICLE_NOT_FOUND", message: "프로젝트를 찾지 못했습니다.", httpStatus: 404 };
  }

  const article = await findArticle(project.id, articleId, headers);

  if (!article) {
    return { ok: false as const, error: "TTS_ARTICLE_NOT_FOUND", message: "기사를 찾지 못했습니다.", httpStatus: 404 };
  }

  const source = normalizeArticleAudioSource(article.audio_source, Boolean(article.audio_id));

  if (source !== "ai_tts") {
    return { ok: false as const, error: "TTS_FORBIDDEN", message: "AI 음성 자동 생성으로 선택된 기사만 생성할 수 있습니다.", httpStatus: 400 };
  }

  const [blocks, currentAiAudio] = await Promise.all([
    fetchArticleBlocks(article.id, headers),
    findAudioById(article.ai_audio_id, project.id, headers),
  ]);
  const narrationText = await buildArticleNarrationText(article, blocks, currentAiAudio);

  if (!narrationText) {
    return { ok: false as const, error: "TTS_TEXT_EMPTY", message: "낭독할 기사 텍스트가 없습니다.", httpStatus: 400 };
  }

  if (narrationText.length > maxRawArticleTextLength) {
    return { ok: false as const, error: "TTS_GENERATION_FAILED", message: "낭독 원문이 너무 깁니다.", httpStatus: 400 };
  }

  const textHash = hashNarrationText(narrationText);
  const oldPaths = getAudioPaths(currentAiAudio?.ai_tts_audio_paths);

  if (
    !force &&
    oldPaths.length > 0 &&
    currentAiAudio?.ai_tts_text_hash === textHash &&
    currentAiAudio.ai_tts_voice === voice &&
    currentAiAudio.ai_tts_model === model
  ) {
    return {
      ok: true as const,
      audioId: currentAiAudio.id,
      message: "이미 최신 AI 음성이 생성되어 있습니다.",
      segments: oldPaths.length,
      skipped: true,
    };
  }

  const chunks = chunkArticleTtsText(narrationText);
  const generatedSegments: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const generated = await generateAudioForChunk(chunk, voice, model, targetChunkLength);

    if (!generated.ok) {
      return {
        ok: false as const,
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
    const path = `ai-tts/${project.id}/${article.id}/${textHash}/${String(index).padStart(3, "0")}.mp3`;
    const uploaded = await uploadAudioSegment(path, audio, headers);

    if (!uploaded) {
      await deleteAudioSegments(newPaths, headers);

      return { ok: false as const, error: "TTS_UPLOAD_FAILED", message: "AI 음성 파일을 업로드하지 못했습니다.", httpStatus: 500 };
    }

    newPaths.push(path);
  }

  const audioTitle = `${article.display_title || article.title} AI 음성`;
  const audioId = await upsertArticleAiAudioRow(project.id, article, audioTitle, { model, paths: newPaths, textHash, voice }, headers);

  if (!audioId) {
    await deleteAudioSegments(newPaths, headers);

    return { ok: false as const, error: "TTS_METADATA_UPDATE_FAILED", message: "AI 음성 메타데이터를 저장하지 못했습니다.", httpStatus: 500 };
  }

  const articleUpdated = await updateArticleAiAudioReference(project.id, article.id, audioId, voice, headers);

  if (!articleUpdated) {
    await deleteAudioSegments(newPaths, headers);

    return { ok: false as const, error: "TTS_METADATA_UPDATE_FAILED", message: "기사의 AI 음성 연결 정보를 저장하지 못했습니다.", httpStatus: 500 };
  }

  await deleteAudioSegments(oldPaths.filter((path) => !newPaths.includes(path)), headers);

  return {
    ok: true as const,
    audioId,
    message: "AI 음성을 생성했습니다.",
    segments: newPaths.length,
  };
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
      articleTitle: article.display_title || article.title,
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

export async function getPublicArticleAudioManifest(slug: string, articleId: string) {
  const headers = getServiceHeaders();

  if (!headers) {
    return { ok: false as const, httpStatus: 503, message: "음성을 사용할 수 없습니다." };
  }

  const project = await findProjectBySlug(slug, headers, true);

  if (!project) {
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

export async function downloadPublicArticleAudioSegment(slug: string, articleId: string, segmentIndex: number) {
  const headers = getServiceHeaders();

  if (!headers) {
    return { ok: false as const, httpStatus: 503, message: "음성을 사용할 수 없습니다." };
  }

  const project = await findProjectBySlug(slug, headers, true);

  if (!project) {
    return { ok: false as const, httpStatus: 404, message: "공개된 소식지를 찾지 못했습니다." };
  }

  const article = await findArticle(project.id, articleId, headers);

  if (!article) {
    return { ok: false as const, httpStatus: 404, message: "기사를 찾지 못했습니다." };
  }

  const manifestResult = await getPublicArticleAudioManifest(slug, articleId);

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
