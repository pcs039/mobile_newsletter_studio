import {
  buildArticleAnalyticsBreakdowns,
  type ArticleAnalyticsBreakdowns,
  type ArticleAnalyticsRow,
  type ProjectArticleAnalyticsResult,
} from "@/lib/article-analytics-repository";

export type OperationsReportInsight = {
  description: string;
  evidence: string[];
  id: string;
  title: string;
  type: "positive" | "attention" | "information";
};

export type OperationsReportSummary = {
  articleViews: number;
  breakdowns: ArticleAnalyticsBreakdowns;
  dominantDevice: {
    count: number;
    device: "mobile" | "pc" | "tablet";
    label: string;
    rate: number | null;
  } | null;
  insights: OperationsReportInsight[];
  periodLabel: string;
  reactionCount: number;
  survey: {
    submissionRate: number | null;
    totalClicks: number;
    totalSubmissions: number | null;
  };
  topArticle: {
    articleId: string;
    articleViews: number;
    reactionCount: number;
    reactionScore: number | null;
    title: string;
  } | null;
  topChannel: {
    count: number;
    label: string;
    rate: number | null;
    source: string;
  } | null;
  topReactionArticle: {
    articleId: string;
    articleViews: number;
    reactionCount: number;
    reactionScore: number;
    title: string;
  } | null;
  topReferrer: {
    count: number;
    domain: string;
    rate: number | null;
  } | null;
  totalVisits: number | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "이메일",
  facebook: "페이스북",
  homepage: "홈페이지",
  instagram: "인스타그램",
  kakao: "카카오톡",
  naver: "네이버",
  newsletter: "뉴스레터",
  qr: "QR",
  sms: "문자",
};

const DEVICE_LABELS = {
  mobile: "모바일",
  pc: "PC",
  tablet: "태블릿",
} as const;

