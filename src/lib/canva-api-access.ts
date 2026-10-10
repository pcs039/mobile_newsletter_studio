import "server-only";
import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
export function canvaJson(value: unknown, status=200) { return NextResponse.json(value,{status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}}); }
export function canvaFailure(error: unknown) { return canvaJson({ok:false,message:error instanceof CanvaConnectError?error.message:"Canva 연결을 처리하지 못했습니다."},error instanceof CanvaConnectError?error.status:502); }
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new CanvaConnectError(403,"현재 관리자 화면에서 다시 요청해 주세요.");
}
export async function canvaAdmin(projectSlug: string) {
  const access=await requireProjectApiAccess({projectSlug});
  if (!access.ok) return access;
  if (access.user.role!=="admin") return {ok:false as const,response:canvaJson({ok:false,message:"관리자만 Canva 연결을 사용할 수 있습니다."},403)};
  return access;
}
export const canvaStateCookie="datadiction_canva_oauth_state";
