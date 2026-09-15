"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectFileUploadKind } from "@/lib/newsletter-file-storage";

type ConversionStatus = "idle" | "loading" | "ready" | "converting" | "success" | "error";
type RenderWidth = 1080 | 1440 | 1920;

type UploadPrepareResult = {
  ok?: boolean;
  bucket?: string;
  fileName?: string;
  message?: string;
  mimeType?: string;
  pageNumber?: number;
  path?: string;
  size?: number;
  uploadUrl?: string;
};

type PageConversionResult = {
  message: string;
  pageNumber: number;
  status: "완료" | "실패";
};

const pdfWorkerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
const pdfCMapUrl = "/pdfjs/cmaps/";
const pdfStandardFontDataUrl = "/pdfjs/standard_fonts/";
const pdfWasmUrl = "/pdfjs/wasm/";
const pdfQualityOptions: Array<{ label: string; width: RenderWidth }> = [
  { label: "표준 1080px", width: 1080 },
  { label: "고품질 1440px", width: 1440 },
  { label: "초고품질 1920px", width: 1920 },
];
const pdfReviewNotice =
  "PDF 구조에 따라 일부 삽화·사진이 누락될 수 있습니다. 변환 후 PC e-book 보기에서 원본과 비교해 확인하세요.";

function getPdfDocumentOptions(data: ArrayBuffer) {
  return {
    cMapPacked: true,
    cMapUrl: pdfCMapUrl,
    data,
    disableFontFace: false,
    enableXfa: true,
    standardFontDataUrl: pdfStandardFontDataUrl,
    useSystemFonts: true,
    wasmUrl: pdfWasmUrl,
  };
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

async function readUploadError(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    return result?.message ?? fallbackMessage;
  }

  return (await response.text().catch(() => "")) || fallbackMessage;
}

function blobFromCanvas(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("페이지 이미지를 생성하지 못했습니다."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function makePageImageFileName(projectSlug: string, pageNumber: number) {
  return `${projectSlug}-page-${String(pageNumber).padStart(3, "0")}.png`;
}

async function uploadProjectFile({
  file,
  kind,
  pageNumber,
  projectSlug,
}: {
  file: File;
  kind: ProjectFileUploadKind;
  pageNumber?: number;
  projectSlug: string;
}) {
  const prepareResponse = await fetch("/api/project-files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "prepare",
      fileName: file.name,
      kind,
      mimeType: file.type,
      pageNumber,
      projectSlug,
      size: file.size,
    }),
  });
  const prepareResult = (await prepareResponse.json().catch(() => null)) as UploadPrepareResult | null;

  if (!prepareResponse.ok || !prepareResult?.ok || !prepareResult.uploadUrl) {
    throw new Error(prepareResult?.message ?? "Supabase Storage 업로드 주소를 준비하지 못했습니다.");
  }

  const uploadResponse = await fetch(prepareResult.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": prepareResult.mimeType || file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(
      await readUploadError(
        uploadResponse,
        `Supabase Storage 직접 업로드에 실패했습니다. (${uploadResponse.status})`,
      ),
    );
  }

  const completeResponse = await fetch("/api/project-files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "complete",
      bucket: prepareResult.bucket,
      fileName: prepareResult.fileName ?? file.name,
      kind,
      mimeType: prepareResult.mimeType ?? file.type,
      pageNumber: prepareResult.pageNumber ?? pageNumber,
      path: prepareResult.path,
      projectSlug,
      size: prepareResult.size ?? file.size,
    }),
  });
  const completeResult = (await completeResponse.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

  if (!completeResponse.ok || !completeResult?.ok) {
    throw new Error(completeResult?.message ?? "파일은 올라갔지만 프로젝트 기록 연결에 실패했습니다.");
  }

  return completeResult.message ?? "업로드가 완료됐습니다.";
}

