import { NextResponse } from "next/server";
import { getDemoSession,getDemoAccess,demoCookieName,demoHeaders } from "@/lib/demo-share";
import {requireImageSameOrigin} from "@/lib/article-image-api-origin";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 try{const {share}=await getDemoSession(new URL(request.url).searchParams.get("project")??"");return NextResponse.json({ok:true,shareId:share.id,expiresAt:share.expires_at},{headers:demoHeaders});}
 catch{return NextResponse.json({ok:false},{status:410,headers:demoHeaders});}
}

export async function POST(request:Request){
 try{requireImageSameOrigin(request);}catch{return NextResponse.json({ok:false},{status:403,headers:demoHeaders});}
 try{const input=await request.json();const access=await getDemoAccess(typeof input?.token==="string"?input.token:"");
  const response=NextResponse.json({ok:true,project:access.project.slug},{headers:demoHeaders});
  response.cookies.set(demoCookieName(access.project.slug),input.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",expires:new Date(access.share.expires_at)});return response;
 }catch{return NextResponse.json({ok:false},{status:410,headers:demoHeaders});}
}
