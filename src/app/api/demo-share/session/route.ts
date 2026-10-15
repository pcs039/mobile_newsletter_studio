import { NextResponse } from "next/server";
import { getDemoSession,demoHeaders } from "@/lib/demo-share";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 try{const {share}=await getDemoSession(new URL(request.url).searchParams.get("project")??"");return NextResponse.json({ok:true,shareId:share.id,expiresAt:share.expires_at},{headers:demoHeaders});}
 catch{return NextResponse.json({ok:false},{status:410,headers:demoHeaders});}
}
