import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectQuickPostForm } from "@/components/project-quick-post-form";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

export default async function ProjectQuickPostPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const workspace = await getProjectWorkspace(projectId);

  return (
    <ProjectAdminShell
      active="reading"
      projectId={projectId}
      title="빠른 소식 등록"
      description="수시 안내와 긴급 정보를 빠르게 등록합니다."
      sidebarTitle={<>빠른 소식<br />등록</>}
      sidebarDescription="정기호 발행 사이의 공지와 긴급 정보를 게시합니다."
      sidebarNoteTitle="공개 기준"
      sidebarNote="즉시 게시한 수시 소식은 설정한 노출 기간에만 공개됩니다."
      actions={
        <Link href={`/projects/${projectId}/reading`} className="dd-btn dd-btn-secondary">기사 작성/편집으로 돌아가기</Link>
      }
    >
      <div className="mx-auto max-w-4xl">
        <ProjectQuickPostForm isProjectPublished={workspace.project?.statusCode === "published"} projectSlug={projectId} />
      </div>
    </ProjectAdminShell>
  );
}
