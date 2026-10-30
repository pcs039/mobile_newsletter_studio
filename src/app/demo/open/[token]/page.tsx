import { Suspense } from "react";
import { HwaseongDemoCoverPending } from "@/components/hwaseong-demo-cover-pending";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { HwaseongDemoView } from "@/components/hwaseong-demo-view";
import { DemoShareFailure } from "@/components/demo-share-failure";
import { prepareHwaseongDemoEntry } from "@/lib/hwaseong-demo-render";
import { stagingOrigin, stagingRequestAllowed } from "@/lib/staging-environment";
import { createDemoTrace, demoFailure, demoStep } from "@/lib/demo-share-diagnostics";
export const dynamic="force-dynamic";
export const metadata={title:"화성시 소식지 · 비공개 시연",referrer:"no-referrer" as const,robots:{index:false,follow:false}};
export default async function DemoOpenPage({params}:{params:Promise<{token:string}>}) {
  const requestHeaders=await headers();
  if(!stagingRequestAllowed(new Request(`${stagingOrigin}/demo`,{headers:requestHeaders})))notFound();
  const trace=createDemoTrace("entry_get",requestHeaders);
  const {token}=await params;
  demoStep(trace,"entry_get","START");
  let result;
  try {
    result=await prepareHwaseongDemoEntry(token,trace);
  } catch(error) {
    const fallback=trace.stage==="media_prepare"?"MEDIA_PREPARATION_FAILED":trace.stage==="render"?"RENDER_FAILED":"SOURCE_UNAVAILABLE";
    return <DemoShareFailure {...demoFailure(error,trace,fallback)}/>;
  }
  return <Suspense fallback={<HwaseongDemoCoverPending cover={result.cover}/>}><ReadyDemo ready={result.ready}/></Suspense>;
}

async function ReadyDemo({ready}:{ready:Awaited<ReturnType<typeof prepareHwaseongDemoEntry>>["ready"]}) {
  const data=await ready;
  return "failure" in data?<DemoShareFailure {...data.failure}/>:<HwaseongDemoView result={data.result} confirmCookie/>;
}
