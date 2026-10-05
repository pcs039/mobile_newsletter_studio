import { detectDeviceType } from "@/lib/device-type";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";
import {
  getAnalyticsPeriodRange,
  normalizeAnalyticsPeriod,
  type AnalyticsPeriod,
  type AnalyticsPeriodRange,
  type ArticleEventType,
} from "@/lib/article-analytics-types";

type ArticleEventRow = {
  article_id: string;
  event_type: ArticleEventType;
  occurred_at: string;
  survey_id: string | null;
};

type AnalyticsArticleRow = {
  article_type: string | null;
  id: string;
  interest_tags: string[] | null;
  publication_kind: string | null;
  sort_order: number | null;
  title: string | null;
  urgency: string | null;
};

type DailyStatsRow = {
  mobile_count: number | null;
  pc_count: number | null;
  stat_date: string;
  tablet_count: number | null;
  view_count: number | null;
};

type SurveyMetadataRow = {
  id: string;
  status: string | null;
  survey_kind: string | null;
  title: string | null;
};

type SurveyResponseRow = {
  submitted_at: string;
  survey_id: string;
};

type ViewReferrerRow = {
  occurred_at: string;
  referrer_domain: string | null;
};

type ViewAttributionRow = ViewReferrerRow & {
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_source: string | null;
};

export type ArticleAnalyticsRow = {
  articleId: string;
  articleType: string;
  articleViews: number;
  audioPlays: number;
  ctaClicks: number;
  interestTags: string[];
  mapClicks: number;
  phoneClicks: number;
  publicationKind: "regular" | "rolling";
  reactionCount: number;
  reactionScore: number | null;
  sortOrder: number;
  surveyClicks: number;
  title: string;
  urgency: "normal" | "time_sensitive" | "urgent";
};

export type ArticleAnalyticsBreakdownRow = {
  articleCount: number;
  articleViews: number;
  ctaClicks: number;
  key: string;
  mapClicks: number;
  phoneClicks: number;
  reactionCount: number;
  reactionScore: number | null;
  surveyClicks: number;
};

export type ArticleAnalyticsBreakdowns = {
  articleTypes: ArticleAnalyticsBreakdownRow[];
  interestTags: ArticleAnalyticsBreakdownRow[];
  publicationGroups: ArticleAnalyticsBreakdownRow[];
};

export type ArticleAnalyticsDailyTrendRow = {
  articleViews: number;
  date: string;
  reactionCount: number;
  totalVisits: number;
};

export type SurveyConversionAnalyticsRow = {
  clickCount: number;
  kind: "survey" | "event";
  submissionCount: number;
  submissionRate: number | null;
  surveyId: string;
  title: string;
};

export type SurveyConversionAnalytics = {
  rows: SurveyConversionAnalyticsRow[];
  submissionRate: number | null;
  totalClicks: number;
  totalSubmissions: number | null;
  warning: string;
};

export type AccessDeviceAnalytics = {
  mobile: number;
  mobileRate: number | null;
  pc: number;
  pcRate: number | null;
  tablet: number;
  tabletRate: number | null;
  total: number;
};

export type ReferrerDomainAnalyticsRow = {
  count: number;
  domain: string;
  rate: number | null;
};

export type ReferrerAnalytics = {
  directInternal: number;
  directInternalRate: number | null;
  domains: ReferrerDomainAnalyticsRow[];
  external: number;
  externalRate: number | null;
  legacyExcludedCount: number;
  total: number;
  warning: string;
};

export type ChannelAnalyticsRow = {
  count: number;
  rate: number | null;
  source: string;
};

export type CampaignAnalyticsRow = {
  campaign: string;
  count: number;
  rate: number | null;
};

export type ChannelAnalytics = {
  attributed: number;
  attributedRate: number | null;
  campaigns: CampaignAnalyticsRow[];
  rows: ChannelAnalyticsRow[];
  total: number;
  unattributed: number;
  unattributedRate: number | null;
  warning: string;
};

export type ProjectArticleAnalyticsResult = {
  articles: ArticleAnalyticsRow[];
  channelAnalytics: ChannelAnalytics;
  dailyTrends: ArticleAnalyticsDailyTrendRow[];
  deviceAnalytics: AccessDeviceAnalytics;
  eventAggregationWarning: string;
  message: string;
  periodRange: AnalyticsPeriodRange;
  projectTitle: string;
  referrerAnalytics: ReferrerAnalytics;
  source: "supabase" | "unconfigured" | "not_found" | "migration_required" | "error";
  surveyConversions: SurveyConversionAnalytics;
  totalVisits: number | null;
  totalVisitsMessage: string;
};

export type GetProjectArticleAnalyticsOptions = {
  now?: Date;
  period?: AnalyticsPeriod | string;
  rangeOverride?: AnalyticsPeriodRange;
};

