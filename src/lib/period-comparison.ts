import type { ProjectArticleAnalyticsResult } from "@/lib/article-analytics-repository";

export type PeriodComparisonDirection = "up" | "down" | "same" | "new" | "unavailable";
export type PeriodComparisonUnit = "count" | "percentage_point";

export type PeriodComparisonMetric = {
  absoluteChange: number | null;
  current: number | null;
  direction: PeriodComparisonDirection;
  key: string;
  label: string;
  percentChange: number | null;
  previous: number | null;
  unit: PeriodComparisonUnit;
};

export type PeriodComparisonSummary = {
  available: boolean;
  currentLabel: string;
  currentRange: {
    endDate: string | null;
    startDate: string | null;
  };
  metrics: {
    articleViews: PeriodComparisonMetric;
    channelAttributedRate: PeriodComparisonMetric;
    mobileRate: PeriodComparisonMetric;
    reactionCount: PeriodComparisonMetric;
    surveySubmissions: PeriodComparisonMetric;
    totalVisits: PeriodComparisonMetric;
  } | null;
  previousLabel: string | null;
  previousRange: {
    endDate: string | null;
    startDate: string | null;
  } | null;
  unavailableReason: "all" | "previous_unavailable" | null;
};

function getDirection(change: number): PeriodComparisonDirection {
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "same";
}

export function buildCountComparisonMetric(
  key: string,
  label: string,
  current: number | null,
  previous: number | null,
): PeriodComparisonMetric {
  if (current === null || previous === null) {
    return {
      absoluteChange: null,
      current,
      direction: "unavailable",
      key,
      label,
      percentChange: null,
      previous,
      unit: "count",
    };
  }

  const absoluteChange = current - previous;

  if (previous === 0 && current > 0) {
    return {
      absoluteChange,
      current,
      direction: "new",
      key,
      label,
      percentChange: null,
      previous,
      unit: "count",
    };
  }

  return {
    absoluteChange,
    current,
    direction: getDirection(absoluteChange),
    key,
    label,
    percentChange: previous === 0 ? 0 : (absoluteChange / previous) * 100,
    previous,
    unit: "count",
  };
}

export function buildPercentagePointComparisonMetric(
  key: string,
  label: string,
  current: number | null,
  previous: number | null,
): PeriodComparisonMetric {
  if (current === null || previous === null) {
    return {
      absoluteChange: null,
      current,
      direction: "unavailable",
      key,
      label,
      percentChange: null,
      previous,
      unit: "percentage_point",
    };
  }

  const absoluteChange = current - previous;

  return {
    absoluteChange,
    current,
    direction: getDirection(absoluteChange),
    key,
    label,
    percentChange: null,
    previous,
    unit: "percentage_point",
  };
}

function getArticleTotals(analytics: ProjectArticleAnalyticsResult) {
  return analytics.articles.reduce(
    (totals, article) => ({
      articleViews: totals.articleViews + article.articleViews,
      reactionCount: totals.reactionCount + article.reactionCount,
    }),
    { articleViews: 0, reactionCount: 0 },
  );
}

export function buildPeriodComparisonSummary(
  current: ProjectArticleAnalyticsResult,
  previous: ProjectArticleAnalyticsResult | null,
): PeriodComparisonSummary {
  const currentRange = {
    endDate: current.periodRange.endDate,
    startDate: current.periodRange.startDate,
  };

  if (current.periodRange.period === "all") {
    return {
      available: false,
      currentLabel: current.periodRange.label,
      currentRange,
      metrics: null,
      previousLabel: null,
      previousRange: null,
      unavailableReason: "all",
    };
  }

  if (current.source !== "supabase" || !previous || previous.source !== "supabase") {
    return {
      available: false,
      currentLabel: current.periodRange.label,
      currentRange,
      metrics: null,
      previousLabel: previous?.periodRange.label ?? null,
      previousRange: previous
        ? { endDate: previous.periodRange.endDate, startDate: previous.periodRange.startDate }
        : null,
      unavailableReason: "previous_unavailable",
    };
  }

  const currentTotals = getArticleTotals(current);
  const previousTotals = getArticleTotals(previous);

  return {
    available: true,
    currentLabel: current.periodRange.label,
    currentRange,
    metrics: {
      articleViews: buildCountComparisonMetric(
        "articleViews",
        "기사 열람",
        currentTotals.articleViews,
        previousTotals.articleViews,
      ),
      channelAttributedRate: buildPercentagePointComparisonMetric(
        "channelAttributedRate",
        "UTM 식별 비중",
        current.channelAnalytics.attributedRate,
        previous.channelAnalytics.attributedRate,
      ),
      mobileRate: buildPercentagePointComparisonMetric(
        "mobileRate",
        "모바일 비중",
        current.deviceAnalytics.mobileRate,
        previous.deviceAnalytics.mobileRate,
      ),
      reactionCount: buildCountComparisonMetric(
        "reactionCount",
        "후속 행동",
        currentTotals.reactionCount,
        previousTotals.reactionCount,
      ),
      surveySubmissions: buildCountComparisonMetric(
        "surveySubmissions",
        "참여 제출",
        current.surveyConversions.totalSubmissions,
        previous.surveyConversions.totalSubmissions,
      ),
      totalVisits: buildCountComparisonMetric(
        "totalVisits",
        "전체 접속",
        current.totalVisits,
        previous.totalVisits,
      ),
    },
    previousLabel: previous.periodRange.label,
    previousRange: {
      endDate: previous.periodRange.endDate,
      startDate: previous.periodRange.startDate,
    },
    unavailableReason: null,
  };
}
