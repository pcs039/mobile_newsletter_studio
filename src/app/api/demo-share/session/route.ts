import { NextResponse } from "next/server";
import { getDemoSession, getDemoAccess, demoCookieName, demoHeaders } from "@/lib/demo-share";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { createDemoTrace, demoFailure, demoStep, demoTimingHeader, type DemoTrace } from "@/lib/demo-share-diagnostics";
import { isHwaseongDemo, validateHwaseongDemoAccess } from "@/lib/hwaseong-demo-render";
export const dynamic = "force-dynamic";
function failure(error: unknown, trace: DemoTrace) {
  const result = demoFailure(error,trace);
  return NextResponse.json(result,{status:result.status,headers:demoHeaders});
}
export async function GET(request: Request) {
  const trace=createDemoTrace("session_check",request.headers);
  try {
    const access=await getDemoSession(new URL(request.url).searchParams.get("project")??"",trace);
    if(isHwaseongDemo(access.project.slug))validateHwaseongDemoAccess(access,trace);
    demoStep(trace,"session_check");
    return NextResponse.json({ok:true,shareId:access.share.id,expiresAt:access.share.expires_at,requestId:trace.requestId},{headers:{...demoHeaders,"Server-Timing":demoTimingHeader(trace)}});
  } catch(error) { return failure(error,trace); }
}
export async function POST(request: Request) {
  const trace=createDemoTrace("origin_check",request.headers);
  try { requireImageSameOrigin(request); } catch { return failure({code:"ORIGIN_REJECTED"},trace); }
  demoStep(trace,"session_exchange");
  try {
    const input=await request.json();
    if(!input||typeof input!=="object"||Array.isArray(input))return failure({code:"INVALID_LINK"},trace);
    const access=await getDemoAccess(typeof input.token==="string"?input.token:"",typeof input.project==="string"?input.project:undefined,trace);
    const sample=isHwaseongDemo(access.project.slug);
    if(sample)validateHwaseongDemoAccess(access,trace);
    const response=NextResponse.json({ok:true,project:access.project.slug,shareId:access.share.id,requestId:trace.requestId},{headers:demoHeaders});
    response.cookies.set(demoCookieName(access.project.slug),input.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:sample?"lax":"strict",path:"/",...(access.share.expires_at?{expires:new Date(access.share.expires_at)}:{})});
    demoStep(trace,"cookie_issue","ISSUED");
    return response;
  } catch(error) { return failure(error,trace); }
}
