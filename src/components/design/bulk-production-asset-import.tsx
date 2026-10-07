"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  approvalStatusLabels,
  productionAssetLabels,
  productionAssetTypes,
  usageRoleLabels,
} from "@/components/design/design-asset-options";
import type {
  ProjectDesignAsset,
  ProjectDesignAssetApprovalStatus,
  ProjectDesignAssetUsageRole,
  ProjectDesignProductionAssetType,
} from "@/lib/newsletter-repository";

type RequestState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type AssetApiResult = {
  ok?: boolean;
  assets?: ProjectDesignAsset[];
  message?: string;
};

type BulkAssetStatus = "ready" | "uploading" | "success" | "error";

type BulkAssetDraft = {
  id: string;
  file: File;
  assetType: ProjectDesignProductionAssetType | "";
  approvalStatus: ProjectDesignAssetApprovalStatus;
  usageRole: ProjectDesignAssetUsageRole;
  usageNote: string;
  status: BulkAssetStatus;
  message: string;
  previewUrl: string;
  validationMessage: string;
  wasSuggested: boolean;
};

const bulkImportMaxFiles = 20;
const bulkImportMaxFileBytes = 10 * 1024 * 1024;
const bulkImportConcurrency = 3;
const productionFileExtensions = new Set(["svg", "png", "jpg", "jpeg", "webp"]);

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toUpperCase() || "FILE";
}

function getLowercaseExtension(fileName: string) {
  return fileName.split(".").pop()?.trim().toLowerCase() ?? "";
}

function getFileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

