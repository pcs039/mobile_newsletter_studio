import { getArticleInterestScore, isArticleWithinValidityWindow, type InterestOrderableArticle } from "@/lib/article-interest-order";

export type ArticlePublicationKind = "regular" | "rolling";

export function normalizeArticlePublicationKind(value: string | null | undefined): ArticlePublicationKind {
  return value === "rolling" ? "rolling" : "regular";
}

export type PublicationArticle = InterestOrderableArticle & {
  publicationKind?: ArticlePublicationKind | null;
  status?: string | null;
  createdAt?: string | null;
};

export function isArticlePubliclyVisible(article: PublicationArticle, now = new Date()) {
  if (normalizeArticlePublicationKind(article.publicationKind) !== "rolling") {
    return true;
  }

  if (article.status !== "published") {
    return false;
  }

  return isArticleWithinValidityWindow(article, now);
}

export function isRollingArticleExpired(article: PublicationArticle, now = new Date()) {
  if (normalizeArticlePublicationKind(article.publicationKind) !== "rolling" || !article.validUntil) {
    return false;
  }

  const validUntil = Date.parse(article.validUntil);

  return Number.isFinite(validUntil) && validUntil < now.getTime();
}

function getRollingBucket(article: PublicationArticle) {
  if (normalizeArticlePublicationKind(article.publicationKind) !== "rolling") {
    return 3;
  }

  if (article.urgency === "urgent") return 0;
  if (article.urgency === "time_sensitive") return 1;
  return 2;
}

export function getPublicOrderedArticles<TArticle extends PublicationArticle>(
  articles: TArticle[],
  selectedInterests: string[],
  now = new Date(),
) {
  return articles
    .map((article, originalIndex) => ({
      article,
      originalIndex,
      bucket: getRollingBucket(article),
      interestScore: getArticleInterestScore(article, selectedInterests, now),
      priority: typeof article.institutionPriority === "number" ? article.institutionPriority : 3,
      createdTime: article.createdAt ? Date.parse(article.createdAt) : Number.NaN,
    }))
    .sort((left, right) => {
      if (left.bucket !== right.bucket) return left.bucket - right.bucket;
      if (left.bucket === 3) {
        if (selectedInterests.length > 0 && right.interestScore !== left.interestScore) {
          return right.interestScore - left.interestScore;
        }

        return left.originalIndex - right.originalIndex;
      }

      if (right.priority !== left.priority) return right.priority - left.priority;
      if (right.interestScore !== left.interestScore) return right.interestScore - left.interestScore;

      if (left.bucket < 3 && Number.isFinite(left.createdTime) && Number.isFinite(right.createdTime)) {
        const createdDifference = right.createdTime - left.createdTime;
        if (createdDifference !== 0) return createdDifference;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ article }) => article);
}
