"use client";
/* eslint-disable @next/next/no-img-element -- Existing private, authenticated thumbnails. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { enablePageTurnSoundWithPreview, readPageTurnSoundPreference, savePageTurnSoundPreference, subscribeToPageTurnSoundPreference } from "@/lib/page-turn-sound";
import type { SampleDisplay } from "@/lib/sample-reader-display";
import styles from "./hwaseong-sample-experience.module.css";

const desktopQuery = "(min-width: 1100px) and (min-height: 600px) and (pointer: fine)";
function subscribe(onChange: () => void) { const m = window.matchMedia(desktopQuery); m.addEventListener("change", onChange); return () => m.removeEventListener("change", onChange); }
export function useSampleDesktopSuggestion() { return useSyncExternalStore(subscribe, () => window.matchMedia(desktopQuery).matches, () => false); }
export type HtmlEbookPage = { id: string; title: string; href: string; thumbnail?: string };
export function SampleDisplayToolbar({ mode, onMode, spread, onSpread, zoom, onZoom, fit, onFit, article, previous, next, contentsHref, onNavigate }: {
  mode: SampleDisplay; onMode: (mode: SampleDisplay) => void; spread: boolean; onSpread: (double: boolean) => void;
  zoom: number; onZoom: (zoom: number) => void; fit: boolean; onFit: () => void; article: boolean; previous?: HtmlEbookPage; next?: HtmlEbookPage; contentsHref: string; onNavigate: (href: string) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false), [message, setMessage] = useState("");
  const sound = useSyncExternalStore(subscribeToPageTurnSoundPreference, readPageTurnSoundPreference, () => true);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const savedScroll = useRef<{ element: HTMLElement; top: number; left: number }[]>([]);
  useEffect(() => { const changed = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", changed); return () => document.removeEventListener("fullscreenchange", changed); }, []);
  useEffect(() => {
    // Restore the same mounted pages/forms, including when ESC exits fullscreen.
    let frame = 0;
    const restore = () => { frame = requestAnimationFrame(() => savedScroll.current.forEach(({ element, top, left }) => element.scrollTo({ top, left, behavior: "instant" }))); };
    document.addEventListener("fullscreenchange", restore);
    return () => { document.removeEventListener("fullscreenchange", restore); cancelAnimationFrame(frame); };
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        const main = toggleRef.current?.closest("main");
        savedScroll.current = Array.from(main?.querySelectorAll<HTMLElement>("[data-sample-scroll], [data-sample-summary], [data-sample-inline-detail], [data-sample-audio-scope], aside") ?? []).map(element => ({ element, top: element.scrollTop, left: element.scrollLeft }));
        await main?.requestFullscreen();
      }
      setMessage("");
    }
    catch { setMessage("이 브라우저에서는 전체화면을 사용할 수 없습니다."); }
  }
  return <div className={styles.displayToolbar} data-swipe-navigation-ignore>
    <div role="group" aria-label="읽기 화면 선택" className={styles.displayModes}>
      {([ ["mobile", "모바일 보기"], ["ebook", "e-book 보기"] ] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={mode===value} onClick={()=>onMode(value)}>{label}</button>)}
    </div>
    <div className={styles.bookToolbar} hidden={mode!=="ebook"} role="toolbar" aria-label="HTML e-book 도구">
      <button type="button" disabled={!previous} onClick={()=>previous&&onNavigate(previous.href)} aria-label="e-book 이전 페이지">‹ 이전</button>
      <button type="button" disabled={!next} onClick={()=>next&&onNavigate(next.href)} aria-label="e-book 다음 페이지">다음 ›</button>
      <button type="button" onClick={()=>onNavigate(contentsHref)}>목차·검색</button>
      <span className={styles.toolDivider} />
      <button type="button" aria-pressed={!spread} onClick={()=>onSpread(false)}>1쪽</button>
      <button type="button" aria-pressed={spread} disabled={!article} onClick={()=>onSpread(true)}>2쪽 · 요약/상세</button>
      <button type="button" disabled={zoom<=75} onClick={()=>onZoom(Math.max(75,zoom-25))} aria-label="e-book 축소">−</button>
      <output aria-label="e-book 확대율">{fit ? "자동 맞춤" : `${zoom}%`}</output>
      <button type="button" disabled={zoom>=175} onClick={()=>onZoom(Math.min(175,zoom+25))} aria-label="e-book 확대">＋</button>
      <button type="button" aria-pressed={fit} onClick={onFit}>화면 맞춤</button>
      <button ref={toggleRef} type="button" onClick={()=>void toggleFullscreen()}>{fullscreen?"전체화면 종료":"전체화면"}</button>
      <button type="button" aria-pressed={sound} onClick={()=>{if(sound)savePageTurnSoundPreference(false);else void enablePageTurnSoundWithPreview();}}>효과음 {sound?"켜짐":"꺼짐"}</button>
    </div>
    {mode==="ebook" ? <p className={styles.bookHint}>HTML 기사형 · 2쪽은 같은 기사의 요약/상세 · 좁은 화면은 1쪽 · 긴 본문은 책 안에서 스크롤</p> : null}
    {message?<p role="status">{message}</p>:null}
  </div>;
}
export function SampleEbookThumbnails({ pages, currentId, visible, onNavigate }: { pages: HtmlEbookPage[]; currentId: string; visible: boolean; onNavigate: (href: string) => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(()=>{if(visible)panel.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block:"nearest"});},[currentId,visible]);
  return <aside ref={panel} className={styles.bookThumbnails} aria-label="e-book 썸네일 목차" data-swipe-navigation-ignore>
    <p>화성, 가까이 <span>비공개 제안 시안</span></p>
    <ol>{pages.map((p,i)=><li key={p.id}><a href={p.href} aria-current={p.id===currentId?"page":undefined} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onNavigate(p.href);}}}>
      {p.thumbnail?<img src={p.thumbnail} loading="lazy" alt=""/>:<span className={styles.bookIndexIcon}>☷</span>}<span><small>{i===0?"COVER":i===1?"CONTENTS":String(i-1).padStart(2,"0")}</small>{p.title}</span>
    </a></li>)}</ol>
  </aside>;
}
