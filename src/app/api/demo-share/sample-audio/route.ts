import { deliverHwaseongDemoAudio } from "@/lib/hwaseong-demo-render";
import { demoHeaders } from "@/lib/demo-share";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const q=new URL(request.url).searchParams;
  if([...q.keys()].some(k=>!["project","article","part","segment"].includes(k)) || ["project","article","part"].some(k=>q.getAll(k).length!==1) || q.getAll("segment").length>1)return new Response(null,{status:404,headers:demoHeaders});
  try {
    const r=await deliverHwaseongDemoAudio(q.get("project")!,q.get("article")!,q.get("part")!,q.get("segment"),request);
    const headers=new Headers(r.headers);for(const [k,v] of Object.entries(demoHeaders))headers.set(k,v);
    return new Response(r.body,{status:r.status,headers});
  } catch { return new Response(null,{status:410,headers:demoHeaders}); }
}
