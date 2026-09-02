"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectFileUploadKind } from "@/lib/newsletter-file-storage";

type ProjectFileDeleteButtonProps = {
  fileLabel: string;
  kind: ProjectFileUploadKind;
  path: string;
  projectSlug: string;
  recordId?: string;
};

export function ProjectFileDeleteButton({
  fileLabel,
  kind,
  path,
  projectSlug,
  recordId,
}: ProjectFileDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(`"${fileLabel}" 파일을 삭제할까요?`);

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");

    const params = new URLSearchParams({
      kind,
      path,
      projectSlug,
    });

    if (recordId) {
      params.set("recordId", recordId);
    }

    const response = await fetch(`/api/project-files?${params.toString()}`, {
      method: "DELETE",
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setErrorMessage(result?.message ?? "파일 삭제에 실패했습니다.");
      setIsDeleting(false);
      return;
    }

    router.refresh();
    setIsDeleting(false);
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 transition hover:border-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "삭제 중" : "삭제"}
      </button>
      {errorMessage ? <p className="max-w-48 text-xs font-bold leading-5 text-rose-700">{errorMessage}</p> : null}
    </div>
  );
}