const EVENT_PAGE_SIZE = 5000;
const MAX_EVENT_PAGES = 100;
const PUBLICATION_GROUP_ORDER = ["regular", "rolling", "time_sensitive", "urgent"];
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// 유입경로 수집 방식 보정 이후 신뢰 가능한 데이터 시작점입니다.
const REFERRER_ANALYTICS_CUTOFF_ISO = "2026-10-05T01:30:00+09:00";
const REFERRER_ANALYTICS_CUTOFF_MS = Date.parse(REFERRER_ANALYTICS_CUTOFF_ISO);
const REACTION_EVENT_TYPES = new Set<ArticleEventType>([
  "phone_click",
  "map_click",
  "cta_click",
  "survey_click",
]);

function makeEmptySurveyConversions(warning = ""): SurveyConversionAnalytics {
  return {
    rows: [],
    submissionRate: null,
    totalClicks: 0,
    totalSubmissions: null,
    warning,
  };
}

function buildAccessDeviceAnalytics(rows: DailyStatsRow[]): AccessDeviceAnalytics {
  const mobile = rows.reduce((sum, row) => sum + (Number(row.mobile_count) || 0), 0);
  const pc = rows.reduce((sum, row) => sum + (Number(row.pc_count) || 0), 0);
  const tablet = rows.reduce((sum, row) => sum + (Number(row.tablet_count) || 0), 0);
  const total = mobile + pc + tablet;

  return {
    mobile,
    mobileRate: total > 0 ? (mobile / total) * 100 : null,
    pc,
    pcRate: total > 0 ? (pc / total) * 100 : null,
    tablet,
    tabletRate: total > 0 ? (tablet / total) * 100 : null,
    total,
  };
}

function makeEmptyReferrerAnalytics(warning = ""): ReferrerAnalytics {
  return {
    directInternal: 0,
    directInternalRate: null,
    domains: [],
    external: 0,
    externalRate: null,
    legacyExcludedCount: 0,
    total: 0,
    warning,
  };
}

function makeEmptyChannelAnalytics(warning = ""): ChannelAnalytics {
  return {
    attributed: 0,
    attributedRate: null,
    campaigns: [],
    rows: [],
    total: 0,
    unattributed: 0,
    unattributedRate: null,
    warning,
  };
}

function buildReferrerAnalytics(
  rows: ViewReferrerRow[],
  warning = "",
): ReferrerAnalytics {
  const domains = new Map<string, number>();
  let directInternal = 0;
  const eligibleRows = rows.filter((row) => Date.parse(row.occurred_at) >= REFERRER_ANALYTICS_CUTOFF_MS);

  for (const row of eligibleRows) {
    const domain = row.referrer_domain ?? "";

    if (!domain.trim()) {
      directInternal += 1;
      continue;
    }

    domains.set(domain, (domains.get(domain) ?? 0) + 1);
  }

  const external = eligibleRows.length - directInternal;
  const total = eligibleRows.length;

  return {
    directInternal,
    directInternalRate: total > 0 ? (directInternal / total) * 100 : null,
    domains: [...domains.entries()]
      .map(([domain, count]) => ({
        count,
        domain,
        rate: external > 0 ? (count / external) * 100 : null,
      }))
      .sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain)),
    external,
    externalRate: total > 0 ? (external / total) * 100 : null,
    legacyExcludedCount: rows.length - eligibleRows.length,
    total,
    warning,
  };
}

function buildChannelAnalytics(
  rows: ViewAttributionRow[],
  warning = "",
): ChannelAnalytics {
  const sources = new Map<string, number>();
  const campaigns = new Map<string, number>();
  let attributed = 0;
  let campaignTotal = 0;

  for (const row of rows) {
    const source = row.utm_source ?? "";
    const campaign = row.utm_campaign ?? "";

    if (source.trim()) {
      attributed += 1;
      sources.set(source, (sources.get(source) ?? 0) + 1);
    }

    if (campaign.trim()) {
      campaignTotal += 1;
      campaigns.set(campaign, (campaigns.get(campaign) ?? 0) + 1);
    }
  }

  const total = rows.length;
  const unattributed = total - attributed;

  return {
    attributed,
    attributedRate: total > 0 ? (attributed / total) * 100 : null,
    campaigns: [...campaigns.entries()]
      .map(([campaign, count]) => ({
        campaign,
        count,
        rate: campaignTotal > 0 ? (count / campaignTotal) * 100 : null,
      }))
      .sort((left, right) => right.count - left.count || left.campaign.localeCompare(right.campaign)),
    rows: [...sources.entries()]
      .map(([source, count]) => ({
        count,
        rate: total > 0 ? (count / total) * 100 : null,
        source,
      }))
      .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source)),
    total,
    unattributed,
    unattributedRate: total > 0 ? (unattributed / total) * 100 : null,
    warning,
  };
}

