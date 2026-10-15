"use client";

import { useState } from "react";
import { ArticleCard } from "@/components/public-mobile-article-reader";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { PublicArticleImageLightbox, type PublicArticleLightboxImage } from "@/components/public-article-image-lightbox";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { readArticleTextDesign } from "@/lib/article-text-design";
import { validateArticleCompositionPlacementSettings, type ProjectArticleComposition } from "@/lib/article-composition";
import type { ArticleHeroBackground } from "@/lib/article-hero-background";
import type { FontAsset, ProjectContentArticle, ProjectDesignAsset, ProjectSurveyItem } from "@/lib/newsletter-repository";

export type CompositionPreviewContext = {
  fontAssets?: FontAsset[];
  projectBodyFontAssetId?: string | null;
  projectTitleFontAssetId?: string | null;
  slug?: string;
  survey?: ProjectSurveyItem | null;
};

type CompositionMobilePreviewProps = {
  article: ProjectContentArticle;
  assets: ProjectDesignAsset[];
  composition: ProjectArticleComposition;
  selectedPlacementId: string | null;
  context?: CompositionPreviewContext;
};

// Local drafts intentionally remain visible regardless of ready/approval state.
// Use the same single supported layer per slot and validation as the saved reader;
// the saved-preview route independently enforces approval/active/ready permissions.
export function localPreviewLayer(composition: ProjectArticleComposition, assets: ProjectDesignAsset[], slot: "hero_background" | "hero_illustration"): ArticleHeroBackground | undefined {
  const placements = composition.assets
    .filter(placement => placement.slot === slot && placement.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  const validTypes = slot === "hero_background" ? ["background", "pattern"] : ["illustration", "decoration"];
  for (const placement of placements) {
    const asset = assets.find(a => a.id === placement.assetId);
    const validation = validateArticleCompositionPlacementSettings(placement.settings, slot);
    if (asset?.previewHref && validTypes.includes(asset.assetType) && validation.ok) return { url: asset.previewHref, visible: true, settings: validation.settings };
  }
}

export function CompositionMobilePreview({ article, assets, composition, selectedPlacementId, context = {} }: CompositionMobilePreviewProps) {
  const [width, setWidth] = useState(390);
  const [lightbox, setLightbox] = useState<PublicArticleLightboxImage | null>(null);
  const selected = composition.assets.find(p => p.id === selectedPlacementId);
  const selectedAsset = selected && assets.find(a => a.id === selected.assetId);

  return (
    <div className="min-w-0" data-composition-preview="">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <label className="font-bold">화면 폭 <select aria-label="즉시 미리보기 화면 폭" value={width} onChange={event => setWidth(Number(event.target.value))} className="rounded border border-slate-300 bg-white p-1">
          <option value={390}>모바일 390px</option><option value={520}>독자 화면 최대 520px</option>
        </select></label>
        <span>작업창보다 넓으면 가용 폭에 맞춥니다.</span>
        {selectedAsset ? <span className="w-full break-words">선택: {selectedAsset.name}</span> : null}
      </div>
      <p className="mb-3 text-xs leading-5 text-slate-600">편집 중인 배경·상단 장식과 HTML 디자인을 공용 기사 카드로 표시합니다. draft·미승인 자산도 편집용으로 보일 수 있습니다. 제목 옆 아이콘·본문 주변 장식·하단 배너는 공개 미지원으로 여기에도 표시하지 않습니다.</p>
      <div className="composition-reader-viewport mx-auto w-full min-w-0" style={{ maxWidth: width, containerType: "inline-size" }}>
        <div className="max-h-[75dvh] overflow-y-auto rounded-lg ring-1 ring-inset ring-[#b8d7ff] bg-[#edf4fb]" aria-label="편집 중인 기사 미리보기">
          <div className="public-newsletter-screen public-mobile-article-reader min-w-0">
            <PublicFontFaceStyle fonts={context.fontAssets ?? []} />
            <div className="px-5 pt-5"><PublicTextSizeToggle compact /></div>
            <ArticleCard key={article.id} article={article} index={0} slug={context.slug ?? ""} analyticsDisabled
              fontAssets={context.fontAssets ?? []} projectBodyFontAssetId={context.projectBodyFontAssetId} projectTitleFontAssetId={context.projectTitleFontAssetId}
              survey={context.survey} showAdminPreviewControls={false}
              heroBackground={localPreviewLayer(composition, assets, "hero_background")}
              topIllustration={localPreviewLayer(composition, assets, "hero_illustration")}
              textDesign={readArticleTextDesign(composition.settings.textDesign)}
              className="mx-5 my-5" onOpenArticleImage={setLightbox} />
          </div>
        </div>
      </div>
      <PublicArticleImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
