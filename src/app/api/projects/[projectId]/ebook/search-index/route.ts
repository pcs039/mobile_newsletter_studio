import { NextResponse } from "next/server";
import { rebuildProjectEbookSearchIndex } from "@/lib/ebook-page-search";
import { requireProjectApiAccess } from "@/lib/project-api-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EbookSearchIndexRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured" ? 503 : status === "not_found" ? 404 : status === "missing_pdf" ? 400 : httpStatus ?? 500;
}

export async function POST(_request: Request, { params }: EbookSearchIndexRouteProps) {
  const { projectId } = await params;
  const access = await requireProjectApiAccess({ projectSlug: projectId });

  if (!access.ok) {
    return access.response;
  }

  const result = await rebuildProjectEbookSearchIndex(projectId);

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result);
}
