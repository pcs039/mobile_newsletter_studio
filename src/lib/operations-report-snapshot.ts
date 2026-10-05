import type {
  AccessDeviceAnalytics,
  ArticleAnalyticsDailyTrendRow,
  ArticleAnalyticsRow,
  ChannelAnalytics,
  ProjectArticleAnalyticsResult,
  ReferrerAnalytics,
  SurveyConversionAnalytics,
} from "@/lib/article-analytics-repository";
import type { AnalyticsPeriod, AnalyticsPeriodRange } from "@/lib/article-analytics-types";
import type {
  AiEvidenceCatalogItem,
  AiOperationsCommentary,
} from "@/lib/ai-operations-commentary";
import type { ProjectWorkspaceInfo } from "@/lib/newsletter-repository";
import type { OperationsReportSummary } from "@/lib/operations-report";
import type { PeriodComparisonSummary } from "@/lib/period-comparison";

export const OPERATIONS_REPORT_SNAPSHOT_SCHEMA_VERSION = 1;

export type OperationsReportSnapshotPayload = {
  analytics: {
    articles: ArticleAnalyticsRow[];
    channel: ChannelAnalytics;
    dailyTrends: ArticleAnalyticsDailyTrendRow[];
    devices: AccessDeviceAnalytics;
    referrers: ReferrerAnalytics;
    survey: SurveyConversionAnalytics;
    totalVisits: number | null;
  };
  capturedAt: string;
  comparison: PeriodComparisonSummary;
  periodRange: AnalyticsPeriodRange;
  project: {
    id: string;
    issue: string;
    organization: string;
    slug: string;
    title: string;
  };
  report: OperationsReportSummary;
  version: 1;
};

export type OperationsReportSnapshotSummary = {
  createdAt: string;
  createdBy: string;
  hasAiCommentary: boolean;
  id: string;
  period: AnalyticsPeriod;
  periodEnd: string | null;
  periodLabel: string;
  periodStart: string | null;
  schemaVersion: number;
  title: string;
};

export type OperationsReportSnapshotDetail = OperationsReportSnapshotSummary & {
  aiCommentary: AiOperationsCommentary | null;
  evidenceCatalog: AiEvidenceCatalogItem[];
  payload: OperationsReportSnapshotPayload;
};

type BuildOperationsReportSnapshotInput = {
  analytics: ProjectArticleAnalyticsResult;
  capturedAt: Date;
  comparison: PeriodComparisonSummary;
  project: ProjectWorkspaceInfo;
  report: OperationsReportSummary;
};

export function buildOperationsReportSnapshotPayload({
  analytics,
  capturedAt,
  comparison,
  project,
  report,
}: BuildOperationsReportSnapshotInput): OperationsReportSnapshotPayload {
  return {
    analytics: {
      articles: analytics.articles.map((article) => ({ ...article, interestTags: [...article.interestTags] })),
      channel: {
        ...analytics.channelAnalytics,
        campaigns: analytics.channelAnalytics.campaigns.map((campaign) => ({ ...campaign })),
        rows: analytics.channelAnalytics.rows.map((row) => ({ ...row })),
      },
      dailyTrends: analytics.dailyTrends.map((row) => ({ ...row })),
      devices: { ...analytics.deviceAnalytics },
      referrers: {
        ...analytics.referrerAnalytics,
        domains: analytics.referrerAnalytics.domains.map((row) => ({ ...row })),
      },
      survey: {
        ...analytics.surveyConversions,
        rows: analytics.surveyConversions.rows.map((row) => ({ ...row })),
      },
      totalVisits: analytics.totalVisits,
    },
    capturedAt: capturedAt.toISOString(),
    comparison,
    periodRange: { ...analytics.periodRange },
    project: {
      id: project.id,
      issue: project.issue,
      organization: project.organization,
      slug: project.slug,
      title: project.title,
    },
    report,
    version: OPERATIONS_REPORT_SNAPSHOT_SCHEMA_VERSION,
  };
}

export function isOperationsReportSnapshotPayload(value: unknown): value is OperationsReportSnapshotPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const project = record.project;
  const periodRange = record.periodRange;

  return record.version === OPERATIONS_REPORT_SNAPSHOT_SCHEMA_VERSION
    && typeof record.capturedAt === "string"
    && Boolean(record.analytics && typeof record.analytics === "object" && !Array.isArray(record.analytics))
    && Boolean(record.report && typeof record.report === "object" && !Array.isArray(record.report))
    && Boolean(record.comparison && typeof record.comparison === "object" && !Array.isArray(record.comparison))
    && Boolean(project && typeof project === "object" && !Array.isArray(project))
    && Boolean(periodRange && typeof periodRange === "object" && !Array.isArray(periodRange));
}
