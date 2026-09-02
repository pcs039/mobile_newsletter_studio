"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectArchiveButton({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleArchive() {
    const confirmed = window.confirm(`"${projectTitle}" 프로젝트를 보관 처리할까요?`);

    if (!confirmed) {
      return;
    }

    setIsArchiving(true);
    setErrorMessage("");

    const response = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
    const result = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setIsArchiving(false);
      setErrorMessage(result?.message ?? "프로젝트 보관 처리에 실패했습니다.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        onClick={handleArchive}
        disabled={isArchiving}
        className="inline-flex h-8 items-center justify-center rounded-md border border-rose-300 bg-rose-50 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {isArchiving ? "보관 중" : "보관"}
      </button>
      {errorMessage && <p className="mt-1 px-2 text-[11px] font-semibold leading-4 text-rose-600">{errorMessage}</p>}
    </div>
  );
}
