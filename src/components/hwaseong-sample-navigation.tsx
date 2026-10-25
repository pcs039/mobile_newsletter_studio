"use client";

import type { ComponentProps } from "react";

// Same-document links keep normal deep-link, modifier/new-tab and browser history behavior.
// Their parent intercepts only unmodified clicks within this authenticated sample route.
export function SampleLink(props: ComponentProps<"a">) { return <a {...props} />; }

export function SamplePageControls({ previous, next, onNavigate, width, active }: {
  previous?: { href: string; label: string }; next?: { href: string; label: string };
  onNavigate: (href: string) => void; width: number; active: boolean;
}) {
  const className = `fixed top-[55svh] z-40 flex h-14 w-10 items-center justify-center rounded-full border border-white/50 bg-[#092046]/65 text-4xl font-medium text-white shadow-lg backdrop-blur-sm transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#125e7c] active:opacity-100 disabled:pointer-events-none disabled:opacity-15 ${active ? "opacity-100" : "opacity-55"}`;
  return <nav aria-label="좌우 페이지 이동" data-swipe-navigation-ignore>
    {previous ? <button type="button" aria-label={previous.label} onClick={() => onNavigate(previous.href)} className={className} style={{ left: `max(8px, calc(50% - ${width / 2}px + 8px))` }}>‹</button> : null}
    <button type="button" aria-label={next?.label ?? "마지막 기사 · 다음 이동 없음"} disabled={!next} onClick={() => next && onNavigate(next.href)} className={className} style={{ right: `max(8px, calc(50% - ${width / 2}px + 8px))` }}>›</button>
  </nav>;
}
