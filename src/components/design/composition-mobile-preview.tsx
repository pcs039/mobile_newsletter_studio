"use client";

import { useState } from "react";
import { ArticleCard } from "@/components/public-mobile-article-reader";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { PublicArticleImageLightbox, type PublicArticleLightboxImage } from "@/components/public-article-image-lightbox";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { mapAdminArticleAudio, previewAudioNotice } from "@/lib/admin-article-preview";
import { validateArticleFontDesign, type ArticleFontDesign } from "@/lib/article-font-design";
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
  fontDesign?: ArticleFontDesign;
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

export function CompositionMobilePreview({ article, assets, composition, selectedPlacementId, context = {}, fontDesign }: CompositionMobilePreviewProps) {
  const [width, setWidth] = useState(390);
  const [lightbox, setLightbox] = useState<PublicArticleLightboxImage | null>(null);
  const selected = composition.assets.find(p => p.id === selectedPlacementId);
  const selectedAsset = selected && assets.find(a => a.id === selected.assetId);
  const previewArticle = context.slug ? mapAdminArticleAudio(context.slug, [article])[0] : article;

  return (
    <div className="min-w-0" data-composition-preview="">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <label className="font-bold">화면 폭 <select aria-label="즉시 미리보기 화면 폭" value={width} onChange={event => setWidth(Number(event.target.value))} className="rounded border border-slate-300 bg-white p-1">
          <option value={390}>모바일 390px</option><option value={520}>독자 화면 최대 520px</option>
        </select></label>
        <span>작업창보다 넓으면 가용 폭에 맞춥니다.</span>
        {selectedAsset ? <span className="w-full break-words">선택: {selectedAsset.name}</span> : null}
      </div>
      <details className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
        <summary className="cursor-pointer font-bold text-[#092046]">모바일 화면 점검 · 390px → 520px</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>위 화면 폭을 390px, 520px로 바꾸어 제목과 본문의 줄바꿈을 확인하세요.</li>
          <li>미리보기 안의 글자 크기를 최대로 높여 긴 제목·날짜·연락처가 잘리지 않는지 확인하세요.</li>
          <li>이미지를 눌러 확대하고, 행동 버튼의 문구와 연결 대상을 확인하세요. 신청·전화 등 실제 실행은 별도 판단하세요.</li>
          <li>필요한 변경사항을 저장한 뒤 화면 상단의 ‘저장본 미리보기’에서 승인·표시 조건이 반영된 결과를 확인하세요.</li>
        </ol>
        <p className="mt-2">아래는 편집 중 즉시 미리보기입니다. 이 화면 확인만으로 저장·승인·발행되지 않습니다.</p>
      </details>
      <p className="mb-3 text-xs leading-5 text-slate-600">편집 중인 배경·상단 장식과 HTML 디자인을 공용 기사 카드로 표시합니다. draft·미승인 자산도 편집용으로 보일 수 있습니다. 제목 옆 아이콘·본문 주변 장식·하단 배너는 공개 미지원으로 여기에도 표시하지 않습니다.</p>
      <p className="mb-3 text-xs leading-5 text-slate-600">{previewAudioNotice}</p>
      <div className="composition-reader-viewport mx-auto w-full min-w-0" style={{ maxWidth: width, containerType: "inline-size" }}>
        <div className="max-h-[75dvh] overflow-y-auto rounded-lg ring-1 ring-inset ring-[#b8d7ff] bg-[#edf4fb]" aria-label="편집 중인 기사 미리보기">
          <div className="public-newsletter-screen public-mobile-article-reader min-w-0">
            <PublicFontFaceStyle fonts={context.fontAssets ?? []} />
            <div className="px-5 pt-5"><PublicTextSizeToggle compact /></div>
            <ArticleCard key={article.id} article={previewArticle} index={0} slug={context.slug ?? ""} analyticsDisabled
              fontAssets={context.fontAssets ?? []} projectBodyFontAssetId={context.projectBodyFontAssetId} projectTitleFontAssetId={context.projectTitleFontAssetId}
              survey={context.survey} showAdminPreviewControls={false}
              heroBackground={localPreviewLayer(composition, assets, "hero_background")}
              topIllustration={localPreviewLayer(composition, assets, "hero_illustration")}
              textDesign={{ ...readArticleTextDesign(composition.settings.textDesign), fontDesign: fontDesign ?? validateArticleFontDesign(composition.settings.fontDesign) ?? undefined }}
              className="mx-5 my-5" onOpenArticleImage={setLightbox} />
          </div>
        </div>
      </div>
      <PublicArticleImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
