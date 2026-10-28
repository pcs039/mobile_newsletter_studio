import { randomUUID } from "node:crypto";

export type TtsPhase =
  | "request"
  | "headers"
  | "body"
  | "db_claim"
  | "db_record"
  | "validation"
  | "storage"
  | "storage_verification"
  | "db_complete";
export type TtsFailure =
  | "timeout"
  | "aborted"
  | "network"
  | "body_read"
  | "size_limit"
  | "invalid_response"
  | "provider_http"
  | "invalid_mp3"
  | "storage"
  | "database"
  | "unconfirmed";
export type TtsDiagnosticEvent = {
  version: 1;
  clientRequestId: string;
  phase: TtsPhase;
  state: "started" | "completed" | "failed";
  elapsedMs: number;
  durationMs: number;
  httpStatus: number | null;
  providerRequestId: string | null;
  inputCharacters?: number;
  receivedBytes?: number;
  receivedChunks?: number;
  lastByteElapsedMs?: number | null;
  failure?: TtsFailure;
};

// Only allowlisted scalars leave this module: no errors, headers, input text or audio bytes.
export function createTtsDiagnostics(
  sink: (event: TtsDiagnosticEvent) => void,
  now = () => performance.now(),
) {
  const clientRequestId = randomUUID(),
    startedAt = now(),
    starts = new Map<TtsPhase, number>(),
    durations = new Map<TtsPhase, number>();
  let httpStatus: number | null = null,
    providerRequestId: string | null = null;
  let transfer: { inputCharacters: number; receivedBytes: number; receivedChunks: number; lastByteElapsedMs: number | null } | undefined;
  const emit = (
    phase: TtsPhase,
    state: TtsDiagnosticEvent["state"],
    failure?: TtsFailure,
  ) => {
    const at = now();
    const event: TtsDiagnosticEvent = {
      version: 1,
      clientRequestId,
      phase,
      state,
      elapsedMs: Math.max(0, Math.round(at - startedAt)),
      durationMs: Math.max(0, Math.round(at - (starts.get(phase) ?? at))),
      httpStatus,
      providerRequestId,
      ...transfer,
      ...(failure ? { failure } : {}),
    };
    try {
      sink(event);
    } catch {
      /* Observability must never change the execution or retry policy. */
    }
  };
  return {
    clientRequestId,
    trackInput(characters: number) {
      if (Number.isSafeInteger(characters) && characters >= 0) {
        transfer = { inputCharacters: characters, receivedBytes: 0, receivedChunks: 0, lastByteElapsedMs: null };
      }
    },
    received(bytes: number) {
      if (transfer && Number.isSafeInteger(bytes) && bytes > 0) {
        transfer.receivedBytes += bytes;
        transfer.receivedChunks++;
        transfer.lastByteElapsedMs = Math.max(0, Math.round(now() - startedAt));
      }
    },
    start(phase: TtsPhase) {
      starts.set(phase, now());
      emit(phase, "started");
    },
    complete(phase: TtsPhase) {
      durations.set(phase, Math.max(0, Math.round(now() - (starts.get(phase) ?? now()))));
      emit(phase, "completed");
    },
    fail(phase: TtsPhase, failure: TtsFailure) {
      durations.set(phase, Math.max(0, Math.round(now() - (starts.get(phase) ?? now()))));
      emit(phase, "failed", failure);
    },
    setReceipt(status: number, id: string | null) {
      httpStatus =
        Number.isInteger(status) && status >= 100 && status <= 599
          ? status
          : null;
      providerRequestId =
        id && /^req_[A-Za-z0-9_-]{1,196}$/.test(id) ? id : null;
    },
    receipt() {
      return { clientRequestId, httpStatus, providerRequestId,
        elapsedMs: Math.max(0, Math.round(now() - startedAt)),
        headersDurationMs: durations.get("headers") ?? null,
        bodyDurationMs: durations.get("body") ?? null,
        ...transfer,
      };
    },
  };
}
export type TtsDiagnostics = ReturnType<typeof createTtsDiagnostics>;

// Safe metadata survives a body failure even when no usable audio can be returned.
export class SpeechRequestError extends Error {
  readonly clientRequestId: string;
  readonly httpStatus: number | null;
  readonly providerRequestId: string | null;
  constructor(
    readonly failure: TtsFailure,
    readonly phase: "headers" | "body",
    diagnostics: TtsDiagnostics,
  ) {
    super("Speech request did not complete");
    this.name = "SpeechRequestError";
    const receipt = diagnostics.receipt();
    this.clientRequestId = receipt.clientRequestId;
    this.httpStatus = receipt.httpStatus;
    this.providerRequestId = receipt.providerRequestId;
  }
}

export function speechFailure(
  error: unknown,
  phase: "headers" | "body",
  signal?: AbortSignal,
): TtsFailure {
  if (error instanceof SpeechRequestError) return error.failure;
  const name = error instanceof Error ? error.name : null;
  if (
    name === "TimeoutError" ||
    (signal?.aborted && signal.reason?.name === "TimeoutError")
  )
    return "timeout";
  if (signal?.aborted || name === "AbortError") return "aborted";
  return phase === "headers" ? "network" : "body_read";
}

export async function traceTtsStep<T>(
  diagnostics: TtsDiagnostics | undefined,
  phase: TtsPhase,
  failure: TtsFailure,
  run: () => T | Promise<T>,
): Promise<T> {
  diagnostics?.start(phase);
  try {
    const result = await run();
    diagnostics?.complete(phase);
    return result;
  } catch (error) {
    diagnostics?.fail(phase, failure);
    throw error;
  }
}
