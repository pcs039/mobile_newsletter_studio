import type { ArticlePublicInfo, ArticlePublicInfoType, ArticleUrgency } from "@/lib/newsletter-repository";

export const articleAiBlockTypes = ["paragraph", "button_group", "video_link", "map_link"] as const;
export const articleAiPhotoRecommendations = ["representative", "supporting", "omit"] as const;
export const articleAiPhotoPlacements = ["first_content", "after_paragraph_1", "after_paragraph_2"] as const;

export type ArticleAiBlockType = (typeof articleAiBlockTypes)[number];

export type ArticleAiDraftBlock = {
  body: string;
  title: string;
  type: ArticleAiBlockType;
};

export type ArticleAiPhotoRecommendation = (typeof articleAiPhotoRecommendations)[number];
export type ArticleAiPhotoPlacement = (typeof articleAiPhotoPlacements)[number];

export type ArticleAiPhotoSuggestion = {
  altText: string;
  caption: string;
  placement: ArticleAiPhotoPlacement;
  reason: string;
  recommendation: ArticleAiPhotoRecommendation;
  sourceId: string;
};

export type ArticleAiPhotoAssetInput = {
  fileName: string;
  mimeType: string;
  sourceId: string;
  storagePath: string;
};

export type ArticleAiPhotoApplyInput = Pick<
  ArticleAiPhotoSuggestion,
  "caption" | "placement" | "sourceId"
> & {
  storagePath: string;
};

export type ArticleAiDraft = {
  articleType: ArticlePublicInfoType;
  blocks: ArticleAiDraftBlock[];
  contactName: string;
  contactPhone: string;
  interestTags: string[];
  missingFacts: string[];
  photoSuggestions: ArticleAiPhotoSuggestion[];
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
