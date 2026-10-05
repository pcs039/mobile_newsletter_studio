import { redirect } from "next/navigation";
import { canAccessProject, hasProjectUnlock, requireAppUser } from "@/lib/app-auth";
import type { ProjectWorkspaceInfo } from "@/lib/newsletter-repository";

export async function requireProjectAdminPreviewAccess(
  project: ProjectWorkspaceInfo,
  nextPath: string,
) {
  const user = await requireAppUser(nextPath);

  if (!canAccessProject(user, project)) {
    return false;
  }

  if (user.role !== "admin" && project.hasProjectPassword && !(await hasProjectUnlock(user, project.slug))) {
    redirect(`/projects/${project.slug}/unlock?next=${encodeURIComponent(nextPath)}`);
  }

  return true;
}
