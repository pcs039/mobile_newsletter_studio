import { NextResponse } from "next/server";
import { getDemoAccess,demoHeaders,demoCookieName } from "@/lib/demo-share";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 try{const {token}=await params;const access=await getDemoAccess(token);
  const response=NextResponse.redirect(new URL(`/demo?${new URLSearchParams({project:access.project.slug})}`,request.url),{status:303,headers:demoHeaders});
  response.cookies.set(demoCookieName(access.project.slug),token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",expires:new Date(access.share.expires_at)});
  return response;
 }catch{return NextResponse.redirect(new URL("/demo",request.url),{status:303,headers:demoHeaders});}
}
