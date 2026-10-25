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
