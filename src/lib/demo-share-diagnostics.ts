import "server-only";
import { randomUUID } from "crypto";
import { demoFailureCode, type DemoFailureCode, type DemoStage } from "@/lib/demo-share-status";
export type DemoTrace = { requestId: string; stage: DemoStage };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createDemoTrace(stage: DemoStage, headers?: Headers): DemoTrace {
  const candidate = headers?.get("x-demo-request-id");
  return { requestId: candidate && uuid.test(candidate) ? candidate : randomUUID(), stage };
}
export function demoStep(trace: DemoTrace | undefined, stage: DemoStage, code: DemoFailureCode | "OK" | "PRESENT" | "ISSUED" | "READY" | "START" | "VALIDATED" | "MATCHED" = "OK") {
  if (!trace) return;
  trace.stage = stage;
  // Deliberate allowlist: never log URL, token, Cookie, headers, source or Error.
  console.info({ requestId: trace.requestId, stage, code });
}
export function demoFailure(error: unknown, trace: DemoTrace, fallback: DemoFailureCode = "SOURCE_UNAVAILABLE") {
  const code = demoFailureCode(error && typeof error === "object" && "code" in error ? error.code : null, fallback);
  demoStep(trace, trace.stage, code);
  const status = code === "SESSION_MISSING" ? 401 : ["EXPIRED", "REVOKED"].includes(code) ? 410
    : code === "SOURCE_CHANGED" ? 409 : code === "ORIGIN_REJECTED" ? 403 : ["INVALID_LINK", "PROJECT_MISMATCH"].includes(code) ? 404 : 503;
  return { ok: false as const, code, stage: trace.stage, requestId: trace.requestId, status };
}
