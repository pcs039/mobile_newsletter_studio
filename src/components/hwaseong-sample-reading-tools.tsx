"use client";

import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
import { samplePresentationArticle, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

// Only expose an existing, content-compatible asset. Tourism/comic mismatch protection stays intact.
export function SampleReadingTools({ sample }: { sample: ProposalSample }) {
  const audio = samplePresentationArticle(sample).audioFile;
  return <div data-sample-reading-tools className="mt-3 space-y-2 text-slate-800">
    <PublicTextSizeToggle compact />
    {audio?.previewHref ? <details className="rounded-xl border border-slate-200 bg-white px-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">기존 요약 음성 듣기</summary>
      <div className="pb-3"><PublicArticleAudioPlayer key={sample.article.id} ariaLabel="기존 요약 음성 안내" src={audio.previewHref} />
        <p className="mt-2 text-xs leading-5 text-slate-500">기존 로컬 합성 요약 음성 · 공식 육성 아님</p></div>
    </details> : null}
  </div>;
}
