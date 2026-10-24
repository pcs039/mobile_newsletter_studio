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
  const map = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const place = tourismPlaces.find(p => p.id === selected);
  function choose(id: string) { setSelected(id); requestAnimationFrame(() => card.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })); }
  return <section aria-label="화성 관광지도">
    <div className="mb-2 flex items-center justify-between gap-2 px-5"><p className="text-sm font-bold">그림 속 번호를 눌러보세요</p><button className="min-h-11 rounded-full border border-sky-300 bg-white px-4 text-sm font-bold" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>{zoomed ? "지도 전체 보기" : "지도 크게 보기"}</button></div>
    <div ref={map} tabIndex={-1} className="scroll-mt-4 overflow-auto border-y border-sky-200 bg-white" style={{ maxHeight: zoomed ? 420 : undefined }}><div className="relative" style={{ minWidth: zoomed ? 680 : undefined }}>
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
    </div></div>
    <div className="mt-4 grid grid-cols-2 gap-2 px-5">{tourismPlaces.map((p, i) => <button key={p.id} onClick={() => choose(p.id)} aria-pressed={selected === p.id} className={`${action} ${selected === p.id ? "bg-[#125e7c] text-white" : "bg-white text-[#125e7c]"}`}>{i + 1}. {p.name}</button>)}</div>
    <div ref={card} aria-live="polite" className="scroll-mt-4 px-5">
      {place ? <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4" aria-label="선택 관광지 정보">
        <h3 className="text-xl font-black">{place.name}</h3><p className="mt-2 leading-7">{place.description}</p><p className="mt-2 text-sm leading-6">{place.address}</p>
        <div className="mt-3 grid gap-2"><a className={action} target="_blank" rel="noreferrer" href={`https://map.kakao.com/link/search/${encodeURIComponent(place.address + " " + place.name)}`}>지도·길찾기 열기 ↗</a>
          {place.phone ? <a className={action} href={`tel:${place.phone}`}>전화 {place.phone}</a> : <p className="text-sm">공식 원본에 전화번호가 없어 전화 버튼을 제공하지 않습니다.</p>}
          <button className={action} onClick={() => { setSelected(null); map.current?.scrollIntoView({ behavior: "smooth", block: "start" }); map.current?.focus({ preventScroll: true }); }}>지도 첫 화면으로</button></div>
        <p className="mt-3 text-xs leading-5">주소·연락처 출처: 화성시 관광지도. 운영·통행 조건은 방문 전 확인하세요.</p>
      </section> : null}
    </div>
    <a href={tourismSource} target="_blank" rel="noreferrer" className="mx-5 mt-4 block text-xs leading-5 underline">지도 출처: 화성특례시 「화성 여행 꿀팁」 · 담당자 대상 비공개 시연</a>
  </section>;
}

