"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated private assets retain their original URL and aspect ratio. */

import Link from "next/link";
import { useRef, useState } from "react";
import { ArticleCard } from "@/components/public-mobile-article-reader";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
import { PublicArticleImageLightbox, type PublicArticleLightboxImage } from "@/components/public-article-image-lightbox";
import { PublicTextSizeToggle } from "@/components/public-text-size-toggle";
import type { FontAsset } from "@/lib/newsletter-repository";
import type { ArticleHeroBackground } from "@/lib/article-hero-background";
import type { ArticleTextDesign } from "@/lib/article-text-design";
import { sampleHref, tourismPlaces, tourismSource, type ProposalSample } from "@/lib/hwaseong-proposal-sample";

const action = "inline-flex min-h-11 items-center justify-center rounded-xl border border-current px-4 py-3 text-center text-sm font-bold [overflow-wrap:anywhere]";
function TourismMap({ sample }: { sample: ProposalSample }) {
  const [selected, setSelected] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const place = tourismPlaces.find(p => p.id === selected);
  function choose(id: string) { setSelected(id); requestAnimationFrame(() => card.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })); }
  return <section aria-label="화성 관광지도">
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Original proportions and source polygons stay in the same coordinate system. */}
      <img src={sample.cover} alt="화성시 공식 관광 그림지도. 아래 큰 관광지 선택 버튼으로도 이용할 수 있습니다." width={1024} height={700} className="block h-auto w-full" />
      <svg viewBox="0 0 1024 700" className="absolute inset-0 h-full w-full" role="group" aria-label="지도 관광지 터치 영역">
        {tourismPlaces.map((p, i) => <g key={p.id}>
          <polygon points={p.points} role="button" tabIndex={0} aria-label={`${p.name} 정보 열기`} aria-pressed={selected === p.id}
            onClick={() => choose(p.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(p.id); } }}
            fill={selected === p.id ? "#f9b93466" : "transparent"} stroke={selected === p.id ? "#9b5216" : "#125e7c"} strokeWidth={3} className="cursor-pointer focus:fill-amber-200/60" />
          <text x={Number(p.points.split(" ")[0].split(",")[0]) + 7} y={Number(p.points.split(" ")[0].split(",")[1]) + 24} fill="#073c54" stroke="white" strokeWidth={2} paintOrder="stroke" fontSize={28} fontWeight="900" pointerEvents="none">{i + 1}</text>
        </g>)}
      </svg>
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-600">주요 6곳을 터치할 수 있습니다. 작은 지도 대신 아래 큰 버튼을 이용해도 같은 안내가 열립니다.</p>
    <div className="mt-3 grid grid-cols-2 gap-2">{tourismPlaces.map((p, i) => <button key={p.id} onClick={() => choose(p.id)} aria-pressed={selected === p.id} className={`${action} ${selected === p.id ? "bg-[#125e7c] text-white" : "bg-white text-[#125e7c]"}`}>{i + 1}. {p.name}</button>)}</div>
    <div ref={card} aria-live="polite" className="scroll-mt-4">
      {place ? <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4" aria-label="선택 관광지 정보">
        <h3 className="text-xl font-black">{place.name}</h3><p className="mt-2 leading-7">{place.description}</p><p className="mt-2 text-sm leading-6">{place.address}</p>
        <div className="mt-3 grid gap-2"><a className={action} target="_blank" rel="noreferrer" href={`https://map.kakao.com/link/search/${encodeURIComponent(place.address + " " + place.name)}`}>지도·길찾기 열기 ↗</a>
          {place.phone ? <a className={action} href={`tel:${place.phone}`}>전화 {place.phone}</a> : <p className="text-sm">공식 원본에 전화번호가 없어 전화 버튼을 제공하지 않습니다.</p>}
          <button className={action} onClick={() => { setSelected(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>지도 첫 화면으로</button></div>
        <p className="mt-3 text-xs leading-5">주소·연락처 출처: 화성시 관광지도. 운영·통행 조건은 방문 전 확인하세요.</p>
      </section> : null}
    </div>
    <a href={tourismSource} target="_blank" rel="noreferrer" className="mt-4 block text-xs leading-5 underline">지도 출처: 화성특례시 「화성 여행 꿀팁」 · 담당자 대상 비공개 시연</a>
  </section>;
}

export function HwaseongProposalReader({ slug, samples, fonts, backgrounds, textDesigns, selectedId, detail, width }: {
  slug: string; samples: ProposalSample[]; fonts: FontAsset[]; backgrounds: Record<string, ArticleHeroBackground>; textDesigns: Record<string, ArticleTextDesign>;
  selectedId?: string; detail: boolean; width: 390 | 520;
}) {
  const [image, setImage] = useState<PublicArticleLightboxImage | null>(null);
  const selected = samples.find(s => s.article.id === selectedId);
  const index = samples.findIndex(s => s.article.id === selectedId);
  const prev = samples[index - 1], next = samples[index + 1];
  const href = (id?: string, d = false, w = width) => sampleHref(slug, id, d, w);
  return <main className="public-newsletter-screen min-h-screen bg-[#e8edef] px-2 py-4 text-[#172e35] sm:py-8">
    <div className="mx-auto mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-xs text-slate-600" style={{ maxWidth: width }}>
      <span>STAGING · 비공개 제안 · 정식 발행 아님</span><div className="flex gap-2"><Link href={href(selectedId, detail, 390)} className="rounded border bg-white px-2 py-2" aria-current={width === 390 ? "page" : undefined}>390px</Link><Link href={href(selectedId, detail, 520)} className="rounded border bg-white px-2 py-2" aria-current={width === 520 ? "page" : undefined}>520px</Link></div>
    </div>
    <div data-sample-width={width} className="mx-auto w-full overflow-hidden rounded-[24px] bg-white shadow-xl" style={{ maxWidth: width }}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-4"><Link href={href()} className="min-h-11 content-center font-black tracking-tight">화성, 가까이</Link><span className="text-xs font-bold text-slate-500">2026.10 · SAMPLE</span></header>
      {selected ? <>
        <nav className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 text-sm"><Link href={href()} className="min-h-11 content-center font-bold">← 목록</Link><span>{index + 1} / {samples.length} · {detail ? "상세기사" : "요약 첫 페이지"}</span></nav>
        {detail ? <section className="p-3">
          <Link href={href(selected.article.id)} className={`${action} mb-4 w-full text-slate-700`}>← 이전 페이지 · 이 기사 요약</Link>
          <ArticleCard article={{ ...selected.article, blocks: selected.article.blocks.filter(b => !b.metadata.proposal_sample) }} index={index} slug={slug} fontAssets={fonts} onOpenArticleImage={setImage} analyticsDisabled showAdminPreviewControls={false} showTextSizeControl heroBackground={backgrounds[selected.article.id]} textDesign={textDesigns[selected.article.id]} />
          <p className="mt-3 px-2 text-xs leading-5 text-slate-500">기존 공통 ArticleCard로 저장된 원문·Composition·CTA·업로드 음성을 표시합니다. 정식 공개 상태로 전환하지 않았습니다.</p>
        </section> : <section className="p-5" style={{ backgroundColor: selected.pale }}>
          <p className="text-xs font-black tracking-wide" style={{ color: selected.color }}>{selected.eyebrow}</p>
          <h1 className="mt-4 whitespace-pre-line text-[2rem] font-black leading-[1.25] tracking-tight [overflow-wrap:anywhere] [word-break:keep-all]" style={{ color: selected.color }}>{selected.headline}</h1>
          <p data-public-text-scale-target="article-summary" className="mt-4 text-base leading-7 [overflow-wrap:anywhere]">{selected.summary}</p>
          <div className="mt-3"><PublicTextSizeToggle compact /></div>
          {selected.kind === "tourism" ? <TourismMap key={selected.article.id} sample={selected} /> : <button className="mt-5 block w-full overflow-hidden rounded-2xl border border-black/5 bg-white" aria-label="요약 이미지 확대" onClick={() => setImage({ src: selected.cover, alt: selected.headline })}>
            <img src={selected.cover} alt={selected.kind === "cartoon" ? "창작 3컷: 등록·입장 확인, 배변 처리와 배려, 펫티켓을 지키며 다음 산책" : selected.headline} className="h-auto w-full" />
          </button>}
          {selected.kind === "accessible" ? <div lang="en" className="mt-4 rounded-xl bg-white p-4 leading-7"><p className="font-bold">A good day with your dog.</p><p>Read the original Korean article and a demonstration English translation on the next page.</p></div> : null}
          <Link href={href(selected.article.id, true)} className={`${action} mt-5 w-full border-transparent text-white`} style={{ backgroundColor: selected.color }}>상세기사 보기 →</Link>
          {selected.article.audioFile?.previewHref ? <div className="mt-4 rounded-xl bg-white/80 p-3"><PublicArticleAudioPlayer key={selected.article.id} ariaLabel="요약 음성 안내" src={selected.article.audioFile.previewHref} /><p className="mt-2 text-xs leading-5 text-slate-500">로컬 기기 합성 요약 음성 · 공식 육성·공식 번역 아님</p></div> : null}
          <p className="mt-4 text-xs leading-5 text-slate-500">원문: {selected.sourceTitle}<br />원문은 상세 화면에 보존했습니다. 시연 편집이며 최신 행정·행사 공고가 아닙니다.</p>
        </section>}
        <nav aria-label="기사 이동" className="grid grid-cols-2 gap-3 border-t border-slate-200 p-5">{prev ? <Link className={action} href={href(prev.article.id)}>← 이전 기사 요약</Link> : <span className="content-center text-center text-xs text-slate-500">첫 기사입니다</span>}{next ? <Link className={action} href={href(next.article.id)}>다음 기사 요약 →</Link> : <span className="content-center text-center text-xs text-slate-500">마지막 기사입니다</span>}</nav>
      </> : <section className="p-5"><p className="text-xs font-black text-[#17694c]">5가지 디자인, 같은 원문</p><h1 className="mt-2 text-3xl font-black leading-tight">손안에서 만나는<br />우리 도시의 소식</h1><p className="mt-4 text-sm leading-6 text-slate-600">기존 화성시 10월호 작업본으로 제작한 비공개 샘플입니다. 각 기사는 이미지 요약과 상세 원문으로 이어집니다.</p>
        <ol className="mt-6 space-y-4">{samples.map(s => <li key={s.article.id}><Link href={href(s.article.id)} className="block overflow-hidden rounded-2xl border border-slate-200"><div className="h-36 overflow-hidden" style={{ backgroundColor: s.pale }}><img src={s.cover} alt="" className="h-full w-full object-contain" /></div><div className="p-4"><p className="text-xs font-black" style={{ color: s.color }}>{s.eyebrow}</p><h2 className="mt-2 text-lg font-black leading-7 [word-break:keep-all]">{s.headline.replace("\n", " ")} →</h2></div></Link></li>)}</ol>
      </section>}
      <footer className="border-t border-slate-200 px-5 py-5 text-xs leading-5 text-slate-500">화성시 담당자 대상 비공개 제안 · 외부 공개·재배포 금지<br />기존 Production 기사·발행 상태는 변경하지 않았습니다.</footer>
    </div><PublicArticleImageLightbox image={image} onClose={() => setImage(null)} />
  </main>;
}
