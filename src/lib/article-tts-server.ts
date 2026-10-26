import "server-only";
import {
  getSupabaseRestEndpoint,
  getSupabaseStorageEndpoint,
} from "@/lib/supabase-config";
import {
  buildArticleNarrationText,
  hashNarrationText,
  normalizeArticleTtsVoice,
  requestOpenAiSpeech,
} from "@/lib/article-tts-audio";
import { createTtsDiagnostics } from "@/lib/tts-request-diagnostics";
import {
  inspectArticleMp3,
  readTtsBytes,
  ttsMaxBytes,
} from "@/lib/article-tts-media";
import {
  executeArticleTts,
  type ArticleTtsActor,
  type TtsJobInput,
  type TtsJobState,
} from "@/lib/article-tts-job";
import { cleanupReplacedArticleTts } from "@/lib/article-tts-cleanup";

export class ArticleTtsError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super("기사 음성 상태를 확인하지 못했습니다.");
  }
}
const model = () => process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new ArticleTtsError(503, "server_unavailable");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}
async function db<T>(path: string, body?: unknown): Promise<T> {
  const url = getSupabaseRestEndpoint(`/rest/v1/${path}`);
  if (!url) throw new ArticleTtsError(503, "server_unavailable");
  const r = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!r.ok) {
    const text = await r.text();
    if (r.status === 404 || /PGRST202|42703|42P01/.test(text))
      throw new ArticleTtsError(503, "schema_not_ready");
    throw new ArticleTtsError(
      r.status < 500 ? 409 : 502,
      "request_unconfirmed",
    );
  }
  return (await r.json()) as T;
}
type Article = {
  id: string;
  project_id: string;
  body: string | null;
  article_tts_voice: string | null;
  ai_audio_id: string | null;
  audio_source: string | null;
  tts_request_id: string | null;
  tts_generation_state: TtsJobState | null;
  tts_started_at: string | null;
};
type Audio = {
  id: string;
  project_id: string;
  source_type: string;
  ai_tts_text_hash: string;
  ai_tts_voice: string;
  ai_tts_model: string;
  ai_tts_audio_paths: string[];
  ai_tts_generated_at: string | null;
};
function storageUrl(path: string) {
  if (!/^ai-tts(?:-v2)?\/[a-f0-9/-]+\.mp3$/.test(path))
    throw new ArticleTtsError(409, "audio_path_unconfirmed");
  const url = getSupabaseStorageEndpoint(
    `/object/audio-files/${path.split("/").map(encodeURIComponent).join("/")}`,
  );
  if (!url) throw new ArticleTtsError(503, "server_unavailable");
  return url;
}
async function object(path: string) {
  const response = await fetch(storageUrl(path), {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (
      [400, 404].includes(response.status) &&
      String(error?.statusCode) === "404" &&
      error?.message === "Object not found"
    )
      return null;
    throw new ArticleTtsError(502, "audio_check_unconfirmed");
  }
  return readTtsBytes(response);
}
export async function articleTtsStatus(projectId: string, articleId: string) {
  const [articles, projects, blocks] = await Promise.all([
    db<Article[]>(
      `newsletter_articles?select=id,project_id,body,article_tts_voice,ai_audio_id,audio_source,tts_request_id,tts_generation_state,tts_started_at&id=eq.${articleId}&project_id=eq.${projectId}&limit=1`,
    ),
    db<Array<{ article_tts_voice: string | null }>>(
      `newsletter_projects?select=article_tts_voice&id=eq.${projectId}&deleted_at=is.null&limit=1`,
    ),
    db<Parameters<typeof buildArticleNarrationText>[1]>(
      `newsletter_content_blocks?select=block_type,title,body,sort_order,is_visible&article_id=eq.${articleId}&order=sort_order.asc,id.asc`,
    ),
  ]);
  const a = articles[0];
  if (!a || !projects[0]) throw new ArticleTtsError(404, "article_not_found");
  const text = await buildArticleNarrationText(a, blocks, null),
    voice = normalizeArticleTtsVoice(
      a.article_tts_voice ?? projects[0].article_tts_voice,
    );
  const audio = a.ai_audio_id
    ? (
        await db<Audio[]>(
          `newsletter_audio_files?select=id,project_id,source_type,ai_tts_text_hash,ai_tts_voice,ai_tts_model,ai_tts_audio_paths,ai_tts_generated_at&id=eq.${a.ai_audio_id}&project_id=eq.${projectId}&limit=1`,
        )
      )[0]
    : null;
  let audioState = "missing",
    current = false;
  if (
    audio &&
    Array.isArray(audio.ai_tts_audio_paths) &&
    audio.ai_tts_audio_paths.length > 0 &&
    audio.ai_tts_audio_paths.length <= 64
  ) {
    try {
      audioState = "present";
      for (const path of audio.ai_tts_audio_paths) {
        if (
          !path.startsWith(`ai-tts/${projectId}/${articleId}/`) &&
          !path.startsWith(`ai-tts-v2/${projectId}/${articleId}/`)
        )
          throw Error("scope");
        const bytes = await object(path);
        if (!bytes) {
          audioState = "missing";
          break;
        }
        try {
          inspectArticleMp3(bytes);
        } catch {
          audioState = "invalid";
          break;
        }
      }
    } catch {
      audioState = "unconfirmed";
    }
    current =
      audioState === "present" &&
      a.audio_source === "ai_tts" &&
      audio.source_type === "ai_tts" &&
      !!text &&
      !!audio.ai_tts_generated_at &&
      audio.ai_tts_text_hash === hashNarrationText(text) &&
      audio.ai_tts_voice === voice &&
      audio.ai_tts_model === model();
  }
  const state = a.tts_generation_state ?? "idle";
  return {
    state,
    requestId: a.tts_request_id,
    current,
    audioId: audio?.id ?? null,
    audioState,
    voice,
    startedAt: a.tts_started_at,
    canRetry:
      state !== "processing" ||
      (!!a.tts_started_at &&
        Date.now() - Date.parse(a.tts_started_at) >= 360000),
  };
}
export async function generateSafeArticleTts(
  projectId: string,
  articleId: string,
  actor: ArticleTtsActor,
  input: TtsJobInput,
) {
  const initial = await articleTtsStatus(projectId, articleId);
  if (initial.voice !== input.voice)
    throw new ArticleTtsError(409, "settings_changed");
  if ((input.force || !initial.current) && !process.env.OPENAI_API_KEY?.trim())
    throw new ArticleTtsError(503, "provider_not_configured");
  const identity = {
    p_project_id: projectId,
    p_article_id: articleId,
    p_actor_id: actor.id,
    p_actor_name: actor.name,
    p_actor_role: actor.role,
  };
  return executeArticleTts(
    {
      status: async () => initial,
      claim: (input) =>
        db("rpc/article_tts_claim", {
          ...identity,
          p_request_id: input.requestId,
          p_previous_request_id: input.previousRequestId,
          p_force: input.force,
          p_voice: input.voice,
          p_model: model(),
        }),
      speech: (text, diagnostics, timeoutMs) =>
        requestOpenAiSpeech(text, input.voice, model(), {
          apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
          captureReceipt: true,
          maxBytes: ttsMaxBytes,
          signal: AbortSignal.timeout(timeoutMs),
          diagnostics,
        }),
      put: async (path, bytes) => {
        const r = await fetch(storageUrl(path), {
          method: "POST",
          headers: {
            ...headers(),
            "Content-Type": "audio/mpeg",
            "x-upsert": "false",
          },
          body: Buffer.from(bytes),
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) throw new ArticleTtsError(502, "upload_unconfirmed");
      },
      object,
      complete: (input, snapshot, textHash, segments) =>
        db("rpc/article_tts_complete", {
          ...identity,
          p_request_id: input.requestId,
          p_fingerprint: snapshot.fingerprint,
          p_voice: input.voice,
          p_model: model(),
          p_text_hash: textHash,
          p_segments: segments,
        }),
      finish: (requestId, state) =>
        db("rpc/article_tts_finish", {
          ...identity,
          p_request_id: requestId,
          p_state: state,
        }),
      cleanup: (paths) =>
        cleanupReplacedArticleTts(projectId, articleId, paths, headers()),
      diagnostics: () =>
        createTtsDiagnostics((e) =>
          console.info(
            JSON.stringify({
              event: "article_tts",
              articleId,
              requestId: input.requestId,
              ...e,
            }),
          ),
        ),
    },
    projectId,
    articleId,
    input,
  );
}
