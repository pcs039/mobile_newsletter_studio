"use client";
/* eslint-disable @next/next/no-img-element -- Private project previews retain authenticated asset URLs. */
import Link from "next/link";
import { useState } from "react";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import { editorialFeature, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

const button = "flex min-h-12 items-center justify-center rounded-full border px-5 py-3 text-center text-sm font-bold [overflow-wrap:anywhere]";
function VideoPlayer({ sample, videoId }: { sample: ProposalSample; videoId: string }) {
  const [loaded, setLoaded] = useState(false);
  return <div id="sample-video" className="scroll-mt-4">
    <div className="relative aspect-video overflow-hidden bg-black">
      {loaded ? <iframe title={sample.article.title} src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`} className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <button onClick={() => setLoaded(true)} className="group relative h-full w-full" aria-label="공식 유튜브 영상 불러오기">
        <img src={sample.cover} alt="화성온TV 공식 영상 썸네일" width={1280} height={720} className="h-full w-full object-contain" /><span className="absolute inset-0 flex items-center justify-center bg-black/10"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ffec72] text-2xl text-black shadow-xl">▶</span></span>
      </button>}
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-300">{loaded ? "재생이 제한되면 아래 ‘유튜브에서 보기’를 이용하세요." : "재생 버튼을 누르면 YouTube 외부 플레이어를 불러옵니다."}</p>
    {loaded ? <button className="mt-2 min-h-11 text-sm underline" onClick={() => setLoaded(false)}>플레이어 닫기 · 재생 중단</button> : null}
  </div>;
}
export function HwaseongEditorialSample({ sample, href, detail }: { sample: ProposalSample; href: string; detail: boolean }) {
  const e = editorialFeature(sample);
  if (!e) return <p className="p-5">출처 정보가 확인되지 않아 이 샘플을 표시하지 않습니다.</p>;
  const video = sample.kind === "video";
  return <article className={`${video ? "bg-[#111d29] text-[#f7f4e9]" : "bg-[#f6f3ec] text-[#30392e]"} pb-7 [overflow-wrap:anywhere]`}>
    <header className="px-6 pb-5 pt-7">
      <p className={`text-[10px] font-bold tracking-[.23em] ${video ? "text-[#ffec72]" : "text-[#6d735b]"}`}>{video ? "07 / PLAY · HWASEONG" : "06 / PEOPLE · CULTURE"}</p>
      <h1 data-public-text-scale-target="article-title" className={`mt-5 whitespace-pre-line text-[2.4rem] leading-[1.18] tracking-[-.05em] [word-break:keep-all] ${video ? "font-black" : "font-serif font-medium"}`}>{sample.headline}</h1>
      <p data-public-text-scale-target="article-summary" className="mt-4 text-sm leading-7 opacity-80">{sample.summary}</p>
      {!video ? <p className="mt-5 border-t border-[#adb19e] pt-3 text-sm"><strong className="mr-3 text-lg">{e.person}</strong>{e.role}</p> : <p className="mt-4 text-xs tracking-wide text-[#ffec72]">화성특례시 · 화성온TV / {e.publishedDate}</p>}
    </header>
    {video ? <div className="px-4"><VideoPlayer key={sample.article.id} sample={sample} videoId={e.videoId} /></div> : <figure><img src={sample.cover} alt={`${e.person} 작가의 실제 인터뷰 사진`} width={690} height={518} className="block h-auto w-full" /><figcaption className="px-6 pt-2 text-[10px] leading-5 opacity-70">{e.credit}</figcaption></figure>}
    <div className="px-6">
      {!video ? <blockquote className="my-6 border-l border-[#8c966e] pl-5"><span aria-hidden="true" className="block h-8 font-serif text-5xl text-[#77835b]">“</span><p data-public-text-scale-target="article-summary" className="font-serif text-[1.4rem] leading-[1.7] tracking-tight">{e.quote}</p><footer className="mt-3 text-xs opacity-70">신현정 · 중부일보 인터뷰 중</footer></blockquote> : null}
      {!detail ? <><Link className={`${button} mt-6 ${video ? "border-[#ffec72] bg-[#ffec72] text-[#111d29]" : "border-[#30392e] bg-[#30392e] text-white"}`} href={href}>상세기사 보기 <span aria-hidden="true" className="ml-3">↗</span></Link>{video ? <a className={`${button} mt-3 border-white/30`} href={e.sourceUrl} target="_blank" rel="noreferrer">유튜브에서 보기 ↗</a> : null}</> : <div className="mt-7 space-y-7">
        <p className="border-y border-current/20 py-4 text-xs leading-6 opacity-75">{e.note}</p>
        {e.sections.map((s, i) => <section key={s.title}><p className={`mb-2 text-[10px] tracking-[.2em] ${video ? "text-[#ffec72]" : "text-[#77835b]"}`}>0{i + 1} / {video ? "OFFICIAL VIDEO NOTES" : "ARTIST NOTES"}</p><h2 data-public-text-scale-target="article-summary" className="text-xl font-bold leading-8">{s.title}</h2><p data-public-text-scale-target="article-body" className="mt-3 whitespace-pre-line text-base leading-[1.95]">{s.text}</p></section>)}
        <a className={`${button} ${video ? "border-[#ffec72] text-[#ffec72]" : "border-[#30392e]"}`} href={e.sourceUrl} target="_blank" rel="noreferrer">{video ? "유튜브에서 원본 보기" : "인터뷰 원문 읽기"} ↗</a>
        {!video && e.canvaCover ? <details className="border-t border-current/20 pt-2"><summary className="min-h-11 cursor-pointer content-center text-sm">Canva 제작 표지 확인</summary><img src={e.canvaCover} alt="Canva 인물형 02 템플릿으로 제작한 인터뷰 표지. 본문과 핵심 문구는 위 HTML로 읽을 수 있습니다." width={1080} height={1920} className="mt-2 h-auto w-full" /><p className="mt-2 text-xs leading-5 opacity-70">인터뷰·인물형 02 · 메인형 템플릿 제작 결과. 실제 기사 제목·인용·본문은 확대 가능한 HTML로 별도 유지합니다.</p></details> : null}
      </div>}
      <div className="mt-6"><PublicTextSizeToggle compact /></div>
      <p className="mt-4 text-[10px] leading-5 opacity-65">출처: {sample.sourceTitle} · {e.publishedDate}<br />{e.note}</p>
    </div>
  </article>;
}
