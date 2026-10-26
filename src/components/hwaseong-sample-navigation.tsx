"use client";

import type { ComponentProps } from "react";
import styles from "./hwaseong-sample-experience.module.css";

// Same-document links keep normal deep-link, modifier/new-tab and browser history behavior.
// Their parent intercepts only unmodified clicks within this authenticated sample route.
export function SampleLink(props: ComponentProps<"a">) { return <a {...props} />; }

export function SamplePageControls({ previous, next, onNavigate, width }: {
  previous?: { href: string; label: string }; next?: { href: string; label: string };
  onNavigate: (href: string) => void; width: number;
}) {
  const className = "fixed top-[75svh] z-40 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-[#092046]/35 text-4xl font-medium text-white shadow-sm backdrop-blur-[2px] hover:bg-[#092046]/75 focus-visible:bg-[#092046]/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#125e7c] disabled:pointer-events-none disabled:opacity-15";
  return <nav aria-label="좌우 페이지 이동" data-swipe-navigation-ignore className={styles.arrows}>
    {previous ? <button type="button" aria-label={previous.label} onClick={() => onNavigate(previous.href)} className={className} style={{ left: `max(8px, calc(50% - ${width / 2}px + 8px))` }}>‹</button> : null}
    <button type="button" aria-label={next?.label ?? "마지막 기사 · 다음 이동 없음"} disabled={!next} onClick={() => next && onNavigate(next.href)} className={className} style={{ right: `max(8px, calc(50% - ${width / 2}px + 8px))` }}>›</button>
  </nav>;
}

export function SampleDisclosureIcon({ expanded = false }: { expanded?: boolean }) {
  return <span aria-hidden="true" className="ml-2 inline-block shrink-0 text-lg leading-none">{expanded ? "↑" : "↓"}</span>;
}
