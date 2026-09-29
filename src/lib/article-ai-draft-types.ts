import type { ArticlePublicInfo, ArticlePublicInfoType, ArticleUrgency } from "@/lib/newsletter-repository";

export const articleAiBlockTypes = ["paragraph", "button_group", "video_link", "map_link"] as const;

export type ArticleAiBlockType = (typeof articleAiBlockTypes)[number];

export type ArticleAiDraftBlock = {
  body: string;
  title: string;
  type: ArticleAiBlockType;
};

export type ArticleAiDraft = {
  articleType: ArticlePublicInfoType;
  blocks: ArticleAiDraftBlock[];
  contactName: string;
  contactPhone: string;
  interestTags: string[];
  missingFacts: string[];
  publicInfo: ArticlePublicInfo;
  reviewNotes: string[];
  suggestedUrgency: ArticleUrgency;
  summary: string;
  title: string;
  urgencyReason: string;
};

export type ArticleAiDraftResponse =
  | { draft: ArticleAiDraft; ok: true }
  | { error?: string; message: string; ok: false };
