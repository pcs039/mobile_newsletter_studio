import { NextResponse } from "next/server";
import { getOperationsReportSnapshot } from "@/lib/operations-report-snapshot-repository";
import { requireProjectApiAccess } from "@/lib/project-api-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; snapshotId: string }> },
) {
  const { projectId, snapshotId } = await params;
  const projectSlug = projectId.trim();
  const normalizedSnapshotId = snapshotId.trim();
  if (!projectSlug || !normalizedSnapshotId) {
    return errorResponse("OPERATIONS_SNAPSHOT_REQUIRED", "저장된 운영 리포트 정보를 확인하지 못했습니다.", 400);
  }

  const access = await requireProjectApiAccess({ projectSlug });
  if (!access.ok) {
    return access.response;
  }

  const result = await getOperationsReportSnapshot(access.project.id, normalizedSnapshotId);
  if (result.status !== "ok" || !result.data) {
    return errorResponse(
      result.status === "not_found" ? "OPERATIONS_SNAPSHOT_NOT_FOUND" : "OPERATIONS_SNAPSHOT_LOAD_FAILED",
      result.message,
      result.status === "not_found" ? 404 : result.status === "not_configured" || result.status === "migration_required" ? 503 : 500,
    );
  }

  return NextResponse.json({ ok: true, snapshot: result.data });
}
