import "server-only";
import { getCanonicalSiteOrigin } from "@/lib/site-url";
import { ImageGenerationError } from "@/lib/article-image-generation";
export function requireImageSameOrigin(request:Request){
  let origin=new URL(request.url).origin;
  if(process.env.VERCEL==="1"){
    const allowed=new Set<string>();
    for(const host of [process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL])if(host&&/^[a-z0-9-]+\.vercel\.app$/.test(host))allowed.add(host);
    for(const url of [getCanonicalSiteOrigin(),process.env.CANVA_REDIRECT_URI]){
      try{if(url){const u=new URL(url);if(u.protocol==="https:"&&!u.username&&!u.password&&!u.port)allowed.add(u.host);}}catch{/* Ignore invalid server config. */}
    }
    const host=request.headers.get("host"),forwarded=request.headers.get("x-forwarded-host");
    if(!host||!allowed.has(host)||(forwarded!==null&&forwarded!==host)||request.headers.get("x-forwarded-proto")!=="https")throw new ImageGenerationError(403,"현재 관리자 화면에서 다시 요청해 주세요.");
    origin=`https://${host}`;
  }
  if(request.headers.get("origin")!==origin)throw new ImageGenerationError(403,"현재 관리자 화면에서 다시 요청해 주세요.");
}
