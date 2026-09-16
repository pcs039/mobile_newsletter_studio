"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ProjectPublishCompletionPanelProps = {
  currentStatus: string;
  ebookUrl: string;
  hasChecklistIssues: boolean;
  initialPublishedAt?: string;
  isPublished: boolean;
  projectId: string;
  publicUrl: string;
  publicUrlAbsolute: string;
};

type PublishState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "publishing";
      message: string;
    }
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

function formatPublishedAt(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function downloadBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function ProjectPublishCompletionPanel({
  currentStatus,
  ebookUrl,
  hasChecklistIssues,
  initialPublishedAt = "",
  isPublished,
  projectId,
  publicUrl,
  publicUrlAbsolute,
}: ProjectPublishCompletionPanelProps) {
  const [state, setState] = useState<PublishState>({
    status: "idle",
    message: isPublished ? "공개 URL이 활성화되어 있습니다." : "",
  });
  const [published, setPublished] = useState(isPublished);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [currentPublicUrl, setCurrentPublicUrl] = useState(publicUrl);
  const [currentPublicUrlAbsolute, setCurrentPublicUrlAbsolute] = useState(publicUrlAbsolute);
  const [currentEbookUrl, setCurrentEbookUrl] = useState(ebookUrl);
  const qrHref = useMemo(
    () => `/api/qr?value=${encodeURIComponent(currentPublicUrlAbsolute || currentPublicUrl)}`,
    [currentPublicUrl, currentPublicUrlAbsolute],
  );
  const qrFileName = `newsletter-${projectId}-qr.png`;
  const isPublishing = state.status === "publishing";

  async function publishProject() {
    if (hasChecklistIssues) {
      const confirmed = window.confirm(
        "미완료 항목이 있습니다. 발행 후에도 수정할 수 있습니다. 그래도 발행할까요?",
      );

      if (!confirmed) {
        return;
      }
    }

    setState({ status: "publishing", message: "발행 중..." });

    const response = await fetch("/api/project-publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
    });
    const result = (await response.json().catch(() => null)) as
      | {
          ok: true;
          ebookUrl: string;
          ebookUrlAbsolute: string;
          publicUrl: string;
          publicUrlAbsolute: string;
          publishedAt: string;
        }
      | { ok: false; message?: string }
      | null;

    if (!response.ok || !result || result.ok !== true) {
      setState({
        status: "error",
        message: result && result.ok === false ? result.message || "발행 처리에 실패했습니다." : "발행 처리에 실패했습니다.",
      });
      return;
    }

    setPublished(true);
    setPublishedAt(result.publishedAt);
    setCurrentPublicUrl(result.publicUrl);
    setCurrentPublicUrlAbsolute(result.publicUrlAbsolute);
    setCurrentEbookUrl(result.ebookUrl);
    setState({ status: "success", message: "발행 완료. 공개 URL과 QR코드가 활성화되었습니다." });
  }

  async function copyPublicUrl() {
    try {
      await navigator.clipboard.writeText(currentPublicUrlAbsolute || currentPublicUrl);
      setState({ status: "success", message: "공개 URL을 복사했습니다." });
    } catch {
      setState({ status: "error", message: "브라우저에서 URL 복사를 허용하지 않았습니다." });
    }
  }

  async function downloadQrPng() {
    try {
      const response = await fetch(qrHref);
      const svg = await response.text();
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const imageUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("QR 이미지를 불러오지 못했습니다."));
        image.src = imageUrl;
      });

      const canvas = document.createElement("canvas");
      const size = 720;
      const context = canvas.getContext("2d");

      canvas.width = size;
      canvas.height = size;

      if (!context) {
        throw new Error("PNG 변환을 지원하지 않는 브라우저입니다.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      URL.revokeObjectURL(imageUrl);

      canvas.toBlob((blob) => {
        if (!blob) {
          setState({ status: "error", message: "QR PNG 생성에 실패했습니다." });
          return;
        }

        downloadBlob(blob, qrFileName);
        setState({ status: "success", message: "QR PNG를 다운로드했습니다." });
      }, "image/png");
    } catch {
      setState({ status: "error", message: "QR PNG 다운로드에 실패했습니다." });
    }
  }

  return (
    <article className="rounded-2xl border border-[#b8d7ff] bg-[#f7fbff] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">최종 발행</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">발행하기</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
            발행하면 공개 URL과 QR코드가 표시됩니다. 발행 후에도 수정할 수 있으며 공개 URL은 유지됩니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {published ? "발행 완료" : currentStatus || "작성 중"}
            </span>
            {hasChecklistIssues ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800">발행 전 확인 필요</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">발행 가능 상태</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void publishProject()}
          disabled={isPublishing}
          className="dd-btn dd-btn-primary dd-btn-lg shrink-0 rounded-xl px-6 py-4 text-base"
        >
          {isPublishing ? "발행 중..." : published ? "발행 정보 갱신" : "발행하기"}
        </button>
      </div>

      {state.message ? (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold leading-6 ${
            state.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      {published ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-[#184a88]">공개 URL</p>
            <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-3 text-sm font-black leading-6 text-[#092046]">
              {currentPublicUrlAbsolute || currentPublicUrl}
            </p>
            {publishedAt ? (
              <p className="mt-3 text-xs font-bold text-slate-500">발행일시: {formatPublishedAt(publishedAt)}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copyPublicUrl()} className="dd-btn dd-btn-secondary dd-btn-sm">
                URL 복사
              </button>
              <Link href={currentPublicUrl} target="_blank" className="dd-btn dd-btn-secondary dd-btn-sm">
                모바일 보기
              </Link>
              <Link href={currentEbookUrl} target="_blank" className="dd-btn dd-btn-secondary dd-btn-sm">
                PC e-book 보기
              </Link>
              <Link href={`/projects/${projectId}/distribution`} className="dd-btn dd-btn-primary dd-btn-sm">
                배포 관리로 이동
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs font-black text-[#184a88]">QR코드</p>
            <div className="mx-auto mt-3 inline-flex rounded-xl border border-slate-200 bg-white p-3">
              <img src={qrHref} alt="공개 URL QR코드" className="h-36 w-36" />
            </div>
            <button type="button" onClick={() => void downloadQrPng()} className="dd-btn dd-btn-secondary dd-btn-sm mt-3 w-full">
              QR 다운로드
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