export type RecordArticleEventInput = {
  articleId: string;
  eventType: ArticleEventType;
  linkActionId?: string;
  routePath?: string;
  sessionHash?: string;
  slug: string;
  surveyId?: string;
  userAgent?: string | null;
};

export type RecordArticleEventResult =
  | { deduped?: boolean; ok: true }
  | {
      httpStatus?: number;
      message: string;
      ok: false;
      status: "not_configured" | "not_found" | "invalid_reference" | "migration_required" | "request_failed";
    };

function getServiceHeaders() {
  const config = getSupabaseConfigStatus();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!config.isConfigured || !config.hasServiceRoleKey || !serviceRoleKey) {
    return null;
  }

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function getProjectBySlug(slug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,title&slug=eq.${encodeURIComponent(slug)}&status=eq.published&deleted_at=is.null&limit=1`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, { headers, cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as Array<{ id: string; title: string }>;
  return rows[0] ?? null;
}

async function referenceExists(path: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(path);

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, { headers, cache: "no-store" });

  if (!response.ok) {
    return false;
  }

  const rows = (await response.json()) as Array<{ id: string }>;
  return rows.length > 0;
}

export async function recordArticleEvent(input: RecordArticleEventInput): Promise<RecordArticleEventResult> {
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      ok: false,
      status: "not_configured",
      message: "기사 반응 통계를 저장할 서버 설정이 필요합니다.",
    };
  }

  try {
    const project = await getProjectBySlug(input.slug, headers);

    if (!project) {
      return { ok: false, status: "not_found", message: "프로젝트를 찾지 못했습니다.", httpStatus: 404 };
    }

    const articleExists = await referenceExists(
      `/rest/v1/newsletter_articles?select=id&id=eq.${encodeURIComponent(input.articleId)}&project_id=eq.${encodeURIComponent(project.id)}&limit=1`,
      headers,
    );

    if (!articleExists) {
      return { ok: false, status: "invalid_reference", message: "프로젝트에 속한 기사를 찾지 못했습니다.", httpStatus: 400 };
    }

    if (input.linkActionId) {
      const linkExists = await referenceExists(
        `/rest/v1/newsletter_link_actions?select=id&id=eq.${encodeURIComponent(input.linkActionId)}&project_id=eq.${encodeURIComponent(project.id)}&article_id=eq.${encodeURIComponent(input.articleId)}&limit=1`,
        headers,
      );

      if (!linkExists) {
        return { ok: false, status: "invalid_reference", message: "기사에 속한 행동 버튼을 찾지 못했습니다.", httpStatus: 400 };
      }
    }

    if (input.surveyId) {
      const surveyExists = await referenceExists(
        `/rest/v1/newsletter_surveys?select=id&id=eq.${encodeURIComponent(input.surveyId)}&project_id=eq.${encodeURIComponent(project.id)}&limit=1`,
        headers,
      );

      if (!surveyExists) {
        return { ok: false, status: "invalid_reference", message: "프로젝트에 속한 참여 콘텐츠를 찾지 못했습니다.", httpStatus: 400 };
      }
    }

    const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_article_events");

    if (!endpoint) {
      return { ok: false, status: "request_failed", message: "기사 반응 통계 저장 주소를 만들지 못했습니다." };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        project_id: project.id,
        article_id: input.articleId,
        link_action_id: input.linkActionId || null,
        survey_id: input.surveyId || null,
        event_type: input.eventType,
        session_hash: input.sessionHash || null,
        route_path: input.routePath || `/newsletters/${input.slug}`,
        device_type: detectDeviceType(input.userAgent),
        metadata: {},
      }),
      cache: "no-store",
    });

    if (response.ok) {
      return { ok: true };
    }

    const error = (await response.json().catch(() => null)) as { code?: string } | null;

    if (response.status === 409 && error?.code === "23505") {
      return { ok: true, deduped: true };
    }

    if (response.status === 404 || error?.code === "PGRST205") {
      return {
        ok: false,
        status: "migration_required",
        message: "기사 반응 통계 DB 준비가 필요합니다.",
        httpStatus: 503,
      };
    }

    return {
      ok: false,
      status: "request_failed",
      message: "기사 반응 통계를 저장하지 못했습니다.",
      httpStatus: response.status,
    };
  } catch {
    return { ok: false, status: "request_failed", message: "기사 반응 통계 저장 중 오류가 발생했습니다." };
  }
}

function makeEmptyAnalyticsRow(article: AnalyticsArticleRow): ArticleAnalyticsRow {
  return {
    articleId: article.id,
    title: article.title?.trim() || "제목 없음 기사",
    sortOrder: Number(article.sort_order) || 0,
    articleType: article.article_type?.trim() || "general",
    interestTags: Array.isArray(article.interest_tags)
      ? [...new Set(article.interest_tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean))]
      : [],
    publicationKind: article.publication_kind === "rolling" ? "rolling" : "regular",
    urgency:
      article.urgency === "urgent" || article.urgency === "time_sensitive"
        ? article.urgency
        : "normal",
    articleViews: 0,
    phoneClicks: 0,
    mapClicks: 0,
    ctaClicks: 0,
    surveyClicks: 0,
    audioPlays: 0,
    reactionCount: 0,
    reactionScore: null,
  };
}

function getPublicationGroup(article: ArticleAnalyticsRow) {
  if (article.publicationKind !== "rolling") return "regular";
  if (article.urgency === "urgent") return "urgent";
  if (article.urgency === "time_sensitive") return "time_sensitive";
  return "rolling";
}

function addArticleToBreakdown(
  groups: Map<string, ArticleAnalyticsBreakdownRow>,
  key: string,
  article: ArticleAnalyticsRow,
) {
  const current = groups.get(key) ?? {
    articleCount: 0,
    articleViews: 0,
    ctaClicks: 0,
    key,
    mapClicks: 0,
    phoneClicks: 0,
    reactionCount: 0,
    reactionScore: null,
    surveyClicks: 0,
  };

  current.articleCount += 1;
  current.articleViews += article.articleViews;
  current.phoneClicks += article.phoneClicks;
  current.mapClicks += article.mapClicks;
  current.ctaClicks += article.ctaClicks;
  current.surveyClicks += article.surveyClicks;
  current.reactionCount += article.reactionCount;
  current.reactionScore = current.articleViews > 0
    ? (current.reactionCount / current.articleViews) * 100
    : null;
  groups.set(key, current);
}

function sortByReaction(rows: ArticleAnalyticsBreakdownRow[]) {
  return rows.sort((left, right) => (
    right.reactionCount - left.reactionCount ||
    right.articleViews - left.articleViews ||
    left.key.localeCompare(right.key, "ko")
  ));
}

export function buildArticleAnalyticsBreakdowns(
  articles: ArticleAnalyticsRow[],
): ArticleAnalyticsBreakdowns {
  const articleTypes = new Map<string, ArticleAnalyticsBreakdownRow>();
  const interestTags = new Map<string, ArticleAnalyticsBreakdownRow>();
  const publicationGroups = new Map<string, ArticleAnalyticsBreakdownRow>();

  for (const article of articles) {
    addArticleToBreakdown(articleTypes, article.articleType, article);
    addArticleToBreakdown(publicationGroups, getPublicationGroup(article), article);
    article.interestTags.forEach((tag) => addArticleToBreakdown(interestTags, tag, article));
  }

  return {
    articleTypes: sortByReaction([...articleTypes.values()]),
    interestTags: sortByReaction([...interestTags.values()]),
    publicationGroups: PUBLICATION_GROUP_ORDER.flatMap((key) => {
      const row = publicationGroups.get(key);
      return row ? [row] : [];
    }),
  };
}

function getNextDate(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

function getPeriodEndExclusiveIso(periodRange: AnalyticsPeriodRange) {
  return new Date(`${getNextDate(periodRange.endDate)}T00:00:00+09:00`).toISOString();
}

function getKoreaDate(timestamp: string) {
  const value = new Date(timestamp);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return new Date(value.getTime() + KOREA_OFFSET_MS).toISOString().slice(0, 10);
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function buildDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = getNextDate(cursor);
  }

  return dates;
}

function buildArticleAnalyticsDailyTrends({
  articleIds,
  dailyStats,
  events,
  periodRange,
}: {
  articleIds: Set<string>;
  dailyStats: DailyStatsRow[];
  events: ArticleEventRow[];
  periodRange: AnalyticsPeriodRange;
}): ArticleAnalyticsDailyTrendRow[] {
  const dailyStatDates = dailyStats
    .map((row) => row.stat_date)
    .filter((date) => isDateKey(date) && date <= periodRange.endDate);
  const eventDates = events
    .map((event) => getKoreaDate(event.occurred_at))
    .filter((date): date is string => Boolean(date && date <= periodRange.endDate));
  const startDate = periodRange.startDate ?? [...dailyStatDates, ...eventDates].sort()[0];

  if (!startDate) {
    return [];
  }

  const rowsByDate = new Map(
    buildDateRange(startDate, periodRange.endDate).map((date) => [
      date,
      { articleViews: 0, date, reactionCount: 0, totalVisits: 0 },
    ]),
  );

  for (const row of dailyStats) {
    const trend = rowsByDate.get(row.stat_date);
    if (trend) trend.totalVisits += Number(row.view_count) || 0;
  }

  for (const event of events) {
    if (!articleIds.has(event.article_id)) continue;

    const date = getKoreaDate(event.occurred_at);
    const trend = date ? rowsByDate.get(date) : null;
    if (!trend) continue;

    if (event.event_type === "article_view") trend.articleViews += 1;
    if (REACTION_EVENT_TYPES.has(event.event_type)) trend.reactionCount += 1;
  }

  return [...rowsByDate.values()];
}

async function fetchArticleEvents(
  projectId: string,
  periodRange: AnalyticsPeriodRange,
  headers: Record<string, string>,
) {
  const rows: ArticleEventRow[] = [];

  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const offset = page * EVENT_PAGE_SIZE;
    const periodFilter = periodRange.startIso
      ? `&occurred_at=gte.${encodeURIComponent(periodRange.startIso)}`
      : "";
    const endExclusiveIso = getPeriodEndExclusiveIso(periodRange);
    const endpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_article_events?select=article_id,event_type,occurred_at,survey_id&project_id=eq.${encodeURIComponent(
        projectId,
      )}${periodFilter}&occurred_at=lt.${encodeURIComponent(endExclusiveIso)}&order=occurred_at.asc,id.asc&limit=${EVENT_PAGE_SIZE}&offset=${offset}`,
    );

    if (!endpoint) {
      return { ok: false as const, migrationRequired: false, rows, truncated: rows.length > 0 };
    }

    const response = await fetch(endpoint, { headers, cache: "no-store" });

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { code?: string } | null;

      return {
        ok: false as const,
        migrationRequired: response.status === 404 || error?.code === "PGRST205",
        rows,
        truncated: rows.length > 0,
      };
    }

    const pageRows = (await response.json()) as ArticleEventRow[];
    rows.push(...pageRows);

    if (pageRows.length < EVENT_PAGE_SIZE) {
      return { ok: true as const, migrationRequired: false, rows, truncated: false };
    }
  }

  return { ok: true as const, migrationRequired: false, rows, truncated: true };
}

