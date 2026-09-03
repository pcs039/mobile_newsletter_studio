import { NextResponse } from "next/server";
import {
  createProjectSurvey,
  createProjectSurveyQuestion,
  getProjectSurveyResponses,
  type CreateProjectSurveyInput,
  type CreateProjectSurveyQuestionInput,
} from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

const kinds = new Set(["survey", "event"]);
const statuses = new Set(["draft", "open", "closed"]);
const questionTypes = new Set(["single_choice", "multiple_choice", "short_text", "long_text", "scale"]);

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  const numberValue = typeof value === "string" || typeof value === "number" ? Number(value) : 1;

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : 1;
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function asOptions(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((option) => asText(option)).filter(Boolean);
  }

  return asText(value)
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : status === "invalid_input"
        ? 400
        : httpStatus ?? 500;
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function makeResponsesCsv(responses: Awaited<ReturnType<typeof getProjectSurveyResponses>>["responses"]) {
  const rows = [["제출일시", "설문명", "문항", "응답"]];

  for (const response of responses) {
    if (response.answers.length === 0) {
      rows.push([response.submittedAt, response.surveyTitle, "응답 없음", "-"]);
      continue;
    }

    for (const answer of response.answers) {
      rows.push([response.submittedAt, response.surveyTitle, answer.questionTitle, answer.answer]);
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectSlug = asText(url.searchParams.get("projectSlug"));
  const format = asText(url.searchParams.get("format"));

  if (format !== "csv") {
    return NextResponse.json({ ok: false, message: "지원하지 않는 설문 조회 형식입니다." }, { status: 400 });
  }

  const result = await getProjectSurveyResponses(projectSlug);

  if (result.source !== "supabase") {
    return NextResponse.json({ ok: false, message: result.message }, { status: getErrorStatus(result.source) });
  }

  const csv = makeResponsesCsv(result.responses);

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": `attachment; filename="survey-responses-${projectSlug || "project"}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json(
      { ok: false, message: "설문·이벤트 저장 요청 데이터를 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const action = asText(payload.action);
  const projectSlug = asText(payload.projectSlug);

  if (action === "createSurvey") {
    const kind = asText(payload.kind);
    const status = asText(payload.status);

    if (!kinds.has(kind) || !statuses.has(status)) {
      return NextResponse.json({ ok: false, message: "설문 종류 또는 상태 값을 확인해야 합니다." }, { status: 400 });
    }

    const result = await createProjectSurvey({
      projectSlug,
      title: asText(payload.title),
      description: asText(payload.description),
      kind: kind as CreateProjectSurveyInput["kind"],
      status: status as CreateProjectSurveyInput["status"],
      respondentTarget: asText(payload.respondentTarget),
      startAt: asText(payload.startAt),
      endAt: asText(payload.endAt),
      eventPrize: asText(payload.eventPrize),
      drawNote: asText(payload.drawNote),
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
    }

    return NextResponse.json(result, { status: 201 });
  }

  if (action === "createQuestion") {
    const type = asText(payload.type);
    const options = asOptions(payload.options);

    if (!questionTypes.has(type)) {
      return NextResponse.json({ ok: false, message: "문항 형식을 확인해야 합니다." }, { status: 400 });
    }

    if ((type === "single_choice" || type === "multiple_choice") && options.length === 0) {
      return NextResponse.json(
        { ok: false, message: "단일 선택 또는 복수 선택 문항은 선택지를 한 줄에 하나씩 입력해야 합니다." },
        { status: 400 },
      );
    }

    const result = await createProjectSurveyQuestion({
      projectSlug,
      surveyId: asText(payload.surveyId),
      order: asNumber(payload.order),
      title: asText(payload.title),
      type: type as CreateProjectSurveyQuestionInput["type"],
      options,
      isRequired: asBoolean(payload.isRequired),
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
    }

    return NextResponse.json(result, { status: 201 });
  }

  return NextResponse.json({ ok: false, message: "지원하지 않는 설문·이벤트 작업입니다." }, { status: 400 });
}
