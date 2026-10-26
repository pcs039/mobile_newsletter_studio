"use client";
/* eslint-disable @next/next/no-img-element -- Private project previews retain authenticated asset URLs. */
import { SampleLink as Link } from "@/components/hwaseong-sample-navigation";
import { useState } from "react";
import styles from "./hwaseong-sample-experience.module.css";
import { SampleReadingTools } from "@/components/hwaseong-sample-reading-tools";
import type { SampleAudio } from "@/lib/hwaseong-sample-narration";
import { editorialFeature, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

const button = "flex min-h-12 items-center justify-center rounded-full border px-5 py-3 text-center text-sm font-bold [overflow-wrap:anywhere]";
export function SampleEditorialText({ articleId, text }: { articleId: string; text: string }) {
  const title = "[화성특급] 화성시 사람들 다 모였다! #화성에코팜테마파크 #선셋콘서트";
  const start = text.indexOf(title);
  if (articleId !== "50bf808f-15b5-4484-8fee-38f7a8acb99d" || start < 0) return text;
  // Blocks change visual line breaks only: every original character/space stays.
  return <>{text.slice(0, start)}{title.split(/(#화성에코팜테마파크|#선셋콘서트)/).map((part, i) => part.startsWith("#") ? <span key={i} data-video-description-tag className="my-1 block font-semibold text-[#d9ff62]">{part}</span> : part)}{text.slice(start + title.length)}</>;
}
function VideoPlayer({ sample, videoId }: { sample: ProposalSample; videoId: string }) {
  const [loaded, setLoaded] = useState(false);
  return <div id="sample-video" className="scroll-mt-4" data-swipe-navigation-ignore>
    <div className="relative aspect-video overflow-hidden bg-black">
      {loaded ? <iframe title={sample.article.title} src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`} className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <button onClick={() => setLoaded(true)} className="group relative h-full w-full" aria-label="공식 유튜브 영상 불러오기">
        <img src={sample.cover} alt="화성온TV 공식 영상 썸네일" width={1280} height={720} className="h-full w-full object-contain" /><span className="absolute inset-0 flex items-center justify-center bg-black/10"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ffec72] text-2xl text-black shadow-xl">▶</span></span>
      </button>}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-300">{loaded ? "재생이 제한되면 아래 ‘유튜브에서 보기’를 이용하세요." : "재생 버튼을 누르면 YouTube 외부 플레이어를 불러옵니다."}</p>
    {loaded ? <button className="mt-2 min-h-11 text-sm underline" onClick={() => setLoaded(false)}>플레이어 닫기 · 재생 중단</button> : null}
  </div>;
}
export function HwaseongEditorialSample({ sample, href, detail, audio }: { sample: ProposalSample; href: string; detail: boolean; audio?: SampleAudio }) {
  const [coverMode, setCoverMode] = useState<"html" | "canva">("html");
  const e = editorialFeature(sample);
  if (!e) return <p className="p-5">출처 정보가 확인되지 않아 이 샘플을 표시하지 않습니다.</p>;
  const video = sample.kind === "video";
  const compare = !video && !detail && !!e.canvaCover;
  const canvaSummary = compare && coverMode === "canva";
  return <article data-editorial-feature={detail ? (video ? "video" : "interview") : undefined} className={`${detail ? styles.editorialArticle : ""} ${video ? "bg-[#111d29] text-[#f7f4e9]" : "bg-[#f6f3ec] text-[#30392e]"} pb-7 [overflow-wrap:anywhere]`}>
    {compare ? <div className="px-4 pt-4"><div role="group" aria-label="인터뷰 표지 비교" className="grid grid-cols-2 gap-2 rounded-xl border border-[#c7c9b8] p-1">
      {([ ["html", "A · HTML 편집형"], ["canva", "B · Canva 표지형"] ] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={coverMode === mode} onClick={() => setCoverMode(mode)} className={`min-h-11 rounded-lg px-2 py-2 text-xs font-bold ${coverMode === mode ? "bg-[#30392e] text-white" : "text-[#30392e]"}`}>{label}</button>)}
    </div></div> : null}
    {detail ? null : canvaSummary ? <h1 className="sr-only">{sample.headline}</h1> : <header className="px-6 pb-5 pt-7">
      <p className={`text-[10px] font-bold tracking-[.23em] ${video ? "text-[#ffec72]" : "text-[#6d735b]"}`}>{video ? "07 / PLAY · HWASEONG" : "06 / PEOPLE · CULTURE"}</p>
      <h1 data-public-text-scale-target="article-title" className={`mt-5 whitespace-pre-line text-[2.4rem] leading-[1.18] tracking-[-.05em] [word-break:keep-all] ${video ? "font-black" : "font-serif font-medium"}`}>{sample.headline}</h1>
      <SampleReadingTools sample={sample} generated={audio} />
      <p data-public-text-scale-target="article-summary" className="mt-4 text-sm leading-7 opacity-80">{sample.summary}</p>
      {!video ? <p className="mt-5 border-t border-[#adb19e] pt-3 text-sm"><strong className="mr-3 text-lg">{e.person}</strong>{e.role}</p> : <p className="mt-4 text-xs tracking-wide text-[#ffec72]">화성특례시 · 화성온TV / {e.publishedDate}</p>}
    </header>}
    {detail ? null : video ? <div className="px-4"><VideoPlayer key={sample.article.id} sample={sample} videoId={e.videoId} /></div> : canvaSummary ? <figure className="mt-4"><Link data-sample-swipe-image href={href} aria-label="Canva 표지에서 상세기사 보기"><img src={e.canvaCover} alt="신현정 인물 인터뷰 Canva 표지. 표지의 인물 이야기 버튼을 포함해 이미지를 누르면 HTML 상세기사를 펼칩니다." width={1080} height={1920} className="block h-auto w-full" /></Link><figcaption className="px-6 pt-2 text-[10px] leading-5 opacity-70">{e.credit}<br />Canva 인터뷰·인물형 02 · 표지를 누르면 상세기사</figcaption></figure> : <figure><img src={sample.cover} alt={`${e.person} 작가의 실제 인터뷰 사진`} width={690} height={518} className="block h-auto w-full" /><figcaption className="px-6 pt-2 text-[10px] leading-5 opacity-70">{e.credit}</figcaption></figure>}
    <div className="px-6">
      {canvaSummary ? <SampleReadingTools sample={sample} generated={audio} /> : null}
      {!video && (detail || !canvaSummary) ? <blockquote data-interview-quote className="my-6 border-l border-[#8c966e] pl-5"><span aria-hidden="true" className="block h-8 font-serif text-5xl text-[#77835b]">“</span><p data-public-text-scale-target="article-summary" className="font-serif text-[1.4rem] leading-[1.7] tracking-tight">{e.quote}</p><footer className="mt-3 text-xs opacity-70">신현정 · 중부일보 인터뷰 중</footer></blockquote> : null}
      {!detail ? <>{canvaSummary ? <p className="mt-4 text-xs leading-6">표지의 글자는 이미지입니다. 표지를 눌러 상세기사에서 본문·인용문을 글자로 확대해 읽을 수 있습니다.</p> : null}{video ? <a className={`${button} mt-3 border-white/30`} href={e.sourceUrl} target="_blank" rel="noreferrer">유튜브에서 보기 ↗</a> : null}</> : <div className={styles.editorialFlow}>
        <p className={styles.editorialNote}>{e.note}</p>
        {e.sections.map((s, i) => <section data-editorial-chapter key={s.title}><div className={styles.editorialChapterHeading}>{!s.title.startsWith(`0${i + 1} · `) ? <p aria-hidden="true" className={styles.chapterNumber}>0{i + 1}</p> : null}<h2 data-public-text-scale-target="article-summary">{s.title}</h2></div><p data-public-text-scale-target="article-body" data-text-alignment={sample.article.bodyAlignment || sample.article.textAlignment || "left"} className="mt-4 whitespace-pre-line [overflow-wrap:anywhere]"><SampleEditorialText articleId={sample.article.id} text={s.text} /></p></section>)}
        <a className={`${button} ${video ? "border-[#ffec72] text-[#ffec72]" : "border-[#30392e]"}`} href={e.sourceUrl} target="_blank" rel="noreferrer">{video ? "유튜브에서 원본 보기" : "인터뷰 원문 읽기"} ↗</a>
        {!video && e.canvaCover ? <details className="border-t border-current/20 pt-2"><summary className="min-h-11 cursor-pointer content-center text-sm">Canva 제작 표지 확인</summary><img src={e.canvaCover} alt="Canva 인물형 02 템플릿으로 제작한 인터뷰 표지. 본문과 핵심 문구는 위 HTML로 읽을 수 있습니다." width={1080} height={1920} className="mt-2 h-auto w-full" /><p className="mt-2 text-xs leading-5 opacity-70">인터뷰·인물형 02 · 메인형 템플릿 제작 결과. 실제 기사 제목·인용·본문은 확대 가능한 HTML로 별도 유지합니다.</p></details> : null}
      </div>}
      {!video ? <details className="mt-4 border-t border-current/20 pt-1 text-xs leading-6"><summary className="min-h-11 cursor-pointer content-center font-bold">사진·Canva 자산의 외부 사용 권리</summary><p>중부일보 이준도 기자의 사진에 대한 별도 재사용 허가는 확인되지 않았습니다. 출처 표시만으로 외부 제안·재배포 권리가 확보되는 것은 아닙니다.</p><p className="mt-2">Canva 출력 성공은 템플릿과 포함 요소의 모든 이용 조건이나 업로드한 사진의 권리까지 확인했다는 뜻이 아닙니다. 사진 권리와 Canva 요소의 이용 조건을 각각 확인한 뒤 외부 전달·공개 여부를 결정해야 합니다.</p></details> : null}
      <p className="mt-4 text-[10px] leading-5 opacity-65">출처: {sample.sourceTitle} · {e.publishedDate}<br />{e.note}</p>
    </div>
  </article>;
}
