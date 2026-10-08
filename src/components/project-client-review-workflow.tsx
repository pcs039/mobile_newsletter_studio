"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectClientReviewRecipient } from "@/components/project-client-review-recipient";
import type { ClientReview } from "@/lib/client-review-repository";
import { ProjectPublishCompletionPanel, type ProjectPublishCompletionPanelProps } from "@/components/project-publish-completion-panel";

type Props = Omit<ProjectPublishCompletionPanelProps, "canPublish" | "onPublishComplete" | "onPublishingChange"> & {
  initialReview: ClientReview | null;
  initialReviewHistory: ClientReview[];
  initialReviewError: string;
  projectStatusCode: string;
};

type ReviewResponse = { ok: boolean; message?: string; review?: ClientReview | null; history?: ClientReview[]; reviewUrl?: string };

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function ProjectClientReviewWorkflow({ initialReview, initialReviewHistory, initialReviewError, projectStatusCode, ...publishProps }: Props) {
  const router = useRouter();
  const [review, setReview] = useState(initialReview);
  const [history, setHistory] = useState(initialReviewHistory);
  const [error, setError] = useState(initialReviewError);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"request" | "cancel" | null>(null);
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasLink, setHasLink] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [now, setNow] = useState(() => Date.now());
  // The raw URL never enters React state, storage, or rendered markup.
  const link = useRef("");
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operation = useRef(false);
  const lookup = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const snapshot = useRef(JSON.stringify(initialReview));
  const endpoint = `/api/projects/${encodeURIComponent(publishProps.projectSlug)}/client-review`;

  const clearLink = useCallback(() => {
    link.current = "";
    if (linkTimer.current) clearTimeout(linkTimer.current);
    linkTimer.current = null;
    setHasLink(false);
  }, []);

  const loadReview = useCallback(async (manual = false) => {
    if (operation.current) return;
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    if (manual) setChecking(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      const result = await response.json() as ReviewResponse;
      if (controller.signal.aborted) return;
      if (!response.ok || !result.ok || result.review === undefined) {
        throw new Error(result.message || "기관 검토 상태를 확인하지 못했습니다.");
      }
      const nextSnapshot = JSON.stringify(result.review);
      if (snapshot.current !== nextSnapshot) {
        clearLink();
        setMessage("");
        snapshot.current = nextSnapshot;
        router.refresh();
      }
      setReview(result.review);
      setHistory(result.history ?? []);
      setError("");
      setNow(Date.now());
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "기관 검토 상태 조회에 실패했습니다.");
      }
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }, [clearLink, endpoint, router]);

  useEffect(() => {
    const refresh = () => { if (!document.hidden) void loadReview(); };
    const visibility = () => { if (document.hidden) clearLink(); else refresh(); };
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
      lookup.current?.abort();
      mutation.current?.abort();
      link.current = "";
      if (linkTimer.current) clearTimeout(linkTimer.current);
    };
  }, [clearLink, loadReview]);

  useEffect(() => {
    if (review?.status !== "pending") return;
    const remaining = new Date(review.expiresAt).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => { setNow(Date.now()); clearLink(); setMessage(""); }, Math.min(remaining, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [clearLink, review]);

  async function mutate(action: "request" | "cancel") {
    if (operation.current) return;
    if (action === "cancel" && !window.confirm("기관 검토 요청을 취소할까요? 기존 링크로 더 이상 검토할 수 없습니다.")) return;
    if (action === "request" && review?.status === "pending" && !window.confirm("검토 링크를 재발급할까요? 기존 링크는 즉시 취소됩니다.")) return;
    operation.current = true;
    lookup.current?.abort();
    setChecking(false);
    setBusy(action);
    setMessage("");
    clearLink();
    const controller = new AbortController();
    mutation.current = controller;
    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        method: action === "request" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(action === "request" ? { body: JSON.stringify({ expiresInDays }) } : {}),
      });
      const result = await response.json() as ReviewResponse;
      if (controller.signal.aborted) return;
      if (!response.ok || !result.ok) throw new Error(result.message || "기관 검토 요청을 처리하지 못했습니다.");
      if (action === "request") {
        if (!result.review || !result.reviewUrl) throw new Error("생성 결과를 확인하지 못했습니다. 상태를 새로고침하세요.");
        setReview(result.review);
        snapshot.current = JSON.stringify(result.review);
        link.current = result.reviewUrl;
        setHasLink(true);
        linkTimer.current = setTimeout(clearLink, 5 * 60_000);
      }
      setError("");
      setMessage(action === "request" ? "검토 링크를 생성했습니다. 지금 복사해 기관 담당자에게 전달하세요." : result.message || "검토 요청을 취소했습니다.");
      router.refresh();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "기관 검토 요청 중 오류가 발생했습니다.");
    } finally {
      operation.current = false;
      if (!controller.signal.aborted) {
        setBusy(null);
        // Reconcile even ambiguous network failures; never retry a mutation automatically.
        void loadReview();
      }
    }
  }

  async function copyLink() {
    if (!link.current) return;
    try {
      await navigator.clipboard.writeText(link.current);
      clearLink();
      setMessage("검토 링크를 복사했습니다. 기관 담당자에게 전달하세요.");
    } catch {
      setMessage("링크를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하고 다시 시도하세요.");
    }
  }

  const expired = review?.status === "pending" && new Date(review.expiresAt).getTime() <= now;
  const status = review?.revokedAt ? "revoked" : expired ? "expired" : review?.status ?? "none";
  const labels = { none: "검토 요청 전", pending: "기관 검토 중", approved: "승인 완료", changes_requested: "기관 수정 요청", revoked: "취소됨", expired: "만료됨" };
  const previousChanges = history.filter((item) => item.id !== review?.id && item.status === "changes_requested");
  const tone = status === "approved" ? "bg-emerald-100 text-emerald-800" : status === "pending" ? "bg-sky-100 text-sky-800" : status === "changes_requested" || status === "expired" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  const disabled = Boolean(busy) || checking || publishing || projectStatusCode === "archived";
  const canPublish = !error && !busy && !checking && status === "approved" && ["in_review", "published"].includes(projectStatusCode);

  return (
    <>
      <article aria-label="기관 검토" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-[#092046]">기관 검토</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">기관 담당자에게 검토 링크를 전달하고, 승인 완료 후 최종 발행하세요.</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${tone}`}>{labels[status]}</span>
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-700">
          {status === "approved" ? "기관 승인 완료. 최종 발행할 수 있습니다." : status === "changes_requested" ? "기관에서 수정 요청했습니다. 기사 작성/편집 화면에서 수정 후 새 검토를 요청하세요." : status === "revoked" ? "검토 요청이 취소되었습니다. 필요하면 새 검토 링크를 생성하세요." : status === "expired" ? "검토 링크가 만료되었습니다. 재발급 후 새 링크를 전달하세요." : status === "pending" ? "기관 검토 중입니다. 응답 상태는 30초마다, 화면으로 돌아올 때 갱신됩니다." : "검토 요청을 생성하면 프로젝트가 검수 중으로 전환됩니다."}
        </p>
        <ProjectClientReviewRecipient key={publishProps.projectSlug} projectSlug={publishProps.projectSlug} readOnly />
        {review ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs font-bold text-slate-500">발급일 (한국 시간)</dt><dd className="mt-1 text-sm font-bold text-[#092046]">{formatDate(review.requestedAt)}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">만료일 (한국 시간)</dt><dd className="mt-1 text-sm font-bold text-[#092046]">{formatDate(review.expiresAt)}</dd></div>
            {review.respondedAt ? <div><dt className="text-xs font-bold text-slate-500">{status === "approved" ? "승인 시각" : status === "changes_requested" ? "수정 요청 시각" : "응답 시각"}</dt><dd className="mt-1 text-sm font-bold text-[#092046]">{formatDate(review.respondedAt)}</dd></div> : null}
            {review.revokedAt ? <div><dt className="text-xs font-bold text-slate-500">취소 시각</dt><dd className="mt-1 text-sm font-bold text-[#092046]">{formatDate(review.revokedAt)}</dd></div> : null}
          </dl>
        ) : null}
        {review?.status === "changes_requested" ? (
          <section aria-label="기관 수정 의견" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-black text-amber-900">수정 의견</h4>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{review.feedback || "별도 수정 의견이 없습니다."}</p>
          </section>
        ) : null}
        {previousChanges.length ? (
          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#092046]">이전 수정 요청 ({previousChanges.length}건)</summary>
            <p className="mt-2 text-xs text-slate-500">최근 20회 검토에서 받은 수정 요청입니다. 새 링크를 발급해도 이전 의견은 보존됩니다.</p>
            <ul className="mt-3 space-y-3">
              {previousChanges.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold text-slate-500">수정 요청: {formatDate(item.respondedAt)} (한국 시간)</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{item.feedback || "별도 수정 의견이 없습니다."}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">새 링크 유효기간
            <select aria-label="새 링크 유효기간" value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))} disabled={disabled} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {[1, 3, 7, 14, 30].map((days) => <option key={days} value={days}>{days}일</option>)}
            </select>
          </label>
          <button type="button" disabled={disabled || Boolean(error)} onClick={() => void mutate("request")} className="dd-btn dd-btn-primary dd-btn-sm">{busy === "request" ? "링크 생성 중..." : review?.status === "pending" ? "링크 재발급" : "기관 검토 요청"}</button>
          {review?.status === "pending" ? <button type="button" disabled={disabled || Boolean(error)} onClick={() => void mutate("cancel")} className="dd-btn dd-btn-secondary dd-btn-sm">{busy === "cancel" ? "취소 중..." : "검토 요청 취소"}</button> : null}
          <button type="button" disabled={disabled} onClick={() => void loadReview(true)} className="dd-btn dd-btn-secondary dd-btn-sm">{checking ? "확인 중..." : "상태 새로고침"}</button>
        </div>
        {status === "pending" && !expired ? (
          <div className="mt-4 rounded-xl bg-sky-50 p-4">
            <button type="button" disabled={!hasLink || disabled} onClick={() => void copyLink()} className="dd-btn dd-btn-secondary dd-btn-sm">검토 링크 복사</button>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{hasLink ? "링크는 생성 후 5분 동안 복사할 수 있습니다. 복사하거나 화면을 떠나면 이 화면에서 제거됩니다." : "기존 링크는 다시 조회할 수 없습니다. 새 링크가 필요하면 재발급하세요."}</p>
          </div>
        ) : null}
        {projectStatusCode === "archived" ? <p className="mt-3 text-sm font-bold text-amber-800">보관된 프로젝트는 검토 요청이나 발행을 진행할 수 없습니다.</p> : null}
        <div aria-live="polite" role="status">{message ? <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-bold leading-6 text-[#184a88]">{message}</p> : null}</div>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-700">{error} 상태 새로고침 후 다시 시도하세요.</p> : null}
      </article>
      <ProjectPublishCompletionPanel key={projectStatusCode} {...publishProps} canPublish={canPublish} onPublishingChange={setPublishing} onPublishComplete={() => { void loadReview(true); router.refresh(); }} />
    </>
  );
}
