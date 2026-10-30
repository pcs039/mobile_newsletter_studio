import { NextRequest, NextResponse } from "next/server";
import { demoCookieName, demoHeaders } from "@/lib/demo-share";
import { createDemoTrace, demoStep } from "@/lib/demo-share-diagnostics";
import { stagingRequestAllowed } from "@/lib/staging-environment";

export function proxy(request: NextRequest) {
  if (!stagingRequestAllowed(request)) return NextResponse.next();
  const token = request.nextUrl.pathname.match(/^\/demo\/open\/([A-Za-z0-9_-]{43})\/?$/)?.[1];
  if (!token || !["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const trace = createDemoTrace("entry_get",request.headers);
  const forwarded = new Headers(request.headers);
  forwarded.set("x-demo-request-id",trace.requestId);
  const response = NextResponse.next({request:{headers:forwarded}});
  const name = demoCookieName("hwaseong-2026-10-samples");
  // A known link-preview bot needs no browser session. User-agent never grants
  // access: the server page still independently validates its bearer/source.
  const preview=/kakaotalk-scrap|kakaostory-og-reader|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot/i.test(request.headers.get("user-agent")??"");
  if (!preview && request.method === "GET" && request.cookies.get(name)?.value !== token) {
    // Transport only, never an authorization decision. SSR verifies the URL's
    // grant/snapshot/7 approved articles independently, and every API rechecks it.
    // No grant is consumed and no DB row is created by preview/reader GETs.
    response.cookies.set(name,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/"});
    demoStep(trace,"cookie_issue","CANDIDATE");
  }
  for(const [key,value] of Object.entries(demoHeaders))response.headers.set(key,value);
  return response;
}
export const config = { matcher: "/demo/open/:token" };
