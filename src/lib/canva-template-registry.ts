import type { CanvaMapping, CanvaTemplateInput } from "@/lib/canva-template";

// Canonical catalog, not a project-owned CanvaTemplate row or an access grant.
// Families describe content; they do not extend ArticleProductionPattern.
export const canvaTemplateFamilies = {
  policy_support: "정책·지원",
  event_festival: "행사·축제",
  recruitment_contest: "모집·공모",
  interview_person: "인터뷰·인물",
  culture_tourism: "문화·관광",
  statistics_performance: "통계·성과",
  cardnews: "카드뉴스",
  cartoon: "만평",
} as const;
export type CanvaTemplateFamily = keyof typeof canvaTemplateFamilies;
export type CanvaTemplateVariant = "01" | "02" | "03" | "04";
export type CanonicalCanvaTemplate = Readonly<{
  id: `${CanvaTemplateFamily}_${CanvaTemplateVariant}`;
  family: CanvaTemplateFamily;
  variant: CanvaTemplateVariant;
  displayName: string;
  canvaBrandTemplateId: string;
  templateType: Extract<CanvaTemplateInput["templateType"], "brand_template">;
  recommendedFor: readonly string[];
  datasetStatus: "verified" | "needs_republish";
  // Exact supplied Canva text/image fields; null is an empty, unverified dataset.
  requiredFields: readonly CanvaMapping["field"][] | null;
  imageFields: readonly CanvaMapping["field"][] | null;
  // Lower is earlier. This is the supplied variant order, not a quality score.
  priority: number;
}>;

const definitions = {
  policy_support: { ids: ["EAHXyJEkAsQ", "EAHXyEzk03Q", "EAHXyFYYiJg", "EAHXyK57FWY"], recommendedFor: ["정책 안내", "지원사업", "복지·혜택 안내"] },
  event_festival: { ids: ["EAHXxK9PTF8", "EAHXxCyfpSI", "EAHXxG6zLMQ", "EAHXxfeoCwc"], recommendedFor: ["행사 안내", "축제", "참여 안내"] },
  recruitment_contest: { ids: ["EAHXxRUqOHo", "EAHXxp1_n_U", "EAHXxle-Lzc", "EAHXxoxe9Jc"], recommendedFor: ["모집 안내", "공모", "신청 안내"] },
  interview_person: { ids: ["EAHXxtPWwK0", "EAHXxi1onEI", "EAHXxuOmqEY", "EAHXxql07IU"], recommendedFor: ["인터뷰", "인물 소개", "대담"] },
  culture_tourism: { ids: ["EAHXx2-zSJU", "EAHXx8cBHkw", "EAHXx7BgMYc", "EAHXx3ZJGCI"], recommendedFor: ["문화 안내", "관광 안내", "지역 명소 소개"] },
  statistics_performance: { ids: ["EAHXyMUji0I", "EAHXyJwJhts", "EAHXyGzU3uo", "EAHXyDK6GeM"], recommendedFor: ["통계 안내", "성과 소개", "수치 비교"] },
  cardnews: { ids: ["EAHXyDB1evg", "EAHXyPsE0cs", "EAHXyMJaJlE", "EAHXyHRzfJY"], recommendedFor: ["카드뉴스", "핵심 내용 요약", "단계별 안내"] },
  cartoon: { ids: ["EAHXyeGz-7E", "EAHXyVzY6Rc", "EAHXySFO9ww", "EAHXybJlwRs"], recommendedFor: ["만평", "시사·공공 메시지"] },
} as const satisfies Record<CanvaTemplateFamily, { ids: readonly [string, string, string, string]; recommendedFor: readonly string[] }>;

type VerifiedCanvaDataset = { readonly requiredFields: readonly CanvaMapping["field"][]; readonly imageFields: readonly CanvaMapping["field"][] };

