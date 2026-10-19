import { preventRevocableFileCaching } from "@/lib/revocable-file-cache";
import { NextResponse } from "next/server";
import { getPublicEbookPageAudioManifest } from "@/lib/ebook-tts-audio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicEbookPageAudioRouteProps = {
  params: Promise<{
    pageId: string;
    slug: string;
  }>;
};

async function serveFile(_request: Request, { params }: PublicEbookPageAudioRouteProps) {
  const { pageId, slug } = await params;
  const result = await getPublicEbookPageAudioManifest(slug, pageId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.httpStatus });
  }

  return NextResponse.json(result.manifest, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request, context: PublicEbookPageAudioRouteProps) {
  return preventRevocableFileCaching(await serveFile(request, context));
}
