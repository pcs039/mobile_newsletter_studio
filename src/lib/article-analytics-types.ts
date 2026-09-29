export const articleEventTypes = [
  "article_view",
  "phone_click",
  "map_click",
  "cta_click",
  "survey_click",
  "audio_play",
] as const;

export type ArticleEventType = (typeof articleEventTypes)[number];

export type AnalyticsPeriod = "7d" | "30d" | "all";

export type AnalyticsPeriodRange = {
  endDate: string;
  label: string;
  period: AnalyticsPeriod;
  startDate: string | null;
  startIso: string | null;
};

const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeAnalyticsPeriod(value: string | null | undefined): AnalyticsPeriod {
  return value === "7d" || value === "all" ? value : "30d";
}

export function getAnalyticsPeriodRange(period: AnalyticsPeriod, now = new Date()): AnalyticsPeriodRange {
  const koreaNow = new Date(now.getTime() + KOREA_OFFSET_MS);
  const todayUtc = Date.UTC(koreaNow.getUTCFullYear(), koreaNow.getUTCMonth(), koreaNow.getUTCDate());
  const endDate = new Date(todayUtc).toISOString().slice(0, 10);

  if (period === "all") {
    return { endDate, label: "전체 누적", period, startDate: null, startIso: null };
  }

  const dayCount = period === "7d" ? 7 : 30;
  const startDate = new Date(todayUtc - (dayCount - 1) * DAY_MS).toISOString().slice(0, 10);
  const startIso = new Date(`${startDate}T00:00:00+09:00`).toISOString();

  return {
    endDate,
    label: period === "7d" ? "최근 7일" : "최근 30일",
    period,
    startDate,
    startIso,
  };
}

// Event meanings are intentionally narrow: views and audio are session-deduped,
// while phone, map, CTA, and survey events represent actual click attempts.
