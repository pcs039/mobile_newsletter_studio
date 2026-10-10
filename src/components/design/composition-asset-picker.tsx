"use client";

import { useMemo, useState } from "react";
import { designAssetClassification } from "@/lib/design-asset-metadata";
import { usageRoleLabels } from "@/components/design/design-asset-options";
import type { ProjectDesignAsset } from "@/lib/newsletter-repository";

type CompositionAssetPickerProps = {
  assets: ProjectDesignAsset[];
  buttonLabel: string;
  currentAssetId?: string;
  disabled?: boolean;
  onSelect: (assetId: string) => void;
};

const assetTypeLabels: Record<string, string> = {
  background: "배경",
  illustration: "일러스트",
  icon: "아이콘",
  card_frame: "카드 프레임",
  banner: "배너",
  pattern: "패턴",
  decoration: "장식",
};

const approvalLabels: Record<string, string> = {
  approved: "승인",
  draft: "검토 전",
};

function previewStyle(asset: ProjectDesignAsset) {
  return asset.previewHref
    ? {
        backgroundImage: `url(${JSON.stringify(asset.previewHref)}), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, #f8fafc 25%, #f8fafc 75%, #e2e8f0 75%)`,
        backgroundPosition: "center, 0 0, 6px 6px",
        backgroundRepeat: "no-repeat, repeat, repeat",
        backgroundSize: "contain, 12px 12px, 12px 12px",
      }
    : undefined;
}

export function CompositionAssetPicker({
  assets,
  buttonLabel,
  currentAssetId,
  disabled = false,
  onSelect,
}: CompositionAssetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sortedAssets = useMemo(
    () =>
      [...assets].sort((first, second) => {
        if (first.approvalStatus !== second.approvalStatus) {
          return first.approvalStatus === "approved" ? -1 : 1;
        }
        return first.name.localeCompare(second.name, "ko");
      }),
    [assets],
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || sortedAssets.length === 0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="rounded-lg border border-[#2f73b7] bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        {sortedAssets.length > 0 ? buttonLabel : "사용 가능한 자산 없음"}
      </button>

      {isOpen ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedAssets.map((asset) => {
            const isCurrent = asset.id === currentAssetId;

            return (
              <button
                key={asset.id}
                type="button"
                disabled={disabled || isCurrent}
                onClick={() => {
                  onSelect(asset.id);
                  setIsOpen(false);
                }}
                className={`min-w-0 overflow-hidden rounded-lg border text-left transition disabled:cursor-default ${
                  isCurrent
                    ? "border-[#184a88] bg-[#eef6ff]"
                    : "border-slate-200 bg-white hover:border-[#7fb5ed] hover:bg-[#f8fbff]"
                }`}
              >
                <span
                  role={asset.altText ? "img" : undefined}
                  aria-label={asset.altText || undefined}
                  aria-hidden={asset.altText ? undefined : true}
                  className="block aspect-[4/3] w-full design-asset-checkerboard"
                  style={previewStyle(asset)}
                />
                <span className="block p-3">
                  <span className="block truncate text-sm font-black text-[#092046]">{asset.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                    <span>{assetTypeLabels[asset.assetType] ?? asset.assetType}</span>
                    <span>·</span>
                    <span>{approvalLabels[asset.approvalStatus] ?? asset.approvalStatus}</span>
                    <span>·</span>
                    <span>{usageRoleLabels[asset.usageRole]}</span>
                  </span>
                  <span className="mt-1 block break-words text-[11px] text-slate-600">{designAssetClassification(asset.metadata)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
