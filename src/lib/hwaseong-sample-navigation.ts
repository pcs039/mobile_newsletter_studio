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
