import { NextResponse } from "next/server";
import { clientReviewAccessStatus, clientReviewResponseHeaders, getClientReviewSession } from "@/lib/client-review-render";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("project")?.trim() ?? "";
  const access = await getClientReviewSession(slug);
  if (access.status !== "ok") return NextResponse.json({ ok: false, message: access.message }, {
    status: clientReviewAccessStatus(access.status), headers: clientReviewResponseHeaders,
  });
  return NextResponse.json({ ok: true, status: access.data.review.status, expiresAt: access.data.review.expiresAt }, {
    headers: clientReviewResponseHeaders,
  });
}
