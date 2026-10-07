export const articleCompositionStatuses = ["draft", "ready"] as const;
export type ArticleCompositionStatus = (typeof articleCompositionStatuses)[number];

export const articleCompositionLayoutKeys = ["standard"] as const;
export type ArticleCompositionLayoutKey = (typeof articleCompositionLayoutKeys)[number];

export const articleCompositionSlots = [
  "hero_background",
  "hero_illustration",
  "title_icon",
  "body_decoration",
  "footer_banner",
] as const;
export type ArticleCompositionSlot = (typeof articleCompositionSlots)[number];

export type ArticleCompositionJsonValue =
  | boolean
  | number
  | string
  | null
  | ArticleCompositionJsonValue[]
  | { [key: string]: ArticleCompositionJsonValue };

export type ArticleCompositionSettings = Record<string, ArticleCompositionJsonValue>;

export type ProjectArticleCompositionAsset = {
  assetId: string;
  compositionId: string;
  createdAt: string;
  id: string;
  isVisible: boolean;
  settings: ArticleCompositionSettings;
  slot: ArticleCompositionSlot;
  sortOrder: number;
  updatedAt: string;
};

export type ProjectArticleComposition = {
  articleId: string;
  assets: ProjectArticleCompositionAsset[];
  createdAt: string;
  id: string;
  layoutKey: ArticleCompositionLayoutKey;
  projectId: string;
  settings: ArticleCompositionSettings;
  status: ArticleCompositionStatus;
  updatedAt: string;
};

export function isArticleCompositionStatus(value: unknown): value is ArticleCompositionStatus {
  return typeof value === "string" && articleCompositionStatuses.includes(value as ArticleCompositionStatus);
}

export function isArticleCompositionLayoutKey(value: unknown): value is ArticleCompositionLayoutKey {
  return typeof value === "string" && articleCompositionLayoutKeys.includes(value as ArticleCompositionLayoutKey);
}

export function isArticleCompositionSlot(value: unknown): value is ArticleCompositionSlot {
  return typeof value === "string" && articleCompositionSlots.includes(value as ArticleCompositionSlot);
}
