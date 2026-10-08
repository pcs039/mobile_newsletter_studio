"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ClientReviewStatus, ClientReviewDecision } from "@/lib/client-review-repository";

type Props = {
  children: ReactNode;
  projectSlug: string;
  title: string;
  organization: string;
  issue: string;
  expiresAt: string;
  initialStatus: ClientReviewStatus;
};

const labels = { pending: "기관 검토 중", approved: "승인 완료", changes_requested: "수정 요청 완료", revoked: "취소됨" };

export function ClientReviewScreen({ children, projectSlug, title, organization, issue, expiresAt, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState("");
  const [deadline, setDeadline] = useState(expiresAt);
  const submitting = useRef(false);
  const responseVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden || submitting.current) return;
      const version = responseVersion.current;
      try {
        const response = await fetch(`/api/client-review/session?${new URLSearchParams({ project: projectSlug })}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (controller.signal.aborted || submitting.current || version !== responseVersion.current) return;
        if (!response.ok || !result.ok) {
          if ([404, 410].includes(response.status)) setBlocked(result.message || "검토 세션이 유효하지 않습니다.");
          else setError("검토 상태를 확인하지 못했습니다. 잠시 후 다시 시도하거나 화면을 새로고침하세요.");
          return;
        }
        if (["pending", "approved", "changes_requested", "revoked"].includes(result.status)) setStatus(result.status);
        setDeadline(result.expiresAt);
        setError("");
      } catch {
        if (!controller.signal.aborted) setError("검토 상태를 확인하지 못했습니다. 네트워크 연결을 확인하세요.");
      }
    }
    const timer = setInterval(() => void refresh(), 30_000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { clearInterval(timer); controller.abort(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [projectSlug]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() >= new Date(deadline).getTime()) setBlocked("검토 링크가 만료되었습니다. 담당자에게 새 검토 링크를 요청해 주세요.");
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  async function respond(decision: ClientReviewDecision) {
    if (submitting.current || status !== "pending" || blocked || error) return;
    if (!window.confirm(decision === "approved"
      ? "소식지 내용을 확인하고 승인할까요? 승인 후에는 이 링크로 응답을 변경할 수 없습니다."
      : "수정 요청을 전달할까요? 요청 후에는 이 링크로 응답을 변경할 수 없습니다.")) return;
    submitting.current = true;
    responseVersion.current += 1;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/client-review/respond", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug, decision }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        if ([404, 410].includes(response.status)) setBlocked(result.message || "검토 세션이 유효하지 않습니다.");
        throw new Error(result.message || "응답을 저장하지 못했습니다. 화면을 새로고침해 처리 결과를 확인하세요.");
      }
      setStatus(result.decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "응답 결과를 확인하지 못했습니다. 화면을 새로고침해 처리 결과를 확인하세요.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const pending = status === "pending" && !blocked;
  return (
    <main className="client-review-screen public-newsletter-screen min-h-screen bg-[#edf4fb] pb-[calc(8rem+env(safe-area-inset-bottom))] text-slate-950">
      <div className="sticky top-0 z-[60] border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-black leading-5 text-amber-900">
        기관 검토용 화면입니다. 아직 최종 공개되지 않았습니다.
      </div>
      <header className="mx-auto max-w-[560px] border-b border-slate-200 bg-white p-5">
        <p className="text-sm font-bold text-[#184a88]">{organization}</p>
        <h1 className="mt-2 text-xl font-black text-[#092046]">{title}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-600">{issue}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{blocked ? "검토 종료" : labels[status]}</span>
          <p className="text-xs font-semibold text-slate-500">만료: {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(deadline))} (한국 시간)</p>
        </div>
        {pending ? <p className="mt-3 text-sm leading-6 text-slate-600">아래 소식지를 읽고 하단의 승인 또는 수정 요청을 선택하세요. <a href="#client-review-actions" className="font-bold text-[#184a88] underline">검토 응답으로 이동</a></p> : null}
      </header>
      {pending ? children : (
        <section role="status" className="mx-auto mt-6 max-w-[520px] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-xl font-black text-[#092046]">{blocked ? "검토를 진행할 수 없습니다." : labels[status]}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{blocked || (status === "approved" ? "승인을 전달했습니다. 소식지 담당자가 최종 발행을 진행합니다." : "수정 요청을 전달했습니다. 담당자가 내용을 수정한 뒤 새 검토 링크를 전달합니다.")}</p>
          {!blocked ? <p className="mt-3 text-xs font-semibold text-slate-500">검토 응답이 완료되어 다시 응답할 수 없습니다.</p> : null}
        </section>
      )}
      {pending ? (
        <footer id="client-review-actions" aria-label="기관 검토 응답" className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-[560px] border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-xl backdrop-blur">
          <p className="mb-2 text-center text-xs font-semibold text-slate-500">전체 내용을 확인한 뒤 선택해 주세요.</p>
          {error ? <p role="alert" className="mb-2 text-sm font-bold text-rose-700">{error}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={busy || Boolean(error)} onClick={() => void respond("changes_requested")} className="dd-btn dd-btn-secondary min-h-12 justify-center rounded-xl">수정 요청</button>
            <button type="button" disabled={busy || Boolean(error)} onClick={() => void respond("approved")} className="dd-btn dd-btn-primary min-h-12 justify-center rounded-xl">{busy ? "응답 저장 중..." : "승인"}</button>
          </div>
        </footer>
      ) : null}
    </main>
  );
}
