import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAppUser, canAccessProject } from "@/lib/app-auth";
import { stagingEnvironmentConfigured } from "@/lib/staging-environment";
import { getProjectWorkspace, getProjectContent } from "@/lib/newsletter-repository";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { HwaseongParticipationAdmin } from "@/components/hwaseong-participation-admin";
import { hwaseongSampleSlug } from "@/lib/hwaseong-proposal-sample";
import { participationAdminData, participationProjectId } from "@/lib/hwaseong-participation-server";
export const dynamic = "force-dynamic";
export default async function SampleParticipationAdminPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!stagingEnvironmentConfigured() || projectId !== hwaseongSampleSlug) notFound();
  const user = await requireAppUser(`/projects/${projectId}/sample-participation`), workspace = await getProjectWorkspace(projectId);
  if (user.role !== "admin" || !workspace.ok || workspace.project.id !== participationProjectId || !canAccessProject(user, workspace.project)) notFound();
  const [data, content] = await Promise.all([participationAdminData(), getProjectContent(projectId)]);
  return <ProjectAdminShell active="survey" projectId={projectId} title="시연 의견·댓글·설문 결과" sidebarTitle="참여 콘텐츠" sidebarDescription="기존 설문 문항을 재사용하고 비공개 의견과 댓글을 검토합니다." sidebarNoteTitle="Staging 시연 전용" sidebarNote="실제 민원 접수나 외부 공개 기능이 아닙니다." description="인증된 비공개 시연의 참여 설정과 검토 결과를 관리합니다." actions={<Link className="rounded-lg border bg-white px-4 py-3 text-sm font-bold" href={`/projects/${projectId}/samples?view=contents`}>시연 목차로</Link>}>
    <HwaseongParticipationAdmin {...data} slug={projectId} organization={workspace.project.organization} articles={content.articles.map(a => ({ id: a.id, title: a.title }))} />
  </ProjectAdminShell>;
}
