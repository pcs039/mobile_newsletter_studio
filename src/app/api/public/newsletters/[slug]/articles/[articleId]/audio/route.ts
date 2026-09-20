import { NextResponse } from "next/server";
import { getPublicArticleAudioManifest } from "@/lib/article-tts-audio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicArticleAudioRouteProps = {
  params: Promise<{
    articleId: string;
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: PublicArticleAudioRouteProps) {
  const { articleId, slug } = await params;
  const result = await getPublicArticleAudioManifest(slug, articleId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.httpStatus });
  }

  return NextResponse.json(result.manifest, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
