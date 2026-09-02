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
    <div>
      <button
        type="button"
        onClick={handleArchive}
        disabled={isArchiving}
        className="w-full rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {isArchiving ? "보관 중" : "보관"}
      </button>
      {errorMessage && <p className="mt-1 px-2 text-[11px] font-semibold leading-4 text-rose-600">{errorMessage}</p>}
    </div>
  );
}
