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

export const articleCompositionProductionAssetTypes = [
  "background",
  "illustration",
  "icon",
  "card_frame",
  "banner",
  "pattern",
  "decoration",
] as const;
export type ArticleCompositionProductionAssetType = (typeof articleCompositionProductionAssetTypes)[number];

export const articleCompositionSlotAssetTypes: Record<
  ArticleCompositionSlot,
  readonly ArticleCompositionProductionAssetType[]
> = {
  hero_background: ["background", "pattern"],
  hero_illustration: ["illustration", "decoration"],
  title_icon: ["icon", "illustration"],
  body_decoration: ["decoration", "illustration", "pattern"],
  footer_banner: ["banner", "card_frame"],
};

export const articleCompositionSingleSlots = [
  "hero_background",
  "hero_illustration",
  "title_icon",
  "footer_banner",
] as const satisfies readonly ArticleCompositionSlot[];

export const articleCompositionAnchors = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
] as const;
export type ArticleCompositionAnchor = (typeof articleCompositionAnchors)[number];

export const articleCompositionFits = ["contain", "cover"] as const;
export type ArticleCompositionFit = (typeof articleCompositionFits)[number];

export type ArticleCompositionPlacementSettings = {
  anchor?: ArticleCompositionAnchor;
  fit?: ArticleCompositionFit;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  rotation?: number;
  scale?: number;
  zIndex?: number;
};

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

export function isArticleCompositionAssetTypeCompatible(slot: ArticleCompositionSlot, assetType: string) {
  return articleCompositionSlotAssetTypes[slot].includes(assetType as ArticleCompositionProductionAssetType);
}

export function isArticleCompositionSingleSlot(slot: ArticleCompositionSlot) {
  return articleCompositionSingleSlots.includes(slot as (typeof articleCompositionSingleSlots)[number]);
}

export type ArticleCompositionSettingsValidationResult =
  | { ok: true; settings: ArticleCompositionPlacementSettings }
  | { ok: false; message: string };

const placementSettingKeys = new Set([
  "anchor",
  "fit",
  "offsetX",
  "offsetY",
  "opacity",
  "rotation",
  "scale",
  "zIndex",
]);

function isFiniteNumberInRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function validateArticleCompositionPlacementSettings(
  value: unknown,
): ArticleCompositionSettingsValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "레이어 설정은 객체 형식이어야 합니다." };
  }

  const input = value as Record<string, unknown>;
  const unknownKey = Object.keys(input).find((key) => !placementSettingKeys.has(key));

  if (unknownKey) {
    return { ok: false, message: `지원하지 않는 레이어 설정입니다: ${unknownKey}` };
  }

  const settings: ArticleCompositionPlacementSettings = {};

  if ("anchor" in input) {
    if (!articleCompositionAnchors.includes(input.anchor as ArticleCompositionAnchor)) {
      return { ok: false, message: "기준 위치 값을 확인해 주세요." };
    }
    settings.anchor = input.anchor as ArticleCompositionAnchor;
  }
  if ("fit" in input) {
    if (!articleCompositionFits.includes(input.fit as ArticleCompositionFit)) {
      return { ok: false, message: "자산 맞춤 방식을 확인해 주세요." };
    }
    settings.fit = input.fit as ArticleCompositionFit;
  }

  const numericRules = [
    ["offsetX", -200, 200],
    ["offsetY", -200, 200],
    ["scale", 0.25, 3],
    ["rotation", -180, 180],
    ["opacity", 0, 1],
    ["zIndex", 0, 20],
  ] as const;

  for (const [key, min, max] of numericRules) {
    if (!(key in input)) continue;
    const valueAtKey = input[key];
    if (!isFiniteNumberInRange(valueAtKey, min, max)) {
      return { ok: false, message: `${key} 값은 ${min}~${max} 범위여야 합니다.` };
    }
    settings[key] = valueAtKey as number;
  }

  return { ok: true, settings };
}
