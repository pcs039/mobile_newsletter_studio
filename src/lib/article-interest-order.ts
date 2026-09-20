export type InterestOrderableArticle = {
  id: string;
  interestTags?: string[] | null;
  institutionPriority?: number | null;
  urgency?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

export function getAvailableInterestTags<TArticle extends InterestOrderableArticle>(articles: TArticle[]) {
  const tagMap = new Map<string, { count: number; firstSeenIndex: number }>();

  articles.forEach((article, articleIndex) => {
    const seenInArticle = new Set<string>();

    article.interestTags?.forEach((rawTag) => {
      const tag = rawTag.trim();

      if (!tag || seenInArticle.has(tag)) {
        return;
      }

      seenInArticle.add(tag);

      const current = tagMap.get(tag);

      if (current) {
        current.count += 1;
        return;
      }

      tagMap.set(tag, { count: 1, firstSeenIndex: articleIndex });
    });
  });

  return [...tagMap.entries()]
    .sort(([, left], [, right]) => right.count - left.count || left.firstSeenIndex - right.firstSeenIndex)
    .map(([tag]) => tag);
}

function parseBoundedTime(value: string | null | undefined) {
  const cleaned = value?.trim() ?? "";

  if (!cleaned) {
    return null;
  }

  const parsed = Date.parse(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

export function isArticleWithinValidityWindow(article: InterestOrderableArticle, now = new Date()) {
  const currentTime = now.getTime();
  const validFrom = parseBoundedTime(article.validFrom);
  const validUntil = parseBoundedTime(article.validUntil);

  if (validFrom !== null && currentTime < validFrom) {
    return false;
  }

  if (validUntil !== null && currentTime > validUntil) {
    return false;
  }

  return true;
}

export function getArticleInterestScore(
  article: InterestOrderableArticle,
  selectedInterests: string[],
  now = new Date(),
) {
  if (selectedInterests.length === 0) {
    return 0;
  }

  const articleTags = new Set((article.interestTags ?? []).map((tag) => tag.trim()).filter(Boolean));
  const isWithinValidity = isArticleWithinValidityWindow(article, now);
  let score = 0;

  if (article.urgency === "urgent" && isWithinValidity) {
    score += 1000;
  }

  selectedInterests.forEach((interest) => {
    if (articleTags.has(interest)) {
      score += 300;
    }
  });

  if (article.urgency === "time_sensitive" && isWithinValidity) {
    score += 120;
  }

  const priority = typeof article.institutionPriority === "number" ? article.institutionPriority : 3;
  score += (Math.min(5, Math.max(1, priority)) - 3) * 20;

  return score;
}

export function getInterestOrderedArticles<TArticle extends InterestOrderableArticle>(
  articles: TArticle[],
  selectedInterests: string[],
  now = new Date(),
) {
  if (selectedInterests.length === 0) {
    return articles;
  }

  return articles
    .map((article, originalIndex) => ({
      article,
      originalIndex,
      score: getArticleInterestScore(article, selectedInterests, now),
    }))
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .map(({ article }) => article);
}
