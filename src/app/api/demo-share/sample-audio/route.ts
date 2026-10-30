import { createDemoTrace, demoTimingHeader } from "@/lib/demo-share-diagnostics";
import { deliverHwaseongDemoAudio } from "@/lib/hwaseong-demo-render";
import { demoHeaders } from "@/lib/demo-share";
import { demoAudioPreparationRequest, validDemoPreparationResponse } from "@/lib/demo-audio-preparation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const q=new URL(request.url).searchParams;
  if([...q.keys()].some(k=>!["project","article","part","segment","prepare"].includes(k)) || ["project","article","part"].some(k=>q.getAll(k).length!==1) || q.getAll("segment").length>1 || q.getAll("prepare").length>1 || (q.has("prepare")&&(q.get("prepare")!=="1"||q.get("segment")!=="0")))return new Response(null,{status:404,headers:demoHeaders});
  const trace=createDemoTrace("session_check",request.headers);
  try {
    const prepared=q.has("prepare")?demoAudioPreparationRequest(request):{request,limited:false};
    const r=await deliverHwaseongDemoAudio(q.get("project")!,q.get("article")!,q.get("part")!,q.get("segment"),prepared.request,trace);
    if(prepared.limited && r.ok && !validDemoPreparationResponse(r,prepared.start!,prepared.end!)) {
      await r.body?.cancel();
      return new Response(null,{status:502,headers:demoHeaders});
    }
    const headers=new Headers(r.headers);headers.set("Server-Timing",demoTimingHeader(trace));for(const [k,v] of Object.entries(demoHeaders))headers.set(k,v);
    let body:ReadableStream<Uint8Array>|null=r.body;
    if(prepared.limited&&r.ok&&body){
      let received=0;
      body=body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){
        received+=chunk.byteLength;
        if(received>prepared.end!-prepared.start!+1)throw Error("Preparation response exceeded byte limit");
        controller.enqueue(chunk);
      }}));
    }
    return new Response(body,{status:r.status,headers});
  } catch { return new Response(null,{status:410,headers:demoHeaders}); }
}
