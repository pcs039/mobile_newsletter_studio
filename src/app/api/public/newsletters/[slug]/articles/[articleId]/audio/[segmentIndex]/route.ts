import { NextResponse } from "next/server";
import { downloadPublicArticleAudioSegment } from "@/lib/article-tts-audio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicArticleAudioSegmentRouteProps = {
  params: Promise<{
    articleId: string;
    segmentIndex: string;
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: PublicArticleAudioSegmentRouteProps) {
  const { articleId, segmentIndex, slug } = await params;
  const result = await downloadPublicArticleAudioSegment(slug, articleId, Number(segmentIndex));

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.httpStatus });
  }

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
      "Content-Type": "audio/mpeg",
      ...(result.contentLength ? { "Content-Length": result.contentLength } : {}),
    },
  });
}
