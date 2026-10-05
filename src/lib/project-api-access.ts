import { NextResponse } from "next/server";
import {
  canAccessProject,
  hasProjectUnlock,
  requireApiUser,
  unauthorizedJsonResponse,
  type AppUser,
} from "@/lib/app-auth";
import {
  getProjectWorkspace,
  getProjectWorkspaceById,
  type ProjectWorkspaceInfo,
} from "@/lib/newsletter-repository";

type ProjectApiAccessInput = {
  projectId?: string;
  projectSlug?: string;
};

export type ProjectApiAccessResult =
  | { ok: true; project: ProjectWorkspaceInfo; user: AppUser }
  | { ok: false; response: NextResponse };

export async function requireProjectApiAccess(
  input: ProjectApiAccessInput,
): Promise<ProjectApiAccessResult> {
  const user = await requireApiUser();

  if (!user) {
    return { ok: false, response: unauthorizedJsonResponse() };
  }

  const projectId = input.projectId?.trim() ?? "";
  const projectSlug = input.projectSlug?.trim() ?? "";

  if (!projectId && !projectSlug) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "프로젝트 정보를 확인하세요." }, { status: 400 }),
    };
  }

  const [workspaceById, workspaceBySlug] = await Promise.all([
    projectId ? getProjectWorkspaceById(projectId) : Promise.resolve(null),
    projectSlug ? getProjectWorkspace(projectSlug) : Promise.resolve(null),
  ]);
  const workspace = workspaceById ?? workspaceBySlug;

  if (
    workspaceById?.ok &&
    workspaceBySlug?.ok &&
    workspaceById.project.id !== workspaceBySlug.project.id
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "프로젝트 ID와 공개 주소가 서로 다른 프로젝트를 가리킵니다." },
        { status: 400 },
      ),
    };
  }

  if (!workspace || !workspace.ok || !workspace.project || (workspaceById && !workspaceById.ok) || (workspaceBySlug && !workspaceBySlug.ok)) {
    const failedWorkspace =
      (workspaceById && !workspaceById.ok ? workspaceById : null) ??
      (workspaceBySlug && !workspaceBySlug.ok ? workspaceBySlug : null) ??
      workspace;
    const source = failedWorkspace?.source ?? "error";
    const message = failedWorkspace?.message ?? "프로젝트 정보를 확인하지 못했습니다.";
    const status = source === "unconfigured" ? 503 : source === "not_found" ? 404 : 500;

    return {
      ok: false,
      response: NextResponse.json({ ok: false, message }, { status }),
    };
  }

  if (!canAccessProject(user, workspace.project)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, message: "이 프로젝트에 접근할 권한이 없습니다." }, { status: 403 }),
    };
  }

  if (
    user.role !== "admin" &&
    workspace.project.hasProjectPassword &&
    !(await hasProjectUnlock(user, workspace.project.slug))
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: "project_unlock_required", message: "프로젝트 비밀번호 확인이 필요합니다." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, project: workspace.project, user };
}
