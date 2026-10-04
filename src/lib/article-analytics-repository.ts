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
  stat_date: string;
  view_count: number | null;
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

export type ProjectArticleAnalyticsResult = {
  articles: ArticleAnalyticsRow[];
  dailyTrends: ArticleAnalyticsDailyTrendRow[];
  eventAggregationWarning: string;
  message: string;
  periodRange: AnalyticsPeriodRange;
  projectTitle: string;
  source: "supabase" | "unconfigured" | "not_found" | "migration_required" | "error";
  totalVisits: number | null;
  totalVisitsMessage: string;
};

export type GetProjectArticleAnalyticsOptions = {
  now?: Date;
  period?: AnalyticsPeriod | string;
};

const EVENT_PAGE_SIZE = 5000;
const MAX_EVENT_PAGES = 100;
const PUBLICATION_GROUP_ORDER = ["regular", "rolling", "time_sensitive", "urgent"];
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REACTION_EVENT_TYPES = new Set<ArticleEventType>([
  "phone_click",
  "map_click",
  "cta_click",
  "survey_click",
]);

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
    `/rest/v1/newsletter_projects?select=id,title&slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&limit=1`,
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
    const endExclusiveIso = new Date(`${getNextDate(periodRange.endDate)}T00:00:00+09:00`).toISOString();
    const endpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_article_events?select=article_id,event_type,occurred_at&project_id=eq.${encodeURIComponent(
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
      `/rest/v1/newsletter_daily_stats?select=stat_date,view_count&project_id=eq.${encodeURIComponent(
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
  const periodRange = getAnalyticsPeriodRange(period, options.now);
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      articles: [],
      dailyTrends: [],
      eventAggregationWarning: "",
      periodRange,
      projectTitle: "",
      source: "unconfigured",
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
        dailyTrends: [],
        eventAggregationWarning: "",
        message: "프로젝트를 찾지 못했습니다.",
        periodRange,
        projectTitle: "",
        source: "not_found",
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
        dailyTrends: [],
        eventAggregationWarning: "",
        message: "기사 반응 통계 조회 주소를 만들지 못했습니다.",
        periodRange,
        projectTitle: project.title,
        source: "error",
        totalVisits: null,
        totalVisitsMessage: "전체 접속 집계 확인이 필요합니다.",
      };
    }

    const articleResponse = await fetch(articleEndpoint, { headers, cache: "no-store" });

    if (!articleResponse.ok) {
      return {
        articles: [],
        dailyTrends: [],
        eventAggregationWarning: "",
        message: "기사 목록을 조회하지 못했습니다.",
        periodRange,
        projectTitle: project.title,
        source: "error",
        totalVisits: null,
        totalVisitsMessage: "전체 접속 집계 확인이 필요합니다.",
      };
    }

    const articleRows = (await articleResponse.json()) as AnalyticsArticleRow[];
    const analyticsByArticleId = new Map(articleRows.map((article) => [article.id, makeEmptyAnalyticsRow(article)]));
    const [eventResult, totalVisitsResult] = await Promise.all([
      fetchArticleEvents(project.id, periodRange, headers),
      fetchTotalVisits(project.id, periodRange, headers),
    ]);
    const dailyTrends = buildArticleAnalyticsDailyTrends({
      articleIds: new Set(analyticsByArticleId.keys()),
      dailyStats: totalVisitsResult.dailyStats,
      events: eventResult.rows,
      periodRange,
    });

    if (!eventResult.ok && eventResult.rows.length === 0) {
      return {
        articles: [...analyticsByArticleId.values()],
        dailyTrends,
        eventAggregationWarning: "",
        periodRange,
        projectTitle: project.title,
        source: eventResult.migrationRequired ? "migration_required" : "error",
        message: eventResult.migrationRequired
          ? "반응 통계 DB 준비가 필요합니다. v1.17 migration을 적용하면 이벤트가 집계됩니다."
          : "기사 반응 이벤트를 조회하지 못했습니다.",
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
      dailyTrends,
      eventAggregationWarning: eventResult.truncated ? "일부 이벤트만 집계되었습니다." : "",
      periodRange,
      projectTitle: project.title,
      source: "supabase",
      message: eventResult.rows.length > 0 ? `${periodRange.label} 기사 반응 이벤트를 표시합니다.` : `${periodRange.label} 기사 반응 데이터가 없습니다.`,
      totalVisits: totalVisitsResult.value,
      totalVisitsMessage: totalVisitsResult.message,
    };
  } catch {
    return {
      articles: [],
      dailyTrends: [],
      eventAggregationWarning: "",
      message: "기사 반응 통계를 조회하는 중 오류가 발생했습니다.",
      periodRange,
      projectTitle: "",
      source: "error",
      totalVisits: null,
      totalVisitsMessage: "전체 접속 집계 확인이 필요합니다.",
    };
  }
}
