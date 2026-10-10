export const assetSourceLabels = {
  manual: "직접 업로드", adobe: "Adobe", canva: "Canva", openai: "ChatGPT Images", institution: "기관 제공",
} as const;
export const assetUsageTagLabels = {
  event: "행사", policy: "정책", interview: "인터뷰", welfare: "복지",
  culture: "문화", notice: "공지", seasonal: "계절", common: "공통",
} as const;
export const assetReuseScopeLabels = {
  project: "이 프로젝트용", institution: "기관용", common_candidate: "공통 사용 후보",
} as const;
export const assetTransparencyLabels = { yes: "예", no: "아니오", unknown: "확인 안 됨" } as const;

export type DesignAssetMetadata = {
  source?: keyof typeof assetSourceLabels;
  usageTags?: Array<keyof typeof assetUsageTagLabels>;
  reuseScope?: keyof typeof assetReuseScopeLabels;
  transparency?: keyof typeof assetTransparencyLabels;
};

export function defaultDesignAssetMetadata(): DesignAssetMetadata {
  return { source: "manual", usageTags: [], reuseScope: "project", transparency: "unknown" };
}

function allowed(value: unknown, labels: Record<string, string>) {
  return typeof value === "string" && Object.hasOwn(labels, value);
}

export function validateDesignAssetMetadata(value: unknown):
  | { ok: true; metadata: DesignAssetMetadata | null }
  | { ok: false; message: string } {
  const invalid = { ok: false as const, message: "외부 제작 정보의 분류 값이 올바르지 않습니다." };
  if (value === null) return { ok: true, metadata: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["source", "usageTags", "reuseScope", "transparency"].includes(key))) return invalid;
  if ("source" in record && !allowed(record.source, assetSourceLabels)) return invalid;
  if ("reuseScope" in record && !allowed(record.reuseScope, assetReuseScopeLabels)) return invalid;
  if ("transparency" in record && !allowed(record.transparency, assetTransparencyLabels)) return invalid;
  if ("usageTags" in record && (!Array.isArray(record.usageTags) || record.usageTags.length > 8 ||
    record.usageTags.some((tag) => !allowed(tag, assetUsageTagLabels)))) return invalid;
  // Rebuild only the allowlisted fields; never pass arbitrary JSON through the repository.
  const metadata: DesignAssetMetadata = {};
  if ("source" in record) metadata.source = record.source as DesignAssetMetadata["source"];
  if ("reuseScope" in record) metadata.reuseScope = record.reuseScope as DesignAssetMetadata["reuseScope"];
  if ("transparency" in record) metadata.transparency = record.transparency as DesignAssetMetadata["transparency"];
  if ("usageTags" in record) metadata.usageTags = [...new Set(record.usageTags as NonNullable<DesignAssetMetadata["usageTags"]>)];
  return { ok: true, metadata };
}

export function readDesignAssetMetadata(value: unknown): DesignAssetMetadata | null {
  const result = validateDesignAssetMetadata(value ?? null);
  return result.ok ? result.metadata : null;
}

export function designAssetClassification(metadata: DesignAssetMetadata | null) {
  return [metadata?.source ? assetSourceLabels[metadata.source] : "미지정/기존 자산",
    metadata?.usageTags?.length ? metadata.usageTags.map((tag) => assetUsageTagLabels[tag]).join(" · ") : "용도 미지정"].join(" · ");
}
