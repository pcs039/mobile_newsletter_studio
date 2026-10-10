import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { CanvaConnectError, type CanvaJob } from "@/lib/canva-connect-contract";
export type Execution = { key: string; hash: string; articleId: string; templateId: string; status: "sending" | "unknown" | "in_progress" | "success" | "failed"; job?: CanvaJob };
export type Connection = { project_id: string; user_id: string; access_token: string | null; refresh_token: string | null; expires_at: string | null; oauth_state_hash: string | null; oauth_verifier: string | null; oauth_expires_at: string | null; lock_id: string | null; execution: Execution | null };
const table = "newsletter_project_canva_connections";
export async function connectionRows(projectId: string, userId: string, method = "GET", patch?: object, filters: Record<string,string> = {}, prefer = "return=representation"): Promise<Connection[]> {
  const query = new URLSearchParams({ project_id: `eq.${projectId}`, user_id: `eq.${userId}`, ...filters });
  const endpoint = getSupabaseRestEndpoint(`/rest/v1/${table}?${query}`);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!endpoint || !key) throw new CanvaConnectError(503, "서버 설정을 확인해 주세요.");
  const r = await fetch(endpoint, { method, cache: "no-store", signal: AbortSignal.timeout(10000), headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: prefer }, ...(patch ? {body: JSON.stringify(patch)} : {}) });
  if (!r.ok) throw new CanvaConnectError(503, "Canva 연결 저장소를 확인해 주세요. v1.34 schema가 필요합니다.");
  return r.json();
}
export async function getConnection(projectId: string, userId: string) { return (await connectionRows(projectId,userId))[0] || null; }
export async function ensureConnection(projectId: string, userId: string) {
  await connectionRows(projectId,userId,"POST",{project_id:projectId,user_id:userId}, {},"resolution=ignore-duplicates,return=representation");
}
export async function withConnectionLock<T>(projectId: string, userId: string, action: (row: Connection, update: (patch: object) => Promise<Connection>) => Promise<T>): Promise<T> {
  const lockId = randomUUID();
  const now = new Date().toISOString();
  const rows = await connectionRows(projectId,userId,"PATCH",{lock_id:lockId,lock_until:new Date(Date.now()+90000).toISOString()}, {or:`(lock_until.is.null,lock_until.lt.${now})`});
  if (!rows[0]) throw new CanvaConnectError(409, "Canva 요청을 처리 중입니다. 잠시 후 다시 확인하세요.");
  async function update(patch: object) {
    const result = await connectionRows(projectId,userId,"PATCH",{...patch,updated_at:new Date().toISOString()}, {lock_id:`eq.${lockId}`});
    if (!result[0]) throw new CanvaConnectError(409, "연결 상태가 변경되었습니다. 다시 확인해 주세요.");
    return result[0];
  }
  try { return await action(rows[0],update); }
  finally { await connectionRows(projectId,userId,"PATCH",{lock_id:null,lock_until:null},{lock_id:`eq.${lockId}`}).catch(() => undefined); }
}
