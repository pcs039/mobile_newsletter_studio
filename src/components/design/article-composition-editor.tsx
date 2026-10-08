"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompositionAssetPicker } from "@/components/design/composition-asset-picker";
import { CompositionMobilePreview } from "@/components/design/composition-mobile-preview";
import {
  articleCompositionSlotAssetTypes,
  articleCompositionSlotDefaultZIndex,
  isArticleCompositionSingleSlot,
  type ArticleCompositionAnchor,
  type ArticleCompositionPlacementSettings,
  type ArticleCompositionSlot,
  type ProjectArticleComposition,
  type ProjectArticleCompositionAsset,
} from "@/lib/article-composition";
import type { ArticleCompositionRepositoryStatus } from "@/lib/article-composition-repository";
import type { ProjectDesignAsset, ProjectDesignProductionAssetType } from "@/lib/newsletter-repository";

type ArticleCompositionEditorProps = {
  article: {
    body: string;
    id: string;
    summary: string;
    title: string;
  };
  assets: ProjectDesignAsset[];
  initialComposition: ProjectArticleComposition | null;
  initialStatus: ArticleCompositionRepositoryStatus;
  projectSlug: string;
  reuseSources: Array<{
    hasComposition: boolean;
    id: string;
    orderLabel: string;
    statusLabel: string;
    title: string;
  }>;
};

type CompositionApiResponse = {
  composition?: ProjectArticleComposition | null;
  message?: string;
  ok?: boolean;
};

type Notice = { kind: "error" | "success"; message: string } | null;

type ReuseState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const slotDefinitions: Array<{
  description: string;
  label: string;
  slot: ArticleCompositionSlot;
}> = [
  { slot: "hero_background", label: "배경판", description: "기사 제목 영역 뒤에 사용할 배경이나 패턴을 선택합니다." },
  { slot: "hero_illustration", label: "상단 이미지·장식", description: "기사 상단을 보조하는 이미지나 장식을 선택합니다." },
  { slot: "title_icon", label: "제목 옆 아이콘", description: "기사 제목 주변에 표시할 작은 아이콘을 선택합니다." },
  { slot: "body_decoration", label: "본문 주변 장식", description: "본문 주변에 여러 개의 장식을 독립적으로 배치할 수 있습니다." },
  { slot: "footer_banner", label: "하단 이미지·배너", description: "기사 마지막에 표시할 이미지, 배너 또는 프레임을 선택합니다." },
];

const assetTypeLabels: Record<string, string> = {
  background: "배경",
  illustration: "이미지",
  icon: "아이콘",
  card_frame: "카드 프레임",
  banner: "배너",
  pattern: "패턴",
  decoration: "장식",
};

const anchorOptions: Array<{ label: string; value: ArticleCompositionAnchor }> = [
  { value: "center", label: "가운데" },
  { value: "top", label: "위" },
  { value: "bottom", label: "아래" },
  { value: "left", label: "왼쪽" },
  { value: "right", label: "오른쪽" },
  { value: "top_left", label: "왼쪽 위" },
  { value: "top_right", label: "오른쪽 위" },
  { value: "bottom_left", label: "왼쪽 아래" },
  { value: "bottom_right", label: "오른쪽 아래" },
];

const productionAssetTypes = new Set<ProjectDesignProductionAssetType>([
  "background",
  "illustration",
  "icon",
  "card_frame",
  "banner",
  "pattern",
  "decoration",
]);

function isProductionAsset(asset: ProjectDesignAsset): asset is ProjectDesignAsset & {
  assetType: ProjectDesignProductionAssetType;
} {
  return productionAssetTypes.has(asset.assetType as ProjectDesignProductionAssetType);
}

function defaultSettingsForSlot(slot: ArticleCompositionSlot): ArticleCompositionPlacementSettings {
  return {
    anchor: "center",
    fit: slot === "hero_background" ? "cover" : "contain",
    offsetX: 0,
    offsetY: 0,
    opacity: 1,
    rotation: 0,
    scale: 1,
    zIndex: articleCompositionSlotDefaultZIndex[slot],
  };
}

