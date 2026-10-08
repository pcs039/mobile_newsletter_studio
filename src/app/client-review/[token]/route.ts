import { NextResponse } from "next/server";
import { setClientReviewCookie } from "@/lib/client-review";
import { getClientReviewAccess } from "@/lib/client-review-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await getClientReviewAccess(token.trim());
  const destination = new URL("/client-review", request.url);

  if (result.status !== "ok") {
    destination.searchParams.set("error", result.status);
    return NextResponse.redirect(destination, {
      status: 303,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  destination.searchParams.set("project", result.data.project.slug);
  const response = NextResponse.redirect(destination, {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  setClientReviewCookie(
    response,
    result.data.project.slug,
    token,
    result.data.review.expiresAt,
  );
  return response;
}
