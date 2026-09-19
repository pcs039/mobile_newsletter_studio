import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { rebuildProjectEbookSearchIndex } from "@/lib/ebook-page-search";

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
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const { projectId } = await params;
  const result = await rebuildProjectEbookSearchIndex(projectId);

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  return NextResponse.json(result);
}
