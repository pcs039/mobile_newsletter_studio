"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectFileUploadKind } from "@/lib/newsletter-file-storage";

type UploadStatus = "idle" | "selected" | "uploading" | "success" | "error";

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-lg bg-[#092046] px-5 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:bg-[#0f3a78] disabled:cursor-not-allowed disabled:bg-slate-400";

const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-lg border border-[#2f73b7] bg-white px-5 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]";

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

export function FileUploadCard({
  accept,
  buttonLabel,
  description,
  kind,
  projectSlug,
  title,
}: {
  accept: string;
  buttonLabel: string;
  description: string;
  kind: ProjectFileUploadKind;
  projectSlug: string;
  title: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");
  const [file, setFile] = useState<File | null>(null);
  const [pageNumber, setPageNumber] = useState("1");
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
  }, []);

  function chooseFile(nextFile: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }

    if (nextFile && (nextFile.type.startsWith("image/") || nextFile.type.startsWith("audio/"))) {
      previewUrlRef.current = URL.createObjectURL(nextFile);
      setPreviewUrl(previewUrlRef.current);
    } else {
      setPreviewUrl("");
    }

    setFile(nextFile);
    setStatus(nextFile ? "selected" : "idle");
    setMessage(nextFile ? "파일이 선택됐습니다. 업로드 버튼을 눌러 저장하세요." : "");
  }

  async function uploadFile() {
    if (!file) {
      setStatus("error");
      setMessage("먼저 파일을 선택하세요.");
      return;
    }

    const body = new FormData();
    body.append("projectSlug", projectSlug);
    body.append("kind", kind);
    body.append("file", file);

    if (kind === "page_image") {
      body.append("pageNumber", pageNumber);
    }

    setStatus("uploading");
    setMessage("파일을 Supabase Storage에 업로드하는 중입니다.");

    const response = await fetch("/api/project-files", {
      method: "POST",
      body,
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

    if (!response.ok || !result?.ok) {
      setStatus("error");
      setMessage(result?.message ?? "파일 업로드에 실패했습니다.");
      return;
    }

    setStatus("success");
    setMessage(result.message ?? "파일 업로드가 완료됐습니다.");
  }

  return (
    <div
      className="rounded-lg border-2 border-dashed border-sky-200 bg-[#f4f8ff] px-5 py-8 text-center"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        chooseFile(event.dataTransfer.files[0] ?? null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
      />

      <p className="text-base font-bold text-[#092046]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

      {kind === "page_image" && (
        <label className="mx-auto mt-4 flex max-w-44 items-center justify-center gap-2 text-sm font-bold text-[#092046]">
          <span>페이지</span>
          <input
            type="number"
            min="1"
            value={pageNumber}
            onChange={(event) => setPageNumber(event.target.value)}
            className="h-10 w-20 rounded-md border border-slate-300 bg-white px-3 text-center text-sm font-bold"
          />
        </label>
      )}

      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" className={secondaryButtonClass} onClick={() => inputRef.current?.click()}>
          {buttonLabel}
        </button>
        <button type="button" className={primaryButtonClass} onClick={uploadFile} disabled={status === "uploading"}>
          {status === "uploading" ? "업로드 중" : "Supabase에 업로드"}
        </button>
      </div>

      {file && (
        <div className="mx-auto mt-5 max-w-xl rounded-lg border border-slate-300 bg-white p-4 text-left">
          <p className="text-sm font-black text-[#092046]">{file.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {file.type || "파일 형식 미확인"} · {formatFileSize(file.size)}
          </p>
          {previewUrl && file.type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="선택한 이미지 미리보기" className="mt-3 max-h-56 w-full rounded-md object-contain" />
          )}
          {previewUrl && file.type.startsWith("audio/") && (
            <audio className="mt-3 h-10 w-full" controls preload="metadata" src={previewUrl} />
          )}
        </div>
      )}

      {message && (
        <p
          className={`mx-auto mt-4 max-w-xl rounded-lg px-4 py-3 text-sm font-bold ${
            status === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : status === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-sky-200 bg-white text-[#184a88]"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
