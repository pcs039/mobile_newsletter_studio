"use client";

import { useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { BulkProductionAssetImport } from "@/components/design/bulk-production-asset-import";
import {
  approvalStatusLabels,
  productionAssetLabels,
  productionAssetTypes,
  usageRoleLabels,
} from "@/components/design/design-asset-options";
import {
  assetSourceLabels, assetUsageTagLabels, assetReuseScopeLabels, assetTransparencyLabels,
  defaultDesignAssetMetadata, designAssetClassification, type DesignAssetMetadata,
} from "@/lib/design-asset-metadata";
import type {
  ProjectDesignAsset,
  ProjectDesignAssetApprovalStatus,
  ProjectDesignAssetBackgroundMode,
  ProjectDesignAssetUsageRole,
  ProjectDesignProductionAssetType,
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

type IntakeAssetType = "source_design" | "reference";

type ProductionUploadDraft = {
  metadata: DesignAssetMetadata | null;
  file: File | null;
  name: string;
  assetType: ProjectDesignProductionAssetType;
  parentSourceAssetId: string;
  backgroundMode: ProjectDesignAssetBackgroundMode;
  usageRole: ProjectDesignAssetUsageRole;
  approvalStatus: ProjectDesignAssetApprovalStatus;
  usageNote: string;
};

type AssetApiResult = {
  ok?: boolean;
  assets?: ProjectDesignAsset[];
  message?: string;
  warning?: string;
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

const assetLabels: Record<IntakeAssetType, string> = {
  source_design: "디자인 원본",
  reference: "참고 자료",
};

const backgroundModeLabels: Record<ProjectDesignAssetBackgroundMode, string> = {
  light: "밝은 배경",
  dark: "어두운 배경",
  any: "배경 무관",
};

function makeEmptyUploadDraft(): UploadDraft {
  return { file: null, usageNote: "" };
}

function makeEmptyProductionUploadDraft(): ProductionUploadDraft {
  return {
    metadata: defaultDesignAssetMetadata(),
    file: null,
    name: "",
    assetType: "background",
    parentSourceAssetId: "",
    backgroundMode: "any",
    usageRole: "general",
    approvalStatus: "draft",
    usageNote: "",
  };
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toUpperCase() || "FILE";
}

function formatBytes(bytes: number) {
  if (!bytes) return "크기 정보 없음";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("ko-KR")}KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isPreviewableImage(asset: ProjectDesignAsset) {
  return ["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType);
}

function validateIntakeFile(file: File, assetType: IntakeAssetType) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = assetType === "source_design" ? ["ai", "svg", "eps", "psd", "pdf"] : ["pdf", "png", "jpg", "jpeg", "webp"];

  return file.size > 0 && file.size <= 50 * 1024 * 1024 && allowed.includes(extension);
}

function validateProductionFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  return file.size > 0 && file.size <= 10 * 1024 * 1024 && ["svg", "png", "jpg", "jpeg", "webp"].includes(extension);
}

function isProductionAsset(asset: ProjectDesignAsset): asset is ProjectDesignAsset & { assetType: ProjectDesignProductionAssetType } {
  return productionAssetTypes.includes(asset.assetType as ProjectDesignProductionAssetType);
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
  const productionInputRef = useRef<HTMLInputElement | null>(null);
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
  const [uploadDrafts, setUploadDrafts] = useState<Record<IntakeAssetType, UploadDraft>>({
    source_design: makeEmptyUploadDraft(),
    reference: makeEmptyUploadDraft(),
  });
  const [productionDraft, setProductionDraft] = useState<ProductionUploadDraft>(makeEmptyProductionUploadDraft());
  const [productionSourceFilter, setProductionSourceFilter] = useState("all");

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

  function updateUploadDraft(assetType: IntakeAssetType, patch: Partial<UploadDraft>) {
    setUploadDrafts((current) => ({
      ...current,
      [assetType]: { ...current[assetType], ...patch },
    }));
  }

  async function uploadAsset(assetType: IntakeAssetType) {
    const draft = uploadDrafts[assetType];

    if (!draft.file || !validateIntakeFile(draft.file, assetType)) {
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

  async function uploadProductionAsset() {
    const file = productionDraft.file;

    if (!file || !validateProductionFile(file)) {
      setAssetState({ status: "error", message: "SVG, PNG, JPG, WebP 제작 자산을 10MB 이하로 선택하세요." });
      return;
    }

    setAssetState({ status: "saving", message: "모바일 제작 자산을 업로드하고 있습니다." });
    const formData = new FormData();
    formData.set("projectSlug", projectId);
    formData.set("assetType", productionDraft.assetType);
    formData.set("file", file);
    formData.set("name", productionDraft.name || file.name.replace(/\.[^.]+$/, ""));
    formData.set("parentSourceAssetId", productionDraft.parentSourceAssetId);
    formData.set("backgroundMode", productionDraft.backgroundMode);
    formData.set("usageRole", productionDraft.usageRole);
    formData.set("approvalStatus", productionDraft.approvalStatus);
    formData.set("usageNote", productionDraft.usageNote);
    formData.set("metadata", JSON.stringify(productionDraft.metadata));

    const response = await fetch("/api/project-design-kit/assets", { method: "POST", body: formData }).catch(() => null);
    const result = response ? ((await response.json().catch(() => null)) as AssetApiResult | null) : null;

    if (!response?.ok || !result?.ok) {
      setAssetState({
        status: "error",
        message: result?.message ?? (response ? "제작 자산 업로드에 실패했습니다." : "업로드 요청을 보내지 못했습니다. 네트워크 상태를 확인하세요."),
      });
      return;
    }

    setDesignAssets((result.assets ?? []).filter((asset) => asset.assetType !== "logo"));
    setProductionDraft(makeEmptyProductionUploadDraft());
    if (productionInputRef.current) productionInputRef.current.value = "";
    setAssetState({ status: "success", message: result.message ?? "모바일 제작 자산을 등록했습니다." });
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

  async function updateProductionAsset(asset: ProjectDesignAsset, payload: Record<string, unknown>) {
    setAssetState({ status: "saving", message: "제작 자산 정보를 저장하고 있습니다." });
    const response = await fetch("/api/project-design-kit/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectSlug: projectId, assetId: asset.id, ...payload }),
    }).catch(() => null);
    const result = response ? ((await response.json().catch(() => null)) as AssetApiResult | null) : null;

    if (!response?.ok || !result?.ok) {
      setAssetState({ status: "error", message: result?.message ?? "제작 자산 정보를 저장하지 못했습니다." });
      return;
    }

    setDesignAssets((result.assets ?? []).filter((item) => item.assetType !== "logo"));
    setAssetState({ status: "success", message: result.message ?? "제작 자산 정보를 저장했습니다." });
    router.refresh();
  }

  function showDerivedAssets(sourceAssetId: string) {
    setProductionSourceFilter(sourceAssetId);
    requestAnimationFrame(() => document.getElementById("design-asset-library")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function deleteAsset(asset: ProjectDesignAsset) {
    const derivedAssetNote =
      asset.assetType === "source_design"
        ? "\n연결된 파생 자산은 유지되며 원본 연결만 해제됩니다."
        : "";

    if (
      !window.confirm(
        `${asset.originalFileName || asset.name} 파일을 삭제하시겠습니까?\nStorage 원본과 자산 기록이 함께 삭제됩니다.${derivedAssetNote}`,
      )
    ) {
      return;
    }

    setAssetState({ status: "saving", message: "디자인 자료를 삭제하고 있습니다." });
    const params = new URLSearchParams({ projectSlug: projectId, assetId: asset.id });
    const response = await fetch(`/api/project-design-kit/assets?${params.toString()}`, { method: "DELETE" }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as {
          ok?: boolean;
          assets?: ProjectDesignAsset[];
          message?: string;
          warning?: string;
        } | null)
      : null;

    if (!response?.ok || !result?.ok) {
      setAssetState({ status: "error", message: result?.message ?? "디자인 자료를 삭제하지 못했습니다." });
      return;
    }

    setDesignAssets((result.assets ?? []).filter((item) => item.assetType !== "logo"));
    if (asset.assetType === "source_design" && productionSourceFilter === asset.id) {
      setProductionSourceFilter("all");
    }
    setAssetState({
      status: "success",
      message:
        result.warning === "storage_cleanup_failed"
          ? result.message ?? "디자인 자료 기록은 삭제했지만 Storage 원본 정리에 실패했습니다. 관리자에게 원본 정리를 요청하세요."
          : result.message ?? "디자인 자료를 삭제했습니다.",
    });
    router.refresh();
  }

  const steps = sourceMode ? nextSteps[sourceMode] : [];
  const sourceAssets = designAssets.filter((asset) => asset.assetType === "source_design");
  const productionAssets = designAssets.filter(isProductionAsset);
  const filteredProductionAssets =
    productionSourceFilter === "all"
      ? productionAssets
      : productionAssets.filter((asset) => asset.parentSourceAssetId === productionSourceFilter);

  return (
    <div className="mb-5 space-y-5">
      <section className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">이번 호 자료 준비</p>
        <h3 className="mt-1 text-xl font-black text-[#092046]">이번 발행호에 사용할 디자인 자료를 확인합니다.</h3>
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
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">이번 호 원본·참고자료</p>
        <h3 className="mt-1 text-xl font-black text-[#092046]">발행호 디자인 자료 접수</h3>
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
            derivedAssets={productionAssets}
            onShowDerived={showDerivedAssets}
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

      <ProductionAssetLibrary
        assets={filteredProductionAssets}
        allAssetCount={productionAssets.length}
        draft={productionDraft}
        inputRef={productionInputRef}
        isSaving={assetState.status === "saving"}
        requestState={assetState}
        projectId={projectId}
        sourceAssets={sourceAssets}
        sourceFilter={productionSourceFilter}
        onDelete={deleteAsset}
        onDraftChange={(patch) => setProductionDraft((current) => ({ ...current, ...patch }))}
        onFilterChange={setProductionSourceFilter}
        onAssetsChange={(nextAssets) => setDesignAssets(nextAssets.filter((asset) => asset.assetType !== "logo"))}
        onSave={updateProductionAsset}
        onUpload={uploadProductionAsset}
      />
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
  derivedAssets = [],
  onShowDerived,
}: {
  assetType: IntakeAssetType;
  assets: ProjectDesignAsset[];
  draft: UploadDraft;
  inputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  onDraftChange: (patch: Partial<UploadDraft>) => void;
  onUpload: () => void;
  onDelete: (asset: ProjectDesignAsset) => void;
  onSaveNote: (asset: ProjectDesignAsset, usageNote: string) => void;
  derivedAssets?: ProjectDesignAsset[];
  onShowDerived?: (sourceAssetId: string) => void;
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
          <IntakeAssetCard
            key={asset.id}
            asset={asset}
            derivedCount={derivedAssets.filter((derivedAsset) => derivedAsset.parentSourceAssetId === asset.id).length}
            onDelete={onDelete}
            onSaveNote={onSaveNote}
            onShowDerived={onShowDerived}
          />
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
  derivedCount,
  onDelete,
  onSaveNote,
  onShowDerived,
}: {
  asset: ProjectDesignAsset;
  derivedCount: number;
  onDelete: (asset: ProjectDesignAsset) => void;
  onSaveNote: (asset: ProjectDesignAsset, usageNote: string) => void;
  onShowDerived?: (sourceAssetId: string) => void;
}) {
  const [usageNote, setUsageNote] = useState(asset.usageNote);
  const fileName = asset.originalFileName || asset.name;

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {isPreviewableImage(asset) && asset.previewHref ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.previewHref} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-black text-[#184a88]">{getExtension(fileName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-black text-[#092046]">{fileName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {assetLabels[asset.assetType as IntakeAssetType]} · {asset.mimeType || getExtension(fileName)} · {formatBytes(asset.fileSizeBytes)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-400">등록 {asset.created || "날짜 정보 없음"}</p>
          {asset.assetType === "source_design" ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                type="button"
                onClick={() => onShowDerived?.(asset.id)}
                disabled={!onShowDerived}
                className="text-xs font-black text-[#184a88] underline decoration-[#80b5ed] underline-offset-4 disabled:no-underline"
              >
                파생 자산 {derivedCount.toLocaleString("ko-KR")}개
              </button>
              <span className="text-xs font-bold text-slate-400">외부 디자인 도구 연동 준비 중</span>
            </div>
          ) : null}
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
        {asset.assetType === "source_design" ? (
          <button
            type="button"
            disabled
            title="Adobe·Canva 등 외부 디자인 도구 연동을 준비하고 있습니다."
            className="dd-btn dd-btn-secondary dd-btn-sm cursor-not-allowed border-slate-200 text-slate-400"
          >
            디자인 처리
          </button>
        ) : null}
        <button type="button" onClick={() => onDelete(asset)} className="dd-btn dd-btn-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
          삭제
        </button>
      </div>
    </article>
  );
}

function ProductionAssetLibrary({
  assets,
  allAssetCount,
  draft,
  inputRef,
  isSaving,
  requestState,
  projectId,
  sourceAssets,
  sourceFilter,
  onAssetsChange,
  onDelete,
  onDraftChange,
  onFilterChange,
  onSave,
  onUpload,
}: {
  assets: Array<ProjectDesignAsset & { assetType: ProjectDesignProductionAssetType }>;
  allAssetCount: number;
  draft: ProductionUploadDraft;
  inputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  requestState: RequestState;
  projectId: string;
  sourceAssets: ProjectDesignAsset[];
  sourceFilter: string;
  onAssetsChange: (assets: ProjectDesignAsset[]) => void;
  onDelete: (asset: ProjectDesignAsset) => void;
  onDraftChange: (patch: Partial<ProductionUploadDraft>) => void;
  onFilterChange: (sourceAssetId: string) => void;
  onSave: (asset: ProjectDesignAsset, payload: Record<string, unknown>) => void;
  onUpload: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const filteredAssets = assets.filter((asset) =>
    (typeFilter === "all" || asset.assetType === typeFilter) &&
    (originFilter === "all" || (asset.metadata?.source ?? "unspecified") === originFilter) &&
    (tagFilter === "all" || (tagFilter === "unspecified" ? !asset.metadata?.usageTags?.length : asset.metadata?.usageTags?.some((tag) => tag === tagFilter))),
  );
  return (
    <section id="design-asset-library" className="scroll-mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">이번 호 디자인 자산</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">기사 제작에 재사용할 자산</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 [word-break:keep-all]">
            배경, 일러스트, 아이콘 등 웹용 제작 자산을 원본과 연결해 관리합니다. 이 단계에서는 공개 화면에 자동 적용하지 않습니다.
          </p>
        </div>
        <span className="text-sm font-black text-[#184a88]">등록 {allAssetCount.toLocaleString("ko-KR")}개</span>
      </div>

      <BulkProductionAssetImport
        projectId={projectId}
        sourceAssets={sourceAssets}
        onAssetsChange={onAssetsChange}
      />

      <div className="mt-5 border-t border-slate-200 pt-5">
        <h4 className="text-base font-black text-[#092046]">제작 자산 등록</h4>
        <p className="mt-1 text-xs font-semibold text-slate-500">SVG, PNG, JPG, WebP · 최대 10MB · 프로젝트 전용 비공개 Storage</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-black text-slate-600 sm:col-span-2">
            파일
            <input
              ref={inputRef}
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp"
              onChange={(event) => onDraftChange({ file: event.target.files?.[0] ?? null })}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-black text-slate-600 sm:col-span-2">
            자산 이름
            <input
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
              placeholder="비워두면 파일명을 사용합니다"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88]"
            />
          </label>
          <SelectField
            label="자산 유형"
            value={draft.assetType}
            options={productionAssetTypes.map((value) => ({ value, label: productionAssetLabels[value] }))}
            onChange={(value) => onDraftChange({ assetType: value as ProjectDesignProductionAssetType })}
          />
        </div>
        <details className="mt-4 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-black text-[#092046]">외부 제작 정보 · 세부 분류</summary>
          <div className="mt-3"><AssetMetadataFields value={draft.metadata} onChange={(metadata) => onDraftChange({ metadata })} /></div>
        </details>
        <details className="mt-3 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-black text-[#092046]">사용 조건 · 원본 연결</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="원본 연결"
            value={draft.parentSourceAssetId}
            options={[
              { value: "", label: "연결 없음" },
              ...sourceAssets.map((asset) => ({ value: asset.id, label: asset.originalFileName || asset.name })),
            ]}
            onChange={(value) => onDraftChange({ parentSourceAssetId: value })}
          />
          <SelectField
            label="배경 조건"
            value={draft.backgroundMode}
            options={Object.entries(backgroundModeLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => onDraftChange({ backgroundMode: value as ProjectDesignAssetBackgroundMode })}
          />
          <SelectField
            label="사용 위치"
            value={draft.usageRole}
            options={Object.entries(usageRoleLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => onDraftChange({ usageRole: value as ProjectDesignAssetUsageRole })}
          />
          <SelectField
            label="승인 상태"
            value={draft.approvalStatus}
            options={Object.entries(approvalStatusLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => onDraftChange({ approvalStatus: value as ProjectDesignAssetApprovalStatus })}
          />
          <label className="text-xs font-black text-slate-600 sm:col-span-2 xl:col-span-3">
            사용 메모
            <input
              value={draft.usageNote}
              onChange={(event) => onDraftChange({ usageNote: event.target.value })}
              placeholder="예: 메인 헤더의 푸른 물결 배경"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#184a88]"
            />
          </label>
        </div>
        </details>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs font-bold ${requestState.status === "error" ? "text-rose-700" : "text-[#184a88]"}`}>{requestState.message}</p>
          <button type="button" onClick={onUpload} disabled={isSaving} className="dd-btn dd-btn-primary dd-btn-sm">
            {isSaving ? "처리 중..." : "제작 자산 등록"}
          </button>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="text-base font-black text-[#092046]">등록 자산</h4>
            <p className="mt-1 text-xs font-semibold text-slate-500">원본 파일 기준으로 필터하거나 각 자산의 사용 조건과 승인 상태를 수정할 수 있습니다.</p>
          </div>
          <label className="text-xs font-black text-slate-600">
            원본 필터
            <select
              value={sourceFilter}
              onChange={(event) => onFilterChange(event.target.value)}
              className="mt-1 h-10 min-w-52 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700"
            >
              <option value="all">전체 제작 자산</option>
              {sourceAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.originalFileName || asset.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SelectField label="유형 필터" value={typeFilter} onChange={setTypeFilter} options={[{value:"all",label:"전체 유형"}, ...productionAssetTypes.map((value) => ({value,label:productionAssetLabels[value]}))]} />
          <SelectField label="출처 필터" value={originFilter} onChange={setOriginFilter} options={[{value:"all",label:"전체 출처"},{value:"unspecified",label:"미지정/기존 자산"}, ...Object.entries(assetSourceLabels).map(([value,label]) => ({value,label}))]} />
          <SelectField label="용도 필터" value={tagFilter} onChange={setTagFilter} options={[{value:"all",label:"전체 용도"},{value:"unspecified",label:"미지정"}, ...Object.entries(assetUsageTagLabels).map(([value,label]) => ({value,label}))]} />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {filteredAssets.map((asset) => (
            <ProductionAssetCard
              key={`${asset.id}-${asset.updated}`}
              asset={asset}
              sourceAssets={sourceAssets}
              onDelete={onDelete}
              onSave={onSave}
            />
          ))}
          {filteredAssets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400 xl:col-span-2">
              선택한 조건에 맞는 제작 자산이 없습니다.
            </div>
          ) : null}
        </div>
      </div>
    </section>
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

function ProductionAssetCard({
  asset,
  sourceAssets,
  onDelete,
  onSave,
}: {
  asset: ProjectDesignAsset & { assetType: ProjectDesignProductionAssetType };
  sourceAssets: ProjectDesignAsset[];
  onDelete: (asset: ProjectDesignAsset) => void;
  onSave: (asset: ProjectDesignAsset, payload: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState({
    metadata: asset.metadata,
    name: asset.name,
    parentSourceAssetId: asset.parentSourceAssetId,
    backgroundMode: asset.backgroundMode,
    usageRole: asset.usageRole,
    approvalStatus: asset.approvalStatus,
    usageNote: asset.usageNote,
  });
  const fileName = asset.originalFileName || asset.name;

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 design-asset-checkerboard">
          {isPreviewableImage(asset) && asset.previewHref ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.previewHref} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm font-black text-[#184a88]">{getExtension(fileName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-[#184a88]">{productionAssetLabels[asset.assetType]}</span>
            <span className="text-xs font-bold text-slate-500">{approvalStatusLabels[asset.approvalStatus]}</span>
          </div>
          <p className="mt-1 break-all text-sm font-black text-[#092046]">{asset.name}</p>
          <p className="mt-1 break-words text-xs font-semibold text-slate-600">{designAssetClassification(asset.metadata)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {asset.mimeType || getExtension(fileName)} · {formatBytes(asset.fileSizeBytes)} · 등록 {asset.created || "날짜 정보 없음"}
          </p>
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-black text-[#184a88]">추가 정보 · 수정</summary>
        <p className="mt-2 break-all text-xs text-slate-500">{fileName}</p>
        <div className="mt-3"><AssetMetadataFields value={draft.metadata} onChange={(metadata) => setDraft((current) => ({ ...current, metadata }))} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-slate-600 sm:col-span-2">
          자산 이름
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <SelectField
          label="원본 연결"
          value={draft.parentSourceAssetId}
          options={[
            { value: "", label: "연결 없음" },
            ...sourceAssets.map((sourceAsset) => ({ value: sourceAsset.id, label: sourceAsset.originalFileName || sourceAsset.name })),
          ]}
          onChange={(value) => setDraft((current) => ({ ...current, parentSourceAssetId: value }))}
        />
        <SelectField
          label="배경 조건"
          value={draft.backgroundMode}
          options={Object.entries(backgroundModeLabels).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setDraft((current) => ({ ...current, backgroundMode: value as ProjectDesignAssetBackgroundMode }))}
        />
        <SelectField
          label="사용 위치"
          value={draft.usageRole}
          options={Object.entries(usageRoleLabels).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setDraft((current) => ({ ...current, usageRole: value as ProjectDesignAssetUsageRole }))}
        />
        <SelectField
          label="승인 상태"
          value={draft.approvalStatus}
          options={Object.entries(approvalStatusLabels).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setDraft((current) => ({ ...current, approvalStatus: value as ProjectDesignAssetApprovalStatus }))}
        />
        <label className="text-xs font-black text-slate-600 sm:col-span-2">
          사용 메모
          <input
            value={draft.usageNote}
            onChange={(event) => setDraft((current) => ({ ...current, usageNote: event.target.value }))}
            className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onSave(asset, draft)} className="dd-btn dd-btn-secondary dd-btn-sm border-slate-300">
          정보 저장
        </button>
        <button type="button" onClick={() => onDelete(asset)} className="dd-btn dd-btn-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
          삭제
        </button>
      </div>
      </details>
    </article>
  );
}

function AssetMetadataFields({ value, onChange }: { value: DesignAssetMetadata | null; onChange: (value: DesignAssetMetadata | null) => void }) {
  const change = (patch: Partial<DesignAssetMetadata>) => onChange({ ...(value ?? {}), ...patch });
  const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField label="출처" value={value?.source ?? ""} options={[{ value: "", label: "미지정/기존 자산" }, ...options(assetSourceLabels)]} onChange={(source) => {
        const next = { ...(value ?? {}) }; if (source) next.source = source as DesignAssetMetadata["source"]; else delete next.source; onChange(next);
      }} />
      <SelectField label="재사용 분류" value={value?.reuseScope ?? "project"} options={options(assetReuseScopeLabels)} onChange={(reuseScope) => change({ reuseScope: reuseScope as DesignAssetMetadata["reuseScope"] })} />
      <SelectField label="배경 투명" value={value?.transparency ?? "unknown"} options={options(assetTransparencyLabels)} onChange={(transparency) => change({ transparency: transparency as DesignAssetMetadata["transparency"] })} />
      <fieldset className="min-w-0">
        <legend className="text-xs font-black text-slate-600">용도</legend>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
          {Object.entries(assetUsageTagLabels).map(([tag, label]) => (
            <label key={tag} className="flex items-center gap-1 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={value?.usageTags?.includes(tag as keyof typeof assetUsageTagLabels) ?? false} onChange={(event) => {
                const tags = value?.usageTags ?? []; change({ usageTags: event.target.checked ? [...tags, tag as keyof typeof assetUsageTagLabels] : tags.filter((item) => item !== tag) });
              }} />{label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">현재는 이 프로젝트 안에서만 사용되며, 향후 재사용을 위한 분류입니다.</p>
    </div>
  );
}
