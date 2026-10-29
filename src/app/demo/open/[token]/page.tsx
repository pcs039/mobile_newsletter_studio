import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DemoShareEntry } from "@/components/demo-share-entry";
import { stagingOrigin, stagingRequestAllowed } from "@/lib/staging-environment";
import { createDemoTrace, demoStep } from "@/lib/demo-share-diagnostics";
export const dynamic="force-dynamic";
export const metadata={title:"화성시 소식지 · 비공개 시연",referrer:"no-referrer" as const,robots:{index:false,follow:false}};
export default async function DemoOpenPage({params}:{params:Promise<{token:string}>}) {
  const requestHeaders=await headers();
  const request=new Request(`${stagingOrigin}/demo`,{headers:requestHeaders});
  if(!stagingRequestAllowed(request))notFound();
  const {token}=await params;
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))notFound();
  demoStep(createDemoTrace("entry_get"),"entry_get","READY");
  // GET intentionally performs no grant lookup, cookie write or redirect.
  return <DemoShareEntry initialToken={token} project="hwaseong-2026-10-samples"/>;
}
