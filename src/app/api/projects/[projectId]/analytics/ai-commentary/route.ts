import { NextResponse } from "next/server";
import { canAccessProject, requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { extractResponseOutputText } from "@/lib/article-ai-draft";
import { getProjectArticleAnalytics } from "@/lib/article-analytics-repository";
import {
  getAnalyticsPeriodRange,
  getPreviousAnalyticsPeriodRange,
  normalizeAnalyticsPeriod,
} from "@/lib/article-analytics-types";
import {
  aiOperationsCommentaryInstruction,
  aiOperationsCommentaryJsonSchema,
  buildAiOperationsReportInput,
  sanitizeAiOperationsCommentary,
} from "@/lib/ai-operations-commentary";
import { getProjectWorkspace } from "@/lib/newsletter-repository";
import { buildOperationsReportSummary } from "@/lib/operations-report";
import { buildPeriodComparisonSummary } from "@/lib/period-comparison";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const requestTimeoutMs = 55_000;
const periods = new Set(["7d", "30d", "all"]);

function getOperationsReportModel() {
  return process.env.OPENAI_OPERATIONS_REPORT_MODEL?.trim()
    || process.env.OPENAI_ARTICLE_MODEL?.trim()
    || null;
}

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { projectId } = await params;
  const projectSlug = projectId.trim();
  const body = (await request.json().catch(() => null)) as { period?: unknown } | null;
  const requestedPeriod = typeof body?.period === "string" ? body.period.trim() : "30d";

  if (!projectSlug) {
    return errorResponse("AI_COMMENTARY_PROJECT_REQUIRED", "프로젝트 정보를 확인하지 못했습니다.", 400);
  }

  if (!periods.has(requestedPeriod)) {
    return errorResponse("AI_COMMENTARY_PERIOD_INVALID", "운영 리포트 기간을 확인해 주세요.", 400);
  }

  const workspace = await getProjectWorkspace(projectSlug);

  if (!workspace.ok) {
    return errorResponse(
      "AI_COMMENTARY_PROJECT_UNAVAILABLE",
      workspace.message,
      workspace.source === "not_found" ? 404 : workspace.source === "unconfigured" ? 503 : 500,
    );
  }

  if (!canAccessProject(user, workspace.project)) {
    return errorResponse("AI_COMMENTARY_FORBIDDEN", "이 프로젝트의 운영 리포트를 생성할 권한이 없습니다.", 403);
  }

  const period = normalizeAnalyticsPeriod(requestedPeriod);
  const analyticsNow = new Date();
  const currentRange = getAnalyticsPeriodRange(period, analyticsNow);
  const previousRange = getPreviousAnalyticsPeriodRange(currentRange);
  const [analytics, previousAnalytics] = await Promise.all([
    getProjectArticleAnalytics(projectSlug, { now: analyticsNow, period }),
    previousRange
      ? getProjectArticleAnalytics(projectSlug, { period, rangeOverride: previousRange })
      : Promise.resolve(null),
  ]);

  if (analytics.source !== "supabase") {
    return errorResponse(
      "AI_COMMENTARY_ANALYTICS_UNAVAILABLE",
      "운영 지표를 확인하지 못해 AI 해설을 생성할 수 없습니다.",
      analytics.source === "not_found" ? 404 : analytics.source === "unconfigured" || analytics.source === "migration_required" ? 503 : 500,
    );
  }

  const report = buildOperationsReportSummary(analytics);
  const comparison = buildPeriodComparisonSummary(analytics, previousAnalytics);
  const input = buildAiOperationsReportInput(report, {
    channelAttributedRate: analytics.channelAnalytics.attributedRate,
    comparison,
    referrerTotal: analytics.referrerAnalytics.total,
  });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = getOperationsReportModel();

  if (!apiKey) {
    return errorResponse(
      "AI_COMMENTARY_PROVIDER_NOT_CONFIGURED",
      "AI 운영 해설 API가 설정되지 않았습니다.",
      503,
    );
  }

  if (!model) {
    return errorResponse(
      "AI_COMMENTARY_MODEL_NOT_CONFIGURED",
      "AI 운영 해설 모델이 설정되지 않았습니다.",
      503,
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 1800,
        instructions: aiOperationsCommentaryInstruction,
        input: JSON.stringify(input),
        text: {
          format: {
            type: "json_schema",
            name: "operations_report_commentary",
            description: "검증된 운영 지표에 근거한 공공기관 소식지 운영 해설",
            strict: true,
            schema: aiOperationsCommentaryJsonSchema,
          },
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return errorResponse("AI_COMMENTARY_RATE_LIMITED", "AI 해설 생성 요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
      }

      if (response.status === 400 || response.status === 404) {
        return errorResponse("AI_COMMENTARY_MODEL_INVALID", "AI 운영 해설 모델 설정을 확인해 주세요.", 502);
      }

      return errorResponse("AI_COMMENTARY_PROVIDER_FAILED", "AI 운영 해설 생성에 실패했습니다.", 502);
    }

    const providerResponse = (await response.json().catch(() => null)) as unknown;
    const outputText = extractResponseOutputText(providerResponse);

    if (!outputText) {
      return errorResponse("AI_COMMENTARY_INVALID_RESPONSE", "AI 운영 해설 응답 형식을 확인하지 못했습니다.", 502);
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText) as unknown;
    } catch {
      return errorResponse("AI_COMMENTARY_INVALID_RESPONSE", "AI 운영 해설 응답 형식을 확인하지 못했습니다.", 502);
    }

    const commentary = sanitizeAiOperationsCommentary(
      parsed,
      new Set(input.deterministicInsights.map((insight) => insight.id)),
      input.caveats,
    );

    if (!commentary) {
      return errorResponse("AI_COMMENTARY_INVALID_RESPONSE", "AI 운영 해설 응답 형식을 확인하지 못했습니다.", 502);
    }

    return NextResponse.json({ ok: true, commentary });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("AI_COMMENTARY_TIMEOUT", "AI 운영 해설 생성 시간이 초과되었습니다. 다시 시도해 주세요.", 504);
    }

    return errorResponse("AI_COMMENTARY_FAILED", "AI 운영 해설을 생성하지 못했습니다.", 500);
  } finally {
    clearTimeout(timeoutId);
  }
}
