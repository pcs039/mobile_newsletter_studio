"use client";

import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";
import { samplePresentationArticle, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

// Only expose an existing, content-compatible asset. Tourism/comic mismatch protection stays intact.
export function SampleReadingTools({ sample, generated }: { sample: ProposalSample; generated?: SampleAudio }) {
  const audio = samplePresentationArticle(sample).audioFile;
  return <div data-sample-reading-tools className="mt-3 space-y-2 text-slate-800">
    <PublicTextSizeToggle compact />
    {generated ? <details className="rounded-xl border border-slate-200 bg-white px-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">기사 해설 듣기 · {generated.voice}</summary>
      <div className="pb-3"><p className="mb-2 text-xs text-slate-500">AI 생성 음성 · {sample.kind === "video" ? "원본 영상의 음성이 아닌 기사 해설" : "현재 시연 기사 낭독"}</p>
        <PublicArticleAudioPlayer key={generated.id} ariaLabel="기사 해설 음성" isAiGenerated manifestUrl={generated.manifestHref} />
        <details className="mt-2"><summary className="min-h-11 content-center text-xs font-bold">낭독 대본</summary><p data-public-text-scale-target="article-body" className="whitespace-pre-wrap text-sm leading-7">{generated.transcriptText}</p></details></div>
    </details> : audio?.previewHref ? <details className="rounded-xl border border-slate-200 bg-white px-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">기존 요약 음성 듣기</summary>
      <div className="pb-3"><PublicArticleAudioPlayer key={sample.article.id} ariaLabel="기존 요약 음성 안내" src={audio.previewHref} />
        <p className="mt-2 text-xs leading-5 text-slate-500">기존 로컬 합성 요약 음성 · 공식 육성 아님</p></div>
    </details> : null}
  </div>;
}
