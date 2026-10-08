import { NextResponse } from "next/server";
import { getClientReviewCookieToken } from "@/lib/client-review";
import { CLIENT_REVIEW_FEEDBACK_MAX_LENGTH, getClientReviewFeedbackLength, normalizeClientReviewFeedback } from "@/lib/client-review-feedback";
import {
  getClientReviewAccess,
  respondClientReview,
  type ClientReviewDecision,
  type ClientReviewRepositoryStatus,
} from "@/lib/client-review-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function statusCode(status: ClientReviewRepositoryStatus) {
  if (status === "not_configured" || status === "migration_required") return 503;
  if (status === "not_found") return 404;
  if (status === "expired" || status === "revoked") return 410;
  if (status === "invalid_input") return 400;
  if (status === "conflict") return 409;
  return 500;
}

function isDecision(value: unknown): value is ClientReviewDecision {
  return value === "approved" || value === "changes_requested";
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");

  if (origin && origin !== requestUrl.origin) {
    return NextResponse.json({ ok: false, message: "허용되지 않은 기관 검토 요청입니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    decision?: unknown;
    projectSlug?: unknown;
    feedback?: unknown;
  } | null;
  const projectSlug = typeof body?.projectSlug === "string" ? body.projectSlug.trim() : "";

  if (!projectSlug || !isDecision(body?.decision)) {
    return NextResponse.json({ ok: false, message: "기관 검토 응답 값을 확인해 주세요." }, { status: 400 });
  }

  if (body.feedback !== undefined && body.feedback !== null && typeof body.feedback !== "string") {
    return NextResponse.json({ ok: false, message: "수정 의견은 텍스트로 입력해 주세요." }, { status: 400 });
  }
  const feedback = normalizeClientReviewFeedback(body.feedback as string | null | undefined);
  if (feedback && (body.decision !== "changes_requested" || getClientReviewFeedbackLength(feedback) > CLIENT_REVIEW_FEEDBACK_MAX_LENGTH)) {
    return NextResponse.json({ ok: false, message: "수정 의견은 수정 요청에만 포함할 수 있으며 2000자 이하여야 합니다." }, { status: 400 });
  }

  const token = await getClientReviewCookieToken(projectSlug);
  const access = await getClientReviewAccess(token, projectSlug);

  if (access.status !== "ok") {
    return NextResponse.json({ ok: false, message: access.message }, { status: statusCode(access.status) });
  }

  if (access.data.review.status !== "pending") {
    return NextResponse.json({ ok: false, message: "이미 검토 응답이 완료되어 다시 응답할 수 없습니다." }, {
      status: 409, headers: { "Cache-Control": "private, no-store" },
    });
  }

  const result = await respondClientReview(token, body.decision, feedback);
  return NextResponse.json(
    { ok: result.status === "ok", decision: result.data, message: result.message },
    {
      status: result.status === "ok" ? 200 : statusCode(result.status),
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
