import { NextResponse } from "next/server";
import { canAccessProject, requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { getProjectWorkspace } from "@/lib/newsletter-repository";
import { getOperationsReportSnapshot } from "@/lib/operations-report-snapshot-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; snapshotId: string }> },
) {
  const user = await requireApiUser();
  if (!user) return unauthorizedJsonResponse();

  const { projectId, snapshotId } = await params;
  const projectSlug = projectId.trim();
  const normalizedSnapshotId = snapshotId.trim();
  if (!projectSlug || !normalizedSnapshotId) {
    return errorResponse("OPERATIONS_SNAPSHOT_REQUIRED", "저장된 운영 리포트 정보를 확인하지 못했습니다.", 400);
  }

  const workspace = await getProjectWorkspace(projectSlug);
  if (!workspace.ok) {
    return errorResponse(
      "OPERATIONS_SNAPSHOT_PROJECT_UNAVAILABLE",
      workspace.message,
      workspace.source === "not_found" ? 404 : workspace.source === "unconfigured" ? 503 : 500,
    );
  }
  if (!canAccessProject(user, workspace.project)) {
    return errorResponse("OPERATIONS_SNAPSHOT_FORBIDDEN", "이 저장 리포트를 확인할 권한이 없습니다.", 403);
  }

  const result = await getOperationsReportSnapshot(workspace.project.id, normalizedSnapshotId);
  if (result.status !== "ok" || !result.data) {
    return errorResponse(
      result.status === "not_found" ? "OPERATIONS_SNAPSHOT_NOT_FOUND" : "OPERATIONS_SNAPSHOT_LOAD_FAILED",
      result.message,
      result.status === "not_found" ? 404 : result.status === "not_configured" || result.status === "migration_required" ? 503 : 500,
    );
  }

  return NextResponse.json({ ok: true, snapshot: result.data });
}
