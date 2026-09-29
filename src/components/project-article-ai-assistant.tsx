"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  ArticleAiDraft,
  ArticleAiDraftResponse,
  ArticleAiPhotoApplyInput,
  ArticleAiPhotoAssetInput,
  ArticleAiPhotoSuggestion,
} from "@/lib/article-ai-draft-types";
import {
  findIncompleteContactPhones,
  getArticleContactPhoneStatus,
} from "@/lib/article-contact-phone";
import type { ArticleSourceImportResponse, ArticleSourceKind } from "@/lib/article-source-import-types";
import { getArticlePublicInfoEntries } from "@/lib/article-public-info-fields";
import type { ImportedWordArticle } from "@/lib/word-document-import";

const articleTypeLabels: Record<string, string> = {
  general: "일반형",
  welfare_health: "복지·건강형",
  application_recruitment: "신청·모집형",
  event_festival: "축제·행사형",
  tourism_place: "관광·장소형",
  life_civil: "생활·민원형",
  government_major: "시정·군정 주요소식형",
  local_news: "읍면동·지역소식형",
  emergency: "긴급·안전형",
};

const urgencyLabels: Record<string, string> = {
  normal: "일반",
  time_sensitive: "시한성 정보",
  urgent: "긴급 검토 필요",
};

const blockTypeLabels: Record<string, string> = {
  paragraph: "본문 문단",
  button_group: "행동 버튼",
  video_link: "영상 링크",
  map_link: "지도 링크",
};

type ProjectArticleAiAssistantProps = {
  getCurrentContent: () => string;
  onApplyDraft: (draft: ArticleAiDraft) => boolean;
  onApplyImportedWord: (article: ImportedWordArticle) => boolean;
  onApplyPhotoSuggestions: (photos: ArticleAiPhotoApplyInput[]) => boolean;
  projectSlug: string;
};

type ImportedSourceFile = {
  fileName: string;
  fileSize: number;
  kind: ArticleSourceKind;
  originalCharCount: number;
  truncated: boolean;
  usedCharCount: number;
};

type AiPhotoUploadStatus = "pending" | "uploading" | "uploaded" | "error";

type AiPhotoAsset = {
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  previewUrl: string;
  sourceId: string;
  storagePath: string;
  uploadStatus: AiPhotoUploadStatus;
};

type ProjectFileUploadResponse =
  | {
      bucket: string;
      fileName: string;
      mimeType: string;
      ok: true;
      path: string;
      size: number;
      uploadUrl?: string;
    }
  | { message?: string; ok: false };

const maxPhotoCount = 3;
const maxTotalPhotoBytes = 20 * 1024 * 1024;
const supportedPhotoMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const photoRecommendationLabels: Record<ArticleAiPhotoSuggestion["recommendation"], string> = {
  representative: "대표사진 후보",
  supporting: "보조사진",
  omit: "사용하지 않음",
};

const photoPlacementLabels: Record<ArticleAiPhotoSuggestion["placement"], string> = {
  first_content: "첫 콘텐츠 위치",
  after_paragraph_1: "첫 번째 본문 문단 뒤",
  after_paragraph_2: "두 번째 본문 문단 뒤",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("ko-KR")}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getSupportedPhotoMimeType(file: File) {
  const type = file.type.trim().toLowerCase();
  if (supportedPhotoMimeTypes.has(type)) return type;

  const extension = file.name.split(".").pop()?.trim().toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";

  return "";
}

function readUploadMessage(result: ProjectFileUploadResponse | null, fallback: string) {
  return result && !result.ok && result.message ? result.message : fallback;
}

