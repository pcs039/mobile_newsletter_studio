import "server-only";
import { CanvaConnectError, canvaScopes, validateRedirect } from "@/lib/canva-connect-contract";
import type { Connection } from "@/lib/canva-connection-repository";
export function canvaConfig() {
  const clientId = process.env.CANVA_CLIENT_ID?.trim();
  const secret = process.env.CANVA_CLIENT_SECRET?.trim();
  const redirectUri = process.env.CANVA_REDIRECT_URI?.trim();
  if (!clientId || !secret || !redirectUri) throw new CanvaConnectError(503, "Canva 연결 설정이 필요합니다. 기존 디자인 작업은 계속할 수 있습니다.");
  return { clientId, secret, redirectUri: validateRedirect(redirectUri) };
}
export function canvaConfigured() { try { canvaConfig(); return true; } catch { return false; } }
export async function tokenRequest(params: URLSearchParams) {
  const config = canvaConfig();
  let r: Response;
  try { r = await fetch("https://api.canva.com/rest/v1/oauth/token", {method:"POST",cache:"no-store",signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:params}); }
  catch { throw new CanvaConnectError(502,"Canva 인증 응답을 받지 못했습니다. 다시 연결해 주세요."); }
  if (!r.ok) throw new CanvaConnectError(r.status===429?429:401,"Canva 인증에 실패했습니다. 다시 연결해 주세요.");
  const data = await r.json().catch(()=>null);
  if (typeof data?.access_token !== "string" || !data.access_token || data.access_token.length>8192 || typeof data.refresh_token!=="string" || !data.refresh_token || data.refresh_token.length>8192 || typeof data.expires_in!=="number" || !Number.isFinite(data.expires_in) || data.expires_in<=0 || data.expires_in>86400 || data.token_type?.toLowerCase()!=="bearer" || typeof data.scope!=="string" || canvaScopes.some(s=>!data.scope.split(" ").includes(s))) throw new CanvaConnectError(401,"Canva 연결 권한을 확인하고 다시 연결해 주세요.");
  return {access_token:data.access_token as string,refresh_token:data.refresh_token as string,expires_at:new Date(Date.now()+data.expires_in*1000).toISOString()};
}
export async function accessToken(row: Connection, update: (patch: object)=>Promise<Connection>) {
  if (!row.access_token || !row.refresh_token || !row.expires_at) throw new CanvaConnectError(401,"Canva에 다시 연결해 주세요.");
  if (!Number.isFinite(Date.parse(row.expires_at))) {
    await update({access_token:null,refresh_token:null,expires_at:null});
    throw new CanvaConnectError(401,"Canva에 다시 연결해 주세요.");
  }
  if (Date.parse(row.expires_at)>Date.now()+60000) return row.access_token;
  // Consume before calling Canva. An interrupted/failed rotation requires reconnection, never token replay.
  await update({access_token:null,refresh_token:null,expires_at:null});
  const next = await tokenRequest(new URLSearchParams({grant_type:"refresh_token",refresh_token:row.refresh_token}));
  await update(next);
  return next.access_token;
}
// Called under the connection lease. A remote 401 invalidates only this
// project/admin's credentials. Keep execution guards; never retry a creation.
export async function connectedCanvaRequest(path: string, token: string, update: (patch: object)=>Promise<Connection>, body?: object) {
  try {
    return await canvaRequest(path, token, body);
  } catch (error) {
    if (error instanceof CanvaConnectError && error.status === 401) {
      await update({access_token:null,refresh_token:null,expires_at:null});
    }
    throw error;
  }
}
export async function canvaRequest(path: string, token: string, body?: object) {
  let r: Response;
  try { r=await fetch(`https://api.canva.com/rest/v1${path}`,{method:body?"POST":"GET",cache:"no-store",signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})}); }
  catch { throw new CanvaConnectError(504,"Canva 응답을 확인하지 못했습니다. 생성 요청을 자동으로 다시 보내지 않습니다."); }
  if (!r.ok) {
    const message = r.status===429?"Canva 요청 한도에 도달했습니다. 잠시 후 다시 확인하세요.":r.status===401?"Canva에 다시 연결해 주세요.":r.status===403?"Canva 템플릿 접근 권한과 이용 요금제를 확인해 주세요.":r.status===404?"Canva 템플릿 또는 작업을 찾지 못했습니다.":"Canva 요청을 처리하지 못했습니다.";
    throw new CanvaConnectError([401,403,404,429].includes(r.status)?r.status:502,message);
  }
  return r.json().catch(()=>{throw new CanvaConnectError(502,"Canva 응답 형식을 확인하지 못했습니다.");});
}
export async function revokeToken(token: string) {
  const c=canvaConfig();
  const r=await fetch("https://api.canva.com/rest/v1/oauth/revoke",{method:"POST",cache:"no-store",signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${Buffer.from(`${c.clientId}:${c.secret}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token})});
  return r.ok;
}
