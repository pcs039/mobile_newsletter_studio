import { NextResponse } from "next/server";
import { getPublicArticleAudioManifest, downloadPublicArticleAudioSegment } from "@/lib/article-tts-audio";
import { demoHeaders as clientReviewResponseHeaders } from "@/lib/demo-share";
import { getDemoRenderData } from "@/lib/demo-share-render";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("project") ?? "";
  const articleId = params.get("article") ?? "";
  const segment = params.get("segment");
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: clientReviewResponseHeaders });
  const session=await getDemoRenderData(slug).catch(()=>null);
  if(!session)return json({ok:false},410);
  const {access,data}=session;
  if (data?.project.id !== access.project.id || !data.articles.some((article) => article.id === articleId && article.audioSource === "ai_tts")) return json({ ok: false, message: "시연 음성을 찾지 못했습니다." }, 404);
  if (segment !== null) {
    if (!/^\d+$/.test(segment)) return json({ ok: false }, 404);
    const result = await downloadPublicArticleAudioSegment(slug, articleId, Number(segment), access.project.id);
    return result.ok ? new NextResponse(result.body, { headers: { ...clientReviewResponseHeaders, "Content-Type": "audio/mpeg" } })
      : json({ ok: false, message: result.message }, result.httpStatus);
  }
  const result = await getPublicArticleAudioManifest(slug, articleId, access.project.id);
  if (!result.ok) return json({ ok: false, message: result.message }, result.httpStatus);
  return json({ ...result.manifest, segments: result.manifest.segments.map((part) => ({
    index: part.index,
    url: `/api/demo-share/audio?${new URLSearchParams({ project: slug, article: articleId, segment: String(part.index) })}`,
  })) });
}
