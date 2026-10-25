import { requireProjectApiAccess } from "@/lib/project-api-access";
import { requireCanvaSameOrigin } from "@/lib/canva-request-origin";
import { stagingRequestAllowed } from "@/lib/staging-environment";
import { marinAttemptKey, marinParentId, marinProjectId } from "@/lib/hwaseong-marin-recovery-contract";
import { marinRecoveryEnabled, marinRecoveryReceipt, runMarinRecovery, finishMarinRecovery } from "@/lib/hwaseong-marin-recovery-server";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;
type Context={params:Promise<{projectId:string}>};
async function access(request: Request, context: Context) {
  if (!marinRecoveryEnabled() || !stagingRequestAllowed(request) || (await context.params).projectId!=="hwaseong-2026-10-samples") return {response:new Response(null,{status:404})};
  const a=await requireProjectApiAccess({projectSlug:"hwaseong-2026-10-samples"});
  if (!a.ok) return {response:a.response};
  if (a.project.id!==marinProjectId || a.user.role!=="admin") return {response:new Response(null,{status:403})};
  return {actor:{id:a.user.id,role:"admin" as const}};
}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request: Request, context: Context) {
  try { const a=await access(request,context);if(a.response)return a.response;
    return json({parentId:marinParentId,requestKey:marinAttemptKey,receipt:await marinRecoveryReceipt(),readOnly:true});
  } catch { return json({ok:false,state:"unknown",code:"status_unavailable"},503); }
}
export async function POST(request: Request, context: Context) {
  try {
    const a=await access(request,context);if(a.response)return a.response;
    try{requireCanvaSameOrigin(request);}catch{return new Response(null,{status:403});}
    const text=await request.text();if(text.length>2048)return new Response(null,{status:413});
    let body;try{body=JSON.parse(text);}catch{return new Response(null,{status:400});}
    if (!body || body.parentId!==marinParentId || body.requestKey!==marinAttemptKey) return new Response(null,{status:400});
    if (body.action==="reconcile") return json(await finishMarinRecovery(a.actor!));
    if (body.action!=="execute" || body.acknowledgeUnknownPriorCost!==true || body.confirmPriorInvocationFinished!==true ||
        typeof body.approvalReference!=="string" || !body.approvalReference.trim() || body.approvalReference.length>200) return new Response(null,{status:400});
    return json(await runMarinRecovery(a.actor!,body.approvalReference));
  } catch { return json({ok:false,state:"unknown",code:"query_same_attempt_no_retry"},503); }
}
