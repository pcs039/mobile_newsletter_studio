import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getProjectContent } from "@/lib/newsletter-repository";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { ImageGenerationError } from "@/lib/article-image-generation";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { executeInformationGraphic } from "@/lib/information-graphic-execution";
export const runtime="nodejs";
export async function POST(request:Request){
  try{
    requireImageSameOrigin(request);
    if(Number(request.headers.get("content-length"))>2000)throw new ImageGenerationError(413,"요청 크기를 확인해 주세요.");
    const reader=request.body?.getReader();if(!reader)throw new ImageGenerationError(400,"요청을 확인해 주세요.");
    const parts:Uint8Array[]=[];let size=0;try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>2000){await reader.cancel();throw new ImageGenerationError(413,"요청 크기를 확인해 주세요.");}parts.push(r.value);}}finally{reader.releaseLock();}
    const raw=Buffer.concat(parts).toString("utf8");
    const p=JSON.parse(raw);
    if(!p||("context" in p&&p.context!=="hybrid")||Object.keys(p).some(k=>!["projectSlug","articleId","action","generationKey","context"].includes(k))||typeof p.projectSlug!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(p.articleId)||!["prepare","generate","status"].includes(p.action))throw new ImageGenerationError(400,"저장된 기사와 생성 요청을 확인하세요.");
    const access=await requireProjectApiAccess({projectSlug:p.projectSlug});if(!access.ok)return access.response;
    if(access.user.role!=="admin")throw new ImageGenerationError(403,"관리자만 정보그래픽을 생성할 수 있습니다.");
    const content=await getProjectContent(access.project.slug),article=content.source==="supabase"?content.articles.find(a=>a.id===p.articleId):null;
    if(!article)throw new ImageGenerationError(404,"현재 프로젝트의 저장된 기사를 선택하세요.");
    const result=await executeInformationGraphic({projectId:access.project.id,articleId:article.id,article,color:access.project.primaryColor,action:p.action,expectedKey:p.generationKey,context:p.context});
    return NextResponse.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
  }catch(e){const known=e instanceof ImageGenerationError||e instanceof CanvaConnectError;return NextResponse.json({ok:false,message:known?e.message:"그래픽 결과를 확인하지 못했습니다. 기존 기사는 유지됩니다."},{status:known?e.status:502,headers:{"Cache-Control":"no-store"}});}
}
