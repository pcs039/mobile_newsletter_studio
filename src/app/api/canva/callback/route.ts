import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/app-auth";
import { canvaAdmin, canvaFailure, canvaStateCookie } from "@/lib/canva-api-access";
import { CanvaConnectError, matchesState } from "@/lib/canva-connect-contract";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { withConnectionLock } from "@/lib/canva-connection-repository";
import { canvaConfig, tokenRequest } from "@/lib/canva-connect-server";
import { canvaRequestOrigin } from "@/lib/canva-request-origin";
export const runtime="nodejs";
export async function GET(request: Request) {
  try {
    const user=await requireApiUser();
    if(!user || user.role!=="admin") throw new CanvaConnectError(401,"관리자로 로그인한 뒤 Canva에 다시 연결해 주세요.");
    const config=canvaConfig(); const url=new URL(request.url);
    if(canvaRequestOrigin(request)+url.pathname!==config.redirectUri) throw new CanvaConnectError(400,"Canva callback 주소를 확인해 주세요.");
    const state=url.searchParams.get("state")||"";
    if((await cookies()).get(canvaStateCookie)?.value!==state || !state) throw new CanvaConnectError(400,"Canva 연결 확인이 만료되었습니다. 다시 연결해 주세요.");
    const {digest}=await import("@/lib/canva-connect-contract");
    // Only lookup the current administrator's pending state. Never expose token columns.
    const endpoint=getSupabaseRestEndpoint(`/rest/v1/newsletter_project_canva_connections?${new URLSearchParams({select:"project_id,newsletter_projects!inner(slug)",user_id:`eq.${user.id}`,oauth_state_hash:`eq.${digest(state)}`,oauth_expires_at:`gt.${new Date().toISOString()}`})}`);
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!endpoint || !key) throw new CanvaConnectError(503,"서버 설정을 확인해 주세요.");
    const r=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:`Bearer ${key}`}});
    const rows=r.ok?await r.json():[];
    if(rows.length!==1) throw new CanvaConnectError(400,"Canva 연결 확인이 만료되었습니다. 다시 연결해 주세요.");
    const access=await canvaAdmin(rows[0].newsletter_projects?.slug || "");
    if(!access.ok) return access.response;
    let outcome="connected";
    await withConnectionLock(rows[0].project_id,user.id,async (row,update)=>{
      if(!matchesState(state,row.oauth_state_hash) || !row.oauth_verifier || !row.oauth_expires_at || Date.parse(row.oauth_expires_at)<=Date.now()) throw new CanvaConnectError(400,"Canva 연결 확인이 만료되었습니다. 다시 연결해 주세요.");
      const verifier=row.oauth_verifier;
      await update({oauth_state_hash:null,oauth_verifier:null,oauth_expires_at:null});
      const code=url.searchParams.get("code");
      if(url.searchParams.has("error") || !code) {outcome="cancelled"; return;}
      try {
        const tokens=await tokenRequest(new URLSearchParams({grant_type:"authorization_code",code,code_verifier:verifier,redirect_uri:config.redirectUri}));
        await update(tokens);
      } catch { outcome="failed"; }
    });
    const slug=rows[0].newsletter_projects?.slug;
    if(typeof slug!=="string" || !/^[A-Za-z0-9_-]+$/.test(slug)) throw new CanvaConnectError(400,"프로젝트 주소를 확인해 주세요.");
    const response=NextResponse.redirect(new URL(`/projects/${slug}/design?canvaConnection=${outcome}#canva-templates`,config.redirectUri),303);
    response.headers.set("Cache-Control","no-store"); response.headers.set("Referrer-Policy","no-referrer");
    response.cookies.set(canvaStateCookie,"",{httpOnly:true,secure:new URL(config.redirectUri).protocol==="https:",sameSite:"lax",path:"/api/canva/callback",maxAge:0});
    return response;
  } catch(e) { const response=canvaFailure(e); response.cookies.set(canvaStateCookie,"",{path:"/api/canva/callback",maxAge:0}); return response; }
}
