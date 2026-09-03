"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ProjectDistributionGroup } from "@/lib/newsletter-repository";

type ProjectDistributionFormProps = {
  groups: ProjectDistributionGroup[];
  projectSlug: string;
  publicUrl: string;
};

type SubmitState = {
  target: "group" | "campaign" | null;
  message: string;
  isError: boolean;
};

function getText(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

export function ProjectDistributionForm({ groups, projectSlug, publicUrl }: ProjectDistributionFormProps) {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>({ target: null, message: "", isError: false });

  async function submitPayload(target: SubmitState["target"], payload: Record<string, string | number>) {
    setSubmitState({ target, message: "", isError: false });

    const response = await fetch("/api/project-distribution", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!response) {
      setSubmitState({
        target: null,
        message: "저장 요청을 보내지 못했습니다. 네트워크 상태를 확인하세요.",
        isError: true,
      });
      return false;
    }

    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setSubmitState({
        target: null,
        message: result?.message ?? "저장에 실패했습니다.",
        isError: true,
      });
      return false;
    }

    setSubmitState({
      target: null,
      message: result.message ?? "저장했습니다.",
      isError: false,
    });
    router.refresh();
    return true;
  }

  async function handleGroupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const saved = await submitPayload("group", {
      action: "createGroup",
      projectSlug,
      name: getText(formData, "name"),
      description: getText(formData, "description"),
      recipientCount: Number(getText(formData, "recipientCount")) || 0,
      channelNote: getText(formData, "channelNote"),
    });

    if (saved) {
      form.reset();
    }
  }

  async function handleCampaignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const targetGroupId = getText(formData, "targetGroupId");
    const selectedGroup = groups.find((group) => group.id === targetGroupId);
    const saved = await submitPayload("campaign", {
      action: "createCampaign",
      projectSlug,
      channel: getText(formData, "channel"),
      targetGroupId,
      targetGroupName: selectedGroup?.name ?? getText(formData, "targetGroupName"),
      messageTitle: getText(formData, "messageTitle"),
      publicUrl: getText(formData, "publicUrl") || publicUrl,
      status: getText(formData, "status"),
      sentAt: getText(formData, "sentAt"),
      note: getText(formData, "note"),
    });

    if (saved) {
      form.reset();
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={handleGroupSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">대상 관리</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">수신 대상 그룹 추가</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
            기관 담당자가 제공한 발송 대상 묶음을 기록합니다. 실제 연락처 파일은 별도 보관하고, 여기에는 운영용 요약을 남깁니다.
          </p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            그룹명 *
            <input
              name="name"
              required
              placeholder="예: 무안군 기관·단체장"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            예상 수신자 수
            <input
              name="recipientCount"
              type="number"
              min="0"
              placeholder="예: 350"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            설명
            <textarea
              name="description"
              rows={3}
              placeholder="예: 발행 안내 문자와 QR 안내문을 받을 주요 배포 대상"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            채널 메모
            <input
              name="channelNote"
              placeholder="예: 카카오 알림톡 우선, 미수신자는 SMS"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitState.target !== null}
          className="mt-5 w-full rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitState.target === "group" ? "저장 중" : "대상 그룹 저장"}
        </button>
      </form>

      <form onSubmit={handleCampaignSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">발송 기록</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">발송·공유 기록 추가</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
            실제 발송 시스템과 연결하기 전까지는 운영자가 발송 내역을 직접 기록합니다. 나중에 자동 연동 로그로 확장할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              채널
              <select
                name="channel"
                defaultValue="kakao"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              >
                <option value="kakao">카카오 알림톡</option>
                <option value="sms">문자</option>
                <option value="email">이메일</option>
                <option value="qr">QR·인쇄물</option>
                <option value="manual">직접 공유</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#092046]">
              상태
              <select
                name="status"
                defaultValue="ready"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
              >
                <option value="draft">초안</option>
                <option value="ready">발송 준비</option>
                <option value="sent">발송 완료</option>
                <option value="failed">발송 실패</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            대상 그룹
            <select
              name="targetGroupId"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">대상 그룹 미지정</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <input name="targetGroupName" type="hidden" />
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            발송 제목 *
            <input
              name="messageTitle"
              required
              placeholder="예: 2026년 9월 무안소식 모바일판 공개 안내"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            공개 URL
            <input
              name="publicUrl"
              defaultValue={publicUrl}
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            발송 일시
            <input
              name="sentAt"
              type="datetime-local"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#092046]">
            운영 메모
            <textarea
              name="note"
              rows={3}
              placeholder="예: 기관 담당자 확인 후 오전 10시 발송 예정"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitState.target !== null}
          className="mt-5 w-full rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitState.target === "campaign" ? "저장 중" : "발송 기록 저장"}
        </button>
      </form>

      {submitState.message ? (
        <p
          className={`xl:col-span-2 rounded-lg px-4 py-3 text-sm font-bold leading-6 ${
            submitState.isError ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {submitState.message}
        </p>
      ) : null}
    </div>
  );
}
