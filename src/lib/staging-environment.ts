import "server-only";
import { canvaRequestOrigin } from "@/lib/canva-request-origin";
import { CanvaConnectError } from "@/lib/canva-connect-contract";

export const stagingOrigin = "https://canva-staging.datadiction.co.kr";
export const stagingSupabaseRef = "mvrkpmffuhcqwisqvpqi";
export const stagingNotice = "외부 연동 검증은 고정 Staging에서만 실행할 수 있습니다.";
export function stagingEnvironmentConfigured() {
  return process.env.APP_ENV === "staging" && process.env.VERCEL_ENV !== "production" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") === `https://${stagingSupabaseRef}.supabase.co` &&
    process.env.NEXT_PUBLIC_SITE_URL === stagingOrigin && process.env.SITE_URL === stagingOrigin &&
    process.env.CANVA_REDIRECT_URI === `${stagingOrigin}/api/canva/callback`;
}
export function stagingRequestAllowed(request: Request) {
  if (!stagingEnvironmentConfigured()) return false;
  try { return canvaRequestOrigin(request) === stagingOrigin; } catch { return false; }
}
export function requireStagingE2E(request: Request) {
  if (!stagingRequestAllowed(request)) throw new CanvaConnectError(403, `${stagingNotice} ${stagingOrigin}`);
}