async function fetchViewEventRows<Row>(
  projectId: string,
  periodRange: AnalyticsPeriodRange,
  headers: Record<string, string>,
  selectColumns: string,
) {
  const rows: Row[] = [];

  try {
    for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
      const offset = page * EVENT_PAGE_SIZE;
      const periodFilter = periodRange.startIso
        ? `&occurred_at=gte.${encodeURIComponent(periodRange.startIso)}`
        : "";
      const endpoint = getSupabaseRestEndpoint(
        `/rest/v1/newsletter_view_events?select=${selectColumns}&project_id=eq.${encodeURIComponent(
          projectId,
        )}${periodFilter}&occurred_at=lt.${encodeURIComponent(getPeriodEndExclusiveIso(periodRange))}&order=occurred_at.asc,id.asc&limit=${EVENT_PAGE_SIZE}&offset=${offset}`,
      );

      if (!endpoint) return { ok: false as const, rows: [] as Row[], truncated: false };

      const response = await fetch(endpoint, { headers, cache: "no-store" });
      if (!response.ok) return { ok: false as const, rows: [], truncated: false };

      const pageRows = (await response.json()) as Row[];
      rows.push(...pageRows);

      if (pageRows.length < EVENT_PAGE_SIZE) {
        return { ok: true as const, rows, truncated: false };
      }
    }

    return { ok: true as const, rows, truncated: true };
  } catch {
    return { ok: false as const, rows: [], truncated: false };
  }
}