function formatCount(value: number) {
  return `${value.toLocaleString("ko-KR")}건`;
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function getTopArticle(articles: ArticleAnalyticsRow[]) {
  return [...articles]
    .filter((article) => article.articleViews > 0)
    .sort((left, right) => (
      right.articleViews - left.articleViews ||
      right.reactionCount - left.reactionCount ||
      left.sortOrder - right.sortOrder ||
      left.articleId.localeCompare(right.articleId)
    ))[0] ?? null;
}

function getTopReactionArticle(articles: ArticleAnalyticsRow[]) {
  return [...articles]
    .filter((article): article is ArticleAnalyticsRow & { reactionScore: number } => (
      article.articleViews > 0 && article.reactionScore !== null
    ))
    .sort((left, right) => (
      right.reactionScore - left.reactionScore ||
      right.articleViews - left.articleViews ||
      right.reactionCount - left.reactionCount ||
      left.sortOrder - right.sortOrder ||
      left.articleId.localeCompare(right.articleId)
    ))[0] ?? null;
}

export function getOperationsChannelLabel(source: string) {
  return CHANNEL_LABELS[source] ?? source;
}

export function buildOperationsReportSummary(
  analytics: ProjectArticleAnalyticsResult,
): OperationsReportSummary {
  const articleViews = analytics.articles.reduce((sum, article) => sum + article.articleViews, 0);
  const reactionCount = analytics.articles.reduce((sum, article) => sum + article.reactionCount, 0);
  const topArticleRow = getTopArticle(analytics.articles);
  const topReactionArticleRow = getTopReactionArticle(analytics.articles);
  const topChannelRow = analytics.channelAnalytics.rows[0] ?? null;
  const topReferrerRow = analytics.referrerAnalytics.domains[0] ?? null;
  const devices = (["mobile", "pc", "tablet"] as const).map((device) => ({
    count: analytics.deviceAnalytics[device],
    device,
    label: DEVICE_LABELS[device],
    rate: analytics.deviceAnalytics[`${device}Rate`],
  }));
  const dominantDevice = analytics.deviceAnalytics.total > 0
    ? devices.sort((left, right) => right.count - left.count)[0]
    : null;
  const topArticle = topArticleRow
    ? {
        articleId: topArticleRow.articleId,
        articleViews: topArticleRow.articleViews,
        reactionCount: topArticleRow.reactionCount,
        reactionScore: topArticleRow.reactionScore,
        title: topArticleRow.title,
      }
    : null;
  const topReactionArticle = topReactionArticleRow
    ? {
        articleId: topReactionArticleRow.articleId,
        articleViews: topReactionArticleRow.articleViews,
        reactionCount: topReactionArticleRow.reactionCount,
        reactionScore: topReactionArticleRow.reactionScore,
        title: topReactionArticleRow.title,
      }
    : null;
  const topChannel = topChannelRow
    ? {
        count: topChannelRow.count,
        label: getOperationsChannelLabel(topChannelRow.source),
        rate: topChannelRow.rate,
        source: topChannelRow.source,
      }
    : null;
  const topReferrer = topReferrerRow
    ? {
        count: topReferrerRow.count,
        domain: topReferrerRow.domain,
        rate: topReferrerRow.rate,
      }
    : null;
  const insights: OperationsReportInsight[] = [];

  if (articleViews === 0) {
    insights.push({
      description: "선택한 기간에는 기사 열람 이벤트가 없어 기사별 성과를 판단하기 어렵습니다.",
      evidence: ["기사 열람 0건"],
      id: "article-data-insufficient",
      title: "현재 기간에는 기사 열람 데이터가 충분하지 않습니다.",
      type: "information",
    });
  }

  if (analytics.deviceAnalytics.mobileRate !== null && analytics.deviceAnalytics.mobileRate >= 70) {
    insights.push({
      description: `선택한 기간 접속의 ${formatRate(analytics.deviceAnalytics.mobileRate)}가 모바일에서 발생했습니다.`,
      evidence: [
        `모바일 접속 ${formatCount(analytics.deviceAnalytics.mobile)}`,
        `모바일 비중 ${formatRate(analytics.deviceAnalytics.mobileRate)}`,
      ],
      id: "mobile-majority",
      title: "모바일 이용 비중이 높습니다.",
      type: "positive",
    });
  }

  if (topChannel && analytics.channelAnalytics.attributedRate !== null) {
    if (analytics.channelAnalytics.attributedRate < 20) {
      insights.push({
        description: "UTM으로 식별된 접속 비중이 낮아 채널별 성과를 전체 배포 성과로 일반화하기 어렵습니다.",
        evidence: [
          `식별된 채널 접속 ${formatCount(analytics.channelAnalytics.attributed)}`,
          `전체 접속 대비 ${formatRate(analytics.channelAnalytics.attributedRate)}`,
        ],
        id: "channel-coverage-low",
        title: "식별 가능한 배포 채널 비중이 낮습니다.",
        type: "attention",
      });
    } else {
      insights.push({
        description: `UTM으로 식별된 배포 채널 가운데 ${topChannel.label} 접속이 가장 많았습니다.`,
        evidence: [
          `${topChannel.label} ${formatCount(topChannel.count)}`,
          `전체 접속 대비 ${topChannel.rate === null ? "-" : formatRate(topChannel.rate)}`,
        ],
        id: "top-channel",
        title: `가장 많이 식별된 배포 채널은 ${topChannel.label}입니다.`,
        type: "information",
      });
    }
  }

  if (topArticle) {
    insights.push({
      description: "선택한 기간에 기사 열람 이벤트가 가장 많이 기록된 기사입니다.",
      evidence: [
        `기사 열람 ${formatCount(topArticle.articleViews)}`,
        `후속 행동 ${formatCount(topArticle.reactionCount)}`,
      ],
      id: "top-article",
      title: `가장 많이 읽힌 기사는 ${topArticle.title}입니다.`,
      type: "positive",
    });
  }

  if (topReactionArticle && topReactionArticle.articleViews >= 3 && topReactionArticle.reactionCount > 0) {
    insights.push({
      description: "기사 열람 100회당 후속 행동 건수가 가장 높은 기사입니다.",
      evidence: [
        `반응도 ${formatRate(topReactionArticle.reactionScore)}`,
        `기사 열람 ${formatCount(topReactionArticle.articleViews)}`,
        `후속 행동 ${formatCount(topReactionArticle.reactionCount)}`,
      ],
      id: "top-reaction-article",
      title: `후속 행동 반응이 가장 높은 기사는 ${topReactionArticle.title}입니다.`,
      type: "positive",
    });
  }

  if (
    analytics.surveyConversions.totalClicks > 0 &&
    (analytics.surveyConversions.totalSubmissions ?? 0) > 0 &&
    analytics.surveyConversions.submissionRate !== null
  ) {
    insights.push({
      description: `참여 콘텐츠 이동 대비 제출 비율은 ${formatRate(analytics.surveyConversions.submissionRate)}입니다. 동일 사용자의 연속 행동을 뜻하지 않는 참고 지표입니다.`,
      evidence: [
        `참여 콘텐츠 이동 ${formatCount(analytics.surveyConversions.totalClicks)}`,
        `실제 제출 ${formatCount(analytics.surveyConversions.totalSubmissions ?? 0)}`,
      ],
      id: "survey-submissions",
      title: "참여 콘텐츠 이동 이후 실제 제출이 발생했습니다.",
      type: "information",
    });
  }

  if (insights.length === 0) {
    insights.push({
      description: "선택한 기간에 규칙형 운영 인사이트를 만들 수 있는 관측 이벤트가 아직 없습니다.",
      evidence: ["집계된 운영 지표 기준"],
      id: "no-insights",
      title: "운영 데이터가 더 쌓이면 주요 흐름을 확인할 수 있습니다.",
      type: "information",
    });
  }

  return {
    articleViews,
    breakdowns: buildArticleAnalyticsBreakdowns(analytics.articles),
    dominantDevice,
    insights: insights.slice(0, 5),
    periodLabel: analytics.periodRange.label,
    reactionCount,
    survey: {
      submissionRate: analytics.surveyConversions.submissionRate,
      totalClicks: analytics.surveyConversions.totalClicks,
      totalSubmissions: analytics.surveyConversions.totalSubmissions,
    },
    topArticle,
    topChannel,
    topReactionArticle,
    topReferrer,
    totalVisits: analytics.totalVisits,
  };
}
