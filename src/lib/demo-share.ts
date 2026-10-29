import "server-only";
import { createHash, createHmac } from "crypto";
import { cookies } from "next/headers";
import { hashClientReviewToken, isClientReviewToken } from "@/lib/client-review";
import { getProjectContent, getProjectWorkspace, type ProjectContentArticle } from "@/lib/newsletter-repository";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { isArticlePubliclyVisible } from "@/lib/article-publication";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";

export function demoDurations(slug: string) { return slug === "hwaseong-2026-10-samples" && stagingEnvironmentConfigured() ? [0] : [1,3,7]; }

export const demoHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
export const demoUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class DemoError extends Error { constructor(public status: number, message: string) { super(message); } }
export type DemoShare = { id: string; project_id: string; article_ids: string[]; source_snapshot: string; created_at: string; expires_at: string | null; revoked_at: string | null };
export function demoShareIsLive(share: DemoShare) {
  if (share.revoked_at) return false;
  if (share.expires_at === null) return stagingEnvironmentConfigured() && share.project_id === "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
  return Number.isFinite(Date.parse(share.expires_at)) && Date.parse(share.expires_at) > Date.now();
}
const columns = "id,project_id,article_ids,source_snapshot,created_at,expires_at,revoked_at";
export function demoCookieName(slug: string) { return `datadiction_demo_${createHash("sha256").update(slug).digest("hex").slice(0,20)}`; }
export function demoSnapshot(articles: ProjectContentArticle[]) {
  // Stable saved source only; not request-time signed URLs or audio availability.
  const source = [...articles].sort((a,b)=>a.id.localeCompare(b.id)).map(a=>({
    ...Object.fromEntries(Object.entries(a).filter(([key])=>!["createdAt","updated","audioFile"].includes(key))),
    audioFile:a.audioFile?{id:a.audioFile.id,title:a.audioFile.title,sourceType:a.audioFile.sourceType,
      aiTtsVoice:a.audioFile.aiTtsVoice,transcriptText:a.audioFile.transcriptText,transcriptType:a.audioFile.transcriptType,
      transcriptReviewStatus:a.audioFile.transcriptReviewStatus}:null,
  }));
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}
export async function demoRows(query: URLSearchParams, method = "GET", body?: unknown): Promise<DemoShare[]> {
  const url = getSupabaseRestEndpoint(`/rest/v1/newsletter_project_demo_shares?${query}`);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new DemoError(503,"시연 공유 서버 설정을 확인하세요.");
  const response = await fetch(url,{method,cache:"no-store",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation"},...(body?{body:JSON.stringify(body)}:{})});
  if (!response.ok) throw new DemoError(response.status===404?503:response.status===409?409:502,response.status===404?"시연용 발행 기능을 준비 중입니다. 관리자에게 문의하세요.":"시연 링크 상태를 확인하지 못했습니다. 자동 재시도하지 말고 목록을 확인하세요.");
  return response.json();
}
export async function demoSource(slug: string) {
  const [workspace,content] = await Promise.all([getProjectWorkspace(slug),getProjectContent(slug)]);
  if (!workspace.ok || content.source!=="supabase") throw new DemoError(404,"시연할 프로젝트를 찾지 못했습니다.");
  if (workspace.project.statusCode==="archived") throw new DemoError(409,"보관된 프로젝트는 시연할 수 없습니다.");
  return {project:workspace.project,articles:content.articles.filter(a=>a.title.trim()&&isArticlePubliclyVisible(a))};
}
export function selectDemoArticles(articles: ProjectContentArticle[], ids: unknown): ProjectContentArticle[] {
  if (!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>typeof id!=="string"||!demoUuid.test(id))||new Set(ids).size!==ids.length) throw new DemoError(400,"공유할 기사를 중복 없이 선택하세요.");
  const chosen = articles.filter(a=>ids.includes(a.id));
  if (chosen.length!==ids.length) throw new DemoError(409,"현재 프로젝트의 시연 가능한 기사만 선택하세요.");
  return chosen;
}
export async function issueDemoShare(slug:string, projectId:string, userId:string, ids:unknown, snapshot:unknown, days:unknown, confirmed:unknown, requestKey:unknown) {
  if(typeof requestKey!=="string"||!demoUuid.test(requestKey))throw new DemoError(400,"시연 요청 식별자를 확인하세요.");
  if (!demoDurations(slug).includes(days as number)||confirmed!==true) throw new DemoError(400,"공유할 자료 확인과 유효기간 선택이 필요합니다.");
  const source=await demoSource(slug);
  if(source.project.id!==projectId) throw new DemoError(403,"프로젝트를 확인하세요.");
  const selected=selectDemoArticles(source.articles,ids);
  if(snapshot!==demoSnapshot(selected)) throw new DemoError(409,"기사 내용이 변경되었습니다. 목록을 다시 확인하세요.");
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!secret)throw new DemoError(503,"서버 설정을 확인하세요.");
  const token=createHmac("sha256",secret).update(`demo-v1:${projectId}:${userId}:${requestKey}`).digest("base64url");
  const lookup=()=>demoRows(new URLSearchParams({select:columns,id:`eq.${requestKey}`,project_id:`eq.${projectId}`,token_hash:`eq.${hashClientReviewToken(token)}`,limit:"1"}));
  const reuse=(share:DemoShare)=>{
    const sameDuration=days===0?share.expires_at===null:share.expires_at!==null&&Math.round((Date.parse(share.expires_at)-Date.parse(share.created_at))/86400000)===days;
    if(share.source_snapshot!==snapshot||JSON.stringify(share.article_ids)!==JSON.stringify(selected.map(a=>a.id))||!sameDuration)throw new DemoError(409,"요청 내용이 달라졌습니다. 다시 선택해 새 요청을 준비하세요.");
    if(!demoShareIsLive(share))throw new DemoError(410,"이 요청은 종료되었습니다. 새 요청을 준비하세요.");
    return {share,token,duplicate:true};
  };
  const [existing]=await lookup();if(existing)return reuse(existing);
  try{
    const [share]=await demoRows(new URLSearchParams({select:columns}),"POST",{
      id:requestKey,project_id:projectId,article_ids:selected.map(a=>a.id),source_snapshot:snapshot,created_by:userId,
      token_hash:hashClientReviewToken(token),expires_at:days===0?null:new Date(Date.now()+Number(days)*86400000).toISOString(),
    });
    if(!share?.id)throw new DemoError(502,"발급 응답을 확인하지 못했습니다. 같은 요청으로 다시 확인하세요.");
    return {share,token,duplicate:false};
  }catch(error){
    // A lost response or concurrent retry may have committed. The same key recovers the same token.
    const [saved]=await lookup();if(saved)return reuse(saved);
    throw error;
  }
}