export function ProjectArticleAiAssistant({
  getCurrentContent,
  onApplyDraft,
  onApplyImportedWord,
  onApplyPhotoSuggestions,
  projectSlug,
}: ProjectArticleAiAssistantProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCounterRef = useRef(0);
  const previewUrlsRef = useRef(new Set<string>());
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<ImportedSourceFile | null>(null);
  const [wordImportedArticle, setWordImportedArticle] = useState<ImportedWordArticle | null>(null);
  const [draft, setDraft] = useState<ArticleAiDraft | null>(null);
  const [photoAssets, setPhotoAssets] = useState<AiPhotoAsset[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isDraftApplied, setIsDraftApplied] = useState(false);
  const [isImportingSource, setIsImportingSource] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  function loadCurrentContent() {
    const content = getCurrentContent().trim();

    if (!content) {
      setError("현재 입력된 기사 내용을 찾지 못했습니다.");
      return;
    }

    if (sourceText.trim() && !window.confirm("현재 원자료 입력 내용을 기사 폼의 내용으로 바꿀까요?")) {
      return;
    }

    setSourceText(content.slice(0, 30_000));
    setSourceFile(null);
    setWordImportedArticle(null);
    setDraft(null);
    setIsDraftApplied(false);
    setError("");
    setMessage("현재 기사 입력 내용을 원자료로 가져왔습니다.");
  }

  async function importSourceFile(file: File | undefined) {
    if (!file) return;

    if (sourceText.trim() && !window.confirm("현재 원자료 내용을 선택한 파일의 내용으로 바꿀까요?")) {
      return;
    }

    setError("");
    setMessage("");
    setDraft(null);
    setIsDraftApplied(false);
    setIsImportingSource(true);

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/project-content/source-import", {
      method: "POST",
      body: formData,
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as ArticleSourceImportResponse | null)
      : null;

    setIsImportingSource(false);

    if (!response?.ok || !result || result.ok !== true) {
      setError(
        result && result.ok === false
          ? result.error === "PDF_TEXT_NOT_FOUND"
            ? `${result.message} 스캔 PDF는 현재 자동 문자 인식을 지원하지 않습니다. 텍스트형 PDF 또는 Word 파일을 사용하거나 원문을 직접 붙여넣어 주세요.`
            : result.message
          : "원자료 파일을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }

    setSourceText(result.source.sourceText);
    setSourceFile({
      fileName: result.source.fileName,
      fileSize: file.size,
      kind: result.source.kind,
      originalCharCount: result.source.originalCharCount,
      truncated: result.source.truncated,
      usedCharCount: result.source.usedCharCount,
    });
    setWordImportedArticle(result.wordArticle ?? null);
    setMessage("파일에서 원문을 가져왔습니다. 내용을 확인하고 필요하면 수정하세요.");
  }

  function addPhotoFiles(files: FileList | null) {
    const selectedFiles = files ? Array.from(files) : [];
    if (selectedFiles.length === 0) return;

    if (photoAssets.length + selectedFiles.length > maxPhotoCount) {
      setError("AI 사진 분석은 한 번에 최대 3장까지 사용할 수 있습니다.");
      return;
    }

    const resolvedFiles = selectedFiles.map((file) => ({ file, mimeType: getSupportedPhotoMimeType(file) }));
    if (resolvedFiles.some(({ mimeType }) => !mimeType)) {
      setError("JPG, PNG, WebP 보도사진을 사용해 주세요.");
      return;
    }

    const totalBytes = photoAssets.reduce((sum, photo) => sum + photo.fileSize, 0)
      + resolvedFiles.reduce((sum, { file }) => sum + file.size, 0);
    if (totalBytes > maxTotalPhotoBytes) {
      setError("AI 사진 분석에 사용할 사진의 전체 용량은 20MB 이하여야 합니다.");
      return;
    }

    const fileKeys = [
      ...photoAssets.map((photo) => `${photo.fileName}:${photo.fileSize}`),
      ...resolvedFiles.map(({ file }) => `${file.name}:${file.size}`),
    ];
    if (new Set(fileKeys).size !== fileKeys.length) {
      setError("이미 분석 대상으로 추가한 사진이 포함되어 있습니다.");
      return;
    }

    const nextPhotos = resolvedFiles.map(({ file, mimeType }) => {
      photoCounterRef.current += 1;
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);

      return {
        file,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        previewUrl,
        sourceId: `photo-${photoCounterRef.current}`,
        storagePath: "",
        uploadStatus: "pending" as const,
      };
    });

    setPhotoAssets((current) => [...current, ...nextPhotos]);
    setDraft(null);
    setSelectedPhotoIds(new Set());
    setIsDraftApplied(false);
    setError("");
    setMessage("보도사진을 분석 대상으로 추가했습니다. AI 초안 생성 시 프로젝트 소재로 먼저 저장됩니다.");
  }

  function removePhoto(sourceId: string) {
    const photo = photoAssets.find((candidate) => candidate.sourceId === sourceId);
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
      previewUrlsRef.current.delete(photo.previewUrl);
    }

    setPhotoAssets((current) => current.filter((candidate) => candidate.sourceId !== sourceId));
    setSelectedPhotoIds((current) => {
      const next = new Set(current);
      next.delete(sourceId);
      return next;
    });
    setDraft(null);
    setIsDraftApplied(false);
    setError("");
    setMessage(photo?.storagePath
      ? "사진을 AI 분석 대상에서 제외했습니다. 이미 저장된 프로젝트 소재는 삭제하지 않았습니다."
      : "사진을 AI 분석 대상에서 제외했습니다.");
  }

  function updatePhoto(sourceId: string, updates: Partial<AiPhotoAsset>) {
    setPhotoAssets((current) => current.map((photo) => (
      photo.sourceId === sourceId ? { ...photo, ...updates } : photo
    )));
  }

  async function uploadPhoto(photo: AiPhotoAsset) {
    if (photo.uploadStatus === "uploaded" && photo.storagePath) {
      return { photo, error: "" };
    }

    updatePhoto(photo.sourceId, { uploadStatus: "uploading" });
    const prepareResponse = await fetch("/api/project-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "prepare",
        fileName: photo.fileName,
        kind: "asset_image",
        mimeType: photo.mimeType,
        projectSlug,
        size: photo.fileSize,
      }),
    }).catch(() => null);
    const prepareResult = prepareResponse
      ? ((await prepareResponse.json().catch(() => null)) as ProjectFileUploadResponse | null)
      : null;

    if (!prepareResponse?.ok || !prepareResult?.ok || !prepareResult.uploadUrl) {
      updatePhoto(photo.sourceId, { uploadStatus: "error" });
      return { photo: null, error: readUploadMessage(prepareResult, `${photo.fileName} 업로드 준비에 실패했습니다.`) };
    }

    const uploadResponse = await fetch(prepareResult.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": prepareResult.mimeType || photo.mimeType },
      body: photo.file,
    }).catch(() => null);

    if (!uploadResponse?.ok) {
      updatePhoto(photo.sourceId, { uploadStatus: "error" });
      return { photo: null, error: `${photo.fileName}을 Supabase Storage에 업로드하지 못했습니다.` };
    }

    const completeResponse = await fetch("/api/project-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        bucket: prepareResult.bucket,
        fileName: prepareResult.fileName || photo.fileName,
        kind: "asset_image",
        mimeType: prepareResult.mimeType || photo.mimeType,
        path: prepareResult.path,
        projectSlug,
        size: prepareResult.size || photo.fileSize,
      }),
    }).catch(() => null);
    const completeResult = completeResponse
      ? ((await completeResponse.json().catch(() => null)) as ProjectFileUploadResponse | null)
      : null;

    if (!completeResponse?.ok || !completeResult?.ok) {
      updatePhoto(photo.sourceId, { uploadStatus: "error" });
      return {
        photo: null,
        error: readUploadMessage(completeResult, `${photo.fileName} 소재 기록 연결에 실패했습니다.`),
      };
    }

    const uploadedPhoto: AiPhotoAsset = {
      ...photo,
      fileName: completeResult.fileName || photo.fileName,
      mimeType: completeResult.mimeType || photo.mimeType,
      fileSize: completeResult.size || photo.fileSize,
      storagePath: completeResult.path,
      uploadStatus: "uploaded",
    };
    updatePhoto(photo.sourceId, uploadedPhoto);
    return { photo: uploadedPhoto, error: "" };
  }

  async function generateDraft() {
    const source = sourceText.trim();

    if (!source) {
      setError("원자료를 먼저 입력해 주세요.");
      return;
    }

    setError("");
    setMessage("");
    setDraft(null);
    setSelectedPhotoIds(new Set());
    setIsDraftApplied(false);
    setIsGenerating(true);

    const uploadedPhotos: AiPhotoAsset[] = [];
    const uploadErrors: string[] = [];

    for (const photo of photoAssets) {
      const result = await uploadPhoto(photo);
      if (result.photo) uploadedPhotos.push(result.photo);
      if (result.error) uploadErrors.push(result.error);
    }

    const photoInputs: ArticleAiPhotoAssetInput[] = uploadedPhotos.map((photo) => ({
      sourceId: photo.sourceId,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      storagePath: photo.storagePath,
    }));

    const response = await fetch("/api/project-content/ai-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceText: source, projectSlug, photoAssets: photoInputs }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as ArticleAiDraftResponse | null)
      : null;

    setIsGenerating(false);

    if (!response?.ok || !result || result.ok !== true) {
      const responseError = result && result.ok === false ? result.message : "AI 초안 생성에 실패했습니다.";
      setError(uploadErrors.length > 0 ? `${uploadErrors.join(" ")} ${responseError}` : responseError);
      return;
    }

    setDraft(result.draft);
    setSelectedPhotoIds(new Set(
      result.draft.photoSuggestions
        .filter((suggestion) => suggestion.recommendation !== "omit")
        .map((suggestion) => suggestion.sourceId),
    ));
    if (uploadErrors.length > 0) {
      setError(uploadErrors.join(" "));
      setMessage("업로드에 성공한 사진만 포함해 AI 제안을 준비했습니다.");
    } else {
      setMessage("AI 제안이 준비되었습니다. 원자료와 사진을 비교한 뒤 입력폼에 적용하세요.");
    }
  }

  function applyDraft() {
    if (!draft || !onApplyDraft(draft)) return;

    setIsDraftApplied(true);
    setError("");
    setMessage("AI 제안을 입력폼에 반영했습니다. 원문과 비교해 사실관계를 확인한 뒤 저장하세요.");
  }

  function applySelectedPhotos() {
    if (!draft) return;

    if (!isDraftApplied) {
      setError("먼저 기사 제안을 적용한 뒤 사진을 배치해 주세요.");
      return;
    }

    const selectedPhotos = draft.photoSuggestions.flatMap((suggestion) => {
      if (!selectedPhotoIds.has(suggestion.sourceId)) return [];

      const photo = photoAssets.find((candidate) => (
        candidate.sourceId === suggestion.sourceId && candidate.storagePath
      ));
      if (!photo) return [];

      return [{
        sourceId: suggestion.sourceId,
        storagePath: photo.storagePath,
        caption: suggestion.caption,
        placement: suggestion.placement,
      } satisfies ArticleAiPhotoApplyInput];
    });

    if (selectedPhotos.length === 0) {
      setError("기사에 적용할 사진을 선택해 주세요.");
      return;
    }

    if (!onApplyPhotoSuggestions(selectedPhotos)) return;

    setError("");
    setMessage("선택한 사진을 기사 이미지 블록에 배치했습니다. 기사 저장 버튼을 눌러야 DB에 반영됩니다.");
  }

  function applyImportedWord() {
    if (!wordImportedArticle || !onApplyImportedWord(wordImportedArticle)) return;

    setError("");
    setMessage("Word 원고를 입력폼에 반영했습니다. 저장 버튼을 눌러야 DB에 저장됩니다.");
  }

  function clearSourceFile() {
    setSourceFile(null);
    setWordImportedArticle(null);
    setDraft(null);
    setIsDraftApplied(false);
    setMessage("파일 연결을 해제했습니다. 추출된 원문은 계속 편집할 수 있습니다.");
  }

  const publicInfoEntries = draft ? getArticlePublicInfoEntries(draft.publicInfo, draft.articleType) : [];
  const incompleteSourcePhones = findIncompleteContactPhones(sourceText);

  return (
    <details className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block text-xs font-black uppercase tracking-wide text-[#184a88]">AI 작성 도우미</span>
          <span className="mt-1 block text-base font-black text-[#092046]">원자료를 모바일 기사 초안으로 정리</span>
        </span>
        <span className="self-start rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">열기</span>
      </summary>

      <div className="mt-5 space-y-4 border-t border-[#d8e8ff] pt-5">
        <section className="rounded-lg border border-[#d8e8ff] bg-white p-4" aria-labelledby="article-source-import-heading">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">1. 원자료 가져오기</p>
          <h3 id="article-source-import-heading" className="mt-1 text-base font-black text-[#092046]">PDF, Word 또는 HWPX 원고 선택</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportingSource || isGenerating}
              className="dd-btn dd-btn-secondary dd-btn-sm"
            >
              {isImportingSource ? "원문을 가져오는 중..." : "PDF / Word / HWPX 파일 선택"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.hwpx,application/hwp+zip,application/vnd.hancom.hwpx,application/x-hwpx"
              className="sr-only"
              disabled={isImportingSource || isGenerating}
              onChange={(event) => {
                void importSourceFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <span className="text-xs font-semibold text-slate-500">PDF · Word(.docx) · HWPX 지원</span>
          </div>

          {sourceFile ? (
            <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-lg bg-[#f7fbff] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#092046]" title={sourceFile.fileName}>{sourceFile.fileName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {sourceFile.kind === "pdf" ? "PDF" : sourceFile.kind === "hwpx" ? "HWPX" : "Word"} · {formatFileSize(sourceFile.fileSize)} · {sourceFile.originalCharCount.toLocaleString("ko-KR")}자 추출
                </p>
              </div>
              <button type="button" onClick={clearSourceFile} className="dd-btn dd-btn-secondary dd-btn-sm self-start">파일 해제</button>
            </div>
          ) : null}

          {sourceFile?.truncated ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-bold leading-5 text-amber-900">
              문서에서 {sourceFile.originalCharCount.toLocaleString("ko-KR")}자를 추출했습니다. 현재 AI 초안에는 최대 {sourceFile.usedCharCount.toLocaleString("ko-KR")}자까지 사용됩니다. 중요한 내용이 뒤쪽에 있다면 원문을 직접 줄여 주세요.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-[#d8e8ff] bg-white p-4" aria-labelledby="article-photo-import-heading">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">2. 사진자료 추가 (선택)</p>
          <h3 id="article-photo-import-heading" className="mt-1 text-base font-black text-[#092046]">
            AI가 함께 살펴볼 보도사진
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isGenerating || photoAssets.length >= maxPhotoCount}
              className="dd-btn dd-btn-secondary dd-btn-sm"
            >
              사진 추가
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              disabled={isGenerating || photoAssets.length >= maxPhotoCount}
              onChange={(event) => {
                addPhotoFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <span className="text-xs font-semibold text-slate-500">
              JPG · PNG · WebP, 최대 3장, 전체 20MB 이하
            </span>
          </div>

          {photoAssets.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {photoAssets.map((photo) => (
                <li key={photo.sourceId} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
                    <Image
                      src={photo.previewUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 240px"
                    />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-black text-[#092046]" title={photo.fileName}>{photo.fileName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {photo.sourceId} · {formatFileSize(photo.fileSize)}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`text-xs font-black ${
                        photo.uploadStatus === "uploaded"
                          ? "text-emerald-700"
                          : photo.uploadStatus === "error"
                            ? "text-rose-700"
                            : "text-slate-500"
                      }`}>
                        {photo.uploadStatus === "uploaded"
                          ? "프로젝트 소재 저장됨"
                          : photo.uploadStatus === "uploading"
                            ? "업로드 중..."
                            : photo.uploadStatus === "error"
                              ? "업로드 실패"
                              : "AI 생성 시 업로드"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.sourceId)}
                        disabled={isGenerating}
                        className="text-xs font-black text-slate-600 underline underline-offset-2 disabled:opacity-50"
                      >
                        분석 대상에서 제외
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold leading-5 text-slate-500">
              사진 없이도 기존 텍스트 중심 AI 초안 생성을 그대로 사용할 수 있습니다.
            </p>
          )}

          <div className="mt-3 space-y-1 text-xs font-semibold leading-5 text-slate-500">
            <p>AI 분석 대상으로 선택한 보도사진은 프로젝트 이미지 소재로 저장되고 사진 내용 분석을 위해 외부 AI API로 전송됩니다.</p>
            <p>기관 제공사진 등 사용 권한과 초상권을 확인한 자료만 사용하고, 개인정보·민감정보가 우려되는 사진은 분석 전에 제외하세요.</p>
          </div>
        </section>

        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">3. 원문 확인</p>
          <label htmlFor="article-ai-source" className="mt-1 block text-sm font-black text-[#092046]">추출된 원문 또는 직접 입력</label>
          <textarea
            id="article-ai-source"
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value.slice(0, 30_000));
              setDraft(null);
              setIsDraftApplied(false);
              setError("");
              setMessage("");
            }}
            maxLength={30_000}
            rows={9}
            placeholder="파일을 선택하거나 보도자료, 공지문, 사업안내, 행사 안내문 등 원문을 붙여넣으세요."
            className="mt-2 min-h-48 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          />
          <div className="mt-2 flex flex-col gap-2 text-xs font-semibold leading-5 text-slate-500 sm:flex-row sm:items-start sm:justify-between">
            <p>PDF·Word·HWPX 원본 파일은 AI에 전송하지 않고 추출된 텍스트만 전송합니다. 직접 입력한 원문도 AI 초안 생성을 누를 때 외부 AI API로 전송되므로 개인정보·민감정보는 필요한 부분을 제거한 뒤 사용하세요.</p>
            <span className="shrink-0 tabular-nums">{sourceText.length.toLocaleString("ko-KR")} / 30,000자</span>
          </div>
          {incompleteSourcePhones.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-black">전화번호 확인 필요</p>
              <p className="mt-1 font-semibold leading-6">
                원자료에서 지역번호가 없는 전화번호가 확인되었습니다. AI가 지역번호를 임의로 추가하지 않습니다. 기사 적용 전에 전체 전화번호를 확인해 주세요.
              </p>
              <p className="mt-2 font-black [overflow-wrap:anywhere]">
                {incompleteSourcePhones.join(", ")}
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-800">확인이 필요한 번호가 있어도 AI 초안 생성은 계속할 수 있습니다.</p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">4. 기사 초안 생성</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={loadCurrentContent} disabled={isGenerating} className="dd-btn dd-btn-secondary dd-btn-sm">
              현재 입력 내용 가져오기
            </button>
            <button type="button" onClick={() => void generateDraft()} disabled={isGenerating} className="dd-btn dd-btn-primary dd-btn-sm">
              {isGenerating ? "공공정보 구조를 분석하고 있습니다..." : "AI 초안 만들기"}
            </button>
            {wordImportedArticle ? (
              <button type="button" onClick={applyImportedWord} disabled={isGenerating} className="dd-btn dd-btn-secondary dd-btn-sm">
                원문 그대로 기사에 적용
              </button>
            ) : null}
          </div>
        </div>

        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
          AI 제안은 원자료 정리 보조용입니다. 날짜·금액·대상·연락처 등 핵심 사실은 반드시 원문과 대조하세요.
        </p>

        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-800">{message}</p> : null}

        {draft ? (
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-label="AI 제안 미리보기">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">AI 제안</p>
                <h3 className="mt-1 text-lg font-black text-[#092046]">저장 전 검수할 기사 초안</h3>
              </div>
              <button type="button" onClick={applyDraft} className="dd-btn dd-btn-primary dd-btn-sm self-start">제안 적용</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <PreviewField label="제목" value={draft.title} />
              <PreviewField label="요약" value={draft.summary} />
              <PreviewField label="기사 유형" value={articleTypeLabels[draft.articleType] ?? draft.articleType} />
              <PreviewField label="관심분야" value={draft.interestTags.join(", ") || "제안 없음"} />
              <PreviewField label="담당 부서·담당자" value={draft.contactName || "원문에서 확인되지 않음"} />
              <PreviewPhoneField value={draft.contactPhone} />
            </div>

            {publicInfoEntries.length > 0 ? (
              <div>
                <p className="text-xs font-black text-[#184a88]">핵심 공공정보</p>
                <dl className="mt-2 grid gap-2 md:grid-cols-2">
                  {publicInfoEntries.map((entry) => (
                    <div key={entry.key} className="rounded-lg bg-[#f7fbff] px-3 py-2">
                      <dt className="text-xs font-black text-slate-500">{entry.label}</dt>
                      <dd className="mt-1 text-sm font-semibold leading-6 text-slate-800 [overflow-wrap:anywhere]">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-black text-[#184a88]">본문 구성</p>
              <ol className="mt-2 space-y-2">
                {draft.blocks.map((block, index) => (
                  <li key={`${block.type}-${index}`} className="rounded-lg border border-slate-200 px-3 py-3">
                    <p className="text-xs font-black text-slate-500">{index + 1}. {blockTypeLabels[block.type] ?? block.type}</p>
                    {block.title ? <p className="mt-1 text-sm font-black text-[#092046]">{block.title}</p> : null}
                    <p className="mt-1 line-clamp-3 text-sm font-medium leading-6 text-slate-700 [overflow-wrap:anywhere]">{block.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            {draft.photoSuggestions.length > 0 ? (
              <div className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">사진 활용 제안</p>
                    <h4 className="mt-1 text-base font-black text-[#092046]">사용할 사진을 사람이 최종 선택</h4>
                  </div>
                  <button type="button" onClick={applySelectedPhotos} className="dd-btn dd-btn-secondary dd-btn-sm self-start">
                    선택 사진 기사에 적용
                  </button>
                </div>
                <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                  {draft.photoSuggestions.map((suggestion) => {
                    const photo = photoAssets.find((candidate) => candidate.sourceId === suggestion.sourceId);
                    if (!photo) return null;

                    const isSelected = selectedPhotoIds.has(suggestion.sourceId);

                    return (
                      <li key={suggestion.sourceId} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="grid min-w-0 gap-3 p-3 sm:grid-cols-[112px_minmax(0,1fr)]">
                          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-200">
                            <Image
                              src={photo.previewUrl}
                              alt=""
                              fill
                              unoptimized
                              className="object-cover"
                              sizes="112px"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="flex cursor-pointer items-start gap-2 text-sm font-black text-[#092046]">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) => {
                                  setSelectedPhotoIds((current) => {
                                    const next = new Set(current);
                                    if (event.target.checked) next.add(suggestion.sourceId);
                                    else next.delete(suggestion.sourceId);
                                    return next;
                                  });
                                }}
                                className="mt-0.5 h-4 w-4 accent-[#184a88]"
                              />
                              기사에 사용
                            </label>
                            <p className="mt-2 text-xs font-black text-[#184a88]">
                              {photoRecommendationLabels[suggestion.recommendation]}
                            </p>
                            <p className="mt-1 truncate text-xs font-semibold text-slate-500" title={photo.fileName}>
                              {photo.fileName}
                            </p>
                          </div>
                        </div>
                        <dl className="space-y-2 border-t border-slate-200 px-3 py-3 text-sm leading-6">
                          <div>
                            <dt className="text-xs font-black text-slate-500">사진설명</dt>
                            <dd className="font-semibold text-slate-800 [overflow-wrap:anywhere]">{suggestion.caption || "제안 없음"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-black text-slate-500">대체텍스트</dt>
                            <dd className="font-semibold text-slate-800 [overflow-wrap:anywhere]">{suggestion.altText || "제안 없음"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-black text-slate-500">권장 위치</dt>
                            <dd className="font-semibold text-slate-800">{photoPlacementLabels[suggestion.placement]}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-black text-slate-500">AI 판단 이유</dt>
                            <dd className="font-semibold text-slate-800 [overflow-wrap:anywhere]">{suggestion.reason || "제안 없음"}</dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                  현재 기사 이미지 블록은 사진설명을 캡션과 이미지 설명에 함께 사용합니다. 별도 대체텍스트 저장은 후속 개선 대상입니다.
                </p>
                {!isDraftApplied ? (
                  <p className="mt-2 text-xs font-black text-amber-800">먼저 기사 제안을 적용한 뒤 사진을 배치해 주세요.</p>
                ) : null}
              </div>
            ) : photoAssets.length > 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                기사에 사용할 사진 제안이 없습니다. 원문과의 관련성 및 사진 품질을 직접 확인해 주세요.
              </p>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-3">
              <PreviewField label="긴급도 제안" value={`${urgencyLabels[draft.suggestedUrgency] ?? draft.suggestedUrgency}${draft.urgencyReason ? ` · ${draft.urgencyReason}` : ""}`} />
              <PreviewList label="확인 필요" values={draft.missingFacts} />
              <PreviewList label="검수 메모" values={draft.reviewNotes} />
            </div>
            <p className="text-xs font-semibold leading-5 text-slate-500">긴급도 제안은 입력폼에 자동 적용되지 않습니다. 노출·우선순위에서 직접 결정하세요.</p>
          </section>
        ) : null}
      </div>
    </details>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold leading-6 text-slate-800 [overflow-wrap:anywhere]">{value || "제안 없음"}</p>
    </div>
  );
}

function PreviewPhoneField({ value }: { value: string }) {
  const status = getArticleContactPhoneStatus(value);

  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-xs font-black text-slate-500">문의 전화</p>
      <p className="mt-1 text-sm font-bold leading-6 text-slate-800 [overflow-wrap:anywhere]">
        {value || "원문에서 확인되지 않음"}
      </p>
      {status === "needs_area_code" ? (
        <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-black text-amber-900">
          지역번호 확인 필요 · AI가 번호를 추측해 보완하지 않았습니다.
        </p>
      ) : null}
    </div>
  );
}

function PreviewList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      {values.length > 0 ? (
        <ul className="mt-1 space-y-1 text-sm font-semibold leading-6 text-slate-800">
          {values.map((value, index) => <li key={`${label}-${index}`}>- {value}</li>)}
        </ul>
      ) : <p className="mt-1 text-sm font-semibold text-slate-500">없음</p>}
    </div>
  );
}
