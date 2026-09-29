export const articleEventTypes = [
  "article_view",
  "phone_click",
  "map_click",
  "cta_click",
  "survey_click",
  "audio_play",
] as const;

export type ArticleEventType = (typeof articleEventTypes)[number];

// Event meanings are intentionally narrow: views and audio are session-deduped,
// while phone, map, CTA, and survey events represent actual click attempts.
