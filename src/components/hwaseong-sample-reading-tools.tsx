"use client";

import { articleFontDesignRoles, articleFontDesignStyle, type ArticleFontDesign } from "@/lib/article-font-design";
import type { FontAsset } from "@/lib/newsletter-repository";
import fontStyles from "@/components/article-font-design.module.css";

import { createContext, useContext, useState, type ReactNode } from "react";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";
import { samplePresentationArticle, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

function SplitNarrationPlayer({ audio, detail }: { audio: SampleAudio; detail?: boolean }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-3 text-slate-800" data-split-narration={detail ? "detail" : "summary"}>
    <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{detail ? "상세기사 듣기" : "기사 요약 듣기"}</h3><span className="text-xs capitalize text-slate-500">{audio.voiceLabel??audio.voice}</span></div>
    <PublicArticleAudioPlayer key={audio.id} ariaLabel={detail ? "상세기사 AI 음성" : "기사 요약 AI 음성"} isAiGenerated manifestUrl={audio.manifestHref} initialSegments={audio.initialSegments} />
    <p className="mt-2 text-xs text-slate-500">AI 생성 음성 · {audio.narrationLabel??(detail ? "상세 본문 낭독" : "요약 낭독 전용")}</p>
    <details className="mt-1 text-xs"><summary className="min-h-8 content-center">낭독 대본 확인</summary><p className="whitespace-pre-wrap leading-6">{audio.transcriptText}</p></details>
  </section>;
}

const SampleAudioControlsContext = createContext<{ target: HTMLDivElement | null; setTarget: (target: HTMLDivElement | null) => void } | null>(null);
export function SampleReadingToolsScope({ children, fontDesign, fonts = [] }: { children: ReactNode; fontDesign?: ArticleFontDesign; fonts?: FontAsset[] }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <SampleAudioControlsContext.Provider value={{ target, setTarget }}><div className={`min-w-0 ${fontStyles.scope}`} data-font-roles={articleFontDesignRoles(fontDesign, fonts)} style={articleFontDesignStyle(fontDesign, fonts)} data-sample-audio-scope onPlayCapture={event => { event.currentTarget.querySelectorAll('audio').forEach(audio => { if (audio !== event.target) audio.pause(); }); }}>{children}</div></SampleAudioControlsContext.Provider>;
}
export function SampleDetailReadingTools({ sample, generated }: { sample: ProposalSample; generated?: SampleAudio }) {
  const scope = useContext(SampleAudioControlsContext);
  const audio = samplePresentationArticle(sample).audioFile;
  return <div data-sample-reading-tools="detail" role="group" aria-label="상세기사 읽기 도구" className="mb-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800" data-swipe-navigation-ignore>
    <PublicTextSizeToggle compact />
    {(sample.authorEdited||sample.editorTest)&&!generated ? <p role="status" className="text-xs leading-6 text-amber-800">원고와 일치하는 음성이 없습니다. 요약·상세 음성을 확인하고 필요한 음성을 재생성해 주세요. 자동 생성하지 않습니다.</p> : null}
    {generated?.detail ? <SplitNarrationPlayer audio={generated.detail} detail /> : generated || audio?.previewHref ? <><p className="text-xs leading-5 text-slate-600">{generated ? `AI 기사 해설 · ${generated.voice}` : "기존 요약 음성"} · 요약과 같은 재생 위치</p><div ref={scope?.setTarget} /></> : null}
  </div>;
}

// Only expose an existing, content-compatible asset. Tourism/comic mismatch protection stays intact.
export function SampleReadingTools({ sample, generated }: { sample: ProposalSample; generated?: SampleAudio }) {
  const audio = samplePresentationArticle(sample).audioFile;
  const scope = useContext(SampleAudioControlsContext);
  return <div data-sample-reading-tools="summary" role="group" aria-label="요약 읽기 도구" className="mt-3 space-y-2 text-slate-800">
    <PublicTextSizeToggle compact />
    {(sample.authorEdited||sample.editorTest)&&!generated ? <p role="status" className="text-xs leading-6 text-amber-800">원고와 일치하는 음성이 없습니다. 요약·상세 음성을 확인하고 필요한 음성을 재생성해 주세요. 자동 생성하지 않습니다.</p> : null}
    {generated?.detail ? <SplitNarrationPlayer audio={generated} /> : generated ? <details className="rounded-xl border border-slate-200 bg-white px-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">기사 해설 듣기 · {generated.voice}</summary>
      <div className="pb-3"><p className="mb-2 text-xs text-slate-500">AI 생성 음성 · {sample.kind === "video" ? "원본 영상의 음성이 아닌 기사 해설" : "현재 시연 기사 낭독"}</p>
        <PublicArticleAudioPlayer controlsPortalTarget={scope?.target} key={generated.id} ariaLabel="기사 해설 음성" isAiGenerated manifestUrl={generated.manifestHref} />
        <details className="mt-2"><summary className="min-h-11 content-center text-xs font-bold">낭독 대본</summary><p data-public-text-scale-target="article-body" className="whitespace-pre-wrap text-sm leading-7">{generated.transcriptText}</p></details></div>
    </details> : audio?.previewHref ? <details className="rounded-xl border border-slate-200 bg-white px-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">기존 요약 음성 듣기</summary>
      <div className="pb-3"><PublicArticleAudioPlayer controlsPortalTarget={scope?.target} key={sample.article.id} ariaLabel="기존 요약 음성 안내" src={audio.previewHref} />
        <p className="mt-2 text-xs leading-5 text-slate-500">기존 로컬 합성 요약 음성 · 공식 육성 아님</p></div>
    </details> : null}
  </div>;
}
