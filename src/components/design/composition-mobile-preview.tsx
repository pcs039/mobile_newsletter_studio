"use client";

import type { CSSProperties } from "react";
import {
  articleCompositionSlotDefaultZIndex,
  type ArticleCompositionAnchor,
  type ArticleCompositionPlacementSettings,
  type ArticleCompositionSlot,
  type ProjectArticleComposition,
  type ProjectArticleCompositionAsset,
} from "@/lib/article-composition";
import type { ProjectDesignAsset } from "@/lib/newsletter-repository";
import { ArticleHeroBackgroundLayer } from "@/components/article-hero-background-layer";
import { validateArticleCompositionPlacementSettings } from "@/lib/article-composition";

type CompositionMobilePreviewProps = {
  article: {
    body: string;
    summary: string;
    title: string;
  };
  assets: ProjectDesignAsset[];
  composition: ProjectArticleComposition;
  selectedPlacementId: string | null;
};

const anchorPosition: Record<ArticleCompositionAnchor, CSSProperties> = {
  center: { left: "50%", top: "50%" },
  top: { left: "50%", top: 0 },
  bottom: { bottom: 0, left: "50%" },
  left: { left: 0, top: "50%" },
  right: { right: 0, top: "50%" },
  top_left: { left: 0, top: 0 },
  top_right: { right: 0, top: 0 },
  bottom_left: { bottom: 0, left: 0 },
  bottom_right: { bottom: 0, right: 0 },
};

function getSettings(placement: ProjectArticleCompositionAsset) {
  return placement.settings as ArticleCompositionPlacementSettings;
}

function getTransform(anchor: ArticleCompositionAnchor, settings: ArticleCompositionPlacementSettings) {
  const anchorX = anchor === "center" || anchor === "top" || anchor === "bottom" ? "-50%" : "0";
  const anchorY = anchor === "center" || anchor === "left" || anchor === "right" ? "-50%" : "0";
  const offsetX = settings.offsetX ?? 0;
  const offsetY = settings.offsetY ?? 0;
  const rotation = settings.rotation ?? 0;
  const scale = settings.scale ?? 1;

  return `translate(${anchorX}, ${anchorY}) translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg) scale(${scale})`;
}

function layerStyle(placement: ProjectArticleCompositionAsset, asset: ProjectDesignAsset): CSSProperties {
  const settings = getSettings(placement);
  const anchor = settings.anchor ?? "center";

  return {
    ...anchorPosition[anchor],
    backgroundImage: `url(${JSON.stringify(asset.previewHref)})`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: settings.fit ?? "contain",
    opacity: settings.opacity ?? 1,
    transform: getTransform(anchor, settings),
    transformOrigin: "center",
    zIndex: Math.min(settings.zIndex ?? articleCompositionSlotDefaultZIndex[placement.slot], 25),
  };
}

function AssetLayer({
  asset,
  className,
  placement,
  selected,
}: {
  asset: ProjectDesignAsset;
  className: string;
  placement: ProjectArticleCompositionAsset;
  selected: boolean;
}) {
  return (
    <span
      role={asset.altText ? "img" : undefined}
      aria-label={asset.altText || undefined}
      aria-hidden={asset.altText ? undefined : true}
      className={`absolute pointer-events-none ${className}`}
      style={{
        ...layerStyle(placement, asset),
        outline: selected ? "3px solid #2f73b7" : undefined,
        outlineOffset: selected ? "-3px" : undefined,
      }}
    />
  );
}

const slotLabels: Record<ArticleCompositionSlot, string> = {
  hero_background: "배경판",
  hero_illustration: "상단 이미지·장식",
  title_icon: "제목 옆 아이콘",
  body_decoration: "본문 주변 장식",
  footer_banner: "하단 이미지·배너",
};

