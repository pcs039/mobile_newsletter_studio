import { normalizeSampleInterest } from "@/lib/hwaseong-sample-interest";

export function readSampleLocation(query: Pick<URLSearchParams, "get" | "getAll">, ids: readonly string[]) {
  const id = query.get("articleId");
  const interests = query.getAll("interest");
  return {
    selectedId: id && ids.includes(id) ? id : undefined,
    detail: query.get("view") === "detail",
    contents: query.get("view") === "contents",
    width: query.get("width") === "520" ? 520 as const : 390 as const,
    qa: query.get("qa") === "1",
    interest: normalizeSampleInterest(interests.length === 1 ? interests[0] : undefined),
  };
}

export function canUseSampleHistory(href: string, current: string, slug: string) {
  try {
    const next = new URL(href, current), previous = new URL(current);
    return next.origin === previous.origin && next.pathname === `/projects/${encodeURIComponent(slug)}/samples`;
  } catch { return false; }
}

// Sample-only tuning; the ordinary reader keeps its existing gesture contract.
export function sampleSwipeDirection(start: { x: number; y: number }, end: { x: number; y: number }, viewportWidth: number) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const threshold = Math.min(60, Math.max(40, viewportWidth * 0.1));
  return Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5 ? null : dx < 0 ? "next" : "previous";
}

// Photos may live inside zoom buttons or URL-tagged links. Their short clicks remain native.
export function isSampleSwipeBlocked(target: EventTarget | null) {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target.closest('[data-swipe-navigation-ignore], [role="dialog"], input, select, textarea, audio, video, iframe, summary, [role="slider"], [contenteditable="true"]')) return true;
  const control = target.closest('a, button, [role="button"]');
  const image = target.closest("img") ?? control?.querySelector("img");
  const rect = image?.getBoundingClientRect();
  const imageControl = Boolean(image && (!control || control.hasAttribute("data-sample-swipe-image") || (rect && rect.width >= 80 && rect.height >= 64)));
  if (control && !imageControl) return true;
  if (target.closest("details") && !imageControl) return true;
  for (let node: Element | null = target; node; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true;
  }
  return false;
}

export type SampleSwipe = { x: number; y: number; vertical?: boolean; horizontal?: boolean; pointerId?: number };
export function updateSampleSwipe(start: SampleSwipe, point: { x: number; y: number }, width: number) {
  const dx = Math.abs(point.x - start.x), dy = Math.abs(point.y - start.y);
  if (dy > 10 && dy > dx) start.vertical = true;
  if (!start.vertical && sampleSwipeDirection(start, point, width)) start.horizontal = true;
}
