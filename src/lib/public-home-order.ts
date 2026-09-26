import { getArticleInterestScore, isArticleWithinValidityWindow } from "@/lib/article-interest-order";
import type { ProjectContentArticle, PublicHomeSectionKey, PublicHomeSectionSetting } from "@/lib/newsletter-repository";

export const publicHomeSectionDefaults: Array<PublicHomeSectionSetting> = [
  { key: "must_know", label: "지금 꼭 알아야 할 소식", enabled: true, order: 10 },
  { key: "support", label: "신청할 수 있어요", enabled: true, order: 20 },
  { key: "local", label: "우리 동네", enabled: true, order: 30 },
  { key: "life", label: "생활에 도움돼요", enabled: true, order: 40 },
  { key: "event", label: "이번 주 행사", enabled: true, order: 50 },
];

const sectionByType: Partial<Record<ProjectContentArticle["articleType"], PublicHomeSectionKey>> = {
  application_recruitment: "support",
  welfare_health: "support",
  local_news: "local",
  life_civil: "life",
  event_festival: "event",
  tourism_place: "event",
  emergency: "must_know",
  government_major: "must_know",
};

export function normalizePublicHomeSectionKey(value: string | null | undefined): PublicHomeSectionKey | null {
  return publicHomeSectionDefaults.some((section) => section.key === value) ? (value as PublicHomeSectionKey) : null;
}

function getArticleHomeSection(article: ProjectContentArticle): PublicHomeSectionKey {
  const override = normalizePublicHomeSectionKey(article.homeSectionOverride);

  if (override) {
    return override;
  }

  if (article.urgency === "urgent" || article.institutionPriority >= 5) {
    return "must_know";
  }

  return sectionByType[article.articleType] ?? "life";
}

function getRegionScore(article: ProjectContentArticle, selectedRegion: string) {
  if (!selectedRegion || selectedRegion === "all") {
    return 0;
  }

  return article.homeTargetRegions.some((region) => region === selectedRegion) ? 24 : -4;
}

function getUrgencyScore(article: ProjectContentArticle) {
  if (article.urgency === "urgent") {
    return 34;
  }

  if (article.urgency === "time_sensitive") {
    return 18;
  }

  return 0;
}

function getArticleHomeScore(article: ProjectContentArticle, selectedRegion: string, selectedInterests: string[]) {
  return (
    getUrgencyScore(article) +
    getRegionScore(article, selectedRegion) +
    getArticleInterestScore(article, selectedInterests) +
    article.institutionPriority * 4 -
    article.sortOrder / 1000
  );
}

export function buildPublicHomeSections(
  articles: ProjectContentArticle[],
  sectionSettings: PublicHomeSectionSetting[],
  selectedRegion: string,
  selectedInterests: string[],
) {
  const enabledSections = [...sectionSettings]
    .filter((section) => section.enabled)
    .sort((a, b) => a.order - b.order);
  const currentlyVisibleArticles = articles.filter((article) => isArticleWithinValidityWindow(article));

  return enabledSections.map((section) => ({
    ...section,
    articles: currentlyVisibleArticles
      .filter((article) => getArticleHomeSection(article) === section.key)
      .sort((a, b) => getArticleHomeScore(b, selectedRegion, selectedInterests) - getArticleHomeScore(a, selectedRegion, selectedInterests))
      .slice(0, 4),
  }));
}
