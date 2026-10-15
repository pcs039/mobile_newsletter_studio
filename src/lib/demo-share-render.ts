import "server-only";
import { getClientReviewRenderData } from "@/lib/client-review-render";
import { DemoError,getDemoSession } from "@/lib/demo-share";
export async function getDemoRenderData(slug:string){
 const access=await getDemoSession(slug);
 const data=await getClientReviewRenderData(slug,{articleIds:access.share.article_ids,routeBase:"/api/demo-share",articleOnly:true,sourceArticles:access.articles});
 if(!data||data.project.id!==access.project.id)throw new DemoError(503,"시연 자료를 불러오지 못했습니다.");
 return {access,data};
}