function readPlacementSettings(placement: ProjectArticleCompositionAsset) {
  return placement.settings as ArticleCompositionPlacementSettings;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function RangeNumberControl({
  disabled,
  label,
  max,
  min,
  onChange,
  onCommit,
  step,
  unit,
  value,
}: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  step: number;
  unit?: string;
  value: number;
}) {
  function updateValue(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onChange(clampNumber(nextValue, min, max));
  }

  return (
    <div className="block min-w-0 text-xs font-black text-slate-700">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-bold text-slate-500">{value}{unit ?? ""}</span>
      </span>
      <span className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_84px] sm:items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => updateValue(Number(event.currentTarget.value))}
          onPointerUp={onCommit}
          className="h-10 w-full min-w-0 accent-[#184a88]"
          aria-label={`${label} 슬라이더`}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => updateValue(Number(event.currentTarget.value))}
          onBlur={onCommit}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
          aria-label={`${label} 값`}
        />
      </span>
    </div>
  );
}

function PlacementControls({
  asset,
  disabled,
  onDelete,
  onPreview,
  onSelect,
  onUpdate,
  placement,
  selected,
}: {
  asset: ProjectDesignAsset | undefined;
  disabled: boolean;
  onDelete: () => void;
  onPreview: (settings: ArticleCompositionPlacementSettings) => void;
  onSelect: () => void;
  onUpdate: (patch: {
    isVisible?: boolean;
    settings?: ArticleCompositionPlacementSettings;
    sortOrder?: number;
  }) => void;
  placement: ProjectArticleCompositionAsset;
  selected: boolean;
}) {
  const initialSettings = readPlacementSettings(placement);
  const [settings, setSettings] = useState<ArticleCompositionPlacementSettings>(() => ({
    ...defaultSettingsForSlot(placement.slot),
    ...initialSettings,
  }));
  const [sortOrder, setSortOrder] = useState(placement.sortOrder);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function commitSettings(nextSettings = settingsRef.current) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    onUpdate({ settings: nextSettings });
  }

  function changeSettings(patch: Partial<ArticleCompositionPlacementSettings>, saveImmediately = false) {
    const nextSettings = { ...settingsRef.current, ...patch };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    onPreview(nextSettings);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (saveImmediately) {
      saveTimerRef.current = null;
      onUpdate({ settings: nextSettings });
      return;
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      onUpdate({ settings: nextSettings });
    }, 450);
  }

  function resetLayerSettings() {
    changeSettings({
      offsetX: 0,
      offsetY: 0,
      opacity: 1,
      rotation: 0,
      scale: 1,
      zIndex: articleCompositionSlotDefaultZIndex[placement.slot],
    }, true);
  }

  return (
    <div
      onFocusCapture={onSelect}
      onPointerDownCapture={onSelect}
      className={`rounded-lg border p-4 transition ${
        selected ? "border-[#2f73b7] bg-[#f4f9ff] shadow-sm" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-[#092046]">{asset?.name ?? "연결된 자산"}</p>
            {selected ? (
              <span className="rounded-full bg-[#184a88] px-2 py-1 text-[10px] font-black text-white">현재 선택</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {asset?.approvalStatus === "approved" ? "승인 자산" : "검토 전 자산"} · {assetTypeLabels[asset?.assetType ?? ""] ?? "디자인 자산"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-black text-slate-700">
            <input
              type="checkbox"
              checked={placement.isVisible}
              disabled={disabled}
              onChange={(event) => onUpdate({ isVisible: event.currentTarget.checked })}
              className="h-4 w-4 accent-[#184a88]"
            />
            표시
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            className="text-xs font-black text-rose-700 underline decoration-rose-200 underline-offset-4 disabled:text-slate-400"
          >
            제거
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-black text-slate-700">
          기준 위치
          <select
            value={settings.anchor ?? "center"}
            disabled={disabled}
            onChange={(event) => {
              const value = event.currentTarget.value as ArticleCompositionAnchor;
              changeSettings({ anchor: value }, true);
            }}
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
          >
            {anchorOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {placement.slot === "body_decoration" ? (
          <label className="text-xs font-black text-slate-700">
            표시 순서
            <input
              type="number"
              min="0"
              max="10000"
              step="1"
              value={sortOrder}
              disabled={disabled}
              onChange={(event) => setSortOrder(Number(event.currentTarget.value))}
              onBlur={() => onUpdate({ sortOrder })}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
            />
          </label>
        ) : null}
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-black text-[#092046]">
          필요할 때만 세부 조정
          <span className="ml-2 text-xs font-bold text-slate-500">위치·회전·크기·투명도·레이어</span>
        </summary>
        <div className="border-t border-slate-200 p-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <fieldset className="min-w-0 space-y-4">
              <legend className="text-xs font-black uppercase tracking-wide text-[#184a88]">위치</legend>
              <RangeNumberControl
                disabled={disabled}
                label="X 이동"
                min={-200}
                max={200}
                step={1}
                unit="px"
                value={settings.offsetX ?? 0}
                onChange={(value) => changeSettings({ offsetX: value })}
                onCommit={() => commitSettings()}
              />
              <RangeNumberControl
                disabled={disabled}
                label="Y 이동"
                min={-200}
                max={200}
                step={1}
                unit="px"
                value={settings.offsetY ?? 0}
                onChange={(value) => changeSettings({ offsetY: value })}
                onCommit={() => commitSettings()}
              />
            </fieldset>

            <fieldset className="min-w-0 space-y-4">
              <legend className="text-xs font-black uppercase tracking-wide text-[#184a88]">변형</legend>
              <RangeNumberControl
                disabled={disabled}
                label="크기"
                min={0.25}
                max={3}
                step={0.05}
                value={settings.scale ?? 1}
                onChange={(value) => changeSettings({ scale: value })}
                onCommit={() => commitSettings()}
              />
              <RangeNumberControl
                disabled={disabled}
                label="회전"
                min={-180}
                max={180}
                step={1}
                unit="°"
                value={settings.rotation ?? 0}
                onChange={(value) => changeSettings({ rotation: value })}
                onCommit={() => commitSettings()}
              />
            </fieldset>

            <fieldset className="min-w-0 space-y-4">
              <legend className="text-xs font-black uppercase tracking-wide text-[#184a88]">레이어</legend>
              <RangeNumberControl
                disabled={disabled}
                label="z-index"
                min={0}
                max={20}
                step={1}
                value={settings.zIndex ?? articleCompositionSlotDefaultZIndex[placement.slot]}
                onChange={(value) => changeSettings({ zIndex: value })}
                onCommit={() => commitSettings()}
              />
              {placement.slot === "body_decoration" ? (
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  표시 순서는 목록 순서이며, z-index는 장식이 서로 겹칠 때의 앞뒤 순서입니다.
                </p>
              ) : null}
            </fieldset>

            <fieldset className="min-w-0 space-y-4">
              <legend className="text-xs font-black uppercase tracking-wide text-[#184a88]">표현</legend>
              <RangeNumberControl
                disabled={disabled}
                label="투명도"
                min={0}
                max={1}
                step={0.05}
                value={settings.opacity ?? 1}
                onChange={(value) => changeSettings({ opacity: value })}
                onCommit={() => commitSettings()}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={resetLayerSettings}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:text-slate-400"
              >
                이 요소만 기본값으로
              </button>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                현재 선택한 {asset?.name ?? "디자인 요소"}의 위치와 표현 값만 초기화합니다.
              </p>
            </fieldset>
          </div>
        </div>
      </details>
    </div>
  );
}

function DesignReusePanel({
  disabled,
  onApply,
  onSourceChange,
  selectedSourceId,
  sources,
  state,
}: {
  disabled: boolean;
  onApply: () => void;
  onSourceChange: (sourceId: string) => void;
  selectedSourceId: string;
  sources: ArticleCompositionEditorProps["reuseSources"];
  state: ReuseState;
}) {
  const availableSourceCount = sources.filter((source) => source.hasComposition).length;

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-black text-[#092046] sm:px-5">
        다른 기사 디자인 불러오기
        <span className="ml-2 text-xs font-bold text-slate-500">같은 발행호에서 재사용</span>
      </summary>
      <div className="border-t border-slate-200 p-4 sm:p-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="min-w-0 text-sm font-black text-[#092046]">
            원본 기사
            <select
              value={selectedSourceId}
              disabled={disabled || availableSourceCount === 0}
              onChange={(event) => onSourceChange(event.currentTarget.value)}
              className="mt-2 h-12 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">기사를 선택하세요</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id} disabled={!source.hasComposition}>
                  {source.orderLabel} · {source.title} · {source.statusLabel}{source.hasComposition ? "" : " · 디자인 없음"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={disabled || !selectedSourceId}
            onClick={onApply}
            className="h-12 rounded-lg border border-[#2f73b7] bg-[#eaf3ff] px-5 text-sm font-black text-[#092046] transition hover:bg-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {state.status === "loading" ? "디자인 적용 중" : "디자인 적용"}
          </button>
        </div>

        {sources.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-slate-600">재사용할 다른 기사가 없습니다.</p>
        ) : availableSourceCount === 0 ? (
          <p className="mt-3 text-sm font-bold text-slate-600">디자인 구성이 저장된 다른 기사가 없습니다.</p>
        ) : null}

        <div className="mt-4 rounded-lg border border-[#d8e8ff] bg-[#f7fbff] p-4 text-xs font-semibold leading-5 text-slate-600">
          <p className="font-black text-[#092046]">복사되는 항목</p>
          <p className="mt-1">배경, 이미지, 장식과 위치·회전·크기·투명도·레이어·표시 순서를 그대로 적용합니다.</p>
          <p className="mt-2 font-black text-[#184a88]">현재 기사의 제목·본문·요약·콘텐츠 블록·링크·상태는 유지되고 디자인 배치만 교체됩니다.</p>
          <p className="mt-2 text-slate-500">적용 중 오류가 발생하면 atomic transaction이 취소되어 현재 디자인도 그대로 유지됩니다.</p>
        </div>

        {state.status !== "idle" ? (
          <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${
            state.status === "error"
              ? "bg-rose-50 text-rose-800"
              : state.status === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-sky-50 text-sky-800"
          }`} role="status">
            {state.message}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function ArticleCompositionEditor({
  article,
  assets,
  initialComposition,
  initialStatus,
  projectSlug,
  reuseSources,
}: ArticleCompositionEditorProps) {
  const [composition, setComposition] = useState(initialComposition);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [activeSlot, setActiveSlot] = useState<ArticleCompositionSlot>("hero_background");
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [reuseSourceId, setReuseSourceId] = useState("");
  const [reuseState, setReuseState] = useState<ReuseState>({ status: "idle", message: "" });
  const selectableAssets = useMemo(
    () => assets.filter((asset) => isProductionAsset(asset) && asset.isActive && asset.approvalStatus !== "archived"),
    [assets],
  );
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const isBusy = Boolean(busyKey);

  async function mutate(method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>, key: string) {
    setBusyKey(key);
    setNotice(null);

    const requestUrl = method === "DELETE"
      ? `/api/project-article-composition?${new URLSearchParams(payload as Record<string, string>).toString()}`
      : "/api/project-article-composition";
    const response = await fetch(requestUrl, {
      method,
      headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(payload),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as CompositionApiResponse | null)
      : null;

    setBusyKey("");

    if (!response || !response.ok || !result?.ok || !result.composition) {
      setNotice({ kind: "error", message: result?.message ?? "기사 화면 구성을 저장하지 못했습니다." });
      return;
    }

    setComposition(result.composition);
    setNotice({ kind: "success", message: result.message ?? "기사 화면 구성을 저장했습니다." });
  }

  async function createComposition() {
    await mutate("POST", { action: "create_composition", articleId: article.id, projectSlug }, "create");
  }

  async function selectAsset(slot: ArticleCompositionSlot, assetId: string) {
    if (!composition) return;
    const placements = composition.assets.filter((placement) => placement.slot === slot);
    const nextSortOrder = isArticleCompositionSingleSlot(slot)
      ? 0
      : placements.reduce((highest, placement) => Math.max(highest, placement.sortOrder), -1) + 1;

    await mutate(
      "POST",
      {
        action: "add_placement",
        articleId: article.id,
        assetId,
        compositionId: composition.id,
        isVisible: true,
        projectSlug,
        settings: defaultSettingsForSlot(slot),
        slot,
        sortOrder: nextSortOrder,
      },
      `select:${slot}`,
    );
  }

  function selectSlot(slot: ArticleCompositionSlot) {
    setActiveSlot(slot);
    const placement = composition?.assets
      .filter((candidate) => candidate.slot === slot)
      .sort((first, second) => first.sortOrder - second.sortOrder)[0];
    setSelectedPlacementId(placement?.id ?? null);
  }

  async function updatePlacement(
    placement: ProjectArticleCompositionAsset,
    patch: { isVisible?: boolean; settings?: ArticleCompositionPlacementSettings; sortOrder?: number },
  ) {
    if (!composition) return;
    await mutate(
      "PATCH",
      {
        action: "update_placement",
        articleId: article.id,
        assetId: placement.assetId,
        compositionId: composition.id,
        isVisible: patch.isVisible ?? placement.isVisible,
        placementId: placement.id,
        projectSlug,
        settings: patch.settings ?? placement.settings,
        sortOrder: patch.sortOrder ?? placement.sortOrder,
      },
      `placement:${placement.id}`,
    );
  }

  function previewPlacementSettings(
    placementId: string,
    settings: ArticleCompositionPlacementSettings,
  ) {
    setComposition((currentComposition) => currentComposition ? {
      ...currentComposition,
      assets: currentComposition.assets.map((candidate) =>
        candidate.id === placementId ? { ...candidate, settings } : candidate,
      ),
    } : currentComposition);
  }

  async function removePlacement(placement: ProjectArticleCompositionAsset) {
    if (!composition) return;
    await mutate(
      "DELETE",
      {
        articleId: article.id,
        compositionId: composition.id,
        placementId: placement.id,
        projectSlug,
      },
      `delete:${placement.id}`,
    );
  }

  async function updateStatus(status: "draft" | "ready") {
    if (!composition || composition.status === status) return;
    await mutate(
      "PATCH",
      { action: "update_status", articleId: article.id, compositionId: composition.id, projectSlug, status },
      `status:${status}`,
    );
  }

  async function applyReusedDesign() {
    if (!reuseSourceId || reuseSourceId === article.id || isBusy) return;

    const source = reuseSources.find((candidate) => candidate.id === reuseSourceId && candidate.hasComposition);
    if (!source) {
      setReuseState({ status: "error", message: "불러올 기사 디자인을 다시 선택해 주세요. 현재 디자인은 그대로 유지됩니다." });
      return;
    }

    const confirmed = window.confirm(
      `“${source.title}”의 디자인 배치로 현재 디자인을 교체할까요?\n기사 제목·본문·링크와 기사 상태는 유지됩니다.`,
    );
    if (!confirmed) return;

    setBusyKey(`copy:${source.id}`);
    setReuseState({ status: "loading", message: "선택한 기사 디자인을 적용하고 있습니다." });

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    const response = await fetch("/api/project-article-composition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "copy_composition",
        articleId: article.id,
        projectSlug,
        sourceArticleId: source.id,
      }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as CompositionApiResponse | null)
      : null;

    setBusyKey("");

    if (!response || !response.ok || !result?.ok || !result.composition) {
      setReuseState({
        status: "error",
        message: `${result?.message ?? "기사 디자인을 불러오지 못했습니다."} 현재 디자인은 그대로 유지됩니다.`,
      });
      return;
    }

    setComposition(result.composition);
    setSelectedPlacementId(null);
    setReuseState({
      status: "success",
      message: `“${source.title}”의 디자인 배치를 적용했습니다. 모바일 미리보기에 즉시 반영되었습니다.`,
    });
  }

  const availableReuseSources = reuseSources.filter((source) => source.id !== article.id);
  const reusePanel = (
    <DesignReusePanel
      disabled={isBusy}
      onApply={() => void applyReusedDesign()}
      onSourceChange={(sourceId) => {
        setReuseSourceId(sourceId);
        setReuseState({ status: "idle", message: "" });
      }}
      selectedSourceId={reuseSourceId}
      sources={availableReuseSources}
      state={reuseState}
    />
  );

  if (initialStatus === "migration_required") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-black text-amber-900">기사 화면 구성 기능을 준비 중입니다.</p>
        <p className="mt-2 text-sm leading-6 text-amber-800">v1.25 Composition migration 적용 후 이 영역을 사용할 수 있습니다.</p>
      </section>
    );
  }

  if (!composition) {
    return (
      <section className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-5">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">3. 개별 기사 디자인</p>
        <h3 className="mt-2 text-xl font-black text-[#092046]">기사 디자인 조정을 시작합니다</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          기관 디자인 자산을 기사 배경, 이미지, 장식에 배치합니다. 기사 내용은 기존 편집 데이터가 기준입니다.
        </p>
        {initialStatus !== "not_found" ? (
          <p className="mt-3 text-sm font-bold text-rose-700">기사 화면 구성 정보를 불러오지 못했습니다.</p>
        ) : null}
        <button
          type="button"
          disabled={isBusy || initialStatus !== "not_found"}
          onClick={createComposition}
          className="mt-5 rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {busyKey === "create" ? "구성 생성 중" : "디자인 조정 시작"}
        </button>
        <div className="mt-5">{reusePanel}</div>
      </section>
    );
  }

  const activeDefinition = slotDefinitions.find((definition) => definition.slot === activeSlot) ?? slotDefinitions[0];
  const activePlacements = composition.assets
    .filter((placement) => placement.slot === activeSlot)
    .sort((first, second) => first.sortOrder - second.sortOrder);
  const activeSelectedPlacementId = activePlacements.some((placement) => placement.id === selectedPlacementId)
    ? selectedPlacementId
    : activePlacements[0]?.id ?? null;
  const compatibleTypes = articleCompositionSlotAssetTypes[activeSlot];
  const compatibleAssets = selectableAssets.filter((asset) =>
    compatibleTypes.includes(asset.assetType as ProjectDesignProductionAssetType),
  );
  const currentAssetId = isArticleCompositionSingleSlot(activeSlot) ? activePlacements[0]?.assetId : undefined;

  return (
    <section className="rounded-lg border border-[#b8d7ff] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">3. 개별 기사 디자인</p>
          <h3 className="mt-1 text-xl font-black text-[#092046]">기사 디자인 조정</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">변경 내용은 항목별로 즉시 저장됩니다. 준비 완료 상태의 배경판과 상단 이미지·장식은 승인된 자산만 모바일 미리보기·기관 검토·공개 화면에 표시됩니다. 다른 배치 요소는 아직 공개 화면에 반영되지 않습니다.</p>
        </div>
        <div className="flex rounded-lg border border-[#b8d7ff] bg-[#eef6ff] p-1">
          {(["draft", "ready"] as const).map((status) => (
            <button
              key={status}
              type="button"
              disabled={isBusy}
              onClick={() => updateStatus(status)}
              className={`rounded-md px-3 py-2 text-xs font-black transition ${
                composition.status === status ? "bg-[#092046] text-white" : "text-[#184a88] hover:bg-white"
              }`}
            >
              {status === "draft" ? "작성 중" : "준비 완료"}
            </button>
          ))}
        </div>
      </div>

      {notice ? (
        <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${
          notice.kind === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"
        }`}>
          {notice.message}
        </p>
      ) : null}

      <div className="mt-6 rounded-lg border border-[#c9d7e8] bg-[#f7fbff] p-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">디자인 작업 순서</p>
        <ol className="mt-3 grid gap-2 text-xs font-bold text-slate-700 sm:grid-cols-2 xl:grid-cols-5">
          {["자산 준비", "배경판·요소 배치", "텍스트 영역 확인", "모바일 미리보기", "필요 시 세부 조정"].map((label, index) => (
            <li key={label} className="flex min-h-10 items-center gap-2 rounded-lg border border-[#d8e8ff] bg-white px-3 py-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#184a88] text-[10px] text-white">{index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4">{reusePanel}</div>

      <div className="mt-6 flex flex-col gap-3 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">1. 디자인 자산</p>
          <p className="mt-1 text-sm font-bold text-[#092046]">이번 호에 준비된 자산을 선택해 이 기사에 배치합니다.</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">사용 가능 {selectableAssets.length}개 · 업로드와 승인 관리는 디자인 워크스페이스에서 합니다.</p>
        </div>
        <Link href={`/projects/${projectSlug}/design`} className="text-sm font-black text-[#184a88] underline decoration-sky-200 underline-offset-4">
          자산 업로드·관리
        </Link>
      </div>

      <div className="mt-6">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">2. 기본 배치</p>
        <h4 className="mt-1 text-base font-black text-[#092046]">작업할 영역을 선택하세요</h4>
        <p className="mt-1 text-sm leading-6 text-slate-600">한 번에 한 영역만 열어 자산을 선택하고 배치합니다. 제목과 본문은 HTML 텍스트로 유지되며 시각 요소보다 앞쪽에 보호됩니다.</p>
      </div>

      <div role="tablist" aria-label="기사 디자인 배치 영역" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {slotDefinitions.map((definition) => {
          const count = composition.assets.filter((placement) => placement.slot === definition.slot).length;
          const isActive = activeSlot === definition.slot;

          return (
            <button
              key={definition.slot}
              id={`composition-slot-tab-${definition.slot}`}
              type="button"
              role="tab"
              aria-controls="composition-active-slot-panel"
              aria-selected={isActive}
              onClick={() => selectSlot(definition.slot)}
              className={`min-h-14 rounded-lg border px-3 py-2 text-left transition ${
                isActive
                  ? "border-[#184a88] bg-[#092046] text-white shadow-sm"
                  : "border-slate-200 bg-white text-[#184a88] hover:border-[#7fb5ed] hover:bg-[#f4f9ff]"
              }`}
            >
              <span className="block text-xs font-black">{definition.label}</span>
              <span className={`mt-1 block text-[10px] font-bold ${isActive ? "text-sky-100" : "text-slate-500"}`}>
                {count > 0 ? `${count}개 배치됨` : "비어 있음"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_390px] 2xl:items-start">
        <div
          id="composition-active-slot-panel"
          role="tabpanel"
          aria-labelledby={`composition-slot-tab-${activeSlot}`}
          className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">현재 작업 영역</p>
              <h4 className="mt-1 text-lg font-black text-[#092046]">{activeDefinition.label}</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">{activeDefinition.description}</p>
            </div>
            <CompositionAssetPicker
              assets={compatibleAssets}
              buttonLabel={activePlacements.length > 0 && isArticleCompositionSingleSlot(activeSlot) ? "자산 교체" : "자산 추가"}
              currentAssetId={currentAssetId}
              disabled={isBusy}
              onSelect={(assetId) => selectAsset(activeSlot, assetId)}
            />
          </div>

          {busyKey.startsWith("copy:") ? (
            <div className="mt-5 rounded-lg border border-sky-200 bg-white px-4 py-6 text-center">
              <p className="text-sm font-black text-[#184a88]">선택한 기사 디자인을 적용하고 있습니다.</p>
            </div>
          ) : activePlacements.length > 0 ? (
            <div className="mt-5 space-y-3">
              {activePlacements.map((placement) => (
                <PlacementControls
                  key={`${placement.id}:${placement.updatedAt}`}
                  asset={assetById.get(placement.assetId)}
                  disabled={isBusy}
                  placement={placement}
                  selected={placement.id === activeSelectedPlacementId}
                  onDelete={() => removePlacement(placement)}
                  onPreview={(settings) => previewPlacementSettings(placement.id, settings)}
                  onSelect={() => setSelectedPlacementId(placement.id)}
                  onUpdate={(patch) => updatePlacement(placement, patch)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
              <p className="text-sm font-black text-slate-600">{activeDefinition.label}에 배치된 자산이 없습니다.</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">위의 자산 추가 버튼에서 이번 호 디자인 자산을 선택하세요.</p>
            </div>
          )}
        </div>

        <div className="min-w-0 2xl:sticky 2xl:top-4">
          <CompositionMobilePreview
            article={article}
            assets={assets}
            composition={composition}
            selectedPlacementId={activeSelectedPlacementId}
          />
          {selectableAssets.length === 0 ? (
            <p className="mt-3 text-center text-xs font-bold leading-5 text-slate-500">
              사용할 이번 호 디자인 자산이 없습니다. <Link href={`/projects/${projectSlug}/design`} className="text-[#184a88] underline">디자인 워크스페이스</Link>에서 먼저 등록하세요.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