// Only the five private fixtures use this editorial presentation. Saved detail content stays in ArticleCard.
function SampleSummary({ sample, href, onImage }: { sample: ProposalSample; href: string; onImage: (image: PublicArticleLightboxImage) => void }) {
  const dark = sample.kind === "event";
  const imageAlt = sample.kind === "cartoon" ? "창작 3컷: 놀이터 입장에 신난 보호자와 강아지, 뒷정리를 깨닫는 장면, 두 강아지와 함께 웃는 다음 산책" : sample.headline;
  const facts = sample.kind === "policy" ? [
    ["01 · 따로 모으기", "폐건전지와 종이팩을 일반쓰레기·일반 종이와 구분해 모아요."],
    ["02 · 깨끗이 준비", "우유팩은 비우고, 씻고, 말린 뒤 펼쳐 주세요."],
    ["03 · 가까운 센터에서 교환", "읍·면·동 행정복지센터에서 교환하세요. 수량·이용 기준은 상세 원문을 확인하세요."],
  ] : sample.kind === "event" ? [
    ["빛과 음악 · 루나빛축제", "동탄호수공원에서 만나는 가을밤의 풍경"],
    ["전통문화 · 안곡서원 문화제", "지역의 문화를 가까이에서 체험하는 시간"],
    ["공연 · 노작홍사용창작연극제", "지역 예술인들의 이야기가 무대가 되는 순간"],
  ] : sample.kind === "accessible" ? [
    ["체격에 맞는 공간", "반려견의 크기에 따라 나뉜 공간을 이용해요."],
    ["등록 후 QR 입장", "반려견 등록 후 QR코드로 입장해요."],
    ["뒷정리와 서로 배려", "배변을 치우고 다른 이용객과 반려견을 배려해요."],
  ] : [];
  const english = ["Use the area for your dog’s size.", "Register your dog, then enter with a QR code.", "Clean up after your dog and respect others."];
  return <section data-summary-kind={sample.kind} className="pb-5" style={{ backgroundColor: dark ? "#192e46" : sample.pale, color: dark ? "#fff8e8" : "#172e35" }}>
    <div className="px-5 pb-5 pt-4">
      <p className="text-[11px] font-black tracking-[.16em]" style={{ color: dark ? "#eec2a8" : sample.color }}>{sample.eyebrow}</p>
      <h1 data-public-text-scale-target="article-title" className="mt-3 whitespace-pre-line text-[2rem] font-black leading-[1.22] tracking-tight [overflow-wrap:anywhere] [word-break:keep-all]">{sample.headline}</h1>
      {sample.kind === "accessible" ? <p lang="en" className="mt-3 text-base leading-6 text-[#244dae]">A better day out, together.</p> : null}
    </div>
    {sample.kind === "tourism" ? <TourismMap key={sample.article.id} sample={sample} /> : <button className="block w-full bg-transparent text-left" aria-label="요약 이미지 확대" onClick={() => onImage({ src: sample.cover, alt: imageAlt })}>
      <img src={sample.cover} alt={imageAlt} className="block h-auto w-full" />
    </button>}
    <div className="px-5">
      {facts.length ? <ol className={`mt-5 ${sample.kind === "policy" ? "border-l-2 border-[#91b89c] pl-4" : ""}`} aria-label="핵심 정보">
        {facts.map(([title, body], i) => <li key={title} className={`py-3 ${i ? "border-t border-current/15" : ""}`}>
          <h2 data-public-text-scale-target="article-summary" className="text-base font-black leading-7 [overflow-wrap:anywhere]">{title}</h2>
          <p data-public-text-scale-target="article-summary" className={`mt-1 text-sm leading-6 [overflow-wrap:anywhere] ${dark ? "text-[#d0dde5]" : "text-[#435956]"}`}>{body}</p>
          {sample.kind === "accessible" ? <p data-public-text-scale-target="article-summary" lang="en" className="mt-2 text-sm leading-6 text-[#244dae]">{english[i]}</p> : null}
        </li>)}
      </ol> : sample.kind === "cartoon" ? <><p data-public-text-scale-target="article-summary" className="mt-5 text-lg font-black leading-8">즐거운 놀이터의 마지막 한 걸음,<br />뒷정리와 배려입니다.</p><details className="mt-3 text-sm leading-6"><summary className="min-h-11 cursor-pointer content-center underline">만화 대사 글로 읽기</summary><ol className="space-y-2 pb-3" data-public-text-scale-target="article-summary"><li>1. 드디어 놀이터다! — 신나게 입장해요.</li><li>2. 잠깐! 뒷정리도 함께 해야지. — 보호자가 배변 봉투를 챙겨요.</li><li>3. 다음 산책도 기분 좋게! — 서로 배려하며 함께 웃어요.</li></ol></details></> : null}
      <Link href={href} className={`${action} mt-5 w-full border-transparent text-white`} style={{ backgroundColor: dark ? "#ffe0ae" : sample.color, color: dark ? "#192e46" : "white" }}>상세기사 보기 <span aria-hidden="true" className="ml-3">→</span></Link>
      <div className="mt-4 grid gap-3"><span className="text-xs opacity-80">{sample.kind === "cartoon" ? "원문 소재의 창작 시연 만화" : sample.kind === "accessible" ? "영어는 시연 번역 · 공식 공고 아님" : "10월호 원문 기반 · 비공개 시연"}</span><PublicTextSizeToggle compact /></div>
      {sample.article.audioFile?.previewHref ? <details className="mt-3 rounded-xl bg-white/90 px-3 text-[#172e35]"><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">요약 음성 듣기</summary><div className="pb-3"><PublicArticleAudioPlayer key={sample.article.id} ariaLabel="요약 음성 안내" src={sample.article.audioFile.previewHref} /><p className="mt-2 text-xs leading-5 text-slate-500">로컬 기기 합성 요약 음성 · 공식 육성 아님</p></div></details> : null}
      <details className="mt-3 text-xs leading-5 opacity-80"><summary className="min-h-11 cursor-pointer content-center">출처·시연 안내</summary><p>원문: {sample.sourceTitle}<br />상세 원문은 그대로 보존했습니다. 최신 행정·행사 공고가 아닙니다. {sample.kind !== "tourism" ? "이미지는 시연용 일러스트입니다." : "장소 안내는 공식 관광지도에 근거합니다."}</p></details>
    </div>
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
  return <main className="public-newsletter-screen min-h-screen bg-[#e8edef] py-3 sm:px-2 text-[#172e35] sm:py-8">
    <div className="mx-auto mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-xs text-slate-600" style={{ maxWidth: width }}>
      <span>STAGING · 비공개 제안 · 정식 발행 아님</span><div className="flex gap-2"><Link href={href(selectedId, detail, 390)} className="rounded border bg-white px-2 py-2" aria-current={width === 390 ? "page" : undefined}>390px</Link><Link href={href(selectedId, detail, 520)} className="rounded border bg-white px-2 py-2" aria-current={width === 520 ? "page" : undefined}>520px</Link></div>
    </div>
    <div data-sample-width={width} className="mx-auto w-full overflow-hidden sm:rounded-[24px] bg-white shadow-xl" style={{ maxWidth: width }}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-4"><Link href={href()} className="min-h-11 content-center font-black tracking-tight">화성, 가까이</Link><span className="text-xs font-bold text-slate-500">2026.10 · SAMPLE</span></header>
      {selected ? <>
        <nav className="flex flex-wrap items-center justify-between gap-2 px-5 pt-2 text-xs"><Link href={href()} className="min-h-11 content-center font-bold">← 목록</Link><span>{index + 1} / {samples.length} · {detail ? "상세기사" : "요약 첫 페이지"}</span></nav>
        {detail ? <section className="p-3">
          <Link href={href(selected.article.id)} className={`${action} mb-4 w-full text-slate-700`}>← 이전 페이지 · 이 기사 요약</Link>
          <ArticleCard article={{ ...selected.article, blocks: selected.article.blocks.filter(b => !b.metadata.proposal_sample) }} index={index} slug={slug} fontAssets={fonts} onOpenArticleImage={setImage} analyticsDisabled showAdminPreviewControls={false} showTextSizeControl heroBackground={backgrounds[selected.article.id]} textDesign={textDesigns[selected.article.id]} />

        </section> : <SampleSummary key={selected.article.id} sample={selected} href={href(selected.article.id, true)} onImage={setImage} />}
        <nav aria-label="기사 이동" className="grid grid-cols-2 gap-3 border-t border-slate-200 p-5">{prev ? <Link className={action} href={href(prev.article.id)}>← 이전 기사 요약</Link> : <span className="content-center text-center text-xs text-slate-500">첫 기사입니다</span>}{next ? <Link className={action} href={href(next.article.id)}>다음 기사 요약 →</Link> : <span className="content-center text-center text-xs text-slate-500">마지막 기사입니다</span>}</nav>
      </> : <section className="p-5"><p className="text-xs font-black text-[#17694c]">5가지 디자인, 같은 원문</p><h1 className="mt-2 text-3xl font-black leading-tight">손안에서 만나는<br />우리 도시의 소식</h1><p className="mt-4 text-sm leading-6 text-slate-600">기존 화성시 10월호 작업본으로 제작한 비공개 샘플입니다. 각 기사는 이미지 요약과 상세 원문으로 이어집니다.</p>
        <ol className="mt-6 space-y-4">{samples.map(s => <li key={s.article.id}><Link href={href(s.article.id)} className="block overflow-hidden rounded-2xl border border-slate-200"><div className="h-36 overflow-hidden" style={{ backgroundColor: s.pale }}><img src={s.cover} alt="" className="h-full w-full object-contain" /></div><div className="p-4"><p className="text-xs font-black" style={{ color: s.color }}>{s.eyebrow}</p><h2 className="mt-2 text-lg font-black leading-7 [word-break:keep-all]">{s.headline.replace("\n", " ")} →</h2></div></Link></li>)}</ol>
      </section>}
      <footer className="border-t border-slate-200 px-5 py-5 text-xs leading-5 text-slate-500">화성시 담당자 대상 비공개 제안 · 외부 공개·재배포 금지<br />기존 Production 기사·발행 상태는 변경하지 않았습니다.</footer>
    </div><PublicArticleImageLightbox image={image} onClose={() => setImage(null)} />
  </main>;
}
