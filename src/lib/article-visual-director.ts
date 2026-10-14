import type { ProjectContentArticle } from "@/lib/newsletter-repository";
import { buildPatternRecommendationInput } from "@/lib/article-pattern-recommendation";
import { getArticlePublicInfoEntries } from "@/lib/article-public-info-fields";
import { readArticleBodyDesign } from "@/lib/article-body-design";
import { recommendArticleDesignTemplates, type ArticleDesignTemplateRecommendation, type TemplateRecommendationArticle } from "@/lib/article-design-template-recommendation";
import type { ArticleDesignConcept } from "@/lib/article-design-concept";
import type { CanvaTemplateFamily } from "@/lib/canva-template-registry";

export const visualStrategies = {
  institution_asset: "기관 제공 자료", ai_generated_image: "AI 개념 이미지",
  information_graphic: "정보 시각화", canva_full_layout: "Canva 완성형 디자인",
  html_first: "HTML 중심", hybrid: "자료와 정보의 결합",
} as const;
export type VisualStrategy = keyof typeof visualStrategies;
export const adobeTaskLabels = {
  remove_background: "배경 제거", retouch: "사진 보정", recolor: "색상 조정",
  upscale: "해상도 보완", extend_canvas: "여백 확장", vectorize: "벡터 변환",
} as const;
export type VisualDirectorArticle = TemplateRecommendationArticle & Partial<Pick<ProjectContentArticle, "links" | "institutionPriority" | "urgency" | "publicationKind">>;
// Availability is supplied by the caller; a generic image is never proof of a real photo.
export type VisualDirectorContext = { institutionVisualAvailable?: boolean };
export type VisualDirectorResult = {
  primaryStrategy: VisualStrategy; secondaryStrategy?: Exclude<VisualStrategy, "hybrid">;
  confidence: number; reasons: string[];
  needsVisual: boolean; needsRealPhoto: boolean; needsGeneratedImage: boolean; needsInformationGraphic: boolean;
  canvaFamily?: CanvaTemplateFamily; canvaTemplateCandidates?: string[];
  canvaRecommendations?: ArticleDesignTemplateRecommendation[];
  adobeTasks: Array<keyof typeof adobeTaskLabels>;
  humanInputRequired: boolean; humanInputReason?: string;
};

