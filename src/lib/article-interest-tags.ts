export const recommendedArticleInterestTags = [
  "건강·복지",
  "생활·민원",
  "교통·도시",
  "청년·일자리",
  "교육·돌봄",
  "문화·축제",
  "관광",
  "농업·귀농",
  "기업·산업",
  "우리동네",
  "시정·군정 주요소식",
] as const;

export type RecommendedArticleInterestTag = (typeof recommendedArticleInterestTags)[number];
