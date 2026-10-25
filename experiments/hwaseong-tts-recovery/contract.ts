// Isolated preparation only: deliberately not imported by an application route.
// No provider, database, storage, credentials, clock or network dependencies.
import { createHash } from "node:crypto";

export const recoveryParentId = "e2041281-42e2-5363-a329-43db98714355";
export const recoveryProjectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
export const recoveryRequestHash = "e204128142e2c363432943db98714355fba056c9534e24df529f116522e2973d";
export const recoveryScriptSha256 = "d216ab7c167a569f6b78beec03d27ad6e9dc088a534334c6bb3d7c4d02ae4470";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
export type RecoveryParent = {
  id: string; project_id: string; article_id: string | null; source_type: string;
  title: string; script_text: string; script_status: string; transcript_type: string;
  ai_tts_voice: string; ai_tts_model: string; ai_tts_text_hash: string;
  ai_tts_generated_at: string | null; ai_tts_audio_paths: string[]; file_path: string;
  pronunciation_note: string | null; duration_seconds: number | null;
  created_at: string; updated_at: string;
};
export type ObjectObservation = { path: string; state: "not_found" | "exists" | "unknown" };
export type PriorEvidence = {
  recordedSpeechAttempts: number;
  firstSpeechHttpStatus: number | null;
  firstProviderRequestId: string | null;
  firstAttemptCharge: "unconfirmed" | "confirmed_zero" | "confirmed_nonzero";
  laterModelHttpStatus: number | null;
};
export function parentFingerprint(row: RecoveryParent) {
  // Fixed review fields avoid reliance on JSON property order; unrelated columns are outside this fingerprint.
  const fields = ["id", "project_id", "article_id", "source_type", "title", "script_text", "script_status", "transcript_type", "ai_tts_voice", "ai_tts_model", "ai_tts_text_hash", "ai_tts_generated_at", "ai_tts_audio_paths", "file_path", "pronunciation_note", "duration_seconds", "created_at", "updated_at"] as const;
  return sha(JSON.stringify(fields.map(k => [k, row[k]])));
}
export function prepareMarinRecovery(input: {
  parent: RecoveryParent;
  objects: ObjectObservation[];
  expectedParentFingerprint: string;
  evidence: PriorEvidence;
  stagingModelHttpStatus: number | null;
  invocationFinished: boolean;
}) {
  const { parent: p, evidence } = input;
  const block = (reason: string) => ({ state: "blocked" as const, reason, executionAllowed: false as const });
  if (p.id !== recoveryParentId || p.project_id !== recoveryProjectId || p.article_id !== null) return block("parent_scope_mismatch");
  if (p.script_status !== "pending" || p.ai_tts_generated_at !== null) return block("parent_not_pending");
  if (p.source_type !== "ai_tts" || p.transcript_type !== "custom_script" || p.ai_tts_voice !== "marin" || p.ai_tts_model !== "gpt-4o-mini-tts") return block("narration_contract_mismatch");
  if (p.ai_tts_text_hash !== recoveryRequestHash || sha(p.script_text) !== recoveryScriptSha256 || p.script_text.length !== 74) return block("script_or_request_hash_changed");
  if (parentFingerprint(p) !== input.expectedParentFingerprint) return block("parent_changed_since_review");
  const path = `projects/${recoveryProjectId}/sample-tts-v1/${recoveryParentId}/000.mp3`;
  if (p.file_path !== path || p.ai_tts_audio_paths.length !== 1 || p.ai_tts_audio_paths[0] !== path) return block("storage_scope_mismatch");
  // HTTP errors alone never establish absence: the read adapter must recognize Object not found.
  if (input.objects.length !== 1 || input.objects[0].path !== path || input.objects[0].state !== "not_found") return block("storage_absence_unconfirmed");
  if (!input.invocationFinished) return block("prior_invocation_unconfirmed");
  if (input.stagingModelHttpStatus !== 200) return block("staging_auth_unconfirmed");
  if (evidence.recordedSpeechAttempts !== 1) return block("attempt_count_requires_review");
  // Authentication evidence and billing evidence are independent; a later 401 cannot fill in the first response.
  const attemptKey = sha(`hwaseong-marin-recovery-v1\n${p.id}\n${recoveryRequestHash}\nattempt:1`);
  return {
    state: "prepared_for_review" as const,
    executionAllowed: false as const,
    reason: "durable_claim_adapter_and_explicit_write_generation_approval_required",
    parentId: p.id, parentFingerprint: parentFingerprint(p), scriptSha256: recoveryScriptSha256,
    requestHash: recoveryRequestHash, attemptOrdinal: 1, attemptKey,
    credentialSource: "STAGING_OPENAI_API_KEY" as const,
    maximumNewSpeechCalls: 1, newAudioRows: 1, newStorageObjects: 1,
    originalRowUpdates: 0, originalObjectUpdates: 0, originalDeletes: 0,
    priorSpeechHttpStatus: evidence.firstSpeechHttpStatus,
    priorProviderRequestId: evidence.firstProviderRequestId,
    priorCharge: evidence.firstAttemptCharge,
    priorChargeAcknowledgementRequired: evidence.firstAttemptCharge === "unconfirmed",
    ledgerRequirements: ["unique_parent_and_attempt", "immutable_parent_link_and_fingerprint", "authenticated_actor_and_approval", "claim_committed_before_provider", "provider_request_id_status_and_usage_if_available", "same_attempt_status_after_response_loss", "no_automatic_retry_or_attempt_increment"] as const,
  };
}
