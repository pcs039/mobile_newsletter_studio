export type ArticlePublicInfo = Record<string, string>;

export type ArticlePublicInfoField = {
  key: string;
  label: string;
};

export type ArticlePublicInfoFieldGroup = {
  cardTitle: string;
  fields: ArticlePublicInfoField[];
};

const publicInfoFieldGroups: Record<string, ArticlePublicInfoFieldGroup> = {
  general: {
    cardTitle: "",
    fields: [],
  },
  welfare_health: {
    cardTitle: "복지·건강 핵심정보",
    fields: [
      { key: "target", label: "대상" },
      { key: "support", label: "지원내용" },
      { key: "method", label: "이용·신청방법" },
      { key: "period", label: "기간" },
    ],
  },
  application_recruitment: {
    cardTitle: "신청 핵심정보",
    fields: [
      { key: "target", label: "대상" },
      { key: "period", label: "기간" },
      { key: "benefit", label: "지원내용" },
      { key: "method", label: "신청방법" },
    ],
  },
  event_festival: {
    cardTitle: "행사 핵심정보",
    fields: [
      { key: "dateTime", label: "일시" },
      { key: "place", label: "장소" },
      { key: "highlights", label: "주요내용" },
      { key: "guide", label: "이용안내" },
    ],
  },
  tourism_place: {
    cardTitle: "방문 핵심정보",
    fields: [
      { key: "location", label: "위치" },
      { key: "hours", label: "운영시간" },
      { key: "guide", label: "이용안내" },
      { key: "fee", label: "요금" },
    ],
  },
  life_civil: {
    cardTitle: "생활·민원 핵심정보",
    fields: [
      { key: "target", label: "대상" },
      { key: "service", label: "서비스 내용" },
      { key: "method", label: "이용방법" },
      { key: "hours", label: "운영시간" },
    ],
  },
  government_major: {
    cardTitle: "주요 정보",
    fields: [
      { key: "keyPoint", label: "핵심내용" },
      { key: "schedule", label: "추진일정" },
    ],
  },
  local_news: {
    cardTitle: "우리동네 핵심정보",
    fields: [
      { key: "area", label: "지역" },
      { key: "dateTime", label: "일시" },
      { key: "place", label: "장소" },
      { key: "guide", label: "안내" },
    ],
  },
  emergency: {
    cardTitle: "긴급 핵심정보",
    fields: [
      { key: "affectedArea", label: "대상 지역" },
      { key: "effectiveTime", label: "적용 시각" },
      { key: "action", label: "행동요령" },
      { key: "contact", label: "문의" },
    ],
  },
};

export function getArticlePublicInfoFieldGroup(articleType: string | null | undefined) {
  return publicInfoFieldGroups[articleType || "general"] ?? publicInfoFieldGroups.general;
}

export function getArticlePublicInfoEntries(publicInfo: ArticlePublicInfo, articleType: string | null | undefined) {
  return getArticlePublicInfoFieldGroup(articleType).fields.flatMap((field) => {
    const value = publicInfo[field.key]?.trim();

    return value ? [{ ...field, value }] : [];
  });
}

export function normalizeArticlePublicInfoValue(value: unknown, articleType: string | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const allowedFields = getArticlePublicInfoFieldGroup(articleType).fields.slice(0, 12);
  const input = value as Record<string, unknown>;
  const normalized: ArticlePublicInfo = {};

  allowedFields.forEach((field) => {
    const rawValue = input[field.key];

    if (typeof rawValue !== "string") {
      return;
    }

    const cleaned = rawValue.trim().slice(0, 300);

    if (cleaned) {
      normalized[field.key] = cleaned;
    }
  });

  return normalized;
}
