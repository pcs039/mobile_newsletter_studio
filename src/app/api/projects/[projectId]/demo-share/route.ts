import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { demoHeaders, DemoError, demoSource, demoSnapshot, issueDemoShare, listDemoShares, revokeDemoShare, selectDemoArticles } from "@/lib/demo-share";
export const dynamic="force-dynamic";
type Context={params:Promise<{projectId:string}>};
function failure(e:unknown){return NextResponse.json({ok:false,message:e instanceof DemoError?e.message:"시연 상태를 확인하지 못했습니다."},{status:e instanceof DemoError?e.status:503,headers:demoHeaders});}
async function context(ctx:Context){const {projectId}=await ctx.params;return requireProjectApiAccess({projectSlug:projectId});}
export async function GET(_request:Request,ctx:Context){
 const access=await context(ctx);if(!access.ok)return access.response;
 try{const source=await demoSource(access.project.slug);
  if(source.project.id!==access.project.id)throw new DemoError(403,"프로젝트를 확인하세요.");
  return NextResponse.json({ok:true,articles:source.articles.map(a=>({id:a.id,title:a.title,status:a.status,snapshot:demoSnapshot([a])})),shares:await listDemoShares(access.project.id)},{headers:demoHeaders});
 }catch(e){return failure(e);}
}
export async function POST(request:Request,ctx:Context){
 try{requireImageSameOrigin(request);}catch{return NextResponse.json({ok:false,message:"현재 사이트에서 시연 링크를 관리하세요."},{status:403,headers:demoHeaders});}
 const access=await context(ctx);if(!access.ok)return access.response;
 try{const input=await request.json();
  if(!input||typeof input!=="object"||Array.isArray(input))throw new DemoError(400,"시연 요청을 확인하세요.");
  if(input.action==="revoke"){await revokeDemoShare(access.project.id,input.shareId);return NextResponse.json({ok:true},{headers:demoHeaders});}
  if(input.action==="prepare"){const source=await demoSource(access.project.slug);if(source.project.id!==access.project.id)throw new DemoError(403,"프로젝트를 확인하세요.");const selected=selectDemoArticles(source.articles,input.articleIds);if(selected.some(a=>input.snapshots?.[a.id]!==demoSnapshot([a])))throw new DemoError(409,"확인한 기사 내용이 바뀌었습니다. 목록을 다시 확인하세요.");return NextResponse.json({ok:true,snapshot:demoSnapshot(selected)},{headers:demoHeaders});}
  if(input.action!=="create")throw new DemoError(400,"시연 요청을 확인하세요.");
  const result=await issueDemoShare(access.project.slug,access.project.id,access.user.id,input.articleIds,input.snapshot,input.days,input.confirmed,input.requestKey);
  // Use the authenticated same origin, never a Preview->Production token link.
  const url=new URL("/demo",request.url);url.hash=result.token;
  return NextResponse.json({ok:true,share:result.share,duplicate:result.duplicate,url:url.href},{status:201,headers:demoHeaders});
 }catch(e){return failure(e);}
}