function fetchViewAttributions(
  projectId: string,
  periodRange: AnalyticsPeriodRange,
  headers: Record<string, string>,
) {
  return fetchViewEventRows<ViewAttributionRow>(
    projectId,
    periodRange,
    headers,
    "referrer_domain,utm_source,utm_medium,utm_campaign,occurred_at",
  );
}

function fetchViewReferrers(
  projectId: string,
  periodRange: AnalyticsPeriodRange,
  headers: Record<string, string>,
) {
  return fetchViewEventRows<ViewReferrerRow>(
    projectId,
    periodRange,
    headers,
    "referrer_domain,occurred_at",
  );
}

async function fetchSurveyMetadata(projectId: string, headers: Record<string, string>) {
  try {
    const endpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_surveys?select=id,title,survey_kind,status&project_id=eq.${encodeURIComponent(projectId)}&order=title.asc`,
    );

    if (!endpoint) return { ok: false as const, rows: [] as SurveyMetadataRow[] };

    const response = await fetch(endpoint, { headers, cache: "no-store" });
    if (!response.ok) return { ok: false as const, rows: [] as SurveyMetadataRow[] };

    return { ok: true as const, rows: (await response.json()) as SurveyMetadataRow[] };
  } catch {
    return { ok: false as const, rows: [] as SurveyMetadataRow[] };
  }
}

async function fetchSurveyResponses(
  projectId: string,
  periodRange: AnalyticsPeriodRange,
  headers: Record<string, string>,
) {
  const rows: SurveyResponseRow[] = [];

  try {
    for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
      const offset = page * EVENT_PAGE_SIZE;
      const periodFilter = periodRange.startIso
        ? `&submitted_at=gte.${encodeURIComponent(periodRange.startIso)}`
        : "";
      const endpoint = getSupabaseRestEndpoint(
        `/rest/v1/newsletter_survey_responses?select=survey_id,submitted_at&project_id=eq.${encodeURIComponent(
          projectId,
        )}${periodFilter}&submitted_at=lt.${encodeURIComponent(getPeriodEndExclusiveIso(periodRange))}&order=submitted_at.asc,id.asc&limit=${EVENT_PAGE_SIZE}&offset=${offset}`,
      );

      if (!endpoint) return { ok: false as const, rows: [] as SurveyResponseRow[], truncated: false };

      const response = await fetch(endpoint, { headers, cache: "no-store" });
      if (!response.ok) return { ok: false as const, rows, truncated: rows.length > 0 };

      const pageRows = (await response.json()) as SurveyResponseRow[];
      rows.push(...pageRows);

      if (pageRows.length < EVENT_PAGE_SIZE) {
        return { ok: true as const, rows, truncated: false };
      }
    }

    return { ok: true as const, rows, truncated: true };
  } catch {
    return { ok: false as const, rows, truncated: rows.length > 0 };
  }
}

function buildSurveyConversionAnalytics({
  articleIds,
  events,
  metadataResult,
  responseResult,
}: {
  articleIds: Set<string>;
  events: ArticleEventRow[];
  metadataResult: Awaited<ReturnType<typeof fetchSurveyMetadata>>;
  responseResult: Awaited<ReturnType<typeof fetchSurveyResponses>>;
}): SurveyConversionAnalytics {
  const surveyClickEvents = events.filter((event) => (
    articleIds.has(event.article_id) && event.event_type === "survey_click"
  ));
  const totalClicks = surveyClickEvents.length;
  const warnings: string[] = [];

  if (!metadataResult.ok) {
    warnings.push("참여 콘텐츠 정보를 조회하지 못해 개별 항목 분석을 표시할 수 없습니다.");
  }

  if (!responseResult.ok) {
    warnings.push("실제 제출 데이터를 조회하지 못했습니다. 참여 콘텐츠 응답 테이블을 확인하세요.");
  } else if (responseResult.truncated) {
    warnings.push("제출 데이터가 많아 일부 응답만 집계되었습니다.");
  }

  const clicksBySurveyId = new Map<string, number>();
  for (const event of surveyClickEvents) {
    if (!event.survey_id) continue;
    clicksBySurveyId.set(event.survey_id, (clicksBySurveyId.get(event.survey_id) ?? 0) + 1);
  }

  const submissionsBySurveyId = new Map<string, number>();
  for (const response of responseResult.rows) {
    submissionsBySurveyId.set(response.survey_id, (submissionsBySurveyId.get(response.survey_id) ?? 0) + 1);
  }

  const rows = metadataResult.ok && responseResult.ok
    ? metadataResult.rows
      .map<SurveyConversionAnalyticsRow>((survey) => {
        const clickCount = clicksBySurveyId.get(survey.id) ?? 0;
        const submissionCount = submissionsBySurveyId.get(survey.id) ?? 0;
        return {
          clickCount,
          kind: survey.survey_kind === "event" ? "event" : "survey",
          submissionCount,
          submissionRate: clickCount > 0 ? (submissionCount / clickCount) * 100 : null,
          surveyId: survey.id,
          title: survey.title?.trim() || "제목 없는 참여 콘텐츠",
        };
      })
      .filter((row) => row.clickCount > 0 || row.submissionCount > 0)
      .sort((left, right) => (
        right.submissionCount - left.submissionCount ||
        right.clickCount - left.clickCount ||
        left.title.localeCompare(right.title, "ko")
      ))
    : [];
  const knownSurveyIds = new Set(metadataResult.rows.map((survey) => survey.id));
  const assignedClickCount = [...clicksBySurveyId].reduce(
    (sum, [surveyId, count]) => sum + (knownSurveyIds.has(surveyId) ? count : 0),
    0,
  );

  if (metadataResult.ok && assignedClickCount < totalClicks) {
    warnings.push("일부 과거 설문 이동 이벤트는 참여 콘텐츠 ID가 없어 개별 항목 분석에서 제외됩니다.");
  }

  const totalSubmissions = responseResult.ok ? responseResult.rows.length : null;

  return {
    rows,
    submissionRate: totalClicks > 0 && totalSubmissions !== null
      ? (totalSubmissions / totalClicks) * 100
      : null,
    totalClicks,
    totalSubmissions,
    warning: warnings.join(" "),
  };
}

async function fetchTotalVisits(
  projectId: string,
  periodRange: AnalyticsPeriodRange,
  headers: Record<string, string>,
) {
  let total = 0;
  const dailyStats: DailyStatsRow[] = [];

  for (let page = 0; page < 100; page += 1) {
    const offset = page * EVENT_PAGE_SIZE;
    const periodFilter = periodRange.startDate ? `&stat_date=gte.${periodRange.startDate}` : "";
    const endpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_daily_stats?select=stat_date,view_count,mobile_count,pc_count,tablet_count&project_id=eq.${encodeURIComponent(
        projectId,
      )}${periodFilter}&stat_date=lte.${periodRange.endDate}&order=stat_date.asc&limit=${EVENT_PAGE_SIZE}&offset=${offset}`,
    );

    if (!endpoint) {
      return { dailyStats: [], message: "전체 접속 집계 확인이 필요합니다.", value: null };
    }

    const response = await fetch(endpoint, { headers, cache: "no-store" });

    if (!response.ok) {
      return { dailyStats: [], message: "전체 접속 집계 확인이 필요합니다.", value: null };
    }

    const rows = (await response.json()) as DailyStatsRow[];
    dailyStats.push(...rows);
    total += rows.reduce((sum, row) => sum + (Number(row.view_count) || 0), 0);

    if (rows.length < EVENT_PAGE_SIZE) {
      return { dailyStats, message: "", value: total };
    }
  }

  return { dailyStats: [], message: "전체 접속 데이터가 많아 집계 확인이 필요합니다.", value: null };
}

