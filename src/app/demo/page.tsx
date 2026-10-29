import { headers } from "next/headers";
import { DemoShareFailure } from "@/components/demo-share-failure";
import { createDemoTrace, demoFailure } from "@/lib/demo-share-diagnostics";
import { PublicMobileArticleReader } from "@/components/public-mobile-article-reader";
import {DemoShareEntry} from "@/components/demo-share-entry";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { DemoShareSession } from "@/components/demo-share-session";
import { getDemoRenderData } from "@/lib/demo-share-render";
import { getHwaseongDemoData, isHwaseongDemo } from "@/lib/hwaseong-demo-render";
import { HwaseongProposalReader } from "@/components/hwaseong-proposal-reader";
export const dynamic="force-dynamic";
export const metadata={title:"소식지 시연용 보기",referrer:"no-referrer" as const,robots:{index:false,follow:false}};
export default async function DemoPage({searchParams}:{searchParams:Promise<{project?:string}>}){
 const {project:slug}=await searchParams;
 if(!slug)return <DemoShareEntry/>;
 if(isHwaseongDemo(slug)){
  const trace=createDemoTrace("render",await headers());
  let result;
  try { result=await getHwaseongDemoData(slug,true,trace); }
  catch(error) { const failure=demoFailure(error,trace,trace.stage==="media_prepare"?"MEDIA_PREPARATION_FAILED":trace.stage==="render"?"RENDER_FAILED":"SOURCE_UNAVAILABLE");return <DemoShareFailure {...failure}/>; }
  return <DemoShareSession slug={slug} shareId={result.access.share.id} expiresAt={result.access.share.expires_at}>
   <PublicFontFaceStyle fonts={result.props.fonts}/><HwaseongProposalReader {...result.props} detail={false} width={390}/>
  </DemoShareSession>;
 }
 const trace=createDemoTrace("render",await headers());
 let result;
 try {result=await getDemoRenderData(slug);}
 catch(error){const failure=demoFailure(error,trace);return <DemoShareFailure {...failure}/>;}
 const {access,data}=result;
 return <main className="mx-auto min-w-0 max-w-[520px] bg-white">
  <aside className="sticky top-0 z-[70] bg-amber-100 px-4 py-3 text-sm font-bold text-amber-950">시연용 · 정식 발행 전<br/><span className="text-xs font-normal">자료 확인을 위한 열람 전용 화면입니다. 기관 승인·정식 발행이 아닙니다.</span></aside>
  <DemoShareSession key={access.share.id} slug={slug} shareId={access.share.id} expiresAt={access.share.expires_at}>
   <PublicFontFaceStyle fonts={data.fonts}/>
   <PublicMobileArticleReader analyticsDisabled articles={data.articles} heroBackgrounds={data.heroBackgrounds} topIllustrations={data.topIllustrations} textDesigns={data.textDesigns}
    hasCoverPage={false} fontAssets={data.fonts} headerColor={data.project.primaryColor} issue={data.project.issue} publicationTitle={data.project.title}
    projectBodyFontAssetId={data.project.bodyFontAssetId} projectTitleFontAssetId={data.project.titleFontAssetId} showAdminPreviewControls={false} slug={slug}/>
  </DemoShareSession>
 </main>;
}
