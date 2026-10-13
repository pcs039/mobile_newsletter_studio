"use client";
import { useEffect, useRef, useState } from "react";
import { canProduceCanva, canvaEditLink, canvaExecutionMessage, canvaFieldLabels, type CanvaRecommendationPreparation } from "@/lib/canva-recommendation-execution";
import { CanvaPngImportControls } from "@/components/design/canva-png-import-controls";
import { CanvaDesignReviewControls } from "@/components/design/canva-design-review-controls";
import { receiveCanvaDesign, restoreCanvaReview, reviewCanvaDesign, type CanvaDesignReview } from "@/lib/canva-design-review";
import { getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";
import type { CanvaAutofillExecutionResult } from "@/lib/canva-autofill-execution";

export function CanvaRecommendationExecutionControls({ projectSlug, articleId, templateId, disabled, articleVersion = "", onChooseAnother }: {
  projectSlug: string; articleId: string; templateId: string; disabled: boolean; articleVersion?: string; onChooseAnother?: () => void;
}) {
  const [review, setReview] = useState<CanvaDesignReview | null>(null);
  const reviewRef = useRef<CanvaDesignReview | null>(null);
  const context = JSON.stringify([articleId, articleVersion, templateId]);
  const contextHash = useRef<string | null>(null);
  const storageKey = `canva-design-review:${projectSlug}`;
  function recordReview(value: CanvaDesignReview | null) {
    reviewRef.current = value; setReview(value);
    try { if (value && contextHash.current) sessionStorage.setItem(storageKey, JSON.stringify({ context: contextHash.current, review: value })); else sessionStorage.removeItem(storageKey); } catch { /* Session persistence is optional in restricted browsers. */ }
  }
  function receiveResult(value: CanvaAutofillExecutionResult) {
    setResult(value);
    const url = canvaEditLink(value.editUrl);
    if (value.status === "created" && value.canvaDesignId && url) recordReview(receiveCanvaDesign(reviewRef.current, value.canvaDesignId, url, new Date().toISOString()));
  }
  const [preparation, setPreparation] = useState<CanvaRecommendationPreparation | null>(null);
  const [result, setResult] = useState<CanvaAutofillExecutionResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(templateId === "event_festival_02");
  const [error, setError] = useState("");
  const flight = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const requestKey = useRef<string | null>(null);
  const supported = templateId === "event_festival_02";

  async function call(action: "prepare" | "execute" | "poll", signal: AbortSignal) {
    const response = await fetch("/api/canva/recommendation-execution", { method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ projectSlug, articleId, templateId, action,
        ...(action !== "prepare" ? { requestKey: requestKey.current, confirmation: preparation?.confirmation } : {}) }) });
    const value = await response.json();
    if (!response.ok) throw Error("제작 상태를 확인하지 못했습니다. 준비 상태를 다시 확인하세요.");
    return value;
  }
  // Parent keys this component by saved article input and selected template.
  // Selection/contents changes cancel local observation, never replay creation.
  useEffect(() => {
    alive.current = true;
    let active = true;
    // Persist only a digest of the article snapshot, never article text.
    void crypto.subtle.digest("SHA-256", new TextEncoder().encode(context)).then(bytes => {
      if (!active) return;
      contextHash.current = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
      try {
        const restored = restoreCanvaReview(JSON.parse(sessionStorage.getItem(storageKey) ?? "null"), contextHash.current);
        if (restored && canvaEditLink(restored.editUrl)) {
          recordReview(restored); setSubmitted(true);
          setResult({ ok: true, status: "created", canvaDesignId: restored.designId, editUrl: restored.editUrl });
        } else sessionStorage.removeItem(storageKey);
      } catch { /* No persistent state is required to edit or review. */ }
    }).catch(() => { /* Review remains available without session persistence. */ });
    const abort = new AbortController(); controller.current = abort;
    if (!supported) { return () => { active = false; alive.current = false; abort.abort(); }; }
    const timer = setTimeout(() => abort.abort(), 15_000);
    void call("prepare", abort.signal).then(value => {
      if (active && !abort.signal.aborted) { setPreparation(value); setError(""); }
    }).catch(() => { if (active && !abort.signal.aborted) setError("제작 준비를 확인하지 못했습니다."); })
      .finally(() => { clearTimeout(timer); if (active) { setChecking(false); if (abort.signal.aborted) setError("제작 준비를 확인하지 못했습니다."); } });
    return () => { active = false; alive.current = false; abort.abort(); controller.current?.abort(); };
    // Context changes remount this component; prepare never executes Canva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(pollOnly = false) {
    if (flight.current || disabled || !canProduceCanva(preparation) || (!pollOnly && requestKey.current)) return;
    flight.current = true;
    if (!pollOnly) { requestKey.current = crypto.randomUUID(); setSubmitted(true); }
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 60_000);
    setBusy(true); setError("");
    try {
      // One creation request. Subsequent observations use poll, whose server
      // guard requires the SAME persisted key/hash/job and cannot create.
      let value: CanvaAutofillExecutionResult = await call(pollOnly ? "poll" : "execute", abort.signal);
      // Polling reuses the persisted job, but that does not mean the user
      // reused a pre-existing design. Retain the initial creation provenance.
      const reused = pollOnly ? result?.duplicate === true : value.duplicate === true;
      value = { ...value, duplicate: reused };
      if (alive.current) receiveResult(value);
      for (let count = 0; value.status === "in_progress" && count < 6 && !abort.signal.aborted; count++) {
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 3000);
          abort.signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
        if (!alive.current || abort.signal.aborted) break;
        value = { ...await call("poll", abort.signal), duplicate: reused };
        if (alive.current) receiveResult(value);
      }
    } catch { if (alive.current) setError("제작 실패 · 결과가 미확정일 수 있습니다. 자동으로 다시 제작하지 않습니다. 프로젝트 디자인 화면에서 상태를 확인하세요."); }
    finally { clearTimeout(timeout); flight.current = false; if (alive.current) setBusy(false); }
  }
  async function reviewAction(action: "approve" | "open" | "revise" | "cancel") {
    if (!review || flight.current || disabled || importBusy) return false;
    if (preparation && !preparation.stagingAllowed) { recordReview(reviewCanvaDesign(review, action)); return true; }
    // Opening an approved design also returns it to review: Canva edits cannot
    // be detected, so a fresh explicit approval is required before import.
    if (action === "open" && review.status !== "approved" && review.status !== "needs_revision") {
      recordReview(reviewCanvaDesign(review, action)); return true;
    }
    if (action !== "approve") recordReview(reviewCanvaDesign(review, action === "open" ? "revise" : action));
    flight.current = true; setBusy(true); setError("");
    try {
      let confirmation: string | undefined;
      if (action === "approve") {
        const response = await fetch(`/api/canva/png-import?${new URLSearchParams({ projectSlug, articleId, templateId, designId: review.designId })}`, { signal: AbortSignal.timeout(15000) });
        const candidate = await response.json();
        if (!response.ok || !candidate.enabled || candidate.designId !== review.designId) throw Error("현재 결과의 승인을 확인하지 못했습니다. 고정 Staging에서 다시 검토하세요.");
        confirmation = candidate.confirmation;
      }
      const response = await fetch("/api/canva/png-import", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ projectSlug, articleId, templateId, designId: review.designId, action: action === "approve" ? "approve" : "revoke", ...(confirmation ? { confirmation } : {}) }) });
      if (!response.ok) throw Error("현재 결과의 승인 상태를 변경하지 못했습니다. 진행 중인 가져오기와 기사 내용을 확인하세요.");
      if (alive.current) recordReview(reviewCanvaDesign(review, action === "open" ? "revise" : action));
      return true;
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "승인 상태를 확인하지 못했습니다."); return false; }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  const fields = [...new Set([...(preparation?.missingFields ?? []), ...(preparation?.visualIssues ?? []).map(f => f.field), ...(result?.visualIssues ?? []).map(f => f.field)])];
  const editUrl = canvaEditLink(result?.editUrl);
  const state = result ? canvaExecutionMessage(result) : checking ? "제작 준비 확인 중…" : !supported ? "이 템플릿은 Canva 제작 검증 준비 중입니다." :
    preparation && !preparation.stagingAllowed ? "Canva 제작은 고정 Staging에서만 사용할 수 있습니다." :
    preparation && !preparation.connected ? "Canva 연결 필요 · 프로젝트 디자인 화면에서 Canva에 연결해 주세요." :
    canProduceCanva(preparation) ? "제작 가능" : "내용 확인 필요";
  return <div className="mt-3 min-w-0 rounded-lg border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]" aria-label="선택 디자인 Canva 제작">
    <p role="status" aria-live="polite" className="text-sm font-bold">{busy ? "제작 중" : state}</p>
    {fields.length ? <p className="mt-2 text-sm text-amber-900">확인할 항목: {fields.map(field => canvaFieldLabels[field] ?? "기사 정보").join(", ")}</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    <button type="button" className="dd-btn dd-btn-primary mt-3 max-w-full" style={{ whiteSpace: "normal" }}
      disabled={disabled || busy || checking || submitted || !canProduceCanva(preparation)} onClick={() => void run()}>이 디자인으로 Canva 제작</button>
    {result?.status === "in_progress" && !busy ? <button type="button" disabled={disabled} className="dd-btn dd-btn-secondary ml-2 mt-3 max-w-full" onClick={() => void run(true)}>제작 상태 확인</button> : null}
    {review && editUrl ? <CanvaDesignReviewControls review={review} templateName={getCanonicalCanvaTemplate(templateId)?.displayName ?? "선택한 디자인"} disabled={disabled || busy || importBusy}
      onAction={action => void reviewAction(action)}
      onChooseAnother={() => { void (async () => { if (review.status === "approved" && !await reviewAction("cancel")) return; recordReview(null); setResult(null); onChooseAnother?.(); })(); }} /> : result?.status === "created" && editUrl ? <a className="dd-btn dd-btn-secondary mt-3 max-w-full" href={editUrl} target="_blank" rel="noopener noreferrer">Canva에서 열기</a> : null}
    {review?.status === "approved" ? <CanvaPngImportControls key={review.designId} projectSlug={projectSlug} articleId={articleId} designId={review.designId} templateId={templateId} onBusyChange={setImportBusy} /> : null}
    {(result?.status === "auth_required" || preparation && preparation.stagingAllowed && !preparation.connected) ? <a className="mt-2 block text-sm underline" href={`/projects/${encodeURIComponent(projectSlug)}/design#canva-templates`}>Canva 연결 확인</a> : null}
    {preparation && !preparation.stagingAllowed ? <a className="mt-2 block text-sm underline" href="https://canva-staging.datadiction.co.kr">고정 Staging으로 이동</a> : null}
    <p className="mt-2 text-xs text-slate-600">저장된 기사 기준입니다. 제작 버튼을 누르기 전에는 디자인을 생성하지 않습니다.</p>
  </div>;
}