export async function getProjectArticleAnalytics(
  projectSlug: string,
  options: GetProjectArticleAnalyticsOptions = {},
): Promise<ProjectArticleAnalyticsResult> {
  const period = normalizeAnalyticsPeriod(options.period);
  const periodRange = options.rangeOverride ?? getAnalyticsPeriodRange(period, options.now);
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      articles: [],
      channelAnalytics: makeEmptyChannelAnalytics(),
      dailyTrends: [],
      deviceAnalytics: buildAccessDeviceAnalytics([]),
      eventAggregationWarning: "",
      periodRange,
      projectTitle: "",
      referrerAnalytics: makeEmptyReferrerAnalytics(),
      source: "unconfigured",
      surveyConversions: makeEmptySurveyConversions(),
      message: "Supabase 환경변수와 서버 저장 키 설정 후 기사 반응 통계를 표시합니다.",
      totalVisits: null,
      totalVisitsMessage: "전체 접속 집계 확인이 필요합니다.",
    };
  }

  try {
    const project = await getProjectBySlug(projectSlug.trim(), headers);

    if (!project) {
      return {
        articles: [],
        channelAnalytics: makeEmptyChannelAnalytics(),
        dailyTrends: [],
        deviceAnalytics: buildAccessDeviceAnalytics([]),
        eventAggregationWarning: "",
        message: "프로젝트를 찾지 못했습니다.",
        periodRange,
        projectTitle: "",
        referrerAnalytics: makeEmptyReferrerAnalytics(),
        source: "not_found",
        surveyConversions: makeEmptySurveyConversions(),
        totalVisits: null,
        totalVisitsMessage: "",
      };
    }

    const articleEndpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_articles?select=id,title,sort_order,article_type,interest_tags,publication_kind,urgency&project_id=eq.${encodeURIComponent(project.id)}&order=sort_order.asc`,
    );

    if (!articleEndpoint) {
      return {
        articles: [],
        channelAnalytics: makeEmptyChannelAnalytics(),
        dailyTrends: [],
        deviceAnalytics: buildAccessDeviceAnalytics([]),
        eventAggregationWarning: "",
        message: "기사 반응 통계 조회 주소를 만들지 못했습니다.",
        periodRange,
        projectTitle: project.title,
        referrerAnalytics: makeEmptyReferrerAnalytics(),
        source: "error",
        surveyConversions: makeEmptySurveyConversions(),
        totalVisits: null,
        totalVisitsMessage: "전체 접속 집계 확인이 필요합니다.",
      };
    }

    const articleResponse = await fetch(articleEndpoint, { headers, cache: "no-store" });

    if (!articleResponse.ok) {
      return {
        articles: [],
        channelAnalytics: makeEmptyChannelAnalytics(),
        dailyTrends: [],
        deviceAnalytics: buildAccessDeviceAnalytics([]),
        eventAggregationWarning: "",
        message: "기사 목록을 조회하지 못했습니다.",
        periodRange,
        projectTitle: project.title,
        referrerAnalytics: makeEmptyReferrerAnalytics(),
        source: "error",
        surveyConversions: makeEmptySurveyConversions(),
        totalVisits: null,
        totalVisitsMessage: "전체 접속 집계 확인이 필요합니다.",
      };
    }

    const articleRows = (await articleResponse.json()) as AnalyticsArticleRow[];
    const analyticsByArticleId = new Map(articleRows.map((article) => [article.id, makeEmptyAnalyticsRow(article)]));
    const [eventResult, totalVisitsResult, surveyMetadataResult, surveyResponseResult, attributionResult] = await Promise.all([
      fetchArticleEvents(project.id, periodRange, headers),
      fetchTotalVisits(project.id, periodRange, headers),
      fetchSurveyMetadata(project.id, headers),
      fetchSurveyResponses(project.id, periodRange, headers),
      fetchViewAttributions(project.id, periodRange, headers),
    ]);
    const articleIds = new Set(analyticsByArticleId.keys());
    const dailyTrends = buildArticleAnalyticsDailyTrends({
      articleIds,
      dailyStats: totalVisitsResult.dailyStats,
      events: eventResult.rows,
      periodRange,
    });
    const deviceAnalytics = buildAccessDeviceAnalytics(totalVisitsResult.dailyStats);
    const referrerResult = attributionResult.ok
      ? attributionResult
      : await fetchViewReferrers(project.id, periodRange, headers);
    const referrerAnalytics = referrerResult.ok
      ? buildReferrerAnalytics(
          referrerResult.rows,
          referrerResult.truncated ? "유입경로 데이터가 많아 일부 이벤트만 집계되었습니다." : "",
        )
      : makeEmptyReferrerAnalytics("유입경로 데이터를 조회하지 못했습니다.");
    const channelAnalytics = attributionResult.ok
      ? buildChannelAnalytics(
          attributionResult.rows,
          attributionResult.truncated ? "배포 채널 데이터가 많아 일부 이벤트만 집계되었습니다." : "",
        )
      : makeEmptyChannelAnalytics("배포 채널 데이터를 조회하지 못했습니다.");
    const surveyConversions = buildSurveyConversionAnalytics({
      articleIds,
      events: eventResult.rows,
      metadataResult: surveyMetadataResult,
      responseResult: surveyResponseResult,
    });

    if (!eventResult.ok && eventResult.rows.length === 0) {
      return {
        articles: [...analyticsByArticleId.values()],
        channelAnalytics,
        dailyTrends,
        deviceAnalytics,
        eventAggregationWarning: "",
        periodRange,
        projectTitle: project.title,
        referrerAnalytics,
        source: eventResult.migrationRequired ? "migration_required" : "error",
        message: eventResult.migrationRequired
          ? "반응 통계 DB 준비가 필요합니다. v1.17 migration을 적용하면 이벤트가 집계됩니다."
          : "기사 반응 이벤트를 조회하지 못했습니다.",
        surveyConversions,
        totalVisits: totalVisitsResult.value,
        totalVisitsMessage: totalVisitsResult.message,
      };
    }

    for (const event of eventResult.rows) {
      const row = analyticsByArticleId.get(event.article_id);

      if (!row) {
        continue;
      }

      if (event.event_type === "article_view") row.articleViews += 1;
      if (event.event_type === "phone_click") row.phoneClicks += 1;
      if (event.event_type === "map_click") row.mapClicks += 1;
      if (event.event_type === "cta_click") row.ctaClicks += 1;
      if (event.event_type === "survey_click") row.surveyClicks += 1;
      if (event.event_type === "audio_play") row.audioPlays += 1;
    }

    for (const row of analyticsByArticleId.values()) {
      row.reactionCount = row.phoneClicks + row.mapClicks + row.ctaClicks + row.surveyClicks;
      row.reactionScore = row.articleViews > 0 ? (row.reactionCount / row.articleViews) * 100 : null;
    }

    return {
      articles: [...analyticsByArticleId.values()],
      channelAnalytics,
      dailyTrends,
      deviceAnalytics,
      eventAggregationWarning: eventResult.truncated ? "일부 이벤트만 집계되었습니다." : "",
      periodRange,
      projectTitle: project.title,
      referrerAnalytics,
      source: "supabase",
      surveyConversions,
      message: eventResult.rows.length > 0 ? `${periodRange.label} 기사 반응 이벤트를 표시합니다.` : `${periodRange.label} 기사 반응 데이터가 없습니다.`,
      totalVisits: totalVisitsResult.value,
      totalVisitsMessage: totalVisitsResult.message,
    };
  } catch {
    return {
      articles: [],
      channelAnalytics: makeEmptyChannelAnalytics(),
      dailyTrends: [],
      deviceAnalytics: buildAccessDeviceAnalytics([]),
      eventAggregationWarning: "",
      message: "기사 반응 통계를 조회하는 중 오류가 발생했습니다.",
      periodRange,
      projectTitle: "",
      referrerAnalytics: makeEmptyReferrerAnalytics(),
      source: "error",
      surveyConversions: makeEmptySurveyConversions(),
      totalVisits: null,
      totalVisitsMessage: "전체 접속 집계 확인이 필요합니다.",
    };
  }
}
