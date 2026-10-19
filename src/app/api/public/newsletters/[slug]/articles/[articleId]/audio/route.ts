import { preventRevocableFileCaching } from "@/lib/revocable-file-cache";
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

async function serveFile(_request: Request, { params }: PublicArticleAudioRouteProps) {
  const { articleId, slug } = await params;
  const result = await getPublicArticleAudioManifest(slug, articleId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.httpStatus });
  }

  return NextResponse.json(result.manifest, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request, context: PublicArticleAudioRouteProps) {
  return preventRevocableFileCaching(await serveFile(request, context));
}
