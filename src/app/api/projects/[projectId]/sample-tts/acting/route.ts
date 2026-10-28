import { actingDelivery, actingStatus, generateActingPart } from "@/lib/hwaseong-cartoon-acting-server";
import { actingProjectId } from "@/lib/hwaseong-cartoon-acting";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { stagingRequestAllowed } from "@/lib/staging-environment";
import { hwaseongSampleSlug } from "@/lib/hwaseong-proposal-sample";
import { requireCanvaSameOrigin } from "@/lib/canva-request-origin";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;
type Context={params:Promise<{projectId:string}>};
async function access(request:Request,context:Context){
  const {projectId}=await context.params;
  if(!stagingRequestAllowed(request)||projectId!==hwaseongSampleSlug)return new Response(null,{status:404});
  const auth=await requireProjectApiAccess({projectSlug:projectId});if(!auth.ok)return auth.response;
  if(auth.project.id!==actingProjectId||auth.user.role!=="admin")return new Response(null,{status:403});
}
export async function GET(request:Request,context:Context){try{const denied=await access(request,context);if(denied)return denied;const q=new URL(request.url).searchParams;return q.has("audio")?actingDelivery(q.get("audio")!,q.get("segment"),request):Response.json(await actingStatus(),{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({ok:false,message:"시험 음성 상태를 확인할 수 없습니다."},{status:503});}}
export async function POST(request:Request,context:Context){try{const denied=await access(request,context);if(denied)return denied;try{requireCanvaSameOrigin(request);}catch{return new Response(null,{status:403});}const body=await request.json();if(!["A-2","B-2"].includes(body.variant)||!Number.isInteger(body.part)||typeof body.hash!=="string"||!/^[a-f0-9]{64}$/.test(body.hash))return new Response(null,{status:400});return Response.json(await generateActingPart(body.variant,body.part,body.hash),{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({ok:false,state:"unknown",calls:0,message:"요청 결과를 조회하세요. 자동 재시도하지 않습니다."},{status:503});}}
