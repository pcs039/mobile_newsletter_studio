import { NextResponse } from "next/server";
import { getPublicArticleAudioManifest, downloadPublicArticleAudioSegment } from "@/lib/article-tts-audio";
import { clientReviewAccessStatus, clientReviewResponseHeaders, getClientReviewSession, getClientReviewRenderData } from "@/lib/client-review-render";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("project") ?? "";
  const articleId = params.get("article") ?? "";
  const segment = params.get("segment");
  const access = await getClientReviewSession(slug);
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: clientReviewResponseHeaders });
  if (access.status !== "ok") return json({ ok: false, message: access.message }, clientReviewAccessStatus(access.status));
  if (access.data.review.status !== "pending") return json({ ok: false, message: "이미 검토 응답이 완료되었습니다." }, 409);
  const data = await getClientReviewRenderData(slug);
  if (data?.project.id !== access.data.project.id || !data.articles.some((article) => article.id === articleId && article.audioSource === "ai_tts")) return json({ ok: false, message: "검토 음성을 찾지 못했습니다." }, 404);
  if (segment !== null) {
    if (!/^\d+$/.test(segment)) return json({ ok: false }, 404);
    const result = await downloadPublicArticleAudioSegment(slug, articleId, Number(segment), access.data.project.id);
    return result.ok ? new NextResponse(result.body, { headers: { ...clientReviewResponseHeaders, "Content-Type": "audio/mpeg" } })
      : json({ ok: false, message: result.message }, result.httpStatus);
  }
  const result = await getPublicArticleAudioManifest(slug, articleId, access.data.project.id);
  if (!result.ok) return json({ ok: false, message: result.message }, result.httpStatus);
  return json({ ...result.manifest, segments: result.manifest.segments.map((part) => ({
    index: part.index,
    url: `/api/client-review/audio?${new URLSearchParams({ project: slug, article: articleId, segment: String(part.index) })}`,
  })) });
}
