import {
  buildArticleNarrationText,
  chunkArticleTtsText,
  hashNarrationText,
  type ArticleTtsVoice,
} from "@/lib/article-tts-audio";
import { inspectArticleMp3, ttsHash } from "@/lib/article-tts-media";
import {
  SpeechRequestError,
  traceTtsStep,
  type TtsDiagnostics,
} from "@/lib/tts-request-diagnostics";

export type ArticleTtsActor = { id: string; name: string; role: string };
export type TtsJobInput = {
  requestId: string;
  previousRequestId: string | null;
  force: boolean;
  voice: ArticleTtsVoice;
};
export type TtsJobState =
  "idle" | "processing" | "ready" | "failed" | "unknown";
export type TtsSnapshot = {
  article: Parameters<typeof buildArticleNarrationText>[0] & {
    id: string;
    project_id: string;
  };
  blocks: Parameters<typeof buildArticleNarrationText>[1];
  fingerprint: string;
  requestId: string;
};
export type TtsJobResult = {
  ok: boolean;
  state: TtsJobState;
  requestId: string | null;
  code: string;
  audioId?: string;
  segments?: number;
  reused?: boolean;
  httpStatus?: number;
};
export type TtsJobDependencies = {
  status(): Promise<{
    state: TtsJobState;
    requestId: string | null;
    current: boolean;
    audioId: string | null;
    audioState: string;
  }>;
  claim(input: TtsJobInput): Promise<
    {
      won: boolean;
      state: TtsJobState;
      requestId: string;
    } & Partial<TtsSnapshot>
  >;
  speech(
    text: string,
    diagnostics: TtsDiagnostics,
    timeoutMs: number,
  ): Promise<{ ok: boolean; data?: ArrayBuffer; httpStatus?: number }>;
  put(path: string, bytes: Uint8Array): Promise<void>;
  object(path: string): Promise<Uint8Array | null>;
  complete(
    input: TtsJobInput,
    snapshot: TtsSnapshot,
    textHash: string,
    segments: Array<{
      path: string;
      hash: string;
      size: number;
      duration: number;
    }>,
  ): Promise<{
    ok: boolean;
    state: TtsJobState;
    code?: string;
    audioId?: string;
    segments?: number;
    cleanupPaths?: string[];
  }>;
  cleanup?(paths: string[]): Promise<unknown>;
  finish(requestId: string, state: "failed" | "unknown"): Promise<unknown>;
  diagnostics(): TtsDiagnostics;
  now?(): number;
};
export async function executeArticleTts(
  d: TtsJobDependencies,
  projectId: string,
  articleId: string,
  input: TtsJobInput,
): Promise<TtsJobResult> {
  const now = d.now ?? Date.now,
    deadline = now() + 240000;
  let claimed = false,
    finalizing = false;
  let terminal: "failed" | "unknown" = "unknown";
  const result = (
    state: TtsJobState,
    code: string,
    extra: Partial<TtsJobResult> = {},
  ): TtsJobResult => ({
    ok: state === "ready",
    state,
    requestId: input.requestId,
    code,
    ...extra,
  });
  try {
    const prior = await d.status();
    // Same-key status lookup is read-only: never acquire dispatch ownership after a lost response.
    if (prior.requestId === input.requestId)
      return result(
        prior.state === "ready" && !prior.current ? "unknown" : prior.state,
        "existing_request",
        { audioId: prior.audioId ?? undefined },
      );
    if (prior.requestId !== input.previousRequestId)
      return result("unknown", "request_changed", { httpStatus: 409 });
    if (!input.force && prior.current && prior.audioId)
      return result("ready", "reused", {
        audioId: prior.audioId,
        reused: true,
      });
    if (!input.force && prior.audioId && prior.audioState === "present")
      return result("failed", "explicit_regeneration_required", {
        httpStatus: 409,
      });
    if (prior.audioState === "unconfirmed")
      return result("unknown", "audio_check_unconfirmed", { httpStatus: 503 });
    const claim = await traceTtsStep(
      d.diagnostics(),
      "db_claim",
      "database",
      () => d.claim(input),
    );
    // A competing completion may have committed after our status read. Verify it via GET;
    // a claim receipt alone does not establish that the current file is playable.
    if (!claim.won)
      return {
        ...result(
          claim.state === "ready" ? "unknown" : claim.state,
          "existing_request",
        ),
        requestId: claim.requestId,
      };
    claimed = true;
    if (
      claim.requestId !== input.requestId ||
      claim.article?.id !== articleId ||
      claim.article?.project_id !== projectId ||
      !Array.isArray(claim.blocks) ||
      !claim.fingerprint ||
      !/^[a-f0-9]{64}$/.test(claim.fingerprint)
    )
      throw Error("claim_response_incomplete");
    const snapshot = claim as TtsSnapshot;
    const text = await buildArticleNarrationText(
      snapshot.article,
      snapshot.blocks,
      null,
    );
    const chunks = chunkArticleTtsText(text);
    if (!text || text.length > 80000 || chunks.length > 64) {
      terminal = "failed";
      throw Error("invalid_narration");
    }
    const textHash = hashNarrationText(text),
      segments: Array<{
        path: string;
        hash: string;
        size: number;
        duration: number;
      }> = [];
    for (const [i, chunk] of chunks.entries()) {
      if (now() >= deadline) throw Error("request_budget_exceeded");
      const diagnostics = d.diagnostics();
      const speech = await d.speech(
        chunk,
        diagnostics,
        Math.min(90000, deadline - now()),
      );
      if (!speech.ok || !speech.data) {
        terminal =
          speech.httpStatus &&
          speech.httpStatus >= 400 &&
          speech.httpStatus < 500
            ? "failed"
            : "unknown";
        throw Error("provider_failed");
      }
      const bytes = new Uint8Array(speech.data);
      const proof = await traceTtsStep(
        diagnostics,
        "validation",
        "invalid_mp3",
        () => inspectArticleMp3(bytes),
      );
      const path = `ai-tts-v2/${projectId}/${articleId}/${input.requestId}/${String(i).padStart(3, "0")}.mp3`;
      try {
        await traceTtsStep(diagnostics, "storage", "storage", () =>
          d.put(path, bytes),
        );
      } catch {
        /* A lost upload response is only resolved by reading the exact new path. No retry. */
      }
      await traceTtsStep(
        diagnostics,
        "storage_verification",
        "unconfirmed",
        async () => {
          const saved = await d.object(path);
          if (!saved || ttsHash(saved) !== proof.hash)
            throw Error("saved_audio_unconfirmed");
          inspectArticleMp3(saved);
        },
      );
      segments.push({ path, ...proof });
    }
    finalizing = true;
    const completed = await traceTtsStep(
      d.diagnostics(),
      "db_complete",
      "database",
      () => d.complete(input, snapshot, textHash, segments),
    );
    if (
      completed.state === "ready" &&
      (!completed.ok || completed.audioId !== input.requestId)
    )
      return result("unknown", "completion_unconfirmed");
    if (
      completed.ok &&
      completed.state === "ready" &&
      Array.isArray(completed.cleanupPaths)
    ) {
      await d.cleanup?.(completed.cleanupPaths).catch(() => {});
    }
    return result(completed.state, completed.code ?? "completed", {
      audioId: completed.audioId,
      segments: completed.segments,
    });
  } catch (error) {
    // A complete RPC response may be lost AFTER the link committed. Do not reset or delete anything.
    if (claimed && !finalizing)
      await d.finish(input.requestId, terminal).catch(() => {});
    if (error instanceof SpeechRequestError) terminal = "unknown";
    return result(
      finalizing ? "unknown" : terminal,
      "check_result_before_retry",
      { httpStatus: 502 },
    );
  }
}
