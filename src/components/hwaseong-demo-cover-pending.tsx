"use client";
import type { ComponentProps } from "react";
import { PublicNewsletterCoverView } from "@/components/public-mobile-article-reader";
import type { HwaseongProposalReader } from "@/components/hwaseong-proposal-reader";
const preparing=()=>{};
export function HwaseongDemoCoverPending({cover}:{cover?:ComponentProps<typeof HwaseongProposalReader>["cover"]}) {
  if(!cover)return null;
  return <main aria-busy="true" data-demo-early-cover className="mx-auto min-h-dvh max-w-[740px] bg-[#f8f3e8]">
    <p className="px-4 py-3 text-xs font-bold text-[#234e43]">영업용 읽기 전용 시연 · 정식 발행물 아님</p>
    <PublicNewsletterCoverView {...cover} compact coverImagePriority slug="hwaseong-2026-10-samples" hasArticles={false} tocPrimary tocLabel="소식지 둘러보기" onOpenToc={preparing} onStartReading={preparing} coverImageAlt="바다와 도시, 가을 숲, 문화예술과 시민의 일상을 표현한 Canva AI 시연 일러스트. 실제 화성 풍경 사진이 아닙니다."/>
  </main>;
}
