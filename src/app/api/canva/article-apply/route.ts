import { canvaAdmin,canvaFailure,canvaJson,sameOrigin } from "@/lib/canva-api-access";
import { requireStagingE2E } from "@/lib/staging-environment";
import { fullLayoutRpc } from "@/lib/article-full-layout-server";
import { canvaUuid } from "@/lib/canva-template";
import { getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
export async function POST(request:Request){try{
 requireStagingE2E(request);sameOrigin(request);const p=await request.json();
 if(!p||Object.keys(p).some(k=>!["projectSlug","articleId","assetId","templateId","action","expected"].includes(k))||typeof p.projectSlug!=="string"||!canvaUuid.test(p.articleId??"")||!canvaUuid.test(p.assetId??"")||!getCanonicalCanvaTemplate(p.templateId??"")||!["snapshot","apply","revoke"].includes(p.action))throw new CanvaConnectError(400,"기사와 자산 정보를 확인하세요.");
 const access=await canvaAdmin(p.projectSlug);if(!access.ok)return access.response;
 return canvaJson({ok:true,...await fullLayoutRpc(access.project.id,p.articleId,p.action,p.assetId,p.templateId,p.expected)});
}catch(e){return canvaFailure(e);}}
