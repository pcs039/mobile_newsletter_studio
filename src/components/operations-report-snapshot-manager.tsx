"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AnalyticsPeriod } from "@/lib/article-analytics-types";
import type { AiOperationsCommentary } from "@/lib/ai-operations-commentary";
import type { OperationsReportSnapshotSummary } from "@/lib/operations-report-snapshot";

type SnapshotStatus = "idle" | "loading" | "saving" | "success" | "error";

type SnapshotContextValue = {
  aiCommentary: AiOperationsCommentary | null;
  listMessage: string;
  listStatus: SnapshotStatus;
  period: AnalyticsPeriod;
  projectId: string;
  saveMessage: string;
  saveSnapshot: () => Promise<void>;
  saveStatus: SnapshotStatus;
  setAiCommentary: (commentary: AiOperationsCommentary | null) => void;
  snapshots: OperationsReportSnapshotSummary[];
};

const OperationsReportSnapshotContext = createContext<SnapshotContextValue | null>(null);

type SnapshotListResponse =
  | { ok: true; snapshots: OperationsReportSnapshotSummary[] }
  | { error?: string; message: string; ok: false };

type SnapshotSaveResponse =
  | { message: string; ok: true; snapshot: OperationsReportSnapshotSummary }
  | { error?: string; message: string; ok: false };

export function OperationsReportSnapshotProvider({
  children,
  period,
  projectId,
}: {
  children: ReactNode;
  period: AnalyticsPeriod;
  projectId: string;
}) {
  const [aiCommentary, setAiCommentary] = useState<AiOperationsCommentary | null>(null);
  const [snapshots, setSnapshots] = useState<OperationsReportSnapshotSummary[]>([]);
  const [listStatus, setListStatus] = useState<SnapshotStatus>("loading");
  const [listMessage, setListMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<SnapshotStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/projects/${encodeURIComponent(projectId)}/analytics/snapshots`, {
      cache: "no-store",
    }).then(async (response) => {
      const result = (await response.json().catch(() => null)) as SnapshotListResponse | null;
      if (cancelled) return;

      if (!response.ok || !result || result.ok !== true) {
        setSnapshots([]);
        setListStatus("error");
        setListMessage(
          result && result.ok === false
            ? result.message
            : "저장된 운영 리포트 목록을 불러오지 못했습니다.",
        );
        return;
      }

      setSnapshots(result.snapshots);
      setListStatus("success");
    }).catch(() => {
      if (cancelled) return;
      setSnapshots([]);
      setListStatus("error");
      setListMessage("저장된 운영 리포트 목록을 불러오지 못했습니다.");
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const saveSnapshot = useCallback(async () => {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveMessage("");

    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/analytics/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentary: aiCommentary, period }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as SnapshotSaveResponse | null)
      : null;

    if (!response?.ok || !result || result.ok !== true) {
      setSaveStatus("error");
      setSaveMessage(
        result && result.ok === false
          ? result.message
          : "현재 운영 리포트를 저장하지 못했습니다.",
      );
      return;
    }

    setSaveStatus("success");
    setSaveMessage(result.message);
    setListStatus("success");
    setListMessage("");
    setSnapshots((current) => [result.snapshot, ...current.filter((item) => item.id !== result.snapshot.id)].slice(0, 10));
  }, [aiCommentary, period, projectId, saveStatus]);

  const value = useMemo<SnapshotContextValue>(() => ({
    aiCommentary,
    listMessage,
    listStatus,
    period,
    projectId,
    saveMessage,
    saveSnapshot,
    saveStatus,
    setAiCommentary,
    snapshots,
  }), [aiCommentary, listMessage, listStatus, period, projectId, saveMessage, saveSnapshot, saveStatus, snapshots]);

  return (
    <OperationsReportSnapshotContext.Provider value={value}>
      {children}
    </OperationsReportSnapshotContext.Provider>
  );
}

export function useOperationsReportSnapshot() {
  return useContext(OperationsReportSnapshotContext);
}

export function OperationsReportSnapshotSaveButton() {
  const context = useOperationsReportSnapshot();
  if (!context) return null;

  return (
    <div className="flex flex-col items-start gap-1" data-print-control>
      <button
        type="button"
        className="dd-btn dd-btn-secondary dd-btn-lg text-sm"
        disabled={context.saveStatus === "saving"}
        onClick={() => void context.saveSnapshot()}
      >
        {context.saveStatus === "saving" ? "리포트 저장 중..." : "현재 리포트 저장"}
      </button>
      {context.saveMessage ? (
        <p
          className={`max-w-[260px] text-xs font-bold leading-5 ${context.saveStatus === "error" ? "text-amber-800" : "text-[#184a88]"}`}
          aria-live="polite"
        >
          {context.saveMessage}
        </p>
      ) : null}
    </div>
  );
}

function formatSnapshotDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function OperationsReportSnapshotList() {
  const context = useOperationsReportSnapshot();
  if (!context) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" data-print-control>
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">운영 이력</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">저장된 운영 리포트</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
          저장 시점의 집계 결과를 고정해 보관합니다. 같은 기간도 여러 번 저장할 수 있습니다.
        </p>
      </div>

      {context.listStatus === "loading" ? (
        <p className="px-5 py-8 text-center text-sm font-bold text-slate-500">저장 이력을 불러오는 중입니다.</p>
      ) : context.listStatus === "error" ? (
        <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold leading-6 text-amber-900 sm:m-5">
          {context.listMessage}
          <p className="mt-1 text-xs font-semibold">현재 실시간 운영 통계에는 영향이 없습니다.</p>
        </div>
      ) : context.snapshots.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-black text-[#092046]">아직 저장된 운영 리포트가 없습니다.</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">상단의 현재 리포트 저장 버튼으로 첫 이력을 남길 수 있습니다.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {context.snapshots.map((snapshot) => (
            <article key={snapshot.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-[#092046] [overflow-wrap:anywhere]">{snapshot.title}</h3>
                  <span className="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-[11px] font-black text-[#184a88]">{snapshot.periodLabel}</span>
                  {snapshot.hasAiCommentary ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">AI 해설 포함</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatSnapshotDate(snapshot.createdAt)} · {snapshot.periodStart && snapshot.periodEnd ? `${snapshot.periodStart} ~ ${snapshot.periodEnd}` : "전체 누적"} · 저장자 {snapshot.createdBy}
                </p>
              </div>
              <Link
                href={`/projects/${context.projectId}/analytics/snapshots/${snapshot.id}`}
                className="dd-btn dd-btn-secondary dd-btn-sm shrink-0 self-start sm:self-center"
              >
                저장본 보기
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
