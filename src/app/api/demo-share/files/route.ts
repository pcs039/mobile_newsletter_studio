import { serveFullLayout } from "@/lib/article-full-layout-server";
import { serveAiArticleImage } from "@/lib/ai-image-article-server";
import { NextResponse } from "next/server";
import {
  clientReviewResponseHeaders,
} from "@/lib/client-review-render";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { serveArticleHeroBackground } from "@/lib/article-hero-background-file";

import { getDemoRenderData } from "@/lib/demo-share-render";

export const dynamic = "force-dynamic";

function failure(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: clientReviewResponseHeaders });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("project")?.trim() ?? "";
  const result = await getDemoRenderData(slug).catch(()=>null);
  if (!result) return failure("시연 링크가 유효하지 않습니다.", 410);
  const { access, data } = result;
  if (params.has("heroArticle") || params.has("topArticle") || params.has("fullLayoutBlock") || params.has("aiImageBlock")) {
    const kinds=["heroArticle","topArticle","fullLayoutBlock","aiImageBlock"].filter(key=>params.has(key));
    if(kinds.length!==1)return failure("시연 파일 요청을 확인하세요.",404);
    const articleId = params.get("heroArticle") ?? params.get("topArticle") ?? params.get("articleId") ?? "";
    if(params.has("articleId")&&params.get("articleId")!==articleId)return failure("기사 참조가 일치하지 않습니다.",404);
    if (!data.articles.some(a=>a.id===articleId)) return failure("선택한 시연 기사가 아닙니다.",404);
    if (params.has("aiImageBlock")) return serveAiArticleImage(access.project.id,slug,params.get("articleId")??"",params.get("aiImageBlock")??"",false,request);
    if (params.has("fullLayoutBlock")) return serveFullLayout(access.project.id,slug,params.get("articleId")??"",params.get("fullLayoutBlock")??"",false,request);
    const illustration = params.has("topArticle");
    return serveArticleHeroBackground(access.project.id, params.get(illustration ? "topArticle" : "heroArticle") ?? "", false, illustration ? "hero_illustration" : "hero_background");
  }
  const bucket = params.get("bucket") ?? "";
  const path = params.get("path") ?? "";
  if (!["mobile-assets", "page-images", "audio-files", "brand-assets"].includes(bucket)
    || !path || path.includes("..") || path.startsWith("/") || path.endsWith("/")) return failure("시연 파일을 찾지 못했습니다.", 404);
  if (data.project.id !== access.project.id || !data.files.has(`${bucket}:${path}`)) return failure("시연 파일을 찾지 못했습니다.", 404);

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return failure("시연 파일을 사용할 수 없습니다.", 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  // Render references alone are insufficient: image/audio rows must also belong to this project.
  { // Demo has no issue cover; every referenced file needs a project-owned row.
    const table = bucket === "mobile-assets" ? "newsletter_assets" : bucket === "page-images" ? "newsletter_pages"
      : bucket === "audio-files" ? "newsletter_audio_files" : "newsletter_project_design_assets";
    const column = bucket === "page-images" ? "image_path" : bucket === "brand-assets" ? "storage_path" : "file_path";
    const query = new URLSearchParams({ select: "id", project_id: `eq.${access.project.id}`, [column]: `eq.${path}`, limit: "1" });
    if (bucket === "brand-assets") { query.set("storage_bucket", "eq.brand-assets"); query.set("is_active", "eq.true"); }
    const endpoint = getSupabaseRestEndpoint(`/rest/v1/${table}?${query}`);
    if (!endpoint) return failure("시연 파일을 사용할 수 없습니다.", 503);
    const response = await fetch(endpoint, { headers, cache: "no-store" });
    if (!response.ok || !(await response.json()).length) return failure("시연 파일을 찾지 못했습니다.", 404);
  }
  const endpoint = getSupabaseStorageEndpoint(`/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
  if (!endpoint) return failure("시연 파일을 사용할 수 없습니다.", 503);
  const response = await fetch(endpoint, { headers, cache: "no-store" });
  if (!response.ok || !response.body) return failure("시연 파일을 불러오지 못했습니다.", 404);
  const contentType = response.headers.get("Content-Type")?.split(";")[0] ?? "";
  if (!/^(image\/(png|jpeg|webp|gif|avif|svg\+xml)|audio\/[-a-z0-9.+]+)$/.test(contentType)) return failure("시연 화면에서 지원하지 않는 파일입니다.", 415);
  return new NextResponse(response.body, { headers: {
    ...clientReviewResponseHeaders, "X-Robots-Tag":"noindex, nofollow, noarchive", "Content-Type": contentType, "Content-Disposition": "inline",
    ...(contentType === "image/svg+xml" ? { "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}),
  } });
}
