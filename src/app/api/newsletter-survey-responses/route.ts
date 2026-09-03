import { NextResponse } from "next/server";
import { submitProjectSurveyResponse } from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, answer]) => {
      if (Array.isArray(answer)) {
        return [key, answer.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)];
      }

      return [key, typeof answer === "string" ? answer.trim() : ""];
    }),
  );
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : status === "invalid_input" || status === "closed"
        ? 400
        : httpStatus ?? 500;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "설문 응답 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const result = await submitProjectSurveyResponse({
    projectSlug: asText(payload.projectSlug),
    surveyId: asText(payload.surveyId),
    answers: asAnswers(payload.answers),
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result, { status: 201 });
}
