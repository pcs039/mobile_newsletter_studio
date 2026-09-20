import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { generateProjectEbookPageTtsAudio } from "@/lib/ebook-tts-audio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EbookTtsGenerateRouteProps = {
  params: Promise<{
    pageId: string;
    projectId: string;
  }>;
};

type EbookTtsGenerateRequest = {
  force?: boolean;
};

function getErrorStatus(httpStatus?: number) {
  return httpStatus ?? 500;
}

export async function POST(request: Request, { params }: EbookTtsGenerateRouteProps) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { pageId, projectId } = await params;
  const body = (await request.json().catch(() => ({}))) as EbookTtsGenerateRequest;
  const result = await generateProjectEbookPageTtsAudio(projectId, pageId, {
    force: body.force === true,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.httpStatus) });
  }

  return NextResponse.json(result);
}
