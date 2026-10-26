"use client";
import { useRef, useState } from "react";
import { shareApprovedSampleLink, type SampleShareTarget } from "@/lib/hwaseong-sample-share";

export function SampleParticipationIcon({ kind }: { kind: "private" | "comment" | "survey" | "share" }) {
  const paths = {
    private: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></>,
    comment: <path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z" />,
    survey: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 9 2 2 5-5M8 16h8" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m9 10 6-4M9 14l6 4" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-5 w-5 shrink-0 align-middle">{paths[kind]}</svg>;
}

export function SampleShareAction({ target, label, compact = false }: { target: SampleShareTarget; label: string; compact?: boolean }) {
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  async function share() {
    if (busy.current || !target.externalUrl) return;
    busy.current = true;
    try {
      const result = await shareApprovedSampleLink(target, navigator);
      setMessage(result === "copied" ? "링크를 복사했습니다." : result === "shared" ? "공유 앱으로 전달했습니다." : "공유를 취소했습니다.");
    } catch { setMessage("공유하지 못했습니다. 브라우저의 공유·클립보드 권한을 확인해 주세요."); }
    finally { busy.current = false; }
  }
  return <div data-swipe-navigation-ignore className="text-slate-700">
    <button type="button" onClick={() => void share()} disabled={!target.externalUrl} title={!target.externalUrl ? "승인된 외부 열람 링크 준비 후 이용할 수 있습니다." : undefined}
      className={compact ? "flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" : "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"}>
      <SampleParticipationIcon kind="share" />{label}
    </button>
    {compact ? null : !target.externalUrl ? <p className="mt-2 text-xs leading-5 text-slate-500">비공개 시연본입니다. 승인된 외부 열람 링크가 준비되면 공유·링크 복사를 사용할 수 있습니다.</p> : <p className="mt-2 text-xs leading-5 text-slate-500">기기의 공유 앱을 이용합니다. 공유 기능이 없으면 링크를 복사합니다.</p>}
    {message ? <p role="status" className={compact ? "sr-only" : "mt-2 text-sm leading-6"}>{message}</p> : null}
  </div>;
}
