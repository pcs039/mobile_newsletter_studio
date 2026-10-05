import { NextResponse } from "next/server";
import { generateProjectEbookPageTtsAudio } from "@/lib/ebook-tts-audio";
import { requireProjectApiAccess } from "@/lib/project-api-access";

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
  const { pageId, projectId } = await params;
  const access = await requireProjectApiAccess({ projectSlug: projectId });

  if (!access.ok) {
    return access.response;
  }

  const body = (await request.json().catch(() => ({}))) as EbookTtsGenerateRequest;
  const result = await generateProjectEbookPageTtsAudio(projectId, pageId, {
    force: body.force === true,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.httpStatus) });
  }

  return NextResponse.json(result);
}
