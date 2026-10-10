import { canvaAdmin, canvaFailure, canvaJson, sameOrigin } from "@/lib/canva-api-access";
import { CanvaConnectError, digest, readCanvaJob, textAutofill } from "@/lib/canva-connect-contract";
import { createCanvaConfirmation, verifyCanvaConfirmation } from "@/lib/canva-confirmation";
import { getConnection, withConnectionLock, type Execution } from "@/lib/canva-connection-repository";
import { accessToken, canvaRequest } from "@/lib/canva-connect-server";
import { listCanvaTemplates } from "@/lib/canva-template-repository";
import { buildCanvaPreview, canvaUuid } from "@/lib/canva-template";
import { getProjectContent } from "@/lib/newsletter-repository";
export const runtime="nodejs";
export const maxDuration=60;
function publicExecution(e: Execution) { return { status:e.status, ...(e.job ? {job:e.job} : {}) }; }
export async function GET(request: Request) {
  try {
    const url=new URL(request.url); const access=await canvaAdmin(url.searchParams.get("projectSlug")||""); if(!access.ok) return access.response;
    const articleId=url.searchParams.get("articleId");
    if(!articleId || !canvaUuid.test(articleId)) throw new CanvaConnectError(400,"저장된 기사를 선택하세요.");
    const row=await getConnection(access.project.id,access.user.id);
    if(!row?.execution || row.execution.articleId!==articleId) return canvaJson({ok:true,execution:null});
    return await withConnectionLock(access.project.id,access.user.id,async(current,update)=>{
      const e=current.execution;
      if(!e || e.articleId!==articleId) return canvaJson({ok:true,execution:null});
      if(e.job?.status==="in_progress") {
        const token=await accessToken(current,update);
        const job=readCanvaJob(await canvaRequest(`/autofills/${encodeURIComponent(e.job.id)}`,token));
        if(job.id!==e.job.id) throw new CanvaConnectError(502,"Canva 작업 식별자가 다릅니다.");
        const next={...e,status:job.status,job}; await update({execution:next});
        return canvaJson({ok:true,execution:publicExecution(next)});
      }
      return canvaJson({ok:true,execution:publicExecution(e)});
    });
  } catch(e) {return canvaFailure(e);}
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); const p=await request.json();
    if(!p || Object.keys(p).some(k=>!["projectSlug","articleId","templateId","action","confirmation","requestKey"].includes(k)) || typeof p.projectSlug!=="string" || !canvaUuid.test(p.articleId||"") || !canvaUuid.test(p.templateId||"") || !["prepare","execute"].includes(p.action)) throw new CanvaConnectError(400,"기사와 템플릿을 확인해 주세요.");
    const access=await canvaAdmin(p.projectSlug);if(!access.ok) return access.response;
    const [templates,content]=await Promise.all([listCanvaTemplates(access.project.id),getProjectContent(access.project.slug)]);
    if(content.source!=="supabase") throw new CanvaConnectError(502,"저장된 기사 데이터를 확인하지 못했습니다.");
    const article=content.articles.find(a=>a.id===p.articleId);
    const template=templates.find(t=>t.id===p.templateId && t.isActive);
    if(!article || !template) throw new CanvaConnectError(404,"현재 프로젝트의 기사와 활성 템플릿을 선택하세요.");
    const fields=buildCanvaPreview(template,article,access.project,null);
    if(!(await getConnection(access.project.id,access.user.id))) throw new CanvaConnectError(401,"먼저 Canva에 연결해 주세요.");
    return await withConnectionLock(access.project.id,access.user.id,async(row,update)=>{
      if(p.action==="execute" && (!canvaUuid.test(p.requestKey||"") || typeof p.confirmation!=="string")) throw new CanvaConnectError(400,"실행 확인이 필요합니다.");
      const previous=row.execution;
      // Return the same key's saved job even after a request/response was interrupted.
      if(p.action==="execute" && previous && previous.key===p.requestKey) {
        if(previous.articleId!==article.id || previous.templateId!==template.id) throw new CanvaConnectError(409,"이미 사용한 요청 식별자입니다.");
        return canvaJson({ok:true,execution:publicExecution(previous)});
      }
      if(p.action==="execute" && previous && ["sending","unknown","in_progress"].includes(previous.status)) throw new CanvaConnectError(409,"이 연결의 이전 생성 요청을 먼저 확인하세요. Canva에서 결과를 확인하기 전에는 다시 생성하지 않습니다.");
      const token=await accessToken(row,update);
      const path=template.templateType==="brand_template"?`/brand-templates/${encodeURIComponent(template.externalId)}/dataset`:`/designs/${encodeURIComponent(template.externalId)}/dataset`;
      const payload=textAutofill(template,fields,await canvaRequest(path,token),article.title);
      const hash=digest(JSON.stringify(payload));
      const binding=JSON.stringify([access.project.id,access.user.id,article.id,template.id,hash]);
      if(p.action==="prepare") return canvaJson({ok:true,fields:fields.filter(f=>f.type==="text"),imageExcluded:template.fieldMappings.some(m=>m.type==="image"),confirmation:createCanvaConfirmation(binding)});
      if(!verifyCanvaConfirmation(p.confirmation,binding)) throw new CanvaConnectError(409,"기사 또는 템플릿이 변경되었거나 확인 시간이 지났습니다. 전달 내용을 다시 확인하세요.");
      const execution:Execution={key:p.requestKey,hash,articleId:article.id,templateId:template.id,status:"sending"};
      await update({execution});
      try {
        // No automatic POST retries: the official endpoint documents no idempotency key.
        const job=readCanvaJob(await canvaRequest("/autofills",token,payload));
        const next={...execution,status:job.status,job}; await update({execution:next});
        return canvaJson({ok:true,execution:publicExecution(next)});
      } catch(e) {
        const definitelyRejected=e instanceof CanvaConnectError && [401,403,404,429].includes(e.status);
        await update({execution:{...execution,status:definitelyRejected?"failed":"unknown"}});
        throw e;
      }
    });
  } catch(e) {return canvaFailure(e);}
}