// Pure bounded evidence analysis. No IDs, file paths, full source copies or private
// metadata are returned. Future LLM reasoning can consume these booleans/counts.
export function analyzeArticleVisualNeeds(article: VisualDirectorArticle) {
  if (![article.title, article.summary, article.body].every(v => typeof v === "string") || !Array.isArray(article.blocks) || !article.publicInfo) {
    return { interview: false, record: false, facility: false, suppliedPoster: false, needsRealPhoto: false, namedPerson: false,
      information: false, map: false, images: false, urgent: false, canva: false, conceptual: false, insufficient: true, highPriority: false, retouchSuggested: false, htmlCompanion: false, canvaCompanion: false };
  }
  const entries = getArticlePublicInfoEntries(article.publicInfo, article.articleType);
  const text = buildPatternRecommendationInput(article).replace(/^\[(제목|요약|본문|인용|정보|문단)\]\n/gm, "") + "\n" + entries.map(e => e.value.slice(0, 300)).join("\n");
  const visible = article.blocks.filter(b => b.isVisible);
  const quote = visible.some(b => b.type === "paragraph" && readArticleBodyDesign(b.metadata.body_design)?.kind === "quote" && readArticleBodyDesign(b.metadata.body_design)?.enabled !== false);
  const images = visible.some(b => b.type === "image");
  const has = (rule: RegExp) => rule.test(text);
  const namedPerson = /[가-힣]{2,4}\s+(?:시장|기관장|구청장|군수|작가)(?=\s|의|[,·]|$)/.test(article.title) || /(?:^|\n)\s*(?:성명|인터뷰 대상)\s*[:：]\s*[가-힣]{2,4}/.test(text);
  const interview = has(/인터뷰|대담|인물 소개|프로필/) && (quote || has(/기관장|시장|구청장|군수|작가|주민|인물|화자|질문|답변/));
  const record = has(/현장|취재|실제 행사/) && has(/열렸다|개최됐다|개최되었다|현장 사진|현장사진|기록/);
  const facility = (article.articleType === "tourism_place" && entries.some(e => e.key === "location")) ||
    (has(/시설|건물|건축물|도서관|박물관|제품|센터/) && has(/개관|준공|개소|방문|내부|외관|실제 제품/));
  const locality = article.articleType === "local_news" && entries.some(e => ["area", "place"].includes(e.key)) && has(/현장|촬영|풍경|지역 소식/);
  const suppliedPoster = has(/기관 제공|공식 포스터|기존 포스터|제작된 포스터/) && has(/포스터|캐릭터|사진|원본/);
  const procedure = has(/절차|단계|순서|체크리스트|점검표/) && (entries.some(e => e.key === "method") || has(/신청|접수|준비물|점검|확인|제출/));
  const numericCount = new Set(text.match(/\d+(?:[.,]\d+)?\s*(?:%|명|건|원|만원|억원|배)/g) ?? []).size;
  const comparison = has(/통계|지표|성과|비교|추이|증감|전년|전월/) && numericCount >= 2;
  const infoTable = has(/정보표|비교표|일정표|통계표|지원 조건/) && (entries.length >= 2 || numericCount >= 2 || has(/항목|대상|구분|구간/));
  const map = has(/지도|노선도/) && (has(/경로|위치|구간|통제/) || entries.some(e => e.key === "location"));
  const information = procedure || comparison || infoTable || map;
  const timeSensitive = article.urgency === "urgent" || article.articleType === "emergency" ||
    (article.publicationKind === "rolling" && article.urgency === "time_sensitive" && (entries.length > 0 || has(/변경|통제|중단/)));
  const explicitUrgent = has(/긴급|즉시|교통 통제/) && has(/통제|변경|중단|행동요령|우회/);
  const plannedFormat = ["event_festival", "application_recruitment", "welfare_health"].includes(article.articleType) || has(/행사|축제|모집|공모|지원사업|정책|지원금|혜택|카드뉴스|만평|만화/);
  const layoutEvidence = entries.length >= 2 || article.links?.some(l => l.isVisible) === true || has(/참여|개최|신청|접수|대상|대사|핵심 요약/);
  const conceptual = has(/계절|봄|여름|가을|겨울|추상|생활정보|문화/) && has(/분위기|상징|개념|감성|배경|계절|생활정보/);
  const textLength = [article.title, article.summary, article.body, ...visible.filter(b => b.type === "paragraph").map(b => b.body)].join("").trim().length;
  const prose=(visible.some(b=>b.type==="paragraph")?visible.filter(b=>b.type==="paragraph").map(b=>b.body).join("\n"):article.body).split(/\n/).map(s=>s.trim()).filter(s=>s&&!/^(?:\d+[.)]|[-•✓✔]|[^:]{1,30}:\s)/.test(s));
  const htmlCompanion = prose.length>=3 && prose.join("").length>=400;
  return { canvaCompanion: record && entries.length >= 2 && plannedFormat && layoutEvidence, htmlCompanion, namedPerson, interview, record, facility, suppliedPoster, needsRealPhoto: namedPerson || interview || record || facility || locality,
    information, map, images, urgent: timeSensitive || explicitUrgent, canva: plannedFormat && layoutEvidence,
    conceptual, insufficient: textLength < 24 && entries.length < 2, highPriority: (article.institutionPriority ?? 0) >= 4, retouchSuggested: has(/사진 보정|사진보정|잡티|사진 노이즈/) };
}

export function recommendVisualStrategy(e: ReturnType<typeof analyzeArticleVisualNeeds>): VisualStrategy {
  if (e.urgent) return "html_first";
  if (e.needsRealPhoto && (e.information || e.htmlCompanion || e.canvaCompanion)) return "hybrid";
  if (!e.insufficient && e.information && (e.conceptual || e.htmlCompanion)) return "hybrid";
  if (e.needsRealPhoto || e.suppliedPoster) return "institution_asset";
  if (e.information) return "information_graphic";
  if (e.canva && !e.insufficient) return "canva_full_layout";
  if (e.conceptual && !e.insufficient) return "ai_generated_image";
  return "html_first";
}

