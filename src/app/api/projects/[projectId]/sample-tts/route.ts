import { requireProjectApiAccess } from "@/lib/project-api-access";
import { stagingRequestAllowed } from "@/lib/staging-environment";
import { hwaseongSampleSlug } from "@/lib/hwaseong-proposal-sample";
import { checkSampleTtsProvider, generateSampleTts, sampleProjectId, sampleTtsDelivery, sampleTtsStatus } from "@/lib/hwaseong-sample-tts-server";
import { requireCanvaSameOrigin } from "@/lib/canva-request-origin";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;
type Context={params:Promise<{projectId:string}>};
async function access(request:Request,ctx:Context) {
 const {projectId}=await ctx.params;
 if(!stagingRequestAllowed(request)||projectId!==hwaseongSampleSlug)return new Response(null,{status:404});
 const a=await requireProjectApiAccess({projectSlug:projectId});if(!a.ok)return a.response;
 if(a.project.id!==sampleProjectId||a.user.role!=="admin")return new Response(null,{status:403});
}
export async function GET(request:Request,ctx:Context){try{const denied=await access(request,ctx);if(denied)return denied;const q=new URL(request.url).searchParams;if(q.get('provider')==='check')return Response.json(await checkSampleTtsProvider(),{headers:{'Cache-Control':'private, no-store'}});if(q.has('audio'))return sampleTtsDelivery(q.get('audio')!,q.get('segment'),request);return Response.json(await sampleTtsStatus(),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({ok:false,message:'음성 상태를 확인할 수 없습니다.'},{status:503});}}
export async function POST(request:Request,ctx:Context){try{const denied=await access(request,ctx);if(denied)return denied;try{requireCanvaSameOrigin(request);}catch{return new Response(null,{status:403});}const body=await request.json();if(typeof body.job!=='string'||body.job.length>80)return new Response(null,{status:400});return Response.json(await generateSampleTts(body.job),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({ok:false,state:'unknown',message:'요청 상태를 다시 확인하세요. 자동 재시도하지 않습니다.'},{status:503});}}