export function PdfToPageImageConverter({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [renderWidth, setRenderWidth] = useState<RenderWidth>(1440);
  const [status, setStatus] = useState<ConversionStatus>("idle");
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [results, setResults] = useState<PageConversionResult[]>([]);

  async function inspectPdf(nextFile: File | null) {
    setFile(nextFile);
    setPageCount(0);
    setCurrentPage(0);
    setResults([]);

    if (!nextFile) {
      setStatus("idle");
      setMessage("");
      return;
    }

    if (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setStatus("error");
      setMessage("PDF 파일만 선택할 수 있습니다.");
      return;
    }

    setStatus("loading");
    setMessage("PDF 페이지 수를 확인하는 중입니다.");

    try {
      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

      const data = await nextFile.arrayBuffer();
      const pdf = await pdfjs.getDocument(getPdfDocumentOptions(data)).promise;

      setPageCount(pdf.numPages);
      setStatus("ready");
      setMessage(`${pdf.numPages}쪽 PDF입니다. 변환을 시작할 수 있습니다.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "PDF 정보를 확인하지 못했습니다.");
    }
  }

  async function renderPageToFile(pdf: Awaited<ReturnType<Awaited<typeof import("pdfjs-dist")>["getDocument"]>["promise"]>, pageNumber: number) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = renderWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("브라우저 canvas를 초기화하지 못했습니다.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    context.save();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();

    const renderTask = page.render({
      background: "rgb(255, 255, 255)",
      canvas,
      canvasContext: context,
      viewport,
    });

    await renderTask.promise;

    const blob = await blobFromCanvas(canvas);

    canvas.width = 1;
    canvas.height = 1;

    return new File([blob], makePageImageFileName(projectSlug, pageNumber), { type: "image/png" });
  }

  async function convertPdf() {
    if (!file || pageCount < 1) {
      setStatus("error");
      setMessage("먼저 PDF 파일을 선택하세요.");
      return;
    }

    setStatus("converting");
    setMessage("PDF 원본을 Supabase Storage에 저장하는 중입니다.");
    setCurrentPage(0);
    setResults([]);

    try {
      await uploadProjectFile({
        file,
        kind: "pdf_original",
        projectSlug,
      });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "PDF 원본 저장에 실패했습니다.");
      return;
    }

    const nextResults: PageConversionResult[] = [];

    try {
      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

      const data = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(getPdfDocumentOptions(data)).promise;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setCurrentPage(pageNumber);
        setMessage(`${pageNumber} / ${pdf.numPages}쪽 변환 중입니다.`);

        try {
          const pageImageFile = await renderPageToFile(pdf, pageNumber);

          await uploadProjectFile({
            file: pageImageFile,
            kind: "page_image",
            pageNumber,
            projectSlug,
          });

          nextResults.push({ message: `${pageImageFile.name} 저장 완료`, pageNumber, status: "완료" });
        } catch (error) {
          nextResults.push({
            message: error instanceof Error ? error.message : "페이지 변환 또는 업로드 실패",
            pageNumber,
            status: "실패",
          });
        }

        setResults([...nextResults]);
      }

      const failureCount = nextResults.filter((result) => result.status === "실패").length;

      setStatus(failureCount > 0 ? "error" : "success");
      setMessage(
        failureCount > 0
          ? `변환을 마쳤지만 ${failureCount}개 페이지는 실패했습니다. 실패 항목을 확인하세요. ${pdfReviewNotice}`
          : `PDF ${pdf.numPages}쪽을 모두 페이지 이미지로 저장했습니다. ${pdfReviewNotice}`,
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "PDF 변환 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">자동 생성</p>
          <h4 className="mt-1 text-base font-black text-[#092046]">PDF에서 페이지 이미지 자동 생성</h4>
          <p className="mt-2 text-sm leading-6 text-slate-500 [word-break:keep-all]">PDF에서 e-book 페이지 이미지를 생성합니다.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-1">
          {pdfQualityOptions.map((option) => (
            <button
              key={option.width}
              type="button"
              onClick={() => setRenderWidth(option.width)}
              className={`dd-btn dd-btn-sm rounded-md text-xs ${
                renderWidth === option.width ? "dd-btn-primary" : "dd-btn-secondary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-black text-amber-900">작업 안내</summary>
        <p className="mt-2 text-sm font-bold leading-6 text-amber-900">
          고품질 변환은 시간이 더 걸릴 수 있습니다. {pdfReviewNotice}
        </p>
      </details>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => {
          void inspectPdf(event.target.files?.[0] ?? null);
        }}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "converting"}
          className="dd-btn dd-btn-secondary h-11 px-5 text-sm"
        >
          PDF 선택
        </button>
        <button
          type="button"
          onClick={() => {
            void convertPdf();
          }}
          disabled={!file || pageCount < 1 || status === "converting"}
          className="dd-btn dd-btn-primary h-11 px-5 text-sm disabled:bg-slate-400"
        >
          {status === "converting" ? "변환 중" : "변환 시작"}
        </button>
      </div>

      {file ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-black text-[#092046]">{file.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {formatFileSize(file.size)} · {pageCount > 0 ? `총 ${pageCount}쪽` : "페이지 수 확인 중"}
          </p>
        </div>
      ) : null}

      {status === "converting" && pageCount > 0 ? (
        <div className="mt-4 rounded-lg border border-sky-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-black text-[#184a88]">
              {currentPage} / {pageCount}쪽 변환 중
            </p>
            <p className="text-xs font-bold text-slate-500">{Math.round((currentPage / pageCount) * 100)}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#2f73b7]" style={{ width: `${(currentPage / pageCount) * 100}%` }} />
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold leading-6 ${
            status === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : status === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-sky-200 bg-white text-[#184a88]"
          }`}
        >
          {message}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {results.map((result) => (
            <div key={result.pageNumber} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div>
                <p className="text-sm font-black text-[#092046]">{result.pageNumber}쪽</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{result.message}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                  result.status === "완료" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {result.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
