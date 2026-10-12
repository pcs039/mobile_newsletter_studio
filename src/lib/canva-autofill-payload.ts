import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { readCanvaUploadJob } from "@/lib/canva-background-autofill";
import type { CanvaBackgroundUpload } from "@/lib/canva-connection-repository";
import { canvaDisplayTitle } from "@/lib/canva-display-title";
import { buildCanvaPreview, validateCanvaTemplate, type CanvaMapping, type CanvaSource } from "@/lib/canva-template";
import { canvaTemplateRegistry, getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";
import { readArticleBodyDesign } from "@/lib/article-body-design";
import type { ProjectContentArticle, ProjectDesignAsset } from "@/lib/newsletter-repository";

type TextValue = {
  type: "text"; status: "ready" | "missing" | "invalid"; text?: string;
  source: CanvaSource | "article.links.label" | null; blockId?: string; linkId?: string;
  transform?: "display_title" | "title_line_1" | "title_line_2" | "title_line_3";
};
type ImageValue = { type: "image"; status: "ready" | "missing" | "invalid"; asset_id?: string; sourceAssetId?: string };
export type CanvaAutofillImageBinding = {
  field: string;
  asset: Pick<ProjectDesignAsset, "id" | "projectId" | "approvalStatus" | "isActive" | "mimeType">;
  sourceHash: string;
  upload?: CanvaBackgroundUpload;
};
export type CanonicalCanvaAutofillPayload = {
  templateId: string; canvaBrandTemplateId: string; datasetStatus: "verified";
  textFields: Record<string, TextValue>; imageFields: Record<string, ImageValue>;
  missingFields: Array<{ field: string; type: "text" | "image"; reason: "unmapped" | "missing_value" | "invalid_value" | "upload_required" }>;
  warnings: string[]; isReady: boolean;
  payload: null | {
    type: "create_from_brand_template"; brand_template_id: string; title: string;
    data: Record<string, { type: "text"; text: string } | { type: "image"; asset_id: string }>;
  };
};

// Exact aliases only. No extraction of amounts, names, KPIs or steps from prose.
const defaultSources: Record<string, CanvaSource> = {
  TITLE: "article.title", TITLE_LINE_1: "article.title", TITLE_LINE_2: "article.title", TITLE_LINE_3: "article.title",
  SUMMARY: "article.summary", EVENT_SUMMARY: "article.summary", BODY_TEXT: "article.body",
  TARGET: "publicInfo.target", PERIOD: "publicInfo.period", PERIOD_LINE: "publicInfo.period",
  METHOD: "publicInfo.method", SUPPORT_CONTENT: "publicInfo.support",
  EVENT_DATE: "publicInfo.dateTime", EVENT_DATE_LINE: "publicInfo.dateTime",
  EVENT_PLACE: "publicInfo.place", EVENT_PLACE_LINE: "publicInfo.place", LOCATION_LINE: "publicInfo.location",
  QUOTE: "quote.body",
};

export function buildCanonicalCanvaAutofillPayload(input: {
  templateId?: string; canvaBrandTemplateId?: string; article: ProjectContentArticle;
  project: { id: string; title: string; issue: string };
  fieldMappings?: readonly CanvaMapping[]; images?: readonly CanvaAutofillImageBinding[];
}): CanonicalCanvaAutofillPayload {
  const byId = input.templateId ? getCanonicalCanvaTemplate(input.templateId) : undefined;
  const byExternalId = input.canvaBrandTemplateId ? canvaTemplateRegistry.find(t => t.canvaBrandTemplateId === input.canvaBrandTemplateId) : undefined;
  if ((!input.templateId && !input.canvaBrandTemplateId) || (input.templateId && !byId) || (input.canvaBrandTemplateId && !byExternalId) || (byId && byExternalId && byId.id !== byExternalId.id))
    throw new CanvaConnectError(400, "canonical Canva 템플릿 식별자를 확인하세요.");
  const template = (byId ?? byExternalId)!;
  if (template.datasetStatus !== "verified" || template.requiredFields === null || template.imageFields === null)
    throw new CanvaConnectError(409, "재게시 후 dataset 검증이 필요한 템플릿입니다.");

  // Reuse source/key/type/block allowlist validation, then enforce this dataset.
  const supplied = validateCanvaTemplate({ name: template.displayName, externalId: template.canvaBrandTemplateId,
    templateType: "brand_template", productionPattern: "common", purpose: "card_news", isActive: true,
    fieldMappings: input.fieldMappings ? [...input.fieldMappings] : [] }).fieldMappings;
  for (const mapping of supplied) {
    if (mapping.type !== "text" || !template.requiredFields.includes(mapping.field))
      throw new CanvaConnectError(400, "registry의 글자 필드만 source mapping으로 연결하세요. 이미지는 별도 업로드 참조를 사용하세요.");
  }
  const imageBindings = input.images ?? [];
  const seen = new Set<string>();
  for (const binding of imageBindings) {
    if (!template.imageFields.includes(binding.field) || seen.has(binding.field)) throw new CanvaConnectError(400, "registry 이미지 필드와 중복 연결을 확인하세요.");
    seen.add(binding.field);
  }
  const textFields: Record<string, TextValue> = Object.create(null);
  const imageFields: Record<string, ImageValue> = Object.create(null);
  const data: NonNullable<CanonicalCanvaAutofillPayload["payload"]>["data"] = Object.create(null);
  const missingFields: CanonicalCanvaAutofillPayload["missingFields"] = [];
  const warnings: string[] = [];
  const blockCandidates = (kind: "info" | "quote") => input.article.blocks.filter(block => {
    const design = readArticleBodyDesign(block.metadata.body_design);
    return block.isVisible && block.type === "paragraph" && design?.enabled !== false && design?.kind === kind &&
      (kind !== "info" || ["notice", "warning"].includes(design.tone ?? ""));
  });

  for (const field of template.requiredFields) {
    let mapping = supplied.find(m => m.field === field);
    let value: TextValue = { type: "text", status: "missing", source: null };
    if (!mapping && field === "CTA") {
      const links = input.article.links.filter(link => link.isVisible && link.label.trim());
      if (links.length === 1) value = { type: "text", status: "ready", source: "article.links.label", text: links[0].label.trim(), linkId: links[0].id };
      else if (links.length > 1) warnings.push("CTA: 여러 행동 버튼 중 사용할 문구를 명시적으로 연결하세요.");
    } else {
      const source = field === "SUPPORT_CONTENT" && input.article.articleType === "application_recruitment" ? "publicInfo.benefit" : defaultSources[field];
      if (!mapping && source) mapping = { field, type: "text", source };
      if (!mapping && field === "NOTICE") {
        const blocks = blockCandidates("info");
        if (blocks.length === 1) mapping = { field, type: "text", source: "infoBox.body", blockId: blocks[0].id };
        else if (blocks.length > 1) warnings.push("NOTICE: 여러 안내·주의 정보박스 중 특정 블록을 연결하세요.");
      }
      if (mapping && (mapping.source.startsWith("quote.") || mapping.source.startsWith("infoBox.")) && !mapping.blockId) {
        const blocks = blockCandidates(mapping.source.startsWith("quote.") ? "quote" : "info");
        if (blocks.length === 1) mapping = { ...mapping, blockId: blocks[0].id };
        else { warnings.push(`${field}: 연결할 블록을 명시적으로 선택하세요.`); mapping = undefined; }
      }
      if (mapping) {
        const preview = buildCanvaPreview({ ...validateCanvaTemplate({ name: template.displayName, externalId: template.canvaBrandTemplateId,
          templateType: "brand_template", productionPattern: "common", purpose: "card_news", isActive: true, fieldMappings: [mapping] }), id: template.id }, input.article, input.project, null)[0];
        value = { type: "text", status: "missing", source: mapping.source, ...(mapping.blockId ? { blockId: mapping.blockId } : {}) };
        if (preview.status === "ready" && preview.text) {
          let text = preview.text;
          if (mapping.source === "article.title") {
            text = canvaDisplayTitle(text);
            value.transform = "display_title";
            if (/^TITLE_LINE_[123]$/.test(field)) {
              const line = Number(field.at(-1));
              text = text.split(/\r?\n/)[line - 1] ?? "";
              value.transform = `title_line_${line}` as TextValue["transform"];
            }
          }
          if (text.trim()) { value.status = "ready"; value.text = text; }
        }
      }
    }
    if (value.text && (value.text.length > 10_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.text))) {
      value.status = "invalid"; delete value.text;
    }
    textFields[field] = value;
    if (value.status === "ready" && value.text) data[field] = { type: "text", text: value.text };
    else missingFields.push({ field, type: "text", reason: value.status === "invalid" ? "invalid_value" : value.source ? "missing_value" : "unmapped" });
  }

  for (const field of template.imageFields) {
    const binding = imageBindings.find(b => b.field === field);
    let value: ImageValue = { type: "image", status: "missing" };
    let reason: CanonicalCanvaAutofillPayload["missingFields"][number]["reason"] = "missing_value";
    if (binding) {
      const { asset, upload } = binding;
      const validAsset = asset.projectId === input.project.id && asset.approvalStatus === "approved" && asset.isActive &&
        asset.mimeType === "image/png" && /^[a-f0-9]{64}$/.test(binding.sourceHash);
      if (!validAsset || (upload && (upload.sourceAssetId !== asset.id || upload.sourceHash !== binding.sourceHash))) {
        value.status = "invalid"; reason = "invalid_value";
      } else {
        value.sourceAssetId = asset.id; reason = "upload_required";
        if (upload?.status === "success" && upload.assetId) {
          try {
            const result = readCanvaUploadJob({ job: { id: upload.jobId, status: "success", asset: { type: "image", id: upload.assetId } } });
            value = { ...value, status: "ready", asset_id: result.assetId };
          } catch { value.status = "invalid"; reason = "invalid_value"; }
        }
      }
    }
    imageFields[field] = value;
    if (value.status === "ready" && value.asset_id) data[field] = { type: "image", asset_id: value.asset_id };
    else missingFields.push({ field, type: "image", reason });
  }
  for (const missing of missingFields) warnings.push(`${missing.field}: ${missing.reason === "upload_required" ? "Canva 이미지 업로드 성공 참조가 필요합니다." : "검증된 기사 값 또는 명시적 연결을 확인하세요."}`);
  const isReady = missingFields.length === 0;
  return { templateId: template.id, canvaBrandTemplateId: template.canvaBrandTemplateId, datasetStatus: "verified", textFields, imageFields, missingFields, warnings, isReady,
    payload: isReady ? { type: "create_from_brand_template", brand_template_id: template.canvaBrandTemplateId,
      title: input.article.title.trim().slice(0, 255) || template.displayName, data } : null };
}
