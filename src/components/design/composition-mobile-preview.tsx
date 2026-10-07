"use client";

import type { CSSProperties } from "react";
import type {
  ArticleCompositionAnchor,
  ArticleCompositionPlacementSettings,
  ArticleCompositionSlot,
  ProjectArticleComposition,
  ProjectArticleCompositionAsset,
} from "@/lib/article-composition";
import type { ProjectDesignAsset } from "@/lib/newsletter-repository";

type CompositionMobilePreviewProps = {
  article: {
    body: string;
    summary: string;
    title: string;
  };
  assets: ProjectDesignAsset[];
  composition: ProjectArticleComposition;
};

const defaultZIndex: Record<ArticleCompositionSlot, number> = {
  hero_background: 0,
  hero_illustration: 10,
  title_icon: 20,
  body_decoration: 10,
  footer_banner: 10,
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
    zIndex: Math.min(settings.zIndex ?? defaultZIndex[placement.slot], 25),
  };
}

function AssetLayer({
  asset,
  className,
  placement,
}: {
  asset: ProjectDesignAsset;
  className: string;
  placement: ProjectArticleCompositionAsset;
}) {
  return (
    <span
      role={asset.altText ? "img" : undefined}
      aria-label={asset.altText || undefined}
      aria-hidden={asset.altText ? undefined : true}
      className={`absolute pointer-events-none ${className}`}
      style={layerStyle(placement, asset)}
    />
  );
}

export function CompositionMobilePreview({ article, assets, composition }: CompositionMobilePreviewProps) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const visiblePlacements = composition.assets.filter((placement) => placement.isVisible && assetById.has(placement.assetId));
  const placementsFor = (slot: ArticleCompositionSlot) =>
    visiblePlacements.filter((placement) => placement.slot === slot).sort((a, b) => a.sortOrder - b.sortOrder);
  const heroBackgrounds = placementsFor("hero_background");
  const heroIllustrations = placementsFor("hero_illustration");
  const titleIcons = placementsFor("title_icon");
  const bodyDecorations = placementsFor("body_decoration");
  const footerBanners = placementsFor("footer_banner");

  return (
    <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-lg border border-[#b8d7ff] bg-white shadow-lg">
      <div className="border-b border-[#d8e8ff] bg-[#092046] px-4 py-3 text-xs font-black text-white">
        모바일 구성 미리보기
      </div>

      <div className="relative min-h-64 overflow-hidden bg-[#eef6ff] px-6 py-10">
        {heroBackgrounds.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-full w-full" /> : null;
        })}
        {heroIllustrations.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-40 w-40" /> : null;
        })}
        {titleIcons.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-16 w-16" /> : null;
        })}

        <div className="relative z-30 mx-auto max-w-[290px] text-center">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#184a88]">Mobile Newsletter</p>
          <h3 className="mt-3 break-words text-2xl font-black leading-tight text-[#092046]">{article.title}</h3>
          {article.summary ? <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{article.summary}</p> : null}
        </div>
      </div>

      <div className="relative overflow-hidden px-6 py-8">
        {bodyDecorations.map((placement) => {
          const asset = assetById.get(placement.assetId);
          return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-28 w-28" /> : null;
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
            return asset ? <AssetLayer key={placement.id} placement={placement} asset={asset} className="h-24 w-[90%]" /> : null;
          })}
        </div>
      ) : null}
    </div>
  );
}
