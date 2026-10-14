import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getProjectContent, getProjectDesignAssets } from "@/lib/newsletter-repository";
import { prepareInstitutionAssetRecommendation } from "@/lib/institution-asset-recommendation";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const q=new URL(request.url).searchParams,slug=q.get("projectSlug"),id=q.get("articleId"),context=q.get("context");
  const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
  if((context!==null&&context!=="hybrid")||!slug||slug.length>200||!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||[...q.keys()].some(k=>!["projectSlug","articleId","context"].includes(k)))return json({ok:false,message:"현재 프로젝트의 저장된 기사를 선택하세요."},400);
  try {
    const access=await requireProjectApiAccess({projectSlug:slug});if(!access.ok)return access.response;
    if(access.user.role!=="admin")return json({ok:false,message:"관리자만 기관 자산 후보를 확인할 수 있습니다."},403);
    const content=await getProjectContent(access.project.slug),article=content.source==="supabase"?content.articles.find(a=>a.id===id):null;
    if(!article)return json({ok:false,message:"현재 프로젝트의 기사를 찾지 못했습니다."},404);
    const assets=await getProjectDesignAssets(access.project.slug);
    if(!assets.ok||assets.source!=="supabase"||assets.project?.id!==access.project.id)return json({ok:false,message:"기관 자산을 조회하지 못했습니다. 자산 관리에서 확인하세요."},503);
    return json({ok:true,...prepareInstitutionAssetRecommendation(article,id,assets.assets,access.project.id,context==="hybrid"?"hybrid":undefined)});
  } catch {return json({ok:false,message:"기관 자산을 확인하지 못했습니다. 기존 기사와 자산은 유지됩니다."},503);}
}
