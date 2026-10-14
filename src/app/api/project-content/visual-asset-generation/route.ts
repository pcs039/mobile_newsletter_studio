import { executeDirectorImage } from "@/lib/visual-director-image-execution";
import { requireStagingE2E } from "@/lib/staging-environment";
import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getProjectContent } from "@/lib/newsletter-repository";
import { getProjectArticleComposition } from "@/lib/article-composition-repository";
import { validateDesignConcept } from "@/lib/article-design-concept";
import { isArticleHexColor } from "@/lib/article-text-colors";
import { requireImageSameOrigin } from "@/lib/article-image-api-origin";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { buildImageGenerationRequest, imageGenerationEnabled, ImageGenerationError, imageHash, readImageProof, signImageProof, validateGeneratedImage } from "@/lib/article-image-generation";
import { guardedImageGeneration, requestArticleImage } from "@/lib/article-image-provider";
import { registerGeneratedImageAsset } from "@/lib/generated-image-asset-repository";

export const runtime="nodejs";
export const maxDuration=300;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function result(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}
export async function POST(request:Request){
  try{
    requireStagingE2E(request);
    requireImageSameOrigin(request);
    // Bound before parsing large approval images; never read or log credentials/provider bodies.
    if(Number(request.headers.get("content-length"))>3_500_000)throw new ImageGenerationError(413,"미리보기 이미지가 너무 큽니다.");
    const reader=request.body?.getReader();if(!reader)throw new ImageGenerationError(400,"생성 요청을 확인해 주세요.");
    const chunks:Uint8Array[]=[];let length=0;
    try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>3_500_000){await reader.cancel();throw new ImageGenerationError(413,"미리보기 이미지가 너무 큽니다.");}chunks.push(part.value);}}finally{reader.releaseLock();}
    const p=JSON.parse(Buffer.concat(chunks).toString("utf8")||"null");
    if(!p||typeof p.projectSlug!=="string"||!uuid.test(p.articleId||"")||!["generate","approve","director_prepare","director_generate","director_status"].includes(p.action)||Object.keys(p).some(k=>!["projectSlug","articleId","action","concept","role","requestKey","base64","proof","generationKey"].includes(k)))throw new ImageGenerationError(400,"생성 요청을 확인해 주세요.");
    const access=await requireProjectApiAccess({projectSlug:p.projectSlug});if(!access.ok)return access.response;
    if(access.user.role!=="admin")throw new ImageGenerationError(403,"관리자만 이미지 생성과 승인을 할 수 있습니다.");
    if(!imageGenerationEnabled())throw new ImageGenerationError(403,"이미지 생성과 등록은 Staging에서만 사용할 수 있습니다.");
    const content=await getProjectContent(access.project.slug);
    const article=content.source==="supabase"?content.articles.find(a=>a.id===p.articleId):null;
    if(!article)throw new ImageGenerationError(404,"현재 프로젝트의 저장된 기사를 선택하세요.");
    if(p.action.startsWith("director_")){
      if(Object.keys(p).some(k=>!["projectSlug","articleId","action","generationKey"].includes(k)) ||
        (p.action!=="director_prepare" && (typeof p.generationKey!=="string" || !/^[a-f0-9]{64}$/.test(p.generationKey)))) throw new ImageGenerationError(400,"생성 계획을 확인해 주세요.");
      const response=await executeDirectorImage({projectId:access.project.id,articleId:article.id,article,adminId:access.user.id,
        palette:[access.project.primaryColor],action:p.action.slice(9) as "prepare"|"generate"|"status",expectedKey:p.generationKey});
      return result({ok:true,...response});
    }
    if("generationKey" in p) throw new ImageGenerationError(400,"생성 요청을 확인해 주세요.");
    if(p.action==="approve"){
      const proof=readImageProof(p.proof);
      if(proof.projectId!==access.project.id||proof.articleId!==article.id||proof.adminId!==access.user.id)throw new ImageGenerationError(403,"현재 프로젝트의 생성 결과만 승인할 수 있습니다.");
      const png=validateGeneratedImage(p.base64,proof.role);
      if(imageHash(png.bytes)!==proof.hash)throw new ImageGenerationError(403,"생성 이미지가 변경되었습니다.");
      const saved=await registerGeneratedImageAsset(proof,png.bytes,`${article.title.trim().slice(0,150)||"기사"} · ${proof.role==="hero_background"?"배경판":"상단 일러스트"} · GPT Images`);
      return result({ok:true,asset:saved});
    }
    const concept=validateDesignConcept(p.concept);
    if(!concept||concept.pattern==="manual"||!["hero_background","hero_illustration"].includes(p.role)||!uuid.test(p.requestKey||""))throw new ImageGenerationError(400,"생성 가능한 자산과 콘셉트를 선택하세요.");
    const composition=await getProjectArticleComposition(access.project.id,article.id);
    if(!["ok","empty"].includes(composition.status))throw new ImageGenerationError(503,"현재 디자인 색상을 확인하지 못했습니다.");
    const frame=composition.data?.assets.find(a=>a.slot==="hero_background"&&a.isVisible)?.settings;
    // Authoritative project brand first. Client-supplied palette/specification is never accepted.
    const palette=[access.project.primaryColor,frame?.accentColor,frame?.titleColor,frame?.bodyColor].filter((v):v is string=>typeof v==="string"&&isArticleHexColor(v));
    const plan=buildImageGenerationRequest(concept,p.role,palette);
    const response=await guardedImageGeneration(`${access.user.id}:${access.project.id}`,p.requestKey,imageHash(Buffer.from(JSON.stringify([article.id,plan.payload]))),async()=>{
      const base64=await requestArticleImage(plan.payload);
      const png=validateGeneratedImage(base64,p.role);
      const proof=signImageProof({projectId:access.project.id,articleId:article.id,adminId:access.user.id,role:p.role,pattern:concept.pattern as "event"|"policy"|"interview",hash:imageHash(png.bytes)});
      return {ok:true,base64,proof,width:png.width,height:png.height,size:png.size,transparentBackground:plan.specification.transparentBackground};
    });
    return result(response);
  }catch(error){
    const known=error instanceof ImageGenerationError||error instanceof CanvaConnectError;
    return result({ok:false,message:known?error.message:"이미지 요청을 처리하지 못했습니다. 현재 기사와 디자인은 그대로입니다."},known?error.status:502);
  }
}
