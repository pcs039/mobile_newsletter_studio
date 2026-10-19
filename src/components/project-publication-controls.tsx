"use client";

import Link from "next/link";
import { ProjectPublishCompletionPanel } from "@/components/project-publish-completion-panel";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicationMode, PublicationPreparation, PublicationReceipt } from "@/lib/project-publication";

type Pending = { action: "publish" | "unpublish"; mode: PublicationMode; revision: string; requestKey: string; confirmed: true };
type Props = { projectId: string; projectSlug: string; publicUrlAbsolute: string; ebookUrl?: string; onBusyChange?: (busy: boolean) => void; blocked?: boolean };
export function ProjectPublicationControls({ projectId, projectSlug, publicUrlAbsolute, ebookUrl, onBusyChange, blocked = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<PublicationMode>("author_direct");
  const [preparation, setPreparation] = useState<PublicationPreparation | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [receipt, setReceipt] = useState<PublicationReceipt | null>(null);
  const lock = useRef(false);
  const pending = useRef<Pending | null>(null);
  const controller = useRef<AbortController | null>(null);
  const storageKey = `publication-request-v1:${projectId}`;

  useEffect(() => {
    const timer = setTimeout(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const item = raw ? JSON.parse(raw) : null;
      if (item && ["publish", "unpublish"].includes(item.action) && ["author_direct", "client_review"].includes(item.mode) && /^[a-f0-9]{32}$/.test(item.revision) && /^[a-f0-9-]{36}$/i.test(item.requestKey) && item.confirmed === true) {
        pending.current = item; setMode(item.mode); setUncertain(true); setMessage("이전 요청 결과를 같은 식별자로 확인하세요. 새 발행은 시작하지 않습니다.");
      }
    } catch { /* Storage may be unavailable; server receipts still prevent same-key duplicates. */ }
    }, 0);
    return () => { clearTimeout(timer); controller.current?.abort(); };
  }, [storageKey]);

  function setWorking(value: boolean) { lock.current = value; setBusy(value); onBusyChange?.(value); }
  async function prepare() {
    if (lock.current || pending.current || blocked) return;
    setWorking(true); setConfirmed(false); setMessage(""); setReceipt(null); setPreparation(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch("/api/project-publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, action: "prepare" }), signal: abort.signal });
      const result = await response.json();
      if (abort.signal.aborted) return;
      if (!response.ok || !result.ok) throw new Error(result.message || "공개 대상을 확인하지 못했습니다.");
      setPreparation(result.preparation); setError(false);
    } catch (cause) {
      if (!abort.signal.aborted) { setError(true); setMessage(cause instanceof Error ? cause.message : "공개 대상을 확인하지 못했습니다."); }
    } finally { if (!abort.signal.aborted) setWorking(false); }
  }
  async function execute(action: "publish" | "unpublish", retry = false) {
    if (lock.current || blocked) return;
    if (!retry && (!preparation || !confirmed || pending.current || (action === "publish" && (!preparation.canPublish || (mode === "client_review" && !preparation.canReviewPublish))))) return;
    const input = retry ? pending.current : { action, mode, revision: preparation!.revision, requestKey: crypto.randomUUID(), confirmed: true as const };
    if (!input) return;
    // Persist before transport; retries and reload recovery reuse this exact key/input.
    pending.current = input;
    try { sessionStorage.setItem(storageKey, JSON.stringify(input)); } catch { /* Best effort on restricted browsers. */ }
    setWorking(true); setMessage(""); setError(false);
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch("/api/project-publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, ...input }), signal: abort.signal });
      const result = await response.json();
      if (abort.signal.aborted) return;
      if (!response.ok || !result.ok) {
        if (!result.uncertain && response.status < 500) {
          pending.current = null; try { sessionStorage.removeItem(storageKey); } catch {}
          setUncertain(false); setPreparation(null); setConfirmed(false);
        } else setUncertain(true);
        throw new Error(result.message || "같은 요청으로 결과를 확인하세요.");
      }
      pending.current = null; try { sessionStorage.removeItem(storageKey); } catch {}
      setUncertain(false); setConfirmed(false); setPreparation(null); setReceipt(result.receipt);
      setMessage(result.duplicate ? "기존 요청 결과를 재사용했습니다. 새 발행은 하지 않았습니다." : input.action === "unpublish" ? "비공개로 전환했습니다. 기존 자료는 보존됩니다." : "공식 발행이 완료되었습니다.");
      router.refresh();
    } catch (cause) {
      if (!abort.signal.aborted) { if (pending.current) setUncertain(true); setError(true); setMessage(cause instanceof Error ? cause.message : "같은 요청으로 결과를 확인하세요."); }
    } finally { if (!abort.signal.aborted) setWorking(false); }
  }
  const published = receipt ? receipt.current_status === "published" : preparation?.status === "published";
  return <section aria-label="공식 발행" className="min-w-0 rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
    <h3 className="text-xl font-black text-[#092046]">공식 발행</h3>
    <p className="mt-2 text-sm leading-6 text-slate-700">기본은 작성자 직접 발행입니다. 기관 승인 없이 담당 프로젝트를 공개할 수 있습니다. 시연용 링크와 달리 공식 URL을 누구나 열람할 수 있습니다.</p>
    <label className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold">발행 방식
      <select aria-label="공식 발행 방식" value={mode} disabled={blocked || busy || uncertain} onChange={e => { setMode(e.target.value as PublicationMode); setPreparation(null); setConfirmed(false); setMessage(""); setReceipt(null); }} className="max-w-full rounded-lg border bg-white p-2">
        <option value="author_direct">작성자 직접 발행 (기본)</option><option value="client_review">기관 검수 후 발행</option>
      </select>
    </label>
    {mode === "client_review" ? <p className="mt-2 text-sm">아래 기관 검토에서 승인받은 뒤 발행하세요. 기존 승인 조건을 서버에서 다시 확인합니다.</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={blocked || busy || uncertain} onClick={() => void prepare()} className="dd-btn dd-btn-secondary dd-btn-sm">{busy ? "처리 중..." : "공개 대상 확인"}</button>
      <Link href={`/newsletters/${projectSlug}?preview=admin`} target="_blank" className="dd-btn dd-btn-secondary dd-btn-sm">저장본 미리보기</Link>
    </div>
    {preparation ? <div className="mt-4 space-y-3 text-sm">
      <p>공개 대상 기사 {preparation.eligibleArticles}개 · 제외 {preparation.excludedArticles}개 · e-book {preparation.ebookReady ? "준비됨" : "확인 필요"}</p>
      <p>현재 상태: {{ draft: "제작 중", in_review: "검수 중", published: "발행 완료", private: "비공개", archived: "보관됨" }[preparation.status] || preparation.status} · {preparation.publishedAt ? `최근 발행 ${new Date(preparation.publishedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` : "이전 발행 기록 없음"}</p>
      <ul className="list-inside list-disc space-y-1">{preparation.warnings.map(w => <li key={w}>{w}</li>)}</ul>
      {mode === "client_review" && !preparation.canReviewPublish ? <p className="font-bold text-amber-800">이 발행 방식은 최신 기관 승인이 필요합니다. 직접 발행은 별도로 선택할 수 있습니다.</p> : null}
      {!preparation.canPublish ? <p className="font-bold text-amber-800">공개 가능한 콘텐츠 또는 프로젝트 상태를 확인하세요.</p> : null}
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={blocked || busy} onChange={e => setConfirmed(e.target.checked)} className="mt-1" /><span>저장된 공개 대상과 연락처·개인정보·이미지 이용 권한을 확인했습니다. 발행 또는 비공개 전환을 진행합니다.</span></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={blocked || busy || !confirmed || (!preparation.canPublish || (mode === "client_review" && !preparation.canReviewPublish))} onClick={() => void execute("publish")} className="dd-btn dd-btn-primary dd-btn-sm">{published ? "확인 후 다시 발행" : mode === "author_direct" ? "직접 발행하기" : "기관 승인 후 발행하기"}</button>
        {published ? <button type="button" disabled={blocked || busy || !confirmed} onClick={() => void execute("unpublish")} className="dd-btn dd-btn-secondary dd-btn-sm">비공개로 전환</button> : null}
      </div>
      <p className="break-all text-xs">공식 URL: {publicUrlAbsolute}</p>
      {preparation.history.length ? <details><summary>최근 발행·취소 이력</summary><ul className="mt-2 space-y-2">{preparation.history.map(e => <li key={e.requestKey} className="break-words">{new Date(e.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {e.mode === "author_direct" ? "직접 발행" : e.mode === "client_review" ? "기관 검수" : "상태 변경"} · {e.action === "unpublish" ? "비공개" : e.status} · {e.actorId}</li>)}</ul></details> : <p className="text-xs text-slate-500">이전 발행은 방식 이력이 없을 수 있습니다.</p>}
    </div> : null}
    {uncertain ? <button type="button" disabled={blocked || busy} onClick={() => void execute("publish", true)} className="dd-btn dd-btn-secondary dd-btn-sm mt-4">같은 요청 결과 확인</button> : null}
    {message ? <p role={error ? "alert" : "status"} className={`mt-4 break-words text-sm ${error ? "text-rose-800" : "text-emerald-800"}`}>{message}</p> : null}
    {receipt ? <div className="mt-4 space-y-2 text-sm"><p>현재 공개 상태: {receipt.current_status === "published" ? "발행 완료" : "비공개 또는 비발행"}</p>{receipt.published_at ? <p>발행 시각: {new Date(receipt.published_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p> : null}{receipt.current_status === "published" ? <><ProjectPublishCompletionPanel key={receipt.request_key} resultOnly canPublish={false} currentStatus="발행 완료" isPublished initialPublishedAt={receipt.published_at || ""} projectId={projectId} projectSlug={projectSlug} publicUrl={`/newsletters/${projectSlug}`} publicUrlAbsolute={publicUrlAbsolute} ebookUrl={ebookUrl || `/newsletters/${projectSlug}/ebook`} hasChecklistIssues={false} /></> : null}</div> : null}
  </section>;
}
