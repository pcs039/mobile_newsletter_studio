import { detectDeviceType } from "@/lib/device-type";
import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";
import type { ArticleEventType } from "@/lib/article-analytics-types";

type ArticleEventRow = {
  article_id: string;
  event_type: ArticleEventType;
};

type AnalyticsArticleRow = {
  article_type: string | null;
  id: string;
  sort_order: number | null;
  title: string | null;
};

export type ArticleAnalyticsRow = {
  actionCount: number;
  actionRate: number | null;
  articleId: string;
  articleType: string;
  articleViews: number;
  audioPlays: number;
  ctaClicks: number;
  mapClicks: number;
  phoneClicks: number;
  sortOrder: number;
  surveyClicks: number;
  title: string;
};

export type ProjectArticleAnalyticsResult = {
  articles: ArticleAnalyticsRow[];
  message: string;
  projectTitle: string;
  source: "supabase" | "unconfigured" | "not_found" | "migration_required" | "error";
};

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
    articleViews: 0,
    phoneClicks: 0,
    mapClicks: 0,
    ctaClicks: 0,
    surveyClicks: 0,
    audioPlays: 0,
    actionCount: 0,
    actionRate: null,
  };
}

export async function getProjectArticleAnalytics(projectSlug: string): Promise<ProjectArticleAnalyticsResult> {
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      articles: [],
      projectTitle: "",
      source: "unconfigured",
      message: "Supabase 환경변수와 서버 저장 키 설정 후 기사 반응 통계를 표시합니다.",
    };
  }

  try {
    const project = await getProjectBySlug(projectSlug.trim(), headers);

    if (!project) {
      return { articles: [], projectTitle: "", source: "not_found", message: "프로젝트를 찾지 못했습니다." };
    }

    const articleEndpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_articles?select=id,title,sort_order,article_type&project_id=eq.${encodeURIComponent(project.id)}&order=sort_order.asc`,
    );
    const eventEndpoint = getSupabaseRestEndpoint(
      `/rest/v1/newsletter_article_events?select=article_id,event_type&project_id=eq.${encodeURIComponent(project.id)}&limit=50000`,
    );

    if (!articleEndpoint || !eventEndpoint) {
      return { articles: [], projectTitle: project.title, source: "error", message: "기사 반응 통계 조회 주소를 만들지 못했습니다." };
    }

    const articleResponse = await fetch(articleEndpoint, { headers, cache: "no-store" });

    if (!articleResponse.ok) {
      return { articles: [], projectTitle: project.title, source: "error", message: "기사 목록을 조회하지 못했습니다." };
    }

    const articleRows = (await articleResponse.json()) as AnalyticsArticleRow[];
    const analyticsByArticleId = new Map(articleRows.map((article) => [article.id, makeEmptyAnalyticsRow(article)]));
    const eventResponse = await fetch(eventEndpoint, { headers, cache: "no-store" });

    if (!eventResponse.ok) {
      return {
        articles: [...analyticsByArticleId.values()],
        projectTitle: project.title,
        source: "migration_required",
        message: "반응 통계 DB 준비가 필요합니다. v1.17 migration을 적용하면 이벤트가 집계됩니다.",
      };
    }

    const events = (await eventResponse.json()) as ArticleEventRow[];

    for (const event of events) {
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
      row.actionCount = row.phoneClicks + row.mapClicks + row.ctaClicks + row.surveyClicks;
      row.actionRate = row.articleViews > 0 ? (row.actionCount / row.articleViews) * 100 : null;
    }

    return {
      articles: [...analyticsByArticleId.values()],
      projectTitle: project.title,
      source: "supabase",
      message: events.length > 0 ? "기사별 누적 반응 이벤트를 표시합니다." : "아직 기사 반응 데이터가 없습니다.",
    };
  } catch {
    return { articles: [], projectTitle: "", source: "error", message: "기사 반응 통계를 조회하는 중 오류가 발생했습니다." };
  }
}
