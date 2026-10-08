import { NextResponse } from "next/server";
import {
  clientReviewAccessStatus, clientReviewResponseHeaders, getClientReviewSession, getClientReviewRenderData,
} from "@/lib/client-review-render";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import { serveArticleHeroBackground } from "@/lib/article-hero-background-file";

export const dynamic = "force-dynamic";

function failure(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: clientReviewResponseHeaders });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("project")?.trim() ?? "";
  if (params.has("heroArticle")) {
    const access = await getClientReviewSession(slug);
    if (access.status !== "ok") return failure(access.message, clientReviewAccessStatus(access.status));
    if (access.data.review.status !== "pending") return failure("이미 검토 응답이 완료되었습니다.", 409);
    return serveArticleHeroBackground(access.data.project.id, params.get("heroArticle") ?? "");
  }
  const bucket = params.get("bucket") ?? "";
  const path = params.get("path") ?? "";
  if (!["mobile-assets", "page-images", "audio-files", "brand-assets"].includes(bucket)
    || !path || path.includes("..") || path.startsWith("/") || path.endsWith("/")) return failure("검토 파일을 찾지 못했습니다.", 404);
  const access = await getClientReviewSession(slug);
  if (access.status !== "ok") return failure(access.message, clientReviewAccessStatus(access.status));
  if (access.data.review.status !== "pending") return failure("이미 검토 응답이 완료되었습니다.", 409);
  const data = await getClientReviewRenderData(slug);
  if (!data) return failure("검토 내용을 불러오지 못했습니다.", 503);
  if (data.project.id !== access.data.project.id || !data.files.has(`${bucket}:${path}`)) return failure("검토 파일을 찾지 못했습니다.", 404);

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return failure("검토 파일을 사용할 수 없습니다.", 503);
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  // Render references alone are insufficient: image/audio rows must also belong to this project.
  if (!(bucket === "mobile-assets" && data.project.coverEnabled && data.project.coverImagePath === path)) {
    const table = bucket === "mobile-assets" ? "newsletter_assets" : bucket === "page-images" ? "newsletter_pages"
      : bucket === "audio-files" ? "newsletter_audio_files" : "newsletter_project_design_assets";
    const column = bucket === "page-images" ? "image_path" : bucket === "brand-assets" ? "storage_path" : "file_path";
    const query = new URLSearchParams({ select: "id", project_id: `eq.${access.data.project.id}`, [column]: `eq.${path}`, limit: "1" });
    if (bucket === "brand-assets") { query.set("storage_bucket", "eq.brand-assets"); query.set("is_active", "eq.true"); }
    const endpoint = getSupabaseRestEndpoint(`/rest/v1/${table}?${query}`);
    if (!endpoint) return failure("검토 파일을 사용할 수 없습니다.", 503);
    const response = await fetch(endpoint, { headers, cache: "no-store" });
    if (!response.ok || !(await response.json()).length) return failure("검토 파일을 찾지 못했습니다.", 404);
  }
  const endpoint = getSupabaseStorageEndpoint(`/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
  if (!endpoint) return failure("검토 파일을 사용할 수 없습니다.", 503);
  const response = await fetch(endpoint, { headers, cache: "no-store" });
  if (!response.ok || !response.body) return failure("검토 파일을 불러오지 못했습니다.", 404);
  const contentType = response.headers.get("Content-Type")?.split(";")[0] ?? "";
  if (!/^(image\/(png|jpeg|webp|gif|avif|svg\+xml)|audio\/[-a-z0-9.+]+)$/.test(contentType)) return failure("검토 화면에서 지원하지 않는 파일입니다.", 415);
  return new NextResponse(response.body, { headers: {
    ...clientReviewResponseHeaders, "Content-Type": contentType, "Content-Disposition": "inline",
    ...(contentType === "image/svg+xml" ? { "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}),
  } });
}
