import { NextResponse } from "next/server";
import { getProjectArticleAnalytics } from "@/lib/article-analytics-repository";
import {
  getAnalyticsPeriodRange,
  getPreviousAnalyticsPeriodRange,
  normalizeAnalyticsPeriod,
} from "@/lib/article-analytics-types";
import {
  buildAiEvidenceCatalog,
  buildAiOperationsReportInput,
  sanitizeAiOperationsCommentary,
} from "@/lib/ai-operations-commentary";
import { buildOperationsReportSummary } from "@/lib/operations-report";
import {
  createOperationsReportSnapshot,
  listOperationsReportSnapshots,
} from "@/lib/operations-report-snapshot-repository";
import { buildOperationsReportSnapshotPayload } from "@/lib/operations-report-snapshot";
import { buildPeriodComparisonSummary } from "@/lib/period-comparison";
import { requireProjectApiAccess } from "@/lib/project-api-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const periods = new Set(["7d", "30d", "all"]);

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

async function getAuthorizedProject(projectSlug: string) {
  const access = await requireProjectApiAccess({ projectSlug });
  return access.ok ? { project: access.project, user: access.user } as const : { response: access.response } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const projectSlug = projectId.trim();
  if (!projectSlug) return errorResponse("OPERATIONS_SNAPSHOT_PROJECT_REQUIRED", "프로젝트 정보를 확인하지 못했습니다.", 400);

  const context = await getAuthorizedProject(projectSlug);
  if ("response" in context) return context.response;

  const result = await listOperationsReportSnapshots(context.project.id, 10);
  if (result.status !== "ok") {
    return errorResponse(
      result.status === "migration_required" ? "OPERATIONS_SNAPSHOT_MIGRATION_REQUIRED" : "OPERATIONS_SNAPSHOT_LIST_FAILED",
      result.message,
      result.status === "not_configured" || result.status === "migration_required" ? 503 : 500,
    );
  }

  return NextResponse.json({ ok: true, snapshots: result.data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const projectSlug = projectId.trim();
  const body = (await request.json().catch(() => null)) as {
    commentary?: unknown;
    period?: unknown;
    title?: unknown;
  } | null;
  const requestedPeriod = typeof body?.period === "string" ? body.period.trim() : "30d";

  if (!projectSlug) return errorResponse("OPERATIONS_SNAPSHOT_PROJECT_REQUIRED", "프로젝트 정보를 확인하지 못했습니다.", 400);
  if (!periods.has(requestedPeriod)) {
    return errorResponse("OPERATIONS_SNAPSHOT_PERIOD_INVALID", "운영 리포트 기간을 확인해 주세요.", 400);
  }

  const context = await getAuthorizedProject(projectSlug);
  if ("response" in context) return context.response;

  const period = normalizeAnalyticsPeriod(requestedPeriod);
  const capturedAt = new Date();
  const currentRange = getAnalyticsPeriodRange(period, capturedAt);
  const previousRange = getPreviousAnalyticsPeriodRange(currentRange);
  const [analytics, previousAnalytics] = await Promise.all([
    getProjectArticleAnalytics(projectSlug, { now: capturedAt, period }),
    previousRange
      ? getProjectArticleAnalytics(projectSlug, { period, rangeOverride: previousRange })
      : Promise.resolve(null),
  ]);

  if (analytics.source !== "supabase") {
    return errorResponse(
      "OPERATIONS_SNAPSHOT_ANALYTICS_UNAVAILABLE",
      "현재 운영 지표를 확인하지 못해 리포트를 저장할 수 없습니다.",
      analytics.source === "not_found" ? 404 : analytics.source === "unconfigured" || analytics.source === "migration_required" ? 503 : 500,
    );
  }

  const report = buildOperationsReportSummary(analytics);
  const comparison = buildPeriodComparisonSummary(analytics, previousAnalytics);
  const aiInput = buildAiOperationsReportInput(report, {
    channelAttributedRate: analytics.channelAnalytics.attributedRate,
    comparison,
    referrerTotal: analytics.referrerAnalytics.total,
  });
  const submittedCommentary = body && Object.prototype.hasOwnProperty.call(body, "commentary")
    ? body.commentary
    : null;
  const aiCommentary = submittedCommentary === null || submittedCommentary === undefined
    ? null
    : sanitizeAiOperationsCommentary(
        submittedCommentary,
        new Set([
          ...aiInput.deterministicInsights.map((insight) => insight.id),
          ...aiInput.comparisonEvidence.map((evidence) => evidence.id),
        ]),
        aiInput.caveats,
      );

  if (submittedCommentary !== null && submittedCommentary !== undefined && !aiCommentary) {
    return errorResponse(
      "OPERATIONS_SNAPSHOT_AI_COMMENTARY_INVALID",
      "현재 AI 운영 해설을 검증하지 못했습니다. 해설을 다시 생성하거나 해설 없이 저장해 주세요.",
      400,
    );
  }

  const titleInput = typeof body?.title === "string"
    ? body.title.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
    : "";
  const payload = buildOperationsReportSnapshotPayload({
    analytics,
    capturedAt,
    comparison,
    project: context.project,
    report,
  });
  const result = await createOperationsReportSnapshot({
    aiCommentary,
    createdBy: context.user.id,
    evidenceCatalog: aiCommentary ? buildAiEvidenceCatalog(aiInput) : [],
    payload,
    projectId: context.project.id,
    title: titleInput || `${analytics.periodRange.label} 운영 리포트`,
  });

  if (result.status !== "ok" || !result.data) {
    return errorResponse(
      result.status === "migration_required" ? "OPERATIONS_SNAPSHOT_MIGRATION_REQUIRED" : "OPERATIONS_SNAPSHOT_SAVE_FAILED",
      result.message,
      result.status === "not_configured" || result.status === "migration_required" ? 503 : 500,
    );
  }

  return NextResponse.json({ ok: true, message: result.message, snapshot: result.data }, { status: 201 });
}
