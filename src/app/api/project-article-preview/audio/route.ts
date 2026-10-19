import { NextResponse } from "next/server";
import { requireProjectApiAccess } from "@/lib/project-api-access";
import { getPublicArticleAudioManifest, downloadPublicArticleAudioSegment } from "@/lib/article-tts-audio";
import { adminArticleAudioHref } from "@/lib/admin-article-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

async function servePreviewAudio(request: Request) {
  const params = new URL(request.url).searchParams;
  const projectSlug = params.get("project") ?? "";
  const articleId = params.get("article") ?? "";
  const segment = params.get("segment");
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
  if (!projectSlug || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(articleId) || (segment !== null && !/^\d{1,6}$/.test(segment))) return json({ ok: false, message: "미리보기 음성을 찾지 못했습니다." }, 404);
  const access = await requireProjectApiAccess({ projectSlug });
  if (!access.ok) {
    for (const [name, value] of Object.entries(headers)) access.response.headers.set(name, value);
    return access.response;
  }
  // The service scopes BOTH article and audio lookups to this authorized project.
  // Never accept an internal project ID or storage path from the request.
  if (segment !== null) {
    const result = await downloadPublicArticleAudioSegment(access.project.slug, articleId, Number(segment), access.project.id);
    return result.ok ? new NextResponse(result.body, { headers: { ...headers, "Content-Type": "audio/mpeg", ...(result.contentLength ? { "Content-Length": result.contentLength } : {}) } })
      : json({ ok: false, message: result.message }, result.httpStatus);
  }
  const result = await getPublicArticleAudioManifest(access.project.slug, articleId, access.project.id);
  if (!result.ok) return json({ ok: false, message: result.message }, result.httpStatus);
  return json({ ...result.manifest, segments: result.manifest.segments.map(part => ({ index: part.index, url: adminArticleAudioHref(access.project.slug, articleId, part.index) })) });
}

export async function GET(request: Request) {
  try { return await servePreviewAudio(request); }
  catch { return NextResponse.json({ ok: false, message: "저장된 미리보기 음성을 불러오지 못했습니다. 다시 확인하세요." }, { status: 502, headers }); }
}