// User-supplied, directly verified datasets. Preserve names and order verbatim.
const verifiedCanvaTemplateDatasets = {
  "EAHXyJEkAsQ": {
    requiredFields: ["PRIMARY_VALUE","SUMMARY","TARGET","METHOD","PERIOD","CATEGORY","CTA","SUPPORT_CONTENT","NOTICE","TITLE"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXyEzk03Q": {
    requiredFields: ["TARGET","SUMMARY","CATEGORY","NOTICE","TITLE","METHOD","PERIOD","CTA","PRIMARY_VALUE","SUPPORT_CONTENT"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXyFYYiJg": {
    requiredFields: ["NOTICE","PRIMARY_VALUE","STEP_2_TEXT","STEP_1_TITLE","CATEGORY","STEP_3_TEXT","TITLE_LINE_1","TITLE_LINE_2","PERIOD","SUPPORT_CONTENT","STEP_2_TITLE","TARGET","STEP_3_TITLE","CTA","STEP_1_TEXT","SUMMARY"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXyK57FWY": {
    requiredFields: ["PRIMARY_VALUE","SUPPORT_CONTENT","TITLE","CATEGORY","TARGET","CTA","PERIOD","SUMMARY","METHOD"],
    imageFields: ["MAIN_IMAGE"],
  },

  "EAHXxK9PTF8": {
    requiredFields: ["EVENT_SUMMARY","EVENT_PLACE","EVENT_DATE","CTA","CATEGORY","TITLE"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxCyfpSI": {
    requiredFields: ["TITLE","CTA","EVENT_PLACE","EVENT_DATE","EVENT_SUMMARY"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxG6zLMQ": {
    requiredFields: ["EVENT_PLACE_LINE","TITLE","CTA","EVENT_SUMMARY","EVENT_DATE_LINE"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxfeoCwc": {
    requiredFields: ["TITLE","CTA","EVENT_SUMMARY","EVENT_PLACE_LINE","EVENT_DATE_LINE"],
    imageFields: ["MAIN_IMAGE"],
  },

  "EAHXxRUqOHo": {
    requiredFields: ["CTA","TITLE","CATEGORY","METHOD","DEADLINE","TARGET","QUOTA","SUMMARY"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxp1_n_U": {
    requiredFields: ["TITLE_LINE_2","CATEGORY","TARGET","SUMMARY","TITLE_LINE_1","METHOD","QUOTA","DEADLINE","CTA","TITLE_LINE_3"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxle-Lzc": {
    requiredFields: ["METHOD","CTA","QUOTA","CATEGORY","TITLE","DEADLINE","TARGET","SUMMARY"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxoxe9Jc": {
    requiredFields: ["DEADLINE","CATEGORY","TITLE","QUOTA","SUMMARY","CTA","METHOD","TARGET"],
    imageFields: ["MAIN_IMAGE"],
  },

  "EAHXxtPWwK0": {
    requiredFields: ["TITLE","CATEGORY","SUMMARY","CTA","PERSON_NAME","POSITION","QUOTE"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxi1onEI": {
    requiredFields: ["CATEGORY","QUOTE","TITLE_LINE_1","CTA","TITLE_LINE_2","SUMMARY","POSITION","PERSON_NAME"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxuOmqEY": {
    requiredFields: ["CATEGORY","SUMMARY","CTA","PERSON_NAME","POSITION","QUOTE","TITLE"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXxql07IU": {
    requiredFields: ["QUOTE","CTA","TITLE_LINE_2","HIGHLIGHT","SUMMARY","PERSON_NAME","POSITION","TITLE_LINE_1","TITLE","CATEGORY"],
    imageFields: ["MAIN_IMAGE"],
  },

  "EAHXx8cBHkw": {
    requiredFields: ["PLACE_NAME","HIGHLIGHT_LINE","SUMMARY","CATEGORY","PRICE_LINE","CTA","TITLE","LOCATION_LINE","PERIOD_LINE"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXx7BgMYc": {
    requiredFields: ["CTA","PERIOD_LINE","SECTION_NO","PLACE_NAME_LINE","LOCATION_LINE","TITLE","HIGHLIGHT_LINE","SUMMARY","PRICE_LINE","CATEGORY"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXx3ZJGCI": {
    requiredFields: ["PLACE_NAME","PRICE_LINE","TITLE","CTA","SUMMARY","DETAIL_TEXT","HIGHLIGHT_LINE","LOCATION_LINE","CATEGORY","PERIOD_LINE"],
    imageFields: ["MAIN_IMAGE"],
  },

  "EAHXyMUji0I": {
    requiredFields: ["KPI_2_VALUE","KPI_3_NAME","KPI_1_INSIGHT","KPI_1_NAME","PRIMARY_UNIT","SOURCE","KPI_2_UNIT","KPI_3_VALUE","CATEGORY","KPI_1_UNIT","TITLE","PERIOD","KPI_2_NAME","PRIMARY_INSIGHT","CTA","KPI_1_VALUE","KPI_2_INSIGHT","KPI_3_UNIT","KPI_3_INSIGHT","PRIMARY_VALUE","SUMMARY"],
    imageFields: ["MAIN_VISUAL"],
  },
  "EAHXyJwJhts": {
    requiredFields: ["CTA","LABEL_A","UNIT_A","CHANGE_VALUE","SUMMARY","LABEL_B","TITLE","VALUE_A","CHANGE_RATE","PERIOD","INSIGHT","CATEGORY","UNIT_B","SOURCE","VALUE_B"],
    imageFields: [],
  },
  "EAHXyGzU3uo": {
    requiredFields: ["POINT_5_VALUE","POINT_4_VALUE","INSIGHT","TITLE","PERIOD","POINT_1_VALUE","SOURCE","PRIMARY_VALUE","CHANGE_VALUE","POINT_1_LABEL","POINT_2_VALUE","POINT_3_LABEL","SUMMARY","POINT_4_LABEL","CATEGORY","POINT_5_LABEL","POINT_2_LABEL","PRIMARY_UNIT","POINT_3_VALUE","CTA"],
    imageFields: ["MAIN_VISUAL"],
  },
  "EAHXyDK6GeM": {
    requiredFields: ["KPI_3_NAME","CATEGORY","KPI_4_UNIT","PERIOD","KPI_4_VALUE","PRIMARY_INSIGHT","INSIGHT_3","KPI_2_NAME","KPI_2_VALUE","INSIGHT_2","TITLE","SUMMARY","SOURCE","CTA","KPI_1_VALUE","KPI_1_NAME","INSIGHT_1","PRIMARY_UNIT","KPI_1_INSIGHT","KPI_2_INSIGHT","KPI_4_INSIGHT","KPI_2_UNIT","KPI_3_INSIGHT","KPI_1_UNIT","KPI_4_NAME","PRIMARY_VALUE","KPI_3_VALUE"],
    imageFields: ["MAIN_VISUAL"],
  },

  "EAHXyDB1evg": {
    requiredFields: ["CTA","ITEM_2_TITLE","ITEM_4_TEXT","TITLE_LINE_1","NOTICE","ITEM_1_TITLE","ITEM_1_TEXT","ITEM_2_TEXT","SUMMARY","HIGHLIGHT_LABEL","TITLE_LINE_2","ITEM_3_TITLE","ITEM_3_TEXT","HIGHLIGHT_VALUE","ITEM_4_TITLE","CATEGORY"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXyMJaJlE": {
    requiredFields: ["SUMMARY","CTA","QUESTION_4","QUESTION_2","NOTICE","TITLE","ANSWER_3","CATEGORY","ANSWER_4","ANSWER_2","ANSWER_1","QUESTION_3","QUESTION_1"],
    imageFields: ["MAIN_IMAGE"],
  },
  "EAHXyHRzfJY": {
    requiredFields: ["CHECK_4_TEXT","CHECK_3_TITLE","HIGHLIGHT_TITLE","CHECK_1_TEXT","CHECK_6_TITLE","HIGHLIGHT_TEXT","CATEGORY","CHECK_5_TEXT","TITLE","CHECK_5_TITLE","CHECK_2_TITLE","CTA","CHECK_3_TEXT","CHECK_2_TEXT","NOTICE","CHECK_1_TITLE","SUMMARY","CHECK_4_TITLE","CHECK_6_TEXT"],
    imageFields: ["MAIN_IMAGE"],
  },

  "EAHXyeGz-7E": {
    requiredFields: ["CTA","CATEGORY","TITLE","SUMMARY","KEY_MESSAGE","SPEECH_2","BODY_TEXT"],
    imageFields: ["HERO_IMAGE"],
  },
  "EAHXyVzY6Rc": {
    requiredFields: ["TITLE","CATEGORY","PANEL_2_TEXT","CTA","KEY_MESSAGE","PANEL_1_TEXT","PANEL_3_TEXT","SUMMARY"],
    imageFields: ["PANEL_1_IMAGE","PANEL_2_IMAGE","PANEL_3_IMAGE"],
  },
  "EAHXySFO9ww": {
    requiredFields: ["DIALOGUE_4","KEY_MESSAGE","NOTICE","DIALOGUE_3","CTA","DIALOGUE_2","DIALOGUE_1","SUMMARY","CATEGORY","TITLE"],
    imageFields: ["CHARACTER_A_IMAGE","CHARACTER_B_IMAGE"],
  },
  "EAHXybJlwRs": {
    requiredFields: ["CATEGORY","PANEL_2_TEXT","SUMMARY","NOTICE","BENEFIT","TITLE","PANEL_3_TEXT","CTA","POLICY_SUMMARY","PANEL_1_TEXT"],
    imageFields: ["PANEL_1_IMAGE","PANEL_2_IMAGE","PANEL_3_IMAGE"],
  },
} as const satisfies Record<string, VerifiedCanvaDataset>;

export const canvaTemplateRegistry: readonly CanonicalCanvaTemplate[] = Object.freeze(
  (Object.keys(definitions) as CanvaTemplateFamily[]).flatMap(family => {
    const definition = definitions[family];
    const recommendedFor = Object.freeze([...definition.recommendedFor]);
    return definition.ids.map((canvaBrandTemplateId, index): CanonicalCanvaTemplate => {
      const variant = (["01", "02", "03", "04"] as const)[index];
      const dataset = (verifiedCanvaTemplateDatasets as Partial<Record<string, VerifiedCanvaDataset>>)[canvaBrandTemplateId];
      return Object.freeze({
        id: `${family}_${variant}`, family, variant,
        displayName: `${canvaTemplateFamilies[family]} ${variant}`,
        canvaBrandTemplateId, templateType: "brand_template", recommendedFor,
        datasetStatus: dataset ? "verified" : "needs_republish",
        requiredFields: dataset ? Object.freeze([...dataset.requiredFields]) : null,
        imageFields: dataset ? Object.freeze([...dataset.imageFields]) : null,
        priority: index + 1,
      });
    });
  }),
);

// Exact lookup only; never derive an external ID from arbitrary input.
export function getCanonicalCanvaTemplate(id: string): CanonicalCanvaTemplate | undefined {
  return canvaTemplateRegistry.find(template => template.id === id);
}

export function listCanonicalCanvaTemplates(family: CanvaTemplateFamily): readonly CanonicalCanvaTemplate[] {
  return canvaTemplateRegistry.filter(template => template.family === family);
}