function getBulkFileKey(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

function suggestProductionAssetType(fileName: string): ProjectDesignProductionAssetType | "" {
  const normalized = getFileBaseName(fileName).toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ");
  const words = new Set(normalized.split(/\s+/).filter(Boolean));

  if (words.has("icon")) return "icon";
  if (words.has("banner")) return "banner";
  if (words.has("pattern")) return "pattern";
  if (words.has("frame") || words.has("card")) return "card_frame";
  if (words.has("background") || words.has("bg") || words.has("header")) return "background";
  if (words.has("decoration") || words.has("decor")) return "decoration";
  if (words.has("illustration") || words.has("illust")) return "illustration";

  return "";
}

function validateBulkProductionFile(file: File) {
  const extension = getLowercaseExtension(file.name);

  if (!productionFileExtensions.has(extension)) {
    return "SVG, PNG, JPG, WebP 파일만 등록할 수 있습니다.";
  }
  if (file.size <= 0) return "내용이 없는 파일은 등록할 수 없습니다.";
  if (file.size > bulkImportMaxFileBytes) return "파일당 최대 크기 10MB를 초과했습니다.";

  return "";
}

function makeBulkAssetDraft(file: File): BulkAssetDraft {
  const suggestedAssetType = suggestProductionAssetType(file.name);
  const validationMessage = validateBulkProductionFile(file);
  const extension = getLowercaseExtension(file.name);

  return {
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    file,
    assetType: suggestedAssetType,
    approvalStatus: "draft",
    usageRole: "general",
    usageNote: "",
    status: validationMessage ? "error" : "ready",
    message: validationMessage || "등록 대기",
    previewUrl: ["png", "jpg", "jpeg", "webp"].includes(extension) ? URL.createObjectURL(file) : "",
    validationMessage,
    wasSuggested: Boolean(suggestedAssetType),
  };
}

function formatBytes(bytes: number) {
  if (!bytes) return "크기 정보 없음";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("ko-KR")}KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function BulkProductionAssetImport({
  projectId,
  sourceAssets,
  onAssetsChange,
}: {
  projectId: string;
  sourceAssets: ProjectDesignAsset[];
  onAssetsChange: (assets: ProjectDesignAsset[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const [items, setItems] = useState<BulkAssetDraft[]>([]);
  const [parentSourceAssetId, setParentSourceAssetId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>({
    status: "idle",
    message: "업로드 전에 파일별 자산 유형을 확인하세요. 승인 상태는 검토 중으로 시작합니다.",
  });
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const isUploading = items.some((item) => item.status === "uploading");
  const readyCount = items.filter(
    (item) => item.status === "ready" && !item.validationMessage && item.assetType,
  ).length;
  const retryCount = items.filter(
    (item) => item.status === "error" && !item.validationMessage && item.assetType,
  ).length;
  const groupedItems = Array.from(
    items.reduce((groups, item) => {
      const groupKey = getFileBaseName(item.file.name).toLowerCase();
      const group = groups.get(groupKey) ?? [];
      group.push(item);
      groups.set(groupKey, group);
      return groups;
    }, new Map<string, BulkAssetDraft[]>()),
  );

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    },
    [],
  );

  function addFiles(fileList: FileList | File[]) {
    if (isUploading) return;

    const selectedFiles = Array.from(fileList);
    const existingKeys = new Set(items.map((item) => getBulkFileKey(item.file)));
    const uniqueFiles = selectedFiles.filter((file) => {
      const key = getBulkFileKey(file);

      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    const remainingSlots = Math.max(0, bulkImportMaxFiles - items.length);
    const acceptedFiles = uniqueFiles.slice(0, remainingSlots);
    const duplicateCount = selectedFiles.length - uniqueFiles.length;
    const overflowCount = uniqueFiles.length - acceptedFiles.length;

    if (acceptedFiles.length > 0) {
      const nextItems = acceptedFiles.map(makeBulkAssetDraft);
      nextItems.forEach((item) => {
        if (item.previewUrl) previewUrlsRef.current.add(item.previewUrl);
      });
      setItems((current) => [...current, ...nextItems]);
    }

    const notices = [
      acceptedFiles.length > 0 ? `${acceptedFiles.length}개 파일을 등록 대기 목록에 추가했습니다.` : "추가된 파일이 없습니다.",
      duplicateCount > 0 ? `같은 batch의 중복 파일 ${duplicateCount}개는 제외했습니다.` : "",
      overflowCount > 0 ? `최대 ${bulkImportMaxFiles}개를 초과한 ${overflowCount}개는 제외했습니다.` : "",
    ].filter(Boolean);

    setRequestState({ status: overflowCount > 0 ? "error" : "idle", message: notices.join(" ") });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateItem(id: string, patch: Partial<BulkAssetDraft>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.status !== "uploading" && item.status !== "success"
          ? { ...item, ...patch }
          : item,
      ),
    );
  }

  function removeItem(id: string) {
    if (isUploading) return;
    const removedItem = items.find((item) => item.id === id);

    if (removedItem?.previewUrl) {
      URL.revokeObjectURL(removedItem.previewUrl);
      previewUrlsRef.current.delete(removedItem.previewUrl);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function uploadItem(item: BulkAssetDraft) {
    if (!item.assetType) {
      return { ok: false, message: "자산 유형을 선택하세요." };
    }

    const formData = new FormData();
    formData.set("projectSlug", projectId);
    formData.set("assetType", item.assetType);
    formData.set("file", item.file);
    formData.set("name", getFileBaseName(item.file.name));
    formData.set("parentSourceAssetId", parentSourceAssetId);
    formData.set("backgroundMode", "any");
    formData.set("usageRole", item.usageRole);
    formData.set("approvalStatus", item.approvalStatus);
    formData.set("usageNote", item.usageNote);

    const response = await fetch("/api/project-design-kit/assets", {
      method: "POST",
      body: formData,
    }).catch(() => null);
    const result = response ? ((await response.json().catch(() => null)) as AssetApiResult | null) : null;

    if (!response?.ok || !result?.ok) {
      return {
        ok: false,
        message:
          result?.message ??
          (response
            ? "디자인 자산을 등록하지 못했습니다. 파일과 입력 정보를 확인하세요."
            : "업로드 요청을 보내지 못했습니다. 네트워크 상태를 확인하세요."),
      };
    }

    return { ok: true, message: result.message ?? "모바일 제작 자산을 등록했습니다." };
  }

  async function refreshAssets() {
    const response = await fetch(
      `/api/project-design-kit/assets?${new URLSearchParams({ projectSlug: projectId }).toString()}`,
      { cache: "no-store" },
    ).catch(() => null);
    const result = response ? ((await response.json().catch(() => null)) as AssetApiResult | null) : null;

    if (!response?.ok || !result?.ok || !result.assets) return false;
    onAssetsChange(result.assets);
    return true;
  }

  async function runUploads(mode: "ready" | "retry") {
    if (isUploading) return;

    const targetStatus = mode === "ready" ? "ready" : "error";
    const candidates = items.filter(
      (item) => item.status === targetStatus && !item.validationMessage && item.assetType,
    );

    if (candidates.length === 0) {
      setRequestState({
        status: "error",
        message:
          mode === "ready"
            ? "등록 가능한 파일이 없습니다. 파일 형식·크기와 자산 유형을 확인하세요."
            : "다시 시도할 실패 항목이 없습니다.",
      });
      return;
    }

    const candidateIds = new Set(candidates.map((item) => item.id));
    setItems((current) =>
      current.map((item) =>
        candidateIds.has(item.id) ? { ...item, status: "uploading", message: "업로드 중" } : item,
      ),
    );
    setProgress({ completed: 0, total: candidates.length });
    setRequestState({ status: "saving", message: `0 / ${candidates.length}개를 등록하고 있습니다.` });

    let cursor = 0;
    const results: Array<{ id: string; ok: boolean; message: string }> = [];
    const worker = async () => {
      while (cursor < candidates.length) {
        const item = candidates[cursor];
        cursor += 1;
        const result = await uploadItem(item);
        results.push({ id: item.id, ...result });
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  status: result.ok ? "success" : "error",
                  message: result.message,
                }
              : currentItem,
          ),
        );
        setProgress((current) => ({ ...current, completed: current.completed + 1 }));
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(bulkImportConcurrency, candidates.length) }, () => worker()),
    );

    const successCount = results.filter((result) => result.ok).length;
    const failureCount = results.length - successCount;
    const refreshed = successCount > 0 ? await refreshAssets() : true;
    const pendingCount = items.filter(
      (item) => !candidateIds.has(item.id) && item.status !== "success",
    ).length;
    const summary = [
      `성공 ${successCount}개`,
      `실패 ${failureCount}개`,
      pendingCount > 0 ? `미등록 ${pendingCount}개` : "",
      refreshed ? "" : "등록 자산 목록을 새로 불러오지 못했습니다.",
    ].filter(Boolean);

    setRequestState({
      status: failureCount > 0 || !refreshed ? "error" : "success",
      message: summary.join(" · "),
    });
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h4 className="text-base font-black text-[#092046]">디자인 자산 일괄 등록</h4>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            Illustrator에서 내보낸 SVG·PNG·JPG·WebP를 최대 {bulkImportMaxFiles}개까지 검토한 뒤 등록합니다. 파일당 최대 10MB입니다.
          </p>
        </div>
        <label className="text-xs font-black text-slate-600 lg:min-w-72">
          일괄 원본 연결
          <select
            value={parentSourceAssetId}
            onChange={(event) => setParentSourceAssetId(event.target.value)}
            disabled={isUploading}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 disabled:bg-slate-100"
          >
            <option value="">연결 없음</option>
            {sourceAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.originalFileName || asset.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isUploading) setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`mt-4 rounded-lg border-2 border-dashed px-5 py-7 text-center transition ${
          isDragging ? "border-[#2f73b7] bg-[#eaf3ff]" : "border-[#b8d7ff] bg-[#f7fbff]"
        } ${isUploading ? "opacity-60" : ""}`}
      >
        <p className="text-sm font-black text-[#092046]">여러 파일을 이곳에 놓거나 파일 선택을 사용하세요.</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">같은 이름의 SVG·PNG도 자동 삭제하지 않고 각각 등록할 수 있습니다.</p>
        <label className="dd-btn dd-btn-secondary dd-btn-sm mt-4 cursor-pointer border-[#80b5ed]">
          파일 선택
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".svg,.png,.jpg,.jpeg,.webp"
            disabled={isUploading || items.length >= bulkImportMaxFiles}
            onChange={(event) => addFiles(event.target.files ?? [])}
            className="sr-only"
          />
        </label>
      </div>

      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {groupedItems.map(([groupKey, groupItems]) => (
            <section key={groupKey} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              {groupItems.length > 1 ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="break-all text-xs font-black text-[#092046]">{getFileBaseName(groupItems[0].file.name)}</p>
                  <span className="rounded-full bg-[#eaf3ff] px-2.5 py-1 text-[11px] font-black text-[#184a88]">
                    같은 이름의 파일 {groupItems.length}개
                  </span>
                </div>
              ) : null}
              <div className="space-y-3">
                {groupItems.map((item) => (
                  <BulkAssetDraftRow
                    key={item.id}
                    item={item}
                    isUploading={isUploading}
                    parentSourceName={
                      sourceAssets.find((asset) => asset.id === parentSourceAssetId)?.originalFileName ||
                      sourceAssets.find((asset) => asset.id === parentSourceAssetId)?.name ||
                      "연결 없음"
                    }
                    onChange={(patch) => updateItem(item.id, patch)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[#d8e8ff] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`text-sm font-black ${requestState.status === "error" ? "text-rose-700" : "text-[#184a88]"}`}>
            {requestState.message}
          </p>
          {requestState.status === "saving" ? (
            <p className="mt-1 text-xs font-bold text-slate-500">
              {progress.completed} / {progress.total} 완료 · 동시 업로드 최대 {bulkImportConcurrency}개
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {retryCount > 0 ? (
            <button
              type="button"
              onClick={() => void runUploads("retry")}
              disabled={isUploading}
              className="dd-btn dd-btn-secondary dd-btn-sm border-slate-300"
            >
              실패 항목 다시 시도 ({retryCount})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void runUploads("ready")}
            disabled={isUploading || readyCount === 0}
            className="dd-btn dd-btn-primary dd-btn-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "일괄 등록 중..." : `일괄 등록 (${readyCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkAssetDraftRow({
  item,
  isUploading,
  parentSourceName,
  onChange,
  onRemove,
}: {
  item: BulkAssetDraft;
  isUploading: boolean;
  parentSourceName: string;
  onChange: (patch: Partial<BulkAssetDraft>) => void;
  onRemove: () => void;
}) {
  const controlsDisabled = isUploading || item.status === "success";
  const statusClassName =
    item.status === "success"
      ? "bg-emerald-50 text-emerald-700"
      : item.status === "error"
        ? "bg-rose-50 text-rose-700"
        : item.status === "uploading"
          ? "bg-amber-50 text-amber-700"
          : "bg-[#eaf3ff] text-[#184a88]";
  const statusLabel =
    item.status === "success"
      ? "완료"
      : item.status === "error"
        ? "실패"
        : item.status === "uploading"
          ? "업로드 중"
          : "대기";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 gap-3">
        <BulkAssetPreview file={item.file} previewUrl={item.previewUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-all text-sm font-black text-[#092046]">{item.file.name}</p>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClassName}`}>{statusLabel}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {getExtension(item.file.name)} · {formatBytes(item.file.size)} · 원본 {parentSourceName}
          </p>
          {item.validationMessage ? <p className="mt-1 text-xs font-bold text-rose-700">{item.validationMessage}</p> : null}
          {!item.validationMessage && item.message !== "등록 대기" ? (
            <p className={`mt-1 text-xs font-bold ${item.status === "error" ? "text-rose-700" : "text-slate-600"}`}>
              {item.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-black text-slate-600">
          자산 유형
          <select
            value={item.assetType}
            onChange={(event) =>
              onChange({
                assetType: event.target.value as ProjectDesignProductionAssetType | "",
                wasSuggested: false,
                status: item.validationMessage ? "error" : "ready",
                message: item.validationMessage || "등록 대기",
              })
            }
            disabled={controlsDisabled}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 disabled:bg-slate-100"
          >
            <option value="">유형 선택 필요</option>
            {productionAssetTypes.map((value) => (
              <option key={value} value={value}>
                {productionAssetLabels[value]}
              </option>
            ))}
          </select>
          {item.wasSuggested && item.assetType ? <span className="mt-1 block text-[10px] font-bold text-[#184a88]">파일명 기반 제안</span> : null}
        </label>
        <SelectField
          label="사용 위치"
          value={item.usageRole}
          options={Object.entries(usageRoleLabels).map(([value, label]) => ({ value, label }))}
          onChange={(value) => onChange({ usageRole: value as ProjectDesignAssetUsageRole })}
          disabled={controlsDisabled}
        />
        <SelectField
          label="승인 상태"
          value={item.approvalStatus}
          options={Object.entries(approvalStatusLabels).map(([value, label]) => ({ value, label }))}
          onChange={(value) => onChange({ approvalStatus: value as ProjectDesignAssetApprovalStatus })}
          disabled={controlsDisabled}
        />
        <label className="text-xs font-black text-slate-600 sm:col-span-3">
          사용 메모
          <input
            value={item.usageNote}
            onChange={(event) => onChange({ usageNote: event.target.value })}
            disabled={controlsDisabled}
            placeholder="예: 메인 헤더에 사용할 물결 배경"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88] disabled:bg-slate-100"
          />
        </label>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          disabled={isUploading}
          className="dd-btn dd-btn-sm border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {item.status === "success" ? "목록에서 닫기" : "제외"}
        </button>
      </div>
    </article>
  );
}

function BulkAssetPreview({ file, previewUrl }: { file: File; previewUrl: string }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
      {previewUrl ? (
        // Local object URLs are limited to raster formats; SVG is never rendered inline.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs font-black text-[#184a88]">{getExtension(file.name)}</span>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-black text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 disabled:bg-slate-100"
      >
        {options.map((option) => (
          <option key={option.value || "none"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
