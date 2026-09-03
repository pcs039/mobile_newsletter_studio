import { NextResponse } from "next/server";
import {
  canAccessProject,
  getSafeNextPath,
  requireApiUser,
  setProjectUnlockCookie,
  unauthorizedJsonResponse,
} from "@/lib/app-auth";
import { getProjectWorkspace, verifyProjectPassword } from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorStatus(status: string, httpStatus?: number) {
  return status === "not_configured"
    ? 503
    : status === "not_found"
      ? 404
      : status === "invalid_password"
        ? 401
        : httpStatus ?? 400;
}

export async function POST(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "프로젝트 비밀번호 확인 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const projectSlug = asText(payload.projectSlug);
  const password = String(payload.password ?? "");
  const nextPath = getSafeNextPath(payload.nextPath);
  const workspace = await getProjectWorkspace(projectSlug);

  if (!workspace.project) {
    return NextResponse.json({ ok: false, message: workspace.message }, { status: workspace.httpStatus ?? 404 });
  }

  if (!canAccessProject(user, workspace.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트에 접근할 권한이 없습니다." }, { status: 403 });
  }

  if (user.role === "admin" || !workspace.project.hasProjectPassword) {
    return NextResponse.json({ ok: true, nextPath });
  }

  const result = await verifyProjectPassword(projectSlug, password);

  if (!result.ok) {
    return NextResponse.json(result, { status: getErrorStatus(result.status, result.httpStatus) });
  }

  const response = NextResponse.json({ ok: true, nextPath });
  setProjectUnlockCookie(response, user, projectSlug);

  return response;
}
