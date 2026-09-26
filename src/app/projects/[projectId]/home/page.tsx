import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectHomeSettingsForm } from "@/components/project-home-settings-form";
import { getProjectHomeSettings } from "@/lib/newsletter-repository";

export default async function ProjectHomeSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const homeData = await getProjectHomeSettings(projectId);

  return (
    <ProjectAdminShell
      active="home"
      projectId={projectId}
      title="첫 화면"
      description="주민이 소식지에 들어왔을 때 먼저 볼 생활수요형 공공정보 첫 화면을 설정합니다."
      sidebarTitle={<>첫 화면</>}
      sidebarDescription="지역과 관심분야를 기준으로 공개 모바일 첫 화면의 기사 묶음을 정리합니다."
      sidebarNoteTitle="1단계 범위"
      sidebarNote="AI 자동배치나 페이지 빌더가 아니라, 기존 기사 메타데이터를 활용한 규칙 기반 첫 화면입니다."
      actions={
        <Link
          href={`/projects/${projectId}/reading`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          모바일 기사 작성
        </Link>
      }
    >
      {homeData.settings ? (
        <ProjectHomeSettingsForm projectId={projectId} settings={homeData.settings} />
      ) : (
        <article className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <h3 className="text-lg font-black">첫 화면 설정을 열지 못했습니다.</h3>
          <p className="mt-2 text-sm leading-6">{homeData.message}</p>
          <Link
            href={`/projects/${projectId}/reading`}
            className="mt-4 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
          >
            콘텐츠 제작으로 이동
          </Link>
        </article>
      )}
    </ProjectAdminShell>
  );
}
