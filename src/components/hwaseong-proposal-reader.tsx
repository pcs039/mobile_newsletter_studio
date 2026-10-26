"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated private assets retain their original URL. */

import { SampleLink as Link, SamplePageControls, SampleDisclosureIcon } from "@/components/hwaseong-sample-navigation";
import { preload } from "react-dom";
import styles from "./hwaseong-sample-experience.module.css";
import { useSearchParams } from "next/navigation";
import { HwaseongEditorialSample } from "@/components/hwaseong-editorial-sample";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ArticleCard, PublicNewsletterCoverView } from "@/components/public-mobile-article-reader";
import { SampleReadingTools, SampleDetailReadingTools, SampleReadingToolsScope } from "@/components/hwaseong-sample-reading-tools";
import { PublicArticleImageLightbox, type PublicArticleLightboxImage } from "@/components/public-article-image-lightbox";
import type { FontAsset } from "@/lib/newsletter-repository";
import type { ArticleHeroBackground } from "@/lib/article-hero-background";
import type { ArticleTextDesign } from "@/lib/article-text-design";
import { accessibleSampleEnglish, comicScenes, sampleHref, samplePresentationArticle, tourismFeature, tourismPlaces, tourismSource, type ProposalSample } from "@/lib/hwaseong-proposal-sample";
import { normalizeSampleInterest, orderProposalSamples, sampleInterests, type SampleInterest } from "@/lib/hwaseong-sample-interest";
import { buildProposalSearchIndex, searchProposalSamples } from "@/lib/hwaseong-sample-search";
import { HwaseongArticleParticipation } from "@/components/hwaseong-article-participation";
import { SampleShareAction } from "@/components/hwaseong-sample-share";
import { sampleShareTarget } from "@/lib/hwaseong-sample-share";
import { SampleTtsQa } from "@/components/hwaseong-sample-tts-qa";
import { sampleSummaryFacts, type SampleAudio } from "@/lib/hwaseong-sample-narration";
import { canUseSampleHistory, readSampleLocation, sampleSwipeDirection, isSampleSwipeBlocked, updateSampleSwipe, type SampleSwipe } from "@/lib/hwaseong-sample-navigation";
import { isReaderInteractiveTarget, type ReaderPoint } from "@/lib/mobile-reader-navigation";

const action = "inline-flex min-h-11 items-center justify-center rounded-xl border border-current px-4 py-3 text-center text-sm font-bold [overflow-wrap:anywhere]";

function TocThumbnail({ sample, thumbnail, priority }: { sample: ProposalSample; thumbnail?: string; priority?: boolean }) {
  const framed = thumbnail?.startsWith("data:image/webp;base64,") ? thumbnail : undefined;
  // TOC-only crops: the summary and detail keep the complete original image.
  const position = sample.kind === "event" || sample.kind === "accessible"
    ? "center bottom" : sample.kind === "interview" ? "center top" : "center center";
  const comic = sample.kind === "cartoon" && sample.artDirectionVersion === 3;
  return <div data-sample-thumbnail={sample.kind} className="relative aspect-video overflow-hidden" style={{ backgroundColor: sample.pale }}>
    <img src={framed || sample.cover} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "low"} decoding="async" className="absolute inset-x-0 top-0 h-full w-full object-cover"
      style={framed ? undefined : comic
        // Three stacked scenes; show the first scene without the next panel's border.
        ? { height: "306%", objectPosition: "center top" }
        // Center the three recycling illustrations, excluding the image's text bands.
        : sample.kind === "policy" ? { height: "160%", top: "-40%", objectPosition: "center center" }
        : { objectPosition: position, ...(sample.kind === "accessible" ? { transform: "scale(1.05)", transformOrigin: "center bottom" } : {}) }} />
  </div>;
}

