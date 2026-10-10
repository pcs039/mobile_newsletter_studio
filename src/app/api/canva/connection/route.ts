import { canvaAdmin, canvaFailure, canvaJson, canvaStateCookie, sameOrigin } from "@/lib/canva-api-access";
import { CanvaConnectError, makeAuthorization } from "@/lib/canva-connect-contract";
import { connectionRows, ensureConnection, getConnection, withConnectionLock } from "@/lib/canva-connection-repository";
import { canvaConfig, canvaConfigured, revokeToken } from "@/lib/canva-connect-server";
import { canvaRequestOrigin } from "@/lib/canva-request-origin";
export const runtime="nodejs";
export async function GET(request: Request) {
  const access=await canvaAdmin(new URL(request.url).searchParams.get("projectSlug")||"");
  if (!access.ok) return access.response;
  try {
    if (!canvaConfigured()) return canvaJson({ok:true,status:"setup_required"});
    const row=await getConnection(access.project.id,access.user.id);
    return canvaJson({ok:true,status:row?.access_token&&row.refresh_token&&row.expires_at&&Number.isFinite(Date.parse(row.expires_at))?"connected":"disconnected"});
  } catch(e) { return canvaFailure(e); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const p=await request.json();
    if (!p || typeof p.projectSlug!=="string" || Object.keys(p).some(k=>k!=="projectSlug")) throw new CanvaConnectError(400,"프로젝트 정보를 확인하세요.");
    const access=await canvaAdmin(p.projectSlug); if(!access.ok) return access.response;
    const c=canvaConfig();
    if(new URL(c.redirectUri).origin!==canvaRequestOrigin(request)) throw new CanvaConnectError(503,"등록된 Canva callback 주소의 서버에서 연결해 주세요.");
    await ensureConnection(access.project.id,access.user.id);
    const auth=makeAuthorization(c.clientId,c.redirectUri);
    await withConnectionLock(access.project.id,access.user.id,async (_row,update)=>{
      await update({oauth_state_hash:auth.stateHash,oauth_verifier:auth.verifier,oauth_expires_at:new Date(Date.now()+600000).toISOString()});
    });
    const response=canvaJson({ok:true,url:auth.url});
    response.cookies.set(canvaStateCookie,auth.state,{httpOnly:true,secure:new URL(c.redirectUri).protocol==="https:",sameSite:"lax",path:"/api/canva/callback",maxAge:600});
    return response;
  } catch(e) { return canvaFailure(e); }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request); const p=await request.json();
    if (!p || typeof p.projectSlug!=="string" || p.confirm!==true || Object.keys(p).some(k=>!["projectSlug","confirm"].includes(k))) throw new CanvaConnectError(400,"연결 해제 확인이 필요합니다.");
    const access=await canvaAdmin(p.projectSlug); if(!access.ok) return access.response;
    let revoked=true;
    const row=await getConnection(access.project.id,access.user.id);
    if(row) await withConnectionLock(access.project.id,access.user.id,async (current)=>{
      if(current.refresh_token) { try { revoked=await revokeToken(current.refresh_token); } catch { revoked=false; } }
      await connectionRows(access.project.id,access.user.id,"DELETE",undefined,{lock_id:`eq.${current.lock_id}`});
    });
    return canvaJson({ok:true,message:revoked?"Canva 연결을 해제했습니다.":"앱의 연결 정보는 제거했습니다. Canva 계정 설정에서도 앱 권한을 해제해 주세요."});
  } catch(e) { return canvaFailure(e); }
}
