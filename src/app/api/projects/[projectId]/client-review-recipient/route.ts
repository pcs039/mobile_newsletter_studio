import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { clientReviewRecipient } from "@/lib/client-review-recipient-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ projectId: string }> };
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, context: Context) {
  const { projectId } = await context.params;
  const access = await requireProjectApiAccess({ projectSlug: projectId });
  if (!access.ok) return access.response;
  const result = await clientReviewRecipient(access.project.id);
  return NextResponse.json(result, { status: result.status, headers });
}

export async function PATCH(request: Request, context: Context) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, message: "허용되지 않은 요청입니다." }, { status: 403, headers });
  const { projectId } = await context.params;
  const access = await requireProjectApiAccess({ projectSlug: projectId });
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null);
  const result = await clientReviewRecipient(access.project.id, { email: body?.email });
  return NextResponse.json(result, { status: result.status, headers });
}