export function CompositionMobilePreview({
  article,
  assets,
  composition,
  selectedPlacementId,
}: CompositionMobilePreviewProps) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const visiblePlacements = composition.assets.filter((placement) => placement.isVisible && assetById.has(placement.assetId));
  const placementsFor = (slot: ArticleCompositionSlot) =>
    visiblePlacements.filter((placement) => placement.slot === slot).sort((a, b) => a.sortOrder - b.sortOrder);
  const heroBackgrounds = placementsFor("hero_background");
  const heroIllustrations = placementsFor("hero_illustration");
  const titleIcons = placementsFor("title_icon");
  const bodyDecorations = placementsFor("body_decoration");
  const footerBanners = placementsFor("footer_banner");
  const selectedPlacement = composition.assets.find((placement) => placement.id === selectedPlacementId);
  const selectedAsset = selectedPlacement ? assetById.get(selectedPlacement.assetId) : undefined;
  const framePlacement = heroBackgrounds[0];
  const frameSettings = framePlacement ? validateArticleCompositionPlacementSettings(framePlacement.settings, "hero_background") : null;
  if (framePlacement && frameSettings?.ok && frameSettings.settings.renderMode === "fluid_frame") {
    const illustration = heroIllustrations[0];
    const illustrationAsset = illustration ? assetById.get(illustration.assetId) : undefined;
    return (
      <div className="mx-auto w-full max-w-[390px] rounded-lg border border-[#b8d7ff] bg-white p-4 shadow-lg">
        <p className="mb-3 text-xs font-black text-[#184a88]">3. 모바일 즉시 미리보기</p>
        <ArticleHeroBackgroundLayer background={{ url: "", visible: true, settings: frameSettings.settings }}
          illustration={illustration && illustrationAsset ? { url: illustrationAsset.previewHref, visible: true, settings: getSettings(illustration) } : undefined}
          body={<p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{article.body.slice(0, 360) || "기사 본문이 이 영역에 표시됩니다."}{article.body.length > 360 ? "…" : ""}</p>}>
          <h3 className="break-words text-2xl font-black leading-tight text-[#092046]">{article.title}</h3>
          {article.summary ? <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{article.summary}</p> : null}
        </ArticleHeroBackgroundLayer>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-lg border border-[#b8d7ff] bg-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8e8ff] bg-[#092046] px-4 py-3 text-xs font-black text-white">
        <span>3. 모바일 즉시 미리보기</span>
        {selectedPlacement && selectedAsset ? (
          <span className="max-w-full truncate rounded-full bg-white/15 px-2 py-1 text-[10px] text-sky-50">
            선택: {selectedAsset.name} · {slotLabels[selectedPlacement.slot]}
          </span>
        ) : (
          <span className="text-[10px] text-sky-100">배치 요소를 선택하면 강조됩니다.</span>
        )}
      </div>

      <div className="relative min-h-64 overflow-hidden bg-[#eef6ff] px-6 py-10">
        <span className="absolute left-3 top-3 z-40 rounded bg-white/90 px-2 py-1 text-[10px] font-black text-[#184a88] shadow-sm">
          기사 제목 영역
        </span>
        {heroBackgrounds.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-full w-full" selected={placement.id === selectedPlacementId} /> : null;
        })}
        {heroIllustrations.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-40 w-40" selected={placement.id === selectedPlacementId} /> : null;
        })}
        {titleIcons.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-16 w-16" selected={placement.id === selectedPlacementId} /> : null;
        })}

        <div className="relative z-30 mx-auto max-w-[290px] text-center">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#184a88]">Mobile Newsletter</p>
          <h3 className="mt-3 break-words text-2xl font-black leading-tight text-[#092046]">{article.title}</h3>
          {article.summary ? <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{article.summary}</p> : null}
        </div>
      </div>

      <div className="relative overflow-hidden px-6 py-8">
        <span className="absolute left-3 top-3 z-40 rounded bg-white/90 px-2 py-1 text-[10px] font-black text-[#184a88] shadow-sm">
          기사 본문 영역
        </span>
        {bodyDecorations.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-28 w-28" selected={placement.id === selectedPlacementId} /> : null;
        })}
        <p className="relative z-30 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
          {article.body.slice(0, 360) || "기사 본문이 이 영역에 표시됩니다."}
          {article.body.length > 360 ? "…" : ""}
        </p>
      </div>

      {footerBanners.length > 0 ? (
        <div className="relative min-h-28 overflow-hidden border-t border-slate-100 bg-slate-50">
          {footerBanners.map((placement) => {
            const asset = assetById.get(placement.assetId);
            return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-24 w-[90%]" selected={placement.id === selectedPlacementId} /> : null;
          })}
        </div>
      ) : null}
    </div>
  );
}
