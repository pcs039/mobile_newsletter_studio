import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { stagingEnvironmentConfigured, stagingRequestAllowed, stagingOrigin, stagingSupabaseRef } from "@/lib/staging-environment";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorizedJsonResponse();
  if (user.role !== "admin") return NextResponse.json({ok:false}, {status:403});
  const configured = stagingEnvironmentConfigured();
  // Configuration readiness is inspectable before assigning the custom domain.
  // No credentials, database queries or external provider calls.
  return NextResponse.json({ok:true, configured, enabled:stagingRequestAllowed(request),
    stagingUrl:stagingOrigin, supabaseRef:configured ? stagingSupabaseRef : null,
    callbackOriginMatches:process.env.CANVA_REDIRECT_URI === `${stagingOrigin}/api/canva/callback`,
    canvaConfigured:Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET),
    openaiConfigured:Boolean(process.env.OPENAI_API_KEY)}, {headers:{"Cache-Control":"no-store"}});
}
