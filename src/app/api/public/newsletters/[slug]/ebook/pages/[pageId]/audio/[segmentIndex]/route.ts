import { preventRevocableFileCaching } from "@/lib/revocable-file-cache";
import { NextResponse } from "next/server";
import { downloadPublicEbookPageAudioSegment } from "@/lib/ebook-tts-audio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicEbookPageAudioSegmentRouteProps = {
  params: Promise<{
    pageId: string;
    segmentIndex: string;
    slug: string;
  }>;
};

async function serveFile(_request: Request, { params }: PublicEbookPageAudioSegmentRouteProps) {
  const { pageId, segmentIndex, slug } = await params;
  const parsedSegmentIndex = Number(segmentIndex);
  const result = await downloadPublicEbookPageAudioSegment(slug, pageId, parsedSegmentIndex);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.httpStatus });
  }

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Type": "audio/mpeg",
      ...(result.contentLength ? { "Content-Length": result.contentLength } : {}),
    },
  });
}

export async function GET(request: Request, context: PublicEbookPageAudioSegmentRouteProps) {
  return preventRevocableFileCaching(await serveFile(request, context));
}
