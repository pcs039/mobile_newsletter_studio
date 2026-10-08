import { NextResponse } from "next/server";
import { createClientReviewToken, hashClientReviewToken } from "@/lib/client-review";
import {
  getClientReviewHistory,
  requestClientReview,
  revokeClientReview,
  type ClientReviewRepositoryStatus,
} from "@/lib/client-review-repository";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function statusCode(status: ClientReviewRepositoryStatus) {
  if (status === "not_configured" || status === "migration_required") return 503;
  if (status === "not_found") return 404;
  if (status === "invalid_input") return 400;
  if (status === "conflict" || status === "approval_required") return 409;
  return 500;
}

async function requireProject(projectSlug: string) {
  const access = await requireProjectApiAccess({ projectSlug });
  return access.ok ? { project: access.project, user: access.user } as const : { response: access.response } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const context = await requireProject(projectId.trim());
  if ("response" in context) return context.response;

  const result = await getClientReviewHistory(context.project.id);
  return NextResponse.json(
    { ok: result.status === "ok", message: result.message, review: result.data?.[0] ?? null, history: result.data },
    { status: result.status === "ok" ? 200 : statusCode(result.status), headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const context = await requireProject(projectId.trim());
  if ("response" in context) return context.response;

  const body = (await request.json().catch(() => null)) as { expiresInDays?: unknown } | null;
  const expiresInDays = typeof body?.expiresInDays === "number" && Number.isInteger(body.expiresInDays)
    ? body.expiresInDays
    : 7;

  if (expiresInDays < 1 || expiresInDays > 30) {
    return NextResponse.json(
      { ok: false, message: "기관 검토 링크 만료 기간은 1일에서 30일 사이여야 합니다." },
      { status: 400 },
    );
  }

  const token = createClientReviewToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await requestClientReview({
    expiresAt,
    projectId: context.project.id,
    requestedBy: context.user.id,
    tokenHash: hashClientReviewToken(token),
  });

  if (result.status !== "ok") {
    return NextResponse.json({ ok: false, message: result.message }, { status: statusCode(result.status) });
  }

  const reviewPath = `/client-review/${token}`;
  const requestOrigin = new URL(request.url).origin;

  return NextResponse.json(
    {
      ok: true,
      message: result.message,
      review: result.data,
      reviewUrl: getAbsoluteSiteUrl(reviewPath, requestOrigin),
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const context = await requireProject(projectId.trim());
  if ("response" in context) return context.response;

  const result = await revokeClientReview(context.project.id);
  return NextResponse.json(
    { ok: result.status === "ok", message: result.message, revokedCount: result.data },
    { status: result.status === "ok" ? 200 : statusCode(result.status) },
  );
}
