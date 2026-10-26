import "server-only";
import { randomUUID } from "node:crypto";
import { SpeechRequestError, traceTtsStep, type TtsDiagnostics } from "@/lib/tts-request-diagnostics";
import {
  inspectMarinMp3, marinOriginalPath, marinPath, validateMarinParent, validMarinReceipt,
  type MarinActor, type MarinParent, type MarinReceipt,
} from "@/lib/hwaseong-marin-recovery-contract";

type Proof = ReturnType<typeof inspectMarinMp3>;
export type MarinSpeech = { ok: boolean; data?: ArrayBuffer; httpStatus?: number; providerRequestId?: string | null };
export type MarinDependencies = {
  diagnostics?: TtsDiagnostics;
  parent(): Promise<MarinParent>;
  receipt(): Promise<MarinReceipt | null>;
  object(path: string): Promise<Uint8Array | null>; // null only for explicit Object not found
  claim(actor: MarinActor, parent: MarinParent, token: string, approval: string): Promise<{ won: boolean; receipt: MarinReceipt }>;
  record(actor: MarinActor, token: string, proof: Proof | null, status: number | null, requestId: string | null, error: string | null): Promise<MarinReceipt>;
  complete(actor: MarinActor, proof: Proof): Promise<MarinReceipt>;
  speech(text: string, diagnostics?: TtsDiagnostics): Promise<MarinSpeech>;
  put(path: string, data: Uint8Array): Promise<void>;
};
const outcome = (state: "ready" | "unknown" | "rejected", calls: number, code: string, receipt?: MarinReceipt) =>
  ({ ok: state === "ready", state, calls, code, ...(receipt ? { receipt } : {}) });
function receiptChecked(r: MarinReceipt) { if (!validMarinReceipt(r)) throw Error("receipt_scope"); return r; }
function matchProof(r: MarinReceipt, p: Proof) {
  if (r.byte_hash !== p.hash || r.byte_size !== p.size || r.duration_seconds !== p.duration) throw Error("proof_mismatch");
}

// One successful durable claim authorizes at most ONE application-level speech invocation.
// A lost claim response has no owner continuation, even if its DB transaction committed.
export async function executeMarinRecovery(d: MarinDependencies, actor: MarinActor, approval: string) {
  if (actor.role !== "admin" || !actor.id || !approval.trim() || approval.length > 200) return outcome("rejected",0,"approval_required");
  const token=randomUUID(); let calls=0, claimed=false, proofRecorded=false;
  let status: number | null=null, requestId: string | null=null;
  const note = async (error: string) => {
    if (claimed && !proofRecorded) try {
      await traceTtsStep(d.diagnostics,"db_record","database",()=>d.record(actor,token,null,status,requestId,error));
    } catch { /* Preserve the durable lock; never regenerate. */ }
  };
  try {
    const parent=await d.parent();
    try { validateMarinParent(parent); } catch { return outcome("rejected",0,"parent_mismatch"); }
    const prior=await d.receipt();
    if (prior) {
      const r=receiptChecked(prior);
      if (r.phase==="ready") {
        const saved=await d.object(marinPath); if (!saved) return outcome("unknown",0,"saved_output_missing",r);
        const proof=inspectMarinMp3(saved);matchProof(r,proof);
        const checked=receiptChecked(await d.complete(actor,proof));matchProof(checked,proof);
        return outcome(checked.phase==="ready"?"ready":"unknown",0,"existing_completed_result",checked);
      }
      return outcome("unknown",0,"existing_attempt_query_or_reconcile",r);
    }
    if (await d.object(marinOriginalPath) !== null || await d.object(marinPath) !== null) return outcome("rejected",0,"existing_object_requires_review");
    const claim=await traceTtsStep(d.diagnostics,"db_claim","database",()=>d.claim(actor,parent,token,approval));
    receiptChecked(claim.receipt);
    if (claim.won!==true) return outcome("unknown",0,"existing_attempt_query_or_reconcile",claim.receipt);
    if (claim.receipt.phase !== "reserved") throw Error("invalid_claim_phase");
    claimed=true; calls=1;
    const speech=await d.speech(parent.script_text,d.diagnostics);
    status=speech.httpStatus ?? (speech.ok ? 200 : null); requestId=speech.providerRequestId ?? null;
    if (!speech.ok || !speech.data) { await note("provider_failed"); return outcome("unknown",calls,"provider_failed_no_retry"); }
    const data=new Uint8Array(speech.data);
    let proof: Proof;
    try { proof=await traceTtsStep(d.diagnostics,"validation","invalid_mp3",()=>inspectMarinMp3(data)); }
    catch { await note("invalid_mp3"); return outcome("unknown",calls,"invalid_mp3_no_retry"); }
    // Persist the expected bytes BEFORE upload, so later verification never trusts arbitrary Storage contents.
    const recorded=await traceTtsStep(d.diagnostics,"db_record","database",async()=>{
      const r=receiptChecked(await d.record(actor,token,proof,status,requestId,null));
      matchProof(r,proof); if (r.phase !== "output_verified") throw Error("proof_not_recorded"); return r;
    });
    proofRecorded=true;
    try { await traceTtsStep(d.diagnostics,"storage","storage",()=>d.put(marinPath,data)); }
    catch { /* Upload response may be lost: read and compare, never re-upload. */ }
    d.diagnostics?.start("storage_verification");
    try {
      const saved=await d.object(marinPath);
      if (!saved) {
        d.diagnostics?.fail("storage_verification","unconfirmed");
        return outcome("unknown",calls,"storage_unconfirmed");
      }
      matchProof(recorded,inspectMarinMp3(saved));
      d.diagnostics?.complete("storage_verification");
    } catch (error) {
      d.diagnostics?.fail("storage_verification","unconfirmed"); throw error;
    }
    const complete=await traceTtsStep(d.diagnostics,"db_complete","database",async()=>{
      const r=receiptChecked(await d.complete(actor,proof));
      matchProof(r,proof); if (r.phase !== "ready") throw Error("commit_unconfirmed"); return r;
    });
    return outcome("ready",calls,"completed",complete);
  } catch (error) {
    if (error instanceof SpeechRequestError) {
      status=error.httpStatus; requestId=error.providerRequestId;
    }
    await note("provider_unknown");
    return outcome("unknown",calls,proofRecorded ? "verify_saved_output_then_reconcile" : "query_same_attempt_no_retry");
  }
}

// Explicit operator action, never called by a GET, polling, execute retry or automatic job.
// This path has no speech/put call; it can only finish already journaled, verified bytes.
export async function reconcileMarinRecovery(d: MarinDependencies, actor: MarinActor) {
  if (actor.role !== "admin" || !actor.id) return outcome("rejected",0,"admin_required");
  try {
    validateMarinParent(await d.parent());
    const row=await d.receipt();
    if (!row) return outcome("rejected",0,"attempt_missing");
    const r=receiptChecked(row);
    if (!["output_verified","ready"].includes(r.phase)) return outcome("unknown",0,"no_verified_output_manual_review_required",r);
    const saved=await d.object(marinPath); if (!saved) return outcome("unknown",0,"saved_output_missing",r);
    const proof=inspectMarinMp3(saved); matchProof(r,proof);
    const complete=receiptChecked(await d.complete(actor,proof)); matchProof(complete,proof);
    return outcome(complete.phase==="ready"?"ready":"unknown",0,"reconciled",complete);
  } catch { return outcome("unknown",0,"reconciliation_unconfirmed_no_retry"); }
}
