import { PublicMobileArticleReader } from "@/components/public-mobile-article-reader";
import {DemoShareEntry} from "@/components/demo-share-entry";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { DemoShareSession } from "@/components/demo-share-session";
import { getDemoRenderData } from "@/lib/demo-share-render";
export const dynamic="force-dynamic";
export const metadata={title:"소식지 시연용 보기",referrer:"no-referrer" as const,robots:{index:false,follow:false}};
export default async function DemoPage({searchParams}:{searchParams:Promise<{project?:string}>}){
 const {project:slug}=await searchParams;
 if(!slug)return <DemoShareEntry/>;
 const result=await getDemoRenderData(slug).catch(()=>null);
 if(!result)return <main className="p-8 text-center">시연 링크가 만료·회수되었거나 자료가 변경되었습니다. 새 링크를 요청하세요.</main>;
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
