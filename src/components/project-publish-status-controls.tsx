"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProjectPublishStatusControlsProps = {
  projectId: string;
  currentStatus: string;
  isReady: boolean;
};

const statusOptions = [
  {
    label: "검수 중으로 변경",
    status: "in_review",
    tone: "border-[#2f73b7] bg-white text-[#092046] hover:bg-[#eaf3ff]",
  },
  {
    label: "비공개로 전환",
    status: "private",
    tone: "border-slate-300 bg-white text-slate-700 hover:border-[#184a88] hover:bg-[#f4f8ff]",
  },
  {
    label: "발행 완료 처리",
    status: "published",
    tone: "border-[#092046] bg-[#092046] text-white shadow-sm hover:bg-[#123a78]",
  },
] as const;

export function ProjectPublishStatusControls({
  projectId,
  currentStatus,
  isReady,
}: ProjectPublishStatusControlsProps) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function updateStatus(status: (typeof statusOptions)[number]["status"]) {
    if (status === "published" && !isReady) {
      const confirmed = window.confirm(
        "아직 모든 발행 준비 항목이 완료되지 않았습니다. 그래도 발행 완료로 변경할까요?",
      );

      if (!confirmed) {
        return;
      }
    }

    setPendingStatus(status);
    setMessage("");
    setIsError(false);

    const response = await fetch("/api/projects", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "updateStatus",
        projectId,
        status,
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setPendingStatus(null);
      setIsError(true);
      setMessage(result?.message ?? "공개 상태 변경에 실패했습니다.");
      return;
    }

    setPendingStatus(null);
    setMessage("공개 상태를 저장했습니다.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-slate-600 [word-break:keep-all]">
        현재 상태: <strong className="text-[#092046]">{currentStatus}</strong>
      </p>
      <div className="grid gap-2">
        {statusOptions.map((option) => (
          <button
            key={option.status}
            type="button"
            onClick={() => updateStatus(option.status)}
            disabled={pendingStatus !== null}
            className={`w-full rounded-lg border px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${option.tone}`}
          >
            {pendingStatus === option.status ? "저장 중" : option.label}
          </button>
        ))}
      </div>
      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-xs font-bold leading-5 ${
            isError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
