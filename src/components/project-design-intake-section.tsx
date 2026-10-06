"use client";

import { useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type {
  ProjectDesignAsset,
  ProjectDesignAssetType,
  ProjectDesignSourceMode,
} from "@/lib/newsletter-repository";

type RequestState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type UploadDraft = {
  file: File | null;
  usageNote: string;
};

const sourceModeOptions: Array<{
  value: Exclude<ProjectDesignSourceMode, null>;
  title: string;
  description: string;
}> = [
  {
    value: "source_available",
    title: "원본 디자인 파일이 있습니다",
    description: "AI, SVG, PSD 등 기존 디자인 원본을 활용해 기관 디자인을 최대한 유지합니다.",
  },
  {
    value: "reference_only",
    title: "원본 디자인 파일이 없습니다",
    description: "PDF, 이미지, 로고 등 기존 자료를 분석해 모바일 Design Kit을 새로 구성합니다.",
  },
];

const nextSteps: Record<Exclude<ProjectDesignSourceMode, null>, string[]> = {
  source_available: ["원본 업로드", "디자인 요소 분리", "모바일 자산 등록", "Design Kit 적용"],
  reference_only: ["PDF·이미지 업로드", "디자인 분석", "Design DNA 생성", "모바일 자산 제작"],
};

const assetLabels: Record<Exclude<ProjectDesignAssetType, "logo">, string> = {
  source_design: "디자인 원본",
  reference: "참고 자료",
};

function makeEmptyUploadDraft(): UploadDraft {
  return { file: null, usageNote: "" };
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toUpperCase() || "FILE";
}

function formatBytes(bytes: number) {
  if (!bytes) return "크기 정보 없음";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("ko-KR")}KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isPreviewableReference(asset: ProjectDesignAsset) {
  return asset.assetType === "reference" && ["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType);
}

function validateFile(file: File, assetType: Exclude<ProjectDesignAssetType, "logo">) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = assetType === "source_design" ? ["ai", "svg", "eps", "psd", "pdf"] : ["pdf", "png", "jpg", "jpeg", "webp"];

  return file.size > 0 && file.size <= 50 * 1024 * 1024 && allowed.includes(extension);
}

export function ProjectDesignIntakeSection({
  assets,
  initialSourceMode,
  projectId,
}: {
  assets: ProjectDesignAsset[];
  initialSourceMode: ProjectDesignSourceMode;
  projectId: string;
}) {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceMode, setSourceMode] = useState<ProjectDesignSourceMode>(initialSourceMode);
  const [designAssets, setDesignAssets] = useState(assets.filter((asset) => asset.assetType !== "logo"));
  const [modeState, setModeState] = useState<RequestState>({
    status: "idle",
    message: initialSourceMode ? "저장된 디자인 자료 준비 방식을 표시합니다." : "기관이 보유한 자료 형태를 먼저 선택하세요.",
  });
  const [assetState, setAssetState] = useState<RequestState>({
    status: "idle",
    message: "원본과 참고자료는 현재 프로젝트 전용 비공개 Storage에 보관합니다.",
  });
  const [uploadDrafts, setUploadDrafts] = useState<Record<Exclude<ProjectDesignAssetType, "logo">, UploadDraft>>({
    source_design: makeEmptyUploadDraft(),
    reference: makeEmptyUploadDraft(),
  });

  async function saveSourceMode() {
    if (!sourceMode) {
      setModeState({ status: "error", message: "디자인 자료 준비 방식을 선택하세요." });
      return;
    }

    setModeState({ status: "saving", message: "디자인 자료 준비 방식을 저장하고 있습니다." });

    const response = await fetch("/api/project-design-kit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, sourceMode }),
    }).catch(() => null);
    const result = response ? ((await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null) : null;

    if (!response?.ok || !result?.ok) {
      setModeState({
        status: "error",
        message: result?.message ?? (response ? "준비 방식을 저장하지 못했습니다." : "저장 요청을 보내지 못했습니다. 네트워크 상태를 확인하세요."),
      });
      return;
    }

    setModeState({ status: "success", message: "디자인 자료 준비 방식을 저장했습니다." });
    router.refresh();
  }

  function updateUploadDraft(assetType: Exclude<ProjectDesignAssetType, "logo">, patch: Partial<UploadDraft>) {
    setUploadDrafts((current) => ({
      ...current,
      [assetType]: { ...current[assetType], ...patch },
    }));
  }

  async function uploadAsset(assetType: Exclude<ProjectDesignAssetType, "logo">) {
    const draft = uploadDrafts[assetType];

    if (!draft.file || !validateFile(draft.file, assetType)) {
      setAssetState({
        status: "error",
        message:
          assetType === "source_design"
            ? "AI, SVG, EPS, PSD, PDF 원본 파일을 50MB 이하로 선택하세요."
            : "PDF, PNG, JPG, WebP 참고자료를 50MB 이하로 선택하세요.",
      });
      return;
    }

    setAssetState({ status: "saving", message: `${assetLabels[assetType]}를 업로드하고 있습니다.` });

    const formData = new FormData();
    formData.set("projectSlug", projectId);
    formData.set("assetType", assetType);
    formData.set("file", draft.file);
    formData.set("name", draft.file.name.replace(/\.[^.]+$/, ""));
    formData.set("usageNote", draft.usageNote);

    const response = await fetch("/api/project-design-kit/assets", {
      method: "POST",
      body: formData,
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { ok?: boolean; assets?: ProjectDesignAsset[]; message?: string } | null)
      : null;

    if (!response?.ok || !result?.ok) {
      setAssetState({
        status: "error",
        message: result?.message ?? (response ? "디자인 자료 업로드에 실패했습니다." : "업로드 요청을 보내지 못했습니다. 네트워크 상태를 확인하세요."),
      });
      return;
    }

    setDesignAssets((result.assets ?? []).filter((asset) => asset.assetType !== "logo"));
    setUploadDrafts((current) => ({ ...current, [assetType]: makeEmptyUploadDraft() }));
    const inputRef = assetType === "source_design" ? sourceInputRef : referenceInputRef;
    if (inputRef.current) inputRef.current.value = "";
    setAssetState({ status: "success", message: result.message ?? "디자인 자료를 등록했습니다." });
    router.refresh();
  }

  async function updateAssetNote(asset: ProjectDesignAsset, usageNote: string) {
    setAssetState({ status: "saving", message: "사용 메모를 저장하고 있습니다." });

    const response = await fetch("/api/project-design-kit/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectSlug: projectId, assetId: asset.id, usageNote }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { ok?: boolean; assets?: ProjectDesignAsset[]; message?: string } | null)
      : null;

    if (!response?.ok || !result?.ok) {
      setAssetState({ status: "error", message: result?.message ?? "사용 메모를 저장하지 못했습니다." });
      return;
    }

    setDesignAssets((result.assets ?? []).filter((item) => item.assetType !== "logo"));
    setAssetState({ status: "success", message: "사용 메모를 저장했습니다." });
  }

  async function deleteAsset(asset: ProjectDesignAsset) {
    if (!window.confirm(`${asset.originalFileName || asset.name} 파일을 삭제하시겠습니까?\nStorage 원본과 자산 기록이 함께 삭제됩니다.`)) {
      return;
    }

    setAssetState({ status: "saving", message: "디자인 자료를 삭제하고 있습니다." });
    const params = new URLSearchParams({ projectSlug: projectId, assetId: asset.id });
    const response = await fetch(`/api/project-design-kit/assets?${params.toString()}`, { method: "DELETE" }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { ok?: boolean; assets?: ProjectDesignAsset[]; message?: string } | null)
      : null;

    if (!response?.ok || !result?.ok) {
      setAssetState({ status: "error", message: result?.message ?? "디자인 자료를 삭제하지 못했습니다." });
      return;
    }

    setDesignAssets((result.assets ?? []).filter((item) => item.assetType !== "logo"));
    setAssetState({ status: "success", message: "디자인 자료를 삭제했습니다." });
    router.refresh();
  }

  const steps = sourceMode ? nextSteps[sourceMode] : [];

  return (
    <div className="mb-5 space-y-5">
      <section className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">1. 디자인 자료 준비</p>
        <h3 className="mt-1 text-xl font-black text-[#092046]">기관이 보유한 디자인 자료를 확인합니다.</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
          원본 보유 여부에 따라 접수할 자료와 이후 제작 흐름이 달라집니다. 아직 선택하지 않은 기존 프로젝트는 언제든 여기서 시작할 수 있습니다.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {sourceModeOptions.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border p-4 transition ${
                sourceMode === option.value ? "border-[#2f73b7] bg-white shadow-sm" : "border-[#d8e8ff] bg-white/70 hover:border-[#80b5ed]"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="design-source-mode"
                  value={option.value}
                  checked={sourceMode === option.value}
                  onChange={() => setSourceMode(option.value)}
                  className="mt-1 h-4 w-4 accent-[#184a88]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#092046]">{option.title}</span>
                  <span className="mt-1 block text-sm font-semibold leading-6 text-slate-500 [word-break:keep-all]">{option.description}</span>
                </span>
              </span>
            </label>
          ))}
        </div>

        {steps.length > 0 ? (
          <div className="mt-4 rounded-lg border border-[#d8e8ff] bg-white p-4">
            <p className="text-sm font-black text-[#092046]">다음 단계</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step} className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#092046] text-xs text-white">{index + 1}</span>
                  <span className="[word-break:keep-all]">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs font-semibold text-slate-500">이번 단계에서는 자료 접수까지만 제공하며 분석·자산 제작은 이후 단계에서 지원합니다.</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-sm font-bold ${modeState.status === "error" ? "text-rose-700" : "text-[#184a88]"}`}>{modeState.message}</p>
          <button type="button" onClick={saveSourceMode} disabled={modeState.status === "saving"} className="dd-btn dd-btn-primary dd-btn-sm">
            {modeState.status === "saving" ? "저장 중..." : "준비 방식 저장"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">디자인 원본·참고자료</p>
        <h3 className="mt-1 text-xl font-black text-[#092046]">기관 디자인 자료 접수</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 [word-break:keep-all]">
          편집 가능한 원본과 제작 방향을 참고할 자료를 구분해 등록합니다. Adobe 또는 Canva 연동은 아직 제공하지 않습니다.
        </p>
        <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-bold ${assetState.status === "error" ? "bg-rose-50 text-rose-700" : "bg-[#f7fbff] text-[#184a88]"}`}>
          {assetState.message}
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <IntakeAssetGroup
            assetType="source_design"
            assets={designAssets.filter((asset) => asset.assetType === "source_design")}
            draft={uploadDrafts.source_design}
            inputRef={sourceInputRef}
            isSaving={assetState.status === "saving"}
            onDraftChange={(patch) => updateUploadDraft("source_design", patch)}
            onUpload={() => uploadAsset("source_design")}
            onDelete={deleteAsset}
            onSaveNote={updateAssetNote}
          />
          <IntakeAssetGroup
            assetType="reference"
            assets={designAssets.filter((asset) => asset.assetType === "reference")}
            draft={uploadDrafts.reference}
            inputRef={referenceInputRef}
            isSaving={assetState.status === "saving"}
            onDraftChange={(patch) => updateUploadDraft("reference", patch)}
            onUpload={() => uploadAsset("reference")}
            onDelete={deleteAsset}
            onSaveNote={updateAssetNote}
          />
        </div>
      </section>
    </div>
  );
}

function IntakeAssetGroup({
  assetType,
  assets,
  draft,
  inputRef,
  isSaving,
  onDraftChange,
  onUpload,
  onDelete,
  onSaveNote,
}: {
  assetType: Exclude<ProjectDesignAssetType, "logo">;
  assets: ProjectDesignAsset[];
  draft: UploadDraft;
  inputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  onDraftChange: (patch: Partial<UploadDraft>) => void;
  onUpload: () => void;
  onDelete: (asset: ProjectDesignAsset) => void;
  onSaveNote: (asset: ProjectDesignAsset, usageNote: string) => void;
}) {
  const isSource = assetType === "source_design";

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-base font-black text-[#092046]">{assetLabels[assetType]}</h4>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        {isSource ? "AI, SVG, EPS, PSD, 편집 가능한 PDF · 최대 50MB" : "PDF, PNG, JPG, WebP · 최대 50MB"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={isSource ? ".ai,.svg,.eps,.psd,.pdf" : ".pdf,.png,.jpg,.jpeg,.webp"}
        onChange={(event) => onDraftChange({ file: event.target.files?.[0] ?? null })}
        className="mt-4 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <input
        value={draft.usageNote}
        onChange={(event) => onDraftChange({ usageNote: event.target.value })}
        placeholder={isSource ? "예: 2026년 기관 CI 원본" : "예: 최근 발행물의 표지·색상 참고"}
        className="mt-3 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
      />
      <button type="button" onClick={onUpload} disabled={isSaving} className="dd-btn dd-btn-primary dd-btn-sm mt-3">
        {isSaving ? "처리 중..." : `${assetLabels[assetType]} 등록`}
      </button>

      <div className="mt-4 space-y-3">
        {assets.map((asset) => (
          <IntakeAssetCard key={asset.id} asset={asset} onDelete={onDelete} onSaveNote={onSaveNote} />
        ))}
        {assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs font-bold text-slate-400">
            등록된 {assetLabels[assetType]}가 없습니다.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IntakeAssetCard({
  asset,
  onDelete,
  onSaveNote,
}: {
  asset: ProjectDesignAsset;
  onDelete: (asset: ProjectDesignAsset) => void;
  onSaveNote: (asset: ProjectDesignAsset, usageNote: string) => void;
}) {
  const [usageNote, setUsageNote] = useState(asset.usageNote);
  const fileName = asset.originalFileName || asset.name;

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {isPreviewableReference(asset) && asset.previewHref ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.previewHref} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-black text-[#184a88]">{getExtension(fileName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-black text-[#092046]">{fileName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {assetLabels[asset.assetType as Exclude<ProjectDesignAssetType, "logo">]} · {asset.mimeType || getExtension(fileName)} · {formatBytes(asset.fileSizeBytes)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-400">등록 {asset.created || "날짜 정보 없음"}</p>
        </div>
      </div>
      <label className="mt-3 block text-xs font-black text-slate-600">
        사용 메모
        <input
          value={usageNote}
          onChange={(event) => setUsageNote(event.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 text-xs font-semibold outline-none focus:border-[#184a88]"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onSaveNote(asset, usageNote)} className="dd-btn dd-btn-secondary dd-btn-sm border-slate-300">
          메모 저장
        </button>
        <button type="button" onClick={() => onDelete(asset)} className="dd-btn dd-btn-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
          삭제
        </button>
      </div>
    </article>
  );
}
