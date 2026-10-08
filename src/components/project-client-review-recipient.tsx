"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CLIENT_REVIEW_EMAIL_MAX_LENGTH, parseClientReviewRecipientEmail } from "@/lib/client-review-recipient";

export function ProjectClientReviewRecipient({ projectSlug, readOnly = false }: { projectSlug: string; readOnly?: boolean }) {
  const [email, setEmail] = useState("");
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const endpoint = `/api/projects/${encodeURIComponent(projectSlug)}/client-review-recipient`;
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    void fetch(endpoint, { cache: "no-store", signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "이메일을 조회하지 못했습니다.");
      if (signal.aborted) return;
      setEmail(result.email || ""); setSupported(result.supported); setError("");
      setMessage(result.supported ? "" : result.message);
    }).catch((cause) => {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "이메일을 조회하지 못했습니다.");
    }).finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !supported || loading) return;
    const parsed = parseClientReviewRecipientEmail(email);
    if (!parsed.ok) { setError("잘못된 이메일 형식입니다. 254자 이하의 이메일을 입력해 주세요."); setMessage(""); return; }
    saving.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: parsed.email }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "저장하지 못했습니다.");
      setEmail(result.email || ""); setMessage("저장 완료");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { saving.current = false; setBusy(false); }
  }

  return (
    <section aria-label="기관 검토 담당자 이메일" className="my-4 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {readOnly ? <>
        <h4 className="text-sm font-black text-[#092046]">기관 검토 담당자 이메일</h4>
        <p className="mt-2 break-words text-sm text-slate-700 [overflow-wrap:anywhere]">{loading ? "확인 중..." : supported ? email || "이메일 미등록" : "이메일 등록 기능 준비 중"}</p>
        <Link href={`/projects/${projectSlug}/settings`} className="mt-2 inline-block text-sm font-bold text-[#184a88] underline">기본 정보에서 이메일 관리</Link>
      </> : <form noValidate onSubmit={(event) => void save(event)}>
        <label htmlFor="client-review-recipient-email" className="text-sm font-black text-[#092046]">기관 검토 담당자 이메일</label>
        <p id="client-review-recipient-help" className="mt-2 text-xs leading-6 text-slate-600">향후 기관 검토 링크를 받을 주소입니다. 이번 기능에서는 이메일을 발송하지 않습니다. 빈 값으로 저장하면 등록된 이메일을 삭제합니다.</p>
        <input id="client-review-recipient-email" type="email" autoComplete="off" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setMessage(""); }} maxLength={CLIENT_REVIEW_EMAIL_MAX_LENGTH} disabled={loading || busy || !supported} aria-describedby="client-review-recipient-help" aria-invalid={Boolean(error)} placeholder="honggildong@agency.go.kr" className="mt-3 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-base" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={loading || busy || !supported} className="dd-btn dd-btn-primary min-h-11">{busy ? "저장 중..." : "저장"}</button>
          {!loading && supported && !email ? <span className="text-sm text-slate-500">이메일 미등록</span> : null}
        </div>
      </form>}
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-600">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
    </section>
  );
}
