"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  const [needsReview, setNeedsReview] = useState(false);
  const inFlight = useRef(false);

  async function handleDelete() {
    if (inFlight.current || needsReview) return;
    const confirmed = window.confirm(`"${fileLabel}" 파일을 삭제할까요?`);

    if (!confirmed) {
      return;
    }

    inFlight.current = true;
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

    let keepLocked = false;
    try {
      const response = await fetch(`/api/project-files?${params.toString()}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; outcome?: string } | null;

      if (!response.ok || result?.ok !== true) {
        const uncertain = kind === "audio_mp3" && result?.outcome !== "rejected";
        keepLocked = uncertain;
        setNeedsReview(uncertain);
        setErrorMessage(result?.message ?? (uncertain ? "삭제 결과 확인이 필요합니다. 자동 재시도하지 말고 목록과 DB 상태를 확인해 주세요." : "파일 삭제에 실패했습니다."));
        return;
      }

      router.refresh();
    } catch {
      keepLocked = kind === "audio_mp3";
      setNeedsReview(kind === "audio_mp3");
      setErrorMessage("응답을 받지 못했습니다. 삭제가 취소됐다고 단정할 수 없습니다. 목록과 DB 상태를 확인해 주세요.");
    } finally {
      inFlight.current = keepLocked;
      setIsDeleting(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting || needsReview}
        className="dd-btn dd-btn-danger px-4 py-3 text-sm"
      >
        {isDeleting ? "삭제 중" : needsReview ? "결과 확인 필요" : "삭제"}
      </button>
      {errorMessage ? <p className="max-w-48 text-xs font-bold leading-5 text-rose-700">{errorMessage}</p> : null}
    </div>
  );
}