function TourismMap({ sample, detailHref }: { sample: ProposalSample; detailHref: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const place = tourismPlaces.find(p => p.id === selected);
  function centerMap(id: string | null) {
    const bounds = map.current;
    const target = tourismPlaces.find(p => p.id === id);
    if (!bounds || !target) return;
    const points = target.points.split(" ").map(p => p.split(",").map(Number));
    const scale = (bounds.firstElementChild?.getBoundingClientRect().width ?? 1024) / 1024;
    const x = points.reduce((sum, p) => sum + p[0], 0) / points.length * scale;
    const y = points.reduce((sum, p) => sum + p[1], 0) / points.length * scale;
    bounds.scrollTo({ left: x - bounds.clientWidth / 2, top: y - bounds.clientHeight / 2, behavior: "smooth" });
  }
  function choose(id: string) { setSelected(id); requestAnimationFrame(() => { if (zoomed) centerMap(id); card.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }); }
  return <section aria-label="화성 관광지도" data-swipe-navigation-ignore>
    <div className="mb-3 flex items-center justify-between gap-2 px-5"><p className="text-xs font-bold tracking-wide text-[#125e7c]">바다 · 역사 · 초록<br /><span className="font-normal tracking-normal">그림 속 번호로 떠나는 여행</span></p><button className="min-h-11 rounded-full border border-sky-300 bg-white px-4 text-sm font-bold" aria-pressed={zoomed} onClick={() => { setZoomed(!zoomed); requestAnimationFrame(() => centerMap(selected)); }}>{zoomed ? "지도 전체 보기" : "지도 크게 보기"}</button></div>
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
    <p className="mx-5 mt-2 text-xs leading-5 text-slate-600">{zoomed ? "확대한 지도는 좌우·위아래로 움직여 볼 수 있어요." : "장소 이름을 눌러도 같은 안내가 열려요."}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 px-5">{tourismPlaces.map((p, i) => <button key={p.id} onClick={() => choose(p.id)} aria-pressed={selected === p.id} className={`min-h-[76px] rounded-xl border p-3 text-left ${selected === p.id ? "border-[#125e7c] bg-[#125e7c] text-white" : "border-sky-200 bg-white text-[#125e7c]"}`}><span className="block text-[10px] tracking-wider opacity-80">0{i + 1} / {i < 3 ? "바다" : i === 3 ? "역사" : "초록"}</span><span className="mt-1 block text-sm font-black [word-break:keep-all]">{p.name}</span></button>)}</div>
    <div ref={card} aria-live="polite" className="scroll-mt-4 px-5">
      {place ? <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4" aria-label="선택 관광지 정보">
        <p className="text-xs font-bold text-[#125e7c]">지금 고른 화성</p><h3 className="mt-1 text-2xl font-black">{place.name}</h3><p data-public-text-scale-target="article-summary" className="mt-2 leading-7">{place.description}</p><p className="mt-2 text-sm leading-6">{place.address}</p>
        <div className="mt-3 grid gap-2"><a className={action} target="_blank" rel="noreferrer" href={`https://map.kakao.com/link/search/${encodeURIComponent(place.address + " " + place.name)}`}>지도에서 장소 찾기 ↗</a>
          {place.phone ? <a className={action} href={`tel:${place.phone}`}>전화 {place.phone}</a> : <p className="text-sm">공식 원본에 전화번호가 없어 전화 버튼을 제공하지 않습니다.</p>}
          <Link className={`${action} bg-[#125e7c] text-white`} href={`${detailHref}#place-${place.id}`}>이 장소 자세히 →</Link>
          <button className={action} onClick={() => { setSelected(null); map.current?.scrollIntoView({ behavior: "smooth", block: "start" }); map.current?.focus({ preventScroll: true }); }}>지도 첫 화면으로</button></div>
        <p className="mt-3 text-xs leading-5">주소·연락처 출처: 화성시 관광지도. 운영·통행 조건은 방문 전 확인하세요.</p>
      </section> : null}
    </div>
    <a href={tourismSource} target="_blank" rel="noreferrer" className="mx-5 mt-4 block text-xs leading-5 underline">지도 출처: 화성특례시 「화성 여행 꿀팁」 · 담당자 대상 비공개 시연</a>
  </section>;
}

function ComicStory({ sample, onImage }: { sample: ProposalSample; onImage: (image: PublicArticleLightboxImage) => void }) {
  return <div aria-label="산책 고수 3컷 만평" className="space-y-3 px-3">
    {comicScenes.map((scene, i) => <figure key={scene.line} className="overflow-hidden rounded-2xl border border-[#dccbb4] bg-[#fffdf6]">
      <button data-sample-swipe-image className="relative block w-full overflow-hidden" style={{ aspectRatio: "2 / 1" }} aria-label={`${i + 1}컷 이미지 확대`} onClick={() => onImage({ src: sample.cover, alt: "같은 보호자와 코기의 가을 산책 3컷. 달리기, 깜빡한 봉투, 강아지가 봉투를 건네는 반전." })}>
        {/* One generated equal-panel artwork; CSS framing keeps its original bytes intact. */}
        <img src={sample.cover} alt={scene.alt} className="absolute left-0 top-0 w-full" style={{ height: "300%", transform: `translateY(-${i * 100 / 3}%)` }} />
      </button>
      <figcaption className="relative px-4 py-3">
        <span aria-hidden="true" className="absolute -top-2 left-7 h-4 w-4 rotate-45 bg-[#fffdf6]" />
        <p className="text-[10px] font-bold tracking-wider text-[#9b522d]">0{i + 1} · {scene.speaker}</p>
        <p data-public-text-scale-target="article-summary" className="mt-1 text-base font-black leading-7 [word-break:keep-all]">“{scene.line}”</p>
      </figcaption>
    </figure>)}
  </div>;
}

function TourismDetail({ sample }: { sample: ProposalSample }) {
  const feature = tourismFeature(sample);
  if (!feature) return <p className="p-5">관광 특집 저장본을 확인할 수 없습니다. 요약 지도로 돌아가 주세요.</p>;
  return <article className="px-3 pb-5" aria-label="화성 관광 특집 상세">
    <div className="space-y-5 px-2 py-6">{feature.paragraphs.map((paragraph, i) => { const [heading, ...lines] = paragraph.split("\n"); return <section key={heading}><p className="text-xs font-black tracking-widest text-[#125e7c]">0{i + 1}</p><h2 data-public-text-scale-target="article-summary" className="mt-1 text-xl font-black">{heading}</h2><p data-public-text-scale-target="article-body" className="mt-2 whitespace-pre-line text-base leading-8 [overflow-wrap:anywhere]">{lines.join("\n")}</p></section>; })}</div>
    <h2 className="px-2 text-lg font-black">마음에 든 곳, 찾아가기</h2>
    <div className="mt-3 space-y-3">{tourismPlaces.map(p => <section id={`place-${p.id}`} key={p.id} className="scroll-mt-4 rounded-xl border border-sky-100 bg-[#f8fbfc] p-4"><h3 className="text-lg font-black">{p.name}</h3><p data-public-text-scale-target="article-summary" className="mt-2 text-sm leading-7">{p.description}</p><p className="mt-2 text-xs leading-6 text-slate-600">{p.address}</p><div className="mt-3 flex flex-wrap gap-2"><a className={action} target="_blank" rel="noreferrer" href={`https://map.kakao.com/link/search/${encodeURIComponent(p.address + " " + p.name)}`}>지도에서 장소 찾기 ↗</a>{p.phone ? <a className={action} href={`tel:${p.phone}`}>전화</a> : null}</div></section>)}</div>
    <p className="mt-5 px-2 text-xs leading-6 text-slate-500">출처: <a className="underline" href={tourismSource} target="_blank" rel="noreferrer">화성특례시 「화성 여행 꿀팁」</a>. 공식 자료를 바탕으로 재구성한 비공개 제안용 특집입니다. 추천 장소 묶음이며 이동 시간·실제 여행 코스를 보장하지 않습니다. 운영 시간·요금·바닷길 통행은 방문 전 확인하세요.</p>

    <details className="mt-4 rounded-xl border border-slate-200 p-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">기존 도시 비전 원문 · 보존 자료</summary><p className="mt-2 text-xs leading-6 text-slate-500">관광 특집의 출처와 다른 기존 기사이며 원문을 변경하지 않았습니다.</p><p data-public-text-scale-target="article-body" className="mt-3 whitespace-pre-wrap text-base leading-8">{sample.article.body}</p></details>
  </article>;
}

// Only the five private fixtures use this editorial presentation. Saved detail content stays in ArticleCard.
function SampleSummary({ sample, href, onImage, audio }: { sample: ProposalSample; href: string; onImage: (image: PublicArticleLightboxImage) => void; audio?: SampleAudio }) {
  const dark = sample.kind === "event";
  const artComic = sample.kind === "cartoon" && sample.artDirectionVersion === 3;
  const imageAlt = sample.kind === "cartoon" ? "창작 3컷: 놀이터 입장에 신난 보호자와 강아지, 뒷정리를 깨닫는 장면, 두 강아지와 함께 웃는 다음 산책" : sample.headline;
  const facts = sampleSummaryFacts(sample.kind);
  return <section data-summary-kind={sample.kind} className="pb-5" style={{ backgroundColor: dark ? "#192e46" : sample.pale, color: dark ? "#fff8e8" : "#172e35" }}>
    <div className="px-5 pb-5 pt-4">
      <p className="text-[11px] font-black tracking-[.16em]" style={{ color: dark ? "#eec2a8" : sample.color }}>{sample.eyebrow}</p>
      <h1 data-public-text-scale-target="article-title" className="mt-3 whitespace-pre-line text-[2rem] font-black leading-[1.22] tracking-tight [overflow-wrap:anywhere] [word-break:keep-all]">{sample.headline}</h1>
      <SampleReadingTools sample={sample} generated={audio} />
      {sample.kind === "accessible" ? <p lang="en" className="mt-3 text-base leading-6 text-[#244dae]">A better day out, together.</p> : null}
    </div>
    {sample.kind === "tourism" ? <TourismMap key={sample.article.id} sample={sample} detailHref={href} /> : artComic ? <ComicStory sample={sample} onImage={onImage} /> : <button data-sample-swipe-image className="block w-full bg-transparent text-left" aria-label="요약 이미지 확대" onClick={() => onImage({ src: sample.cover, alt: imageAlt })}>
      <img src={sample.cover} alt={imageAlt} className="block h-auto w-full" />
    </button>}
    <div className="px-5">
      {sample.kind === "event" ? <p data-public-text-scale-target="article-summary" className="mt-4 text-sm leading-6">2026년 10월호 작업본의 행사 소개를 재구성한 시연입니다. 현재 신청·참여 안내가 아닙니다.</p> : null}
      {facts.length ? <ol className={`mt-5 ${sample.kind === "policy" ? "border-l-2 border-[#91b89c] pl-4" : ""}`} aria-label="핵심 정보">
        {facts.map(([title, body], i) => <li key={title} className={`py-3 ${i ? "border-t border-current/15" : ""}`}>
          <h2 data-public-text-scale-target="article-summary" className="text-base font-black leading-7 [overflow-wrap:anywhere]">{title}</h2>
          <p data-public-text-scale-target="article-summary" className={`mt-1 text-sm leading-6 [overflow-wrap:anywhere] ${dark ? "text-[#d0dde5]" : "text-[#435956]"}`}>{body}</p>
          {sample.kind === "accessible" ? <p data-public-text-scale-target="article-summary" lang="en" className="mt-2 text-sm leading-6 text-[#244dae]">{accessibleSampleEnglish[i]}</p> : null}
        </li>)}
      </ol> : sample.kind === "cartoon" ? <><p data-public-text-scale-target="article-summary" className="mt-5 text-lg font-black leading-8">즐거운 놀이터의 마지막 한 걸음,<br />뒷정리와 배려입니다.</p><details className="mt-3 text-sm leading-6"><summary className="min-h-11 cursor-pointer content-center underline">만화 대사 글로 읽기</summary><ol className="space-y-2 pb-3" data-public-text-scale-target="article-summary">{artComic ? comicScenes.map((scene, i) => <li key={scene.line}>{i + 1}. {scene.speaker}: {scene.line} — {scene.aside}</li>) : <><li>1. 드디어 놀이터다! — 신나게 입장해요.</li><li>2. 잠깐! 뒷정리도 함께 해야지. — 보호자가 배변 봉투를 챙겨요.</li><li>3. 다음 산책도 기분 좋게! — 서로 배려하며 함께 웃어요.</li></>}</ol></details></> : null}
      <div className="mt-4 grid gap-3"><span className="text-xs opacity-80">{sample.kind === "cartoon" ? "원문 소재의 창작 시연 만화" : sample.kind === "accessible" ? "영어는 시연 번역 · 공식 공고 아님" : sample.kind === "tourism" ? "공식 관광자료 기반 · 비공개 시연" : "10월호 원문 기반 · 비공개 시연"}</span></div>
      <details className="mt-3 text-xs leading-5 opacity-80"><summary className="min-h-11 cursor-pointer content-center">출처·시연 안내</summary><p>{sample.kind === "tourism" ? "출처: 화성특례시 공식 관광지도. 기존 도시 비전 원문은 보존 자료로 분리했습니다." : <>원문: {sample.sourceTitle}<br />{sample.kind === "cartoon" || sample.kind === "accessible" ? "작업본의 확인 근거 없는 입장 설명만 공식 안내에 맞게 정정했습니다." : "상세 원문은 그대로 보존했습니다."}</>} 최신 행정·행사 공고가 아닙니다. {sample.kind !== "tourism" ? "이미지는 시연용 일러스트입니다." : "장소 안내는 공식 관광지도에 근거합니다."}</p>{!audio && (sample.kind === "tourism" || sample.kind === "cartoon") ? <p className="mt-2">현재 콘텐츠에 맞는 음성은 아직 없습니다. 기존 1차 시연 안내 음성은 보존하고 이 화면에서는 숨겼습니다.</p> : null}</details>
    </div>
  </section>;
}

export function HwaseongProposalReader({ slug, samples, fonts, backgrounds, textDesigns, selectedId: initialSelectedId, detail: initialDetail, width: initialWidth, cover, serverTimings, audioIndex = {}, thumbnailIndex = {}, contents: initialContents = false, qa: initialQa = false, interest: initialInterest = "all" }: {
  slug: string; samples: ProposalSample[]; fonts: FontAsset[]; backgrounds: Record<string, ArticleHeroBackground>; textDesigns: Record<string, ArticleTextDesign>;
  selectedId?: string; detail: boolean; width: 390 | 520;
  cover?: Pick<ComponentProps<typeof PublicNewsletterCoverView>, "coverImageSrc" | "coverFit" | "coverLayout" | "coverTitle" | "coverSubtitle" | "coverIssueText" | "masthead">;
  contents?: boolean; qa?: boolean; interest?: SampleInterest;
  serverTimings?: Record<string, number>;
  audioIndex?: Record<string, SampleAudio>;
  thumbnailIndex?: Record<string, string>;
}) {
  const query = useSearchParams();
  const { selectedId, detail, width, contents, qa, interest } = query
    ? readSampleLocation(query, samples.map(s => s.article.id))
    : { selectedId: initialSelectedId, detail: initialDetail, width: initialWidth, contents: initialContents, qa: initialQa, interest: initialInterest };
  const mainRef = useRef<HTMLElement>(null);
  const navigationStarted = useRef<number | null>(null);
  const swipe = useRef<SampleSwipe | null>(null);
  const mouseSwipe = useRef<SampleSwipe | null>(null);
  const swallowClick = useRef(false);
  const [controlsActivity, setControlsActivity] = useState(0);
  const pointer = useRef<(ReaderPoint & { protectedImage?: boolean }) | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const previousLocation = useRef<{ id?: string; detail: boolean }>({ id: undefined, detail: false });
  const [warmImages, setWarmImages] = useState(false);
  const [coverVisited, setCoverVisited] = useState(!initialSelectedId && !initialContents);
  const warmSources = (() => {
    if (!selectedId) return [];
    const ordered = orderProposalSamples(samples, normalizeSampleInterest(interest));
    const position = ordered.findIndex(s => s.article.id === selectedId);
    if (position < 0) return [];
    const nearby = ordered.slice(Math.max(0, position - 1), position + 2);
    return [...new Set(nearby.flatMap(s => [s.cover,
      ...s.article.blocks.filter(b => b.isVisible && b.type === "image" && b.body.startsWith("/api/project-files/preview?")).map(b => b.body),
      ...(backgrounds[s.article.id]?.visible ? [backgrounds[s.article.id].url] : []),
    ]))].slice(0, 6);
  })();
  const [image, setImage] = useState<PublicArticleLightboxImage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const searchIndex = useMemo(() => buildProposalSearchIndex(samples), [samples]);
  const currentInterest = normalizeSampleInterest(interest);
  const orderedSamples = orderProposalSamples(samples, currentInterest);
  const isSearching = Boolean(searchQuery.trim());
  // Filter all seven after ordering: interest changes order, never the search scope.
  const visibleSamples = isSearching ? searchProposalSamples(orderedSamples, searchIndex, searchQuery)
    : orderedSamples.map(sample => ({ sample, snippet: "" }));
  const selected = orderedSamples.find(s => s.article.id === selectedId);
  const index = orderedSamples.findIndex(s => s.article.id === selectedId);
  const prev = orderedSamples[index - 1], next = orderedSamples[index + 1];
  const isCoverView = Boolean(cover && !selected && !contents);
  const href = (id?: string, d = false, w = width) => sampleHref(slug, id, d, w, { qa, interest: currentInterest, sharedEntry: query?.get("entry") === "share" });
  const contentsHref = sampleHref(slug, undefined, false, width, { contents: true, qa, interest: currentInterest });
  if (isCoverView && cover && !cover.coverImageSrc.startsWith("data:")) preload(cover.coverImageSrc, { as: "image", fetchPriority: "high" });
  const previousPage = selected ? prev ? { href: href(prev.article.id), label: "이전 기사로 이동" }
    : { href: contentsHref, label: "목차로 이동" } : contents && cover ? { href: href(), label: "표지로 이동" } : undefined;
  const nextPage = isCoverView ? { href: contentsHref, label: "목차로 이동" } : !selected && orderedSamples[0] ? { href: href(orderedSamples[0].article.id), label: "첫 기사로 이동" }
    : selected && next ? { href: href(next.article.id), label: "다음 기사로 이동" } : undefined;
  const locationKey = `${currentInterest}:${selectedId ?? (isCoverView ? "cover" : "contents")}:${detail}:${width}`;
  function navigateLocal(target: string) {
    if (!canUseSampleHistory(target, window.location.href, slug)) return false;
    const url = new URL(target, window.location.href);
    if (url.href === window.location.href) return true;
    if (isCoverView || (!url.searchParams.has("articleId") && url.searchParams.get("view") !== "contents")) setCoverVisited(true);
    // eslint-disable-next-line react-hooks/purity -- Event handler only; never invoked during render.
    navigationStarted.current = performance.now();
    if (url.searchParams.get("articleId") !== new URL(window.location.href).searchParams.get("articleId")) window.dispatchEvent(new Event("datadiction:stop-article-audio"));
    window.history.pushState(null, "", url);
    return true;
  }
  useLayoutEffect(() => {
    if (previousLocation.current.id !== selectedId) window.dispatchEvent(new Event("datadiction:stop-article-audio"));
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    const hash = window.location.hash;
    if (hash) { try { document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(); } catch { /* Invalid hash stays on the current article. */ } }
    else if (selectedId && detail) {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ block: "start", behavior });
    } else if (selectedId && previousLocation.current.id === selectedId && previousLocation.current.detail) {
      summaryRef.current?.scrollIntoView({ block: "start", behavior });
    } else window.scrollTo({ top: 0, behavior: "instant" });
    previousLocation.current = { id: selectedId, detail };
    const frame = requestAnimationFrame(() => {
      if (mainRef.current && navigationStarted.current !== null) {
        mainRef.current.dataset.sampleNavigationMs = String(Math.round(performance.now() - navigationStarted.current));
        navigationStarted.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [locationKey, selectedId, detail]);
  useEffect(() => {
    if (isCoverView || !selectedId) return; // No original-image warmup on the cover or TOC.
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;
    // Warm only the current/adjacent authorized articles in this
    // document's decoded-image cache. No public, disk, service-worker or cross-project cache.
    const timer = window.setTimeout(() => setWarmImages(true), 750);
    return () => window.clearTimeout(timer);
  }, [isCoverView, selectedId]);
  function finishSwipe(start: SampleSwipe | null, point: ReaderPoint) {
    if (!start || image) return;
    updateSampleSwipe(start, point, window.innerWidth);
    if (start.horizontal) swallowClick.current = true;
    if (start.vertical || window.getSelection()?.toString()) return;
    const direction = sampleSwipeDirection(start, point, window.innerWidth);
    const target = direction === "next" ? nextPage : direction === "previous" ? previousPage : undefined;
    if (direction) swallowClick.current = true;
    if (target) navigateLocal(target.href);
  }
  return <main ref={mainRef} data-sample-location={locationKey} data-sample-initial-fetch={qa ? JSON.stringify(serverTimings) : undefined} onPointerDownCapture={event => {
      swallowClick.current = false;
      const blocked = isSampleSwipeBlocked(event.target);
      const visual = event.target instanceof Element && (event.target.closest("img") || event.target.closest("button, a")?.querySelector("img"));
      pointer.current = { x: event.clientX, y: event.clientY, protectedImage: blocked && Boolean(visual) };
      mouseSwipe.current = event.pointerType === "touch" || event.button !== 0 || image || blocked
        ? null : { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    }} onPointerMoveCapture={event => {
      const start = mouseSwipe.current;
      if (!start || start.pointerId !== event.pointerId) return;
      updateSampleSwipe(start, { x: event.clientX, y: event.clientY }, window.innerWidth);
      if (start.horizontal) {
        event.preventDefault();
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer may have left the document. */ }
      }
    }} onPointerCancelCapture={() => { mouseSwipe.current = null; pointer.current = null; }}
    onPointerUpCapture={event => {
      const drag = mouseSwipe.current; mouseSwipe.current = null;
      if (drag?.pointerId === event.pointerId) finishSwipe(drag, { x: event.clientX, y: event.clientY });
      const start = pointer.current; pointer.current = null;
      if (start?.protectedImage && sampleSwipeDirection(start, { x: event.clientX, y: event.clientY }, window.innerWidth)) swallowClick.current = true;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10 && !isReaderInteractiveTarget(event.target)) setControlsActivity(value => value + 1);
    }} onDragStartCapture={event => {
      if (!isSampleSwipeBlocked(event.target)) event.preventDefault();
    }}
    onClickCapture={event => {
      if (swallowClick.current && event.detail !== 0) { swallowClick.current = false; event.preventDefault(); event.stopPropagation(); return; }
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      const target = anchor?.getAttribute("href");
      if (target && !anchor?.hasAttribute("download") && (!anchor?.target || anchor.target === "_self") && navigateLocal(target)) event.preventDefault();
    }}
    onTouchStart={event => {
      if (event.touches.length !== 1) swallowClick.current = true;
      swipe.current = image || event.touches.length !== 1 || isSampleSwipeBlocked(event.target)
        ? null : { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }} onTouchMove={event => {
      const start = swipe.current, touch = event.touches[0];
      if (event.touches.length !== 1) { swipe.current = null; swallowClick.current = true; return; }
      if (start && touch) updateSampleSwipe(start, { x: touch.clientX, y: touch.clientY }, window.innerWidth);
    }} onTouchCancel={() => { swipe.current = null; }} onTouchEnd={event => {
      const start = swipe.current, touch = event.changedTouches[0]; swipe.current = null;
      if (touch) finishSwipe(start, { x: touch.clientX, y: touch.clientY });
    }} className={`${styles.screen} public-newsletter-screen min-h-screen bg-[#e8edef] py-3 sm:px-2 text-[#172e35] sm:py-8`}>
    {warmImages ? <div hidden aria-hidden="true" data-sample-image-warmup>{warmSources.map(src => <img key={src} src={src} alt="" width={1} height={1} decoding="async" fetchPriority="low" />)}</div> : null}
    {!image ? <SamplePageControls key={`${locationKey}:${controlsActivity}`} previous={previousPage} next={nextPage} onNavigate={navigateLocal} width={width} /> : null}
    <div className="mx-auto mb-3 flex w-full flex-wrap items-center justify-between gap-2 text-xs text-slate-600" style={{ maxWidth: width }}>
      <span>{qa ? "STAGING QA · " : ""}비공개 제안 시안 · 정식 발행물 아님</span>{qa ? <div className="flex gap-2">{([390, 520] as const).map(w => <Link key={w} href={sampleHref(slug, selectedId, detail, w, { contents: !isCoverView && !selected, qa, interest: currentInterest })} className="rounded border bg-white px-2 py-2" aria-current={width === w ? "page" : undefined}>{w}px</Link>)}</div> : null}
    </div>
    <div data-sample-width={width} className="mx-auto w-full overflow-hidden sm:rounded-[24px] bg-white shadow-xl" style={{ maxWidth: width }}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <span className="text-sm font-black tracking-tight">화성, 가까이</span>
        <nav aria-label="소식지 공통 이동" className="flex gap-2">
          {([{ label: "처음으로", url: href(), current: isCoverView }, { label: selected && query?.get("entry") === "share" ? "전체 소식 보기" : "목록", url: contentsHref, current: !isCoverView && !selected }] as const).map(item => item.current
            ? <button key={item.label} type="button" disabled aria-current="page" className="min-h-11 rounded-xl border border-slate-300 bg-slate-100 px-4 text-sm font-bold text-slate-500">{item.label}</button>
            : <Link key={item.label} href={item.url} className="inline-flex min-h-11 items-center rounded-xl border border-[#125e7c] bg-[#125e7c] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#093c56]">{item.label}</Link>)}
        </nav>
      </header>
      {!isCoverView && !selected ? <nav aria-label="관심분야 선택" data-swipe-navigation-ignore className="mx-4 mt-4 rounded-2xl border border-[#d5e3e7] bg-[#f0f6f7] p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-bold text-[#174c60]">관심분야 · 검색</p><span className="text-[10px] text-slate-500">전체 {samples.length}건에서 검색</span></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">{sampleInterests.map(option => <Link key={option.value} href={sampleHref(slug, undefined, false, width, { contents: !isCoverView, qa, interest: option.value })} aria-current={currentInterest === option.value ? "true" : undefined} className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap ${currentInterest === option.value ? "border-[#125e7c] bg-[#125e7c] text-white" : "border-[#cfdee2] bg-white text-slate-600"}`}>{option.label}</Link>)}</div>
        <div className="mt-2 flex gap-2">
          <label htmlFor="sample-article-search" className="sr-only">기사 검색</label>
          <div className="relative min-w-0 flex-1"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#527280]"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input ref={searchInput} id="sample-article-search" type="search" value={searchQuery} maxLength={100} autoComplete="off" placeholder="반려견, 관광, 재활용, dog"
            aria-describedby="sample-search-help" onChange={e => setSearchQuery(e.currentTarget.value)} className="h-10 w-full min-w-0 rounded-xl border border-[#cfdee2] bg-white pr-3 pl-9 text-base outline-none focus:border-[#125e7c] focus:ring-2 focus:ring-[#125e7c]/30" /></div>
          {isSearching ? <button type="button" onClick={() => { setSearchQuery(""); searchInput.current?.focus(); }} className="min-h-10 shrink-0 rounded-xl border border-[#cfdee2] bg-white px-3 text-xs font-bold text-[#174c60]">검색 종료</button> : null}
        </div>
        <p id="sample-search-help" className="sr-only">관심분야와 관계없이 전체 {samples.length}개 기사에서 찾습니다.</p>
      </nav> : null}
      {cover && (isCoverView || coverVisited) ? <div hidden={!isCoverView} data-sample-cover-persisted>
        <PublicNewsletterCoverView {...cover} compact coverImagePriority slug={slug} hasArticles={orderedSamples.length > 0} coverImageAlt="바다와 도시, 가을 숲, 문화예술과 시민의 일상을 표현한 Canva AI 시연 일러스트. 실제 화성 풍경 사진이 아닙니다." showTextSizeControl tocPrimary tocLabel="소식지 둘러보기" onOpenToc={() => navigateLocal(contentsHref)} onStartReading={() => navigateLocal(href(orderedSamples[0]?.article.id))} />
        <div className="px-5 pb-4"><SampleShareAction target={sampleShareTarget(slug, [cover.masthead, cover.coverIssueText].filter(Boolean).join(" · "))} label="소식지 공유하기" /><p className="mb-3 mt-4 text-[11px] leading-5 text-slate-600">표지 배경은 Canva AI로 제작한 개념 일러스트이며 실제 장소 사진이 아닙니다.</p></div>
      </div> : null}
      {isCoverView ? null : selected ? <SampleReadingToolsScope key={selected.article.id}>
        <nav className="flex flex-wrap items-center justify-between gap-2 px-5 pt-2 text-xs"><span className="py-2 font-bold">기사 읽기</span><span>{currentInterest !== "all" ? `${sampleInterests.find(option => option.value === currentInterest)?.label} · ` : ""}{index + 1} / {orderedSamples.length} · {detail ? "상세기사" : "요약 첫 페이지"}</span></nav>
        <div ref={summaryRef} className={`${styles.summary} scroll-mt-4`} data-sample-summary={selected.kind} data-detail-expanded={detail} key={selected.article.id}>
          {["interview", "video"].includes(selected.kind) ? <HwaseongEditorialSample sample={selected} audio={audioIndex[selected.article.id]} href={href(selected.article.id, true)} detail={false} /> : <SampleSummary sample={selected} audio={audioIndex[selected.article.id]} href={href(selected.article.id, true)} onImage={setImage} />}
        </div>
        {/* Stable section/form identity: toggling detail only inserts/removes its body. */}
        <section ref={detailRef} tabIndex={-1} aria-label={detail ? "펼친 상세기사" : "요약 기사 참여"} data-sample-inline-detail={detail ? "" : undefined} className={`${detail ? styles.detail : ""} scroll-mt-4 border-t border-slate-200 p-5`}>
          {detail ? <div key="detail-body">
          <div className="mb-4 flex items-center justify-between gap-3 px-2"><h2 className="text-lg font-bold">상세기사</h2><Link href={href(selected.article.id)} className={action}>기사 접기 <SampleDisclosureIcon expanded /></Link></div>
          <SampleDetailReadingTools sample={selected} generated={audioIndex[selected.article.id]} />
          {["interview", "video"].includes(selected.kind) ? <HwaseongEditorialSample key={selected.article.id} sample={selected} href={href(selected.article.id, true)} detail /> : selected.kind === "tourism" && tourismFeature(selected) ? <TourismDetail sample={selected} /> : <ArticleCard article={{ ...samplePresentationArticle(selected), showPublicTitle: false, summary: "", audioFile: null, audioSource: "none", blocks: selected.article.blocks.filter(b => !b.metadata.proposal_sample) }} index={index} slug={slug} fontAssets={fonts} onOpenArticleImage={setImage} analyticsDisabled showAdminPreviewControls={false} heroBackground={backgrounds[selected.article.id]} textDesign={{ captionStyled: textDesigns[selected.article.id]?.captionStyled, bodyEmphasis: textDesigns[selected.article.id]?.bodyEmphasis }} />}
          </div> : null}
          {!detail ? <Link key="expand" href={href(selected.article.id, true)} data-sample-expand className={`${action} w-full border-transparent bg-[#125e7c] text-white`}>상세기사 보기 <SampleDisclosureIcon /></Link> : null}
          <HwaseongArticleParticipation key="participation" slug={slug} articleId={selected.article.id} articleTitle={selected.article.title} />
          {detail ? <Link href={href(selected.article.id)} className={`${action} mt-5 w-full text-slate-700`}>기사 접기 · 요약으로 <SampleDisclosureIcon expanded /></Link> : null}
        </section>
        <nav aria-label="기사 이동" className="grid grid-cols-2 gap-3 border-t border-slate-200 p-5">{prev ? <Link className={action} href={href(prev.article.id)}>← 이전 기사</Link> : <Link className={action} href={contentsHref}>← 목록</Link>}{next ? <Link className={action} href={href(next.article.id)}>다음 기사 →</Link> : <span className="content-center text-center text-xs text-slate-500">마지막 기사입니다</span>}</nav>
      </SampleReadingToolsScope> : <section aria-label="기사 목록" className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-2"><h1 aria-live={isSearching ? "polite" : undefined} className="text-base font-black text-[#173f50]">{isSearching ? `검색 결과 ${visibleSamples.length}건` : "기사 목록"}</h1><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">전체 기사 {samples.length}건</span></div>
        {isSearching && !visibleSamples.length ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm leading-6 text-slate-600">검색 결과가 없습니다.<br />다른 검색어를 입력하거나 검색을 종료해 주세요.</p> : null}
        <ol className="space-y-2.5">{visibleSamples.map(({ sample: s, snippet }, visibleIndex) => <li key={s.article.id}><Link href={href(s.article.id)} data-sample-toc-card data-sample-swipe-image title={s.headline.replace("\n", " ")} className="grid min-h-[108px] grid-cols-[112px_minmax(0,1fr)_12px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-[#9bbecb] hover:bg-[#f8fbfc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#125e7c]"><div className="overflow-hidden rounded-lg"><TocThumbnail sample={s} thumbnail={thumbnailIndex[s.article.id]} priority={visibleIndex < 2} /></div><div className="min-w-0"><p className="truncate text-[10px] leading-4 font-bold" style={{ color: s.color }}>{s.eyebrow}</p><h2 className="mt-1 line-clamp-2 text-[15px] leading-5 font-bold text-[#183b49] [overflow-wrap:anywhere]">{s.headline.replace("\n", " ")}</h2>{isSearching ? <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-500 [overflow-wrap:anywhere]">{snippet}</p> : null}</div><svg aria-hidden="true" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-3 text-[#6e8e9c]"><path d="m5 5 7 7-7 7" /></svg></Link></li>)}</ol>
      </section>}
      {qa ? <SampleTtsQa slug={slug} /> : null}
      <footer className="border-t border-slate-200 px-5 py-5 text-xs leading-5 text-slate-500">화성시 담당자 대상 비공개 제안 · 정식 발행물 아님 · 외부 공개·재배포 금지{qa ? <><br />기존 Production 기사·발행 상태는 변경하지 않았습니다.</> : null}</footer>
    </div><PublicArticleImageLightbox image={image} onClose={() => setImage(null)} />
  </main>;
}