export function buildVisualDirectorResult(article: VisualDirectorArticle, context: VisualDirectorContext = {},
  concept?: Pick<ArticleDesignConcept, "pattern" | "layoutDirection">): VisualDirectorResult {
  const e = analyzeArticleVisualNeeds(article);
  let primaryStrategy = recommendVisualStrategy(e);
  // Only the full-layout strategy delegates to the existing canonical recommender.
  const canva = primaryStrategy === "canva_full_layout" ? recommendArticleDesignTemplates(article, concept).filter(r => r.score > 0) : [];
  const noCanvaEvidence = primaryStrategy === "canva_full_layout" && canva.length === 0;
  if (noCanvaEvidence) primaryStrategy = "html_first";
  const realPhoto = e.needsRealPhoto && primaryStrategy !== "html_first";
  const graphic = primaryStrategy === "information_graphic" || (primaryStrategy === "hybrid" && e.information);
  const institution = primaryStrategy === "institution_asset" || (primaryStrategy === "hybrid" && e.needsRealPhoto);
  const humanInputRequired = e.insufficient || noCanvaEvidence || (institution && (e.needsRealPhoto || !context.institutionVisualAvailable)) || (graphic && e.map);
  const reasons: string[] = primaryStrategy === "hybrid" && !e.needsRealPhoto ? ["개념 표현이나 정보그래픽과 읽을 수 있는 정보를 분리해 준비합니다.", "각 요소를 확인한 뒤 조합을 검토하세요."] : primaryStrategy === "hybrid" ? ["실제 대상을 보여 주는 기관 사진을 먼저 확인합니다.", e.information ? "절차·수치는 읽을 수 있는 정보그래픽으로 분리합니다." : e.canvaCompanion ? "안내용 Canva 템플릿은 추천 후보로 확인합니다." : "인터뷰·상세 본문은 HTML로 유지합니다."] :
    primaryStrategy === "institution_asset" ? [e.suppliedPoster ? "기관에서 이미 제작한 포스터·자료를 우선 활용합니다." : "실제 인물·현장·시설의 사실성을 유지해야 합니다.", "실제 대상을 AI 이미지로 대체하지 않습니다."] :
    primaryStrategy === "information_graphic" ? ["절차·수치·비교 정보의 구조가 중요합니다.", "정확한 값과 읽을 수 있는 설명을 먼저 정리하세요."] :
    primaryStrategy === "canva_full_layout" ? ["안내형 기사에 일정·대상·행동 안내가 함께 있습니다.", "검증된 기존 Canva 템플릿을 제작 후보로 활용할 수 있습니다."] :
    primaryStrategy === "ai_generated_image" ? ["사실 기록보다 계절·분위기·개념 표현이 중심입니다.", "문자 없는 시각 자산과 HTML 정보를 분리하세요."] :
    e.urgent ? ["긴급·시간 민감 안내는 정확한 텍스트와 행동 링크 전달이 우선입니다.", "새 이미지 제작을 기다리지 않고 HTML로 안내하세요."] : ["별도 이미지보다 원문과 행동 안내를 우선합니다."];
  if (e.highPriority && !e.insufficient) reasons.push("기관 우선순위가 높아 핵심 정보를 먼저 확인하세요.");
  return {
    primaryStrategy, ...(primaryStrategy === "hybrid" ? { secondaryStrategy: (e.needsRealPhoto ? e.information ? "information_graphic" : e.canvaCompanion ? "canva_full_layout" : "html_first" : e.conceptual ? "information_graphic" : "html_first") as Exclude<VisualStrategy,"hybrid"> } : primaryStrategy === "canva_full_layout" ? { secondaryStrategy: "html_first" as const } : {}),
    // Heuristic confidence, not a calibrated probability.
    confidence: e.insufficient || noCanvaEvidence ? 0.2 : e.urgent ? 0.95 : realPhoto ? 0.9 : graphic ? 0.86 : canva.length ? 0.84 : e.conceptual ? 0.76 : 0.65,
    reasons, needsVisual: primaryStrategy !== "html_first", needsRealPhoto: realPhoto,
    needsGeneratedImage: primaryStrategy === "ai_generated_image" || (primaryStrategy === "hybrid" && !e.needsRealPhoto && e.conceptual), needsInformationGraphic: graphic,
    ...(canva.length ? { canvaFamily: canva[0].family, canvaTemplateCandidates: canva.map(r => r.templateId), canvaRecommendations: canva } : {}),
    adobeTasks: institution && e.retouchSuggested && context.institutionVisualAvailable ? ["retouch"] : [],
    humanInputRequired, ...(humanInputRequired ? { humanInputReason: e.insufficient || noCanvaEvidence ? "기사의 목적과 핵심 정보를 확인해 주세요." : graphic && e.map ? "지도 원본과 경로 정보를 확인해 주세요." : primaryStrategy === "hybrid" && institution ? "기관 사진의 실제 대상·시점·사용 권한을 확인하세요. 없다면 실제 사진을 추가하세요." : institution && context.institutionVisualAvailable && e.needsRealPhoto ? "기관 제공 사진이 현재 기사의 실제 대상과 일치하는지 확인해 주세요." : e.suppliedPoster ? "기관 포스터·원본 자료 확인이 필요합니다." : e.images ? "기사 이미지가 실제 인물·현장 사진인지 확인해 주세요." : "실제 인물·현장·시설 사진을 기관에서 제공해 주세요." } : {}),
  };
}
