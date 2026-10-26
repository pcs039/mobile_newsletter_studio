export const assetSourceLabels = {
  internal: "앱 생성", manual: "직접 업로드", adobe: "Adobe", canva: "Canva", openai: "ChatGPT Images", institution: "기관 제공",
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
  adobeProcessing?: { sourceAssetId: string; operation: "remove_background" | "upscale" | "extend_canvas"; operationVersion: "v1"; processingKey: string };
  informationGraphic?: { articleId: string; graphicType: "steps" | "key_numbers" | "comparison" | "checklist" | "schedule"; specVersion: "v1"; generationKey: string };
  imageGeneration?: { generatedForArticleId: string; visualStrategy: "ai_generated_image"; generationPurpose: "article_visual"; promptVersion: "v1"; generationKey: string; factualityMode: "conceptual"; textInImage: false };
  canvaExport?: { designId: string; format: "png"; articleId?: string; templateId?: string; importedAt?: string };
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
  if (Object.keys(record).some((key) => !["source", "usageTags", "reuseScope", "transparency", "canvaExport", "imageGeneration", "informationGraphic", "adobeProcessing"].includes(key))) return invalid;
  if ("adobeProcessing" in record) {
    const p = record.adobeProcessing as Record<string, unknown> | null;
    if (!p || typeof p !== "object" || Array.isArray(p) || record.source !== "adobe" || Object.keys(p).length !== 4 ||
      Object.keys(p).some(k => !["sourceAssetId", "operation", "operationVersion", "processingKey"].includes(k)) ||
      typeof p.sourceAssetId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(p.sourceAssetId) ||
      !["remove_background", "upscale", "extend_canvas"].includes(String(p.operation)) || p.operationVersion !== "v1" ||
      typeof p.processingKey !== "string" || !/^[a-f0-9]{64}$/.test(p.processingKey)) return invalid;
  }
  if ("informationGraphic" in record) {
    const p=record.informationGraphic as Record<string,unknown>|null;
    if(!p||typeof p!=="object"||Array.isArray(p)||record.source!=="internal"||Object.keys(p).length!==4||Object.keys(p).some(k=>!["articleId","graphicType","specVersion","generationKey"].includes(k))||
      typeof p.articleId!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(p.articleId)||
      !["steps","key_numbers","comparison","checklist","schedule"].includes(String(p.graphicType))||p.specVersion!=="v1"||typeof p.generationKey!=="string"||!/^[a-f0-9]{64}$/.test(p.generationKey))return invalid;
  }
  if ("imageGeneration" in record) {
    const p = record.imageGeneration as Record<string, unknown> | null;
    if (!p || typeof p !== "object" || Array.isArray(p) || record.source !== "openai" ||
      Object.keys(p).length !== 7 || Object.keys(p).some(k => !["generatedForArticleId", "visualStrategy", "generationPurpose", "promptVersion", "generationKey", "factualityMode", "textInImage"].includes(k)) ||
      typeof p.generatedForArticleId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.generatedForArticleId) ||
      p.visualStrategy !== "ai_generated_image" || p.generationPurpose !== "article_visual" || p.promptVersion !== "v1" || p.factualityMode !== "conceptual" || p.textInImage !== false ||
      typeof p.generationKey !== "string" || !/^[a-f0-9]{64}$/.test(p.generationKey)) return invalid;
  }
  if ("canvaExport" in record) {
    const provenance = record.canvaExport;
    if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return invalid;
    const p = provenance as Record<string, unknown>;
    if (Object.keys(p).some(key => !["designId", "format", "articleId", "templateId", "importedAt"].includes(key)) || typeof p.designId !== "string" ||
      !/^D[A-Za-z0-9_-]{1,199}$/.test(p.designId) || p.format !== "png") return invalid;
    if (["articleId", "templateId", "importedAt"].some(k => k in p) &&
      (typeof p.articleId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.articleId) ||
       typeof p.templateId !== "string" || !/^[a-z][a-z0-9_]{1,99}$/.test(p.templateId) || typeof p.importedAt !== "string" ||
       !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.importedAt) || !Number.isFinite(Date.parse(p.importedAt)))) return invalid;
  }
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
  if ("canvaExport" in record) {
    const p = record.canvaExport as NonNullable<DesignAssetMetadata["canvaExport"]>;
    metadata.canvaExport = { designId: p.designId, format: "png", ...(p.articleId ? { articleId: p.articleId, templateId: p.templateId, importedAt: p.importedAt } : {}) };
  }
  if ("imageGeneration" in record) metadata.imageGeneration = { ...record.imageGeneration as NonNullable<DesignAssetMetadata["imageGeneration"]> };
  if ("informationGraphic" in record) metadata.informationGraphic = {...record.informationGraphic as NonNullable<DesignAssetMetadata["informationGraphic"]>};
  if ("adobeProcessing" in record) metadata.adobeProcessing = { ...record.adobeProcessing as NonNullable<DesignAssetMetadata["adobeProcessing"]> };
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
