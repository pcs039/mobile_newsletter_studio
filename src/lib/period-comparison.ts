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

export type AiComparisonEvidence = {
  description: string;
  evidence: string[];
  id:
    | "comparison-total-visits"
    | "comparison-article-views"
    | "comparison-reaction-count"
    | "comparison-survey-submissions"
    | "comparison-mobile-rate"
    | "comparison-channel-attributed-rate";
  title: string;
};

type ComparisonMetricKey = keyof NonNullable<PeriodComparisonSummary["metrics"]>;

const comparisonEvidenceDefinitions: Array<{
  id: AiComparisonEvidence["id"];
  metricKey: ComparisonMetricKey;
  title: string;
}> = [
  { id: "comparison-total-visits", metricKey: "totalVisits", title: "전체 접속 변화" },
  { id: "comparison-article-views", metricKey: "articleViews", title: "기사 열람 변화" },
  { id: "comparison-reaction-count", metricKey: "reactionCount", title: "후속 행동 변화" },
  { id: "comparison-survey-submissions", metricKey: "surveySubmissions", title: "참여 제출 변화" },
  { id: "comparison-mobile-rate", metricKey: "mobileRate", title: "모바일 비중 변화" },
  { id: "comparison-channel-attributed-rate", metricKey: "channelAttributedRate", title: "UTM 식별 비중 변화" },
];

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

function formatCount(value: number) {
  return `${value.toLocaleString("ko-KR")}건`;
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatChange(value: number, unit: PeriodComparisonUnit) {
  const amount = Math.abs(value);
  return unit === "count" ? formatCount(amount) : `${amount.toFixed(1)}%p`;
}

function buildComparisonEvidenceItem(
  metric: PeriodComparisonMetric,
  definition: (typeof comparisonEvidenceDefinitions)[number],
): AiComparisonEvidence | null {
  if (
    metric.direction === "unavailable" ||
    metric.current === null ||
    metric.previous === null ||
    metric.absoluteChange === null
  ) {
    return null;
  }

  const currentValue = metric.unit === "count" ? formatCount(metric.current) : formatRate(metric.current);
  const previousValue = metric.unit === "count" ? formatCount(metric.previous) : formatRate(metric.previous);
  const directionLabel = metric.direction === "up" ? "증가" : metric.direction === "down" ? "감소" : "변화 없음";
  const evidence = [`현재 ${currentValue}`, `이전 ${previousValue}`];
  let description: string;

  if (metric.direction === "new") {
    description = `이전 기간에는 ${metric.label}이 없었고 현재 기간에는 ${currentValue}이 관측됐습니다.`;
    evidence.push("새로 관측");
  } else if (metric.direction === "same") {
    description = `현재 기간 ${metric.label}은 이전 기간과 같은 수준입니다.`;
    evidence.push("변화 없음");
  } else {
    const change = formatChange(metric.absoluteChange, metric.unit);
    description = `현재 기간 ${metric.label}은 이전 기간보다 ${change} ${directionLabel}했습니다.`;
    evidence.push(`${change} ${directionLabel}`);

    if (metric.unit === "count" && metric.percentChange !== null) {
      evidence.push(`${Math.abs(metric.percentChange).toFixed(1)}% ${directionLabel}`);
    }
  }

  return {
    description,
    evidence,
    id: definition.id,
    title: definition.title,
  };
}

export function buildPeriodComparisonEvidence(
  comparison: PeriodComparisonSummary,
): AiComparisonEvidence[] {
  if (!comparison.available || !comparison.metrics) return [];
  const metrics = comparison.metrics;

  return comparisonEvidenceDefinitions.flatMap((definition) => {
    const evidence = buildComparisonEvidenceItem(
      metrics[definition.metricKey],
      definition,
    );

    return evidence ? [evidence] : [];
  });
}
