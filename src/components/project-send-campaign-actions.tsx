"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type ProjectSendCampaignActionsProps = {
  campaignId: string;
  projectSlug: string;
  statusCode: string;
};

type ActionState = {
  message: string;
  isError: boolean;
  isSaving: boolean;
};

export function ProjectSendCampaignActions({
  campaignId,
  projectSlug,
  statusCode,
}: ProjectSendCampaignActionsProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>({ message: "", isError: false, isSaving: false });

  async function submit(payload: Record<string, string>) {
    setState({ message: "", isError: false, isSaving: true });

    const response = await fetch("/api/project-distribution", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response) {
      setState({ message: "요청을 보내지 못했습니다.", isError: true, isSaving: false });
      return;
    }

    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setState({ message: result?.message ?? "처리에 실패했습니다.", isError: true, isSaving: false });
      return;
    }

    setState({ message: result.message ?? "처리했습니다.", isError: false, isSaving: false });
    router.refresh();
  }

  function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const status = String(formData.get("status") ?? "");

    void submit({
      action: "updateCampaignStatus",
      projectSlug,
      campaignId,
      status,
    });
  }

  function handleArchiveClick() {
    if (!window.confirm("이 발송 기록을 목록에서 보관 처리할까요?")) {
      return;
    }

    void submit({
      action: "archiveCampaign",
      projectSlug,
      campaignId,
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3">
      <form onSubmit={handleStatusSubmit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_80px]">
        <label className="grid gap-1 text-xs font-black text-[#092046]">
          상태 변경
          <select
            name="status"
            defaultValue={statusCode}
            disabled={state.isSaving}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="draft">초안</option>
            <option value="ready">발송 준비</option>
            <option value="sent">발송 완료</option>
            <option value="failed">발송 실패</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={state.isSaving}
          className="self-end rounded-md bg-[#092046] px-3 py-2 text-xs font-black text-white transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          저장
        </button>
      </form>

      <button
        type="button"
        onClick={handleArchiveClick}
        disabled={state.isSaving}
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        기록 보관
      </button>

      {state.message ? (
        <p
          className={`mt-2 rounded-md px-2 py-2 text-xs font-bold leading-5 ${
            state.isError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
