import type { ArticlePublicInfoType } from "@/lib/newsletter-repository";

export const articlePublicInfoTypeOptions: Array<{ value: ArticlePublicInfoType; label: string }> = [
  { value: "general", label: "일반형" },
  { value: "welfare_health", label: "복지·건강형" },
  { value: "application_recruitment", label: "신청·모집형" },
  { value: "event_festival", label: "축제·행사형" },
  { value: "tourism_place", label: "관광·장소형" },
  { value: "life_civil", label: "생활·민원형" },
  { value: "government_major", label: "시정·군정 주요소식형" },
  { value: "local_news", label: "읍면동·지역소식형" },
  { value: "emergency", label: "긴급·안전형" },
];
