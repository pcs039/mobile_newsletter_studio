import { productionPatternDescriptions } from "@/lib/article-production-pattern";
import { getArticlePublicInfoEntries } from "@/lib/article-public-info-fields";
import { readArticleBodyDesign } from "@/lib/article-body-design";
import type { ProjectContentArticle } from "@/lib/newsletter-repository";

export const canvaTemplateTypes = { brand_template: "Canva 브랜드 템플릿", existing_design: "기존 Canva 디자인" } as const;
export const canvaTemplatePatterns = { event: productionPatternDescriptions.event.name, policy: productionPatternDescriptions.policy.name, interview: productionPatternDescriptions.interview.name, common: "공통" } as const;
export const canvaTemplatePurposes = { card_news: "카드뉴스", event_guide: "행사안내", policy_guide: "정책안내", stat_card: "통계카드", profile: "인물소개", cover_section: "표지·섹션 이미지" } as const;
// Explicit sources only. These keys are already defined by article-public-info-fields.
export const canvaSources = {
  "article.title": "기사 제목", "article.summary": "기사 요약", "article.body": "기사 본문", "article.primaryImage": "대표 이미지",
  "project.name": "프로젝트 이름", "project.issue": "발행호",
  "infoBox.title": "정보박스 제목", "infoBox.body": "정보박스 내용", "quote.body": "인용문", "quote.source": "인용 출처·화자",
  "publicInfo.dateTime": "행사 일시", "publicInfo.place": "장소", "publicInfo.target": "대상", "publicInfo.period": "기간", "publicInfo.contact": "문의",
  "publicInfo.support": "지원내용", "publicInfo.method": "이용·신청방법", "publicInfo.benefit": "혜택", "publicInfo.highlights": "주요내용", "publicInfo.guide": "이용안내",
  "publicInfo.location": "위치", "publicInfo.hours": "운영시간", "publicInfo.fee": "요금", "publicInfo.service": "서비스 내용", "publicInfo.keyPoint": "핵심내용",
  "publicInfo.schedule": "추진일정", "publicInfo.area": "지역", "publicInfo.affectedArea": "대상 지역", "publicInfo.effectiveTime": "적용 시각", "publicInfo.action": "행동요령",
} as const;
export type CanvaSource = keyof typeof canvaSources;
export type CanvaMapping = { field: string; type: "text" | "image"; source: CanvaSource; blockId?: string };
export type CanvaTemplateInput = {
  name: string; externalId: string; templateType: keyof typeof canvaTemplateTypes;
  productionPattern: keyof typeof canvaTemplatePatterns; purpose: keyof typeof canvaTemplatePurposes;
  isActive: boolean; fieldMappings: CanvaMapping[];
};
export type CanvaTemplate = CanvaTemplateInput & { id: string };
export type CanvaPreviewField = { field: string; type: "text" | "image"; status: "ready" | "missing" | "image_pending"; text?: string; assetReference?: { assetId: string } };
export const canvaUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isBlockSource(source: string) { return source.startsWith("infoBox.") || source.startsWith("quote."); }
export function canvaBlockKind(source: string) { return source.startsWith("infoBox.") ? "info" : "quote"; }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function member(value: unknown, options: object) { return typeof value === "string" && Object.hasOwn(options, value); }
export function validateCanvaTemplate(value: unknown): CanvaTemplateInput {
  if (!record(value) || Object.keys(value).some(k => !["name", "externalId", "templateType", "productionPattern", "purpose", "isActive", "fieldMappings"].includes(k))) throw Error("템플릿 정보 형식을 확인해 주세요.");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 120 || typeof value.externalId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value.externalId.trim())) throw Error("템플릿 이름(120자 이하)과 Canva ID를 확인해 주세요.");
  if (!member(value.templateType, canvaTemplateTypes) || !member(value.productionPattern, canvaTemplatePatterns) || !member(value.purpose, canvaTemplatePurposes) || typeof value.isActive !== "boolean") throw Error("템플릿 유형·제작 패턴·용도·활성 여부를 확인해 주세요.");
  if (!Array.isArray(value.fieldMappings) || value.fieldMappings.length > 40) throw Error("자동 입력 항목은 최대 40개입니다.");
  const fields = new Set<string>();
  const mappings: CanvaMapping[] = value.fieldMappings.map(item => {
    if (!record(item) || Object.keys(item).some(k => !["field", "type", "source", "blockId"].includes(k)) || typeof item.field !== "string" || !item.field.trim() || item.field.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(item.field) || ["__proto__", "constructor", "prototype"].includes(item.field.trim())) throw Error("Canva 필드 이름과 형식을 확인해 주세요(100자 이하).");
    const field = item.field.trim();
    if (fields.has(field)) throw Error("중복된 Canva 필드 이름은 사용할 수 없습니다.");
    fields.add(field);
    if (!member(item.source, canvaSources) || !["text", "image"].includes(item.type as string) || (item.type === "image") !== (item.source === "article.primaryImage")) throw Error("기사 데이터 연결과 글자·이미지 유형이 맞지 않습니다.");
    if (isBlockSource(item.source as string)) {
      if (typeof item.blockId !== "string" || !canvaUuid.test(item.blockId)) throw Error("정보박스·인용문 블록을 선택하세요.");
    } else if (Object.hasOwn(item, "blockId")) throw Error("이 항목에는 블록을 연결할 수 없습니다.");
    return { field, type: item.type as CanvaMapping["type"], source: item.source as CanvaSource, ...(isBlockSource(item.source as string) ? { blockId: item.blockId as string } : {}) };
  });
  return { name: value.name.trim(), externalId: value.externalId.trim(), templateType: value.templateType as CanvaTemplateInput["templateType"], productionPattern: value.productionPattern as CanvaTemplateInput["productionPattern"], purpose: value.purpose as CanvaTemplateInput["purpose"], isActive: value.isActive, fieldMappings: mappings };
}
export function canvaBlockOptions(articles: ProjectContentArticle[]) {
  return articles.flatMap(article => article.blocks.filter(b => b.isVisible && b.type === "paragraph").flatMap(block => {
    const design = readArticleBodyDesign(block.metadata.body_design);
    return design && design.enabled !== false ? [{ id: block.id, kind: design.kind, label: `${article.title.slice(0, 40)} · ${block.title || block.body.slice(0, 40) || "내용 없음"}` }] : [];
  }));
}
export function buildCanvaPreview(template: CanvaTemplate, article: ProjectContentArticle, project: { title: string; issue: string }, primaryImage: string | null): CanvaPreviewField[] {
  const publicInfo = new Map(getArticlePublicInfoEntries(article.publicInfo, article.articleType).map(entry => [`publicInfo.${entry.key}`, entry.value]));
  return template.fieldMappings.map(mapping => {
    if (mapping.type === "image") return primaryImage ? { field: mapping.field, type: "image", status: "image_pending", assetReference: { assetId: primaryImage } } : { field: mapping.field, type: "image", status: "missing" };
    let text = "";
    switch (mapping.source) {
      case "article.title": text = article.title; break;
      case "article.summary": text = article.summary; break;
      case "article.body": text = article.body; break;
      case "project.name": text = project.title; break;
      case "project.issue": text = project.issue; break;
      default: {
        if (isBlockSource(mapping.source)) {
          const block = article.blocks.find(b => b.id === mapping.blockId && b.isVisible && b.type === "paragraph");
          const design = block && readArticleBodyDesign(block.metadata.body_design);
          if (block && design && design.enabled !== false && design.kind === canvaBlockKind(mapping.source)) text = mapping.source === "infoBox.title" ? block.title : mapping.source === "quote.source" ? design.source || "" : block.body;
        } else text = publicInfo.get(mapping.source) || "";
      }
    }
    return text.trim() ? { field: mapping.field, type: "text", status: "ready", text: text.trim() } : { field: mapping.field, type: "text", status: "missing" };
  });
}