export async function getDemoAccess(token: string, slug?:string) {
  if(!isClientReviewToken(token)) throw new DemoError(404,"유효한 시연 링크가 필요합니다.");
  const [share]=await demoRows(new URLSearchParams({select:columns,token_hash:`eq.${hashClientReviewToken(token)}`,limit:"1"}));
  if(!share||!demoShareIsLive(share)) throw new DemoError(410,"시연 링크가 만료되었거나 회수되었습니다.");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const url=getSupabaseRestEndpoint(`/rest/v1/newsletter_projects?${new URLSearchParams({select:"slug",id:`eq.${share.project_id}`,deleted_at:"is.null",limit:"1"})}`);
  if(!url) throw new DemoError(503,"서버 설정을 확인하세요.");
  const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"});
  if(!r.ok) throw new DemoError(503,"시연 상태를 확인하지 못했습니다.");
  const projectSlug=(await r.json())[0]?.slug as string|undefined;
  if(!projectSlug||(slug&&projectSlug!==slug)) throw new DemoError(404,"시연 링크를 확인하세요.");
  const source=await demoSource(projectSlug);
  const articles=selectDemoArticles(source.articles,share.article_ids);
  if(source.project.id!==share.project_id||demoSnapshot(articles)!==share.source_snapshot) throw new DemoError(409,"자료가 변경되어 시연 링크를 다시 발급해야 합니다.");
  return {share,project:source.project,articles};
}
export async function getDemoSession(slug:string) {
  const token=(await cookies()).get(demoCookieName(slug))?.value??"";
  return getDemoAccess(token,slug);
}
export async function listDemoShares(projectId:string) {
  // Keep every live link revocable, even when recent history exceeds 20 rows.
  const active: DemoShare[] = [];
  for (let offset=0;;offset+=100) {
    const page=await demoRows(new URLSearchParams({select:columns,project_id:`eq.${projectId}`,revoked_at:"is.null",or:`(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`,order:"created_at.desc,id.desc",limit:"100",offset:String(offset)}));
    active.push(...page);if(page.length<100)break;
  }
  const recent=await demoRows(new URLSearchParams({select:columns,project_id:`eq.${projectId}`,order:"created_at.desc,id.desc",limit:"20"}));
  return [...new Map([...active,...recent].map(row=>[row.id,row])).values()];
}
export async function revokeDemoShare(projectId:string,id:unknown) {
  if(typeof id!=="string"||!demoUuid.test(id)) throw new DemoError(400,"회수할 링크를 확인하세요.");
  const rows=await demoRows(new URLSearchParams({select:columns,id:`eq.${id}`,project_id:`eq.${projectId}`,revoked_at:"is.null"}),"PATCH",{revoked_at:new Date().toISOString()});
  if(!rows.length) throw new DemoError(404,"이미 회수되었거나 이 프로젝트의 링크가 아닙니다.");
}
