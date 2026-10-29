import { NextResponse } from "next/server";
import { demoCookieName, demoHeaders, getDemoAccess } from "@/lib/demo-share";
import { stagingRequestAllowed } from "@/lib/staging-environment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Mobile messengers can lose URL fragments when handing off to another browser.
// Reuse the existing grant; this entry never issues or extends a share.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!stagingRequestAllowed(request)) return new Response(null, { status: 404, headers: demoHeaders });
  try {
    const { token } = await params;
    const access = await getDemoAccess(token, "hwaseong-2026-10-samples");
    if (access.project.id !== "4cd5297e-a0fd-434c-84d4-fa4d3baf9389") return new Response(null, { status: 404, headers: demoHeaders });
    const destination = new URL("/demo", request.url);
    destination.searchParams.set("project", access.project.slug);
    const response = NextResponse.redirect(destination, { status: 303, headers: demoHeaders });
    response.cookies.set(demoCookieName(access.project.slug), token, {
      httpOnly: true, secure: true, sameSite: "lax", path: "/",
      ...(access.share.expires_at ? { expires: new Date(access.share.expires_at) } : {}),
    });
    return response;
  } catch {
    return new Response("시연 링크를 확인하지 못했습니다. 전달받은 원본 링크로 다시 접속해 주세요.", {
      status: 410, headers: { ...demoHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
