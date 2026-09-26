import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectDesignKitForm } from "@/components/project-design-kit-form";
import { getFontAssets, getProjectDesignKit } from "@/lib/newsletter-repository";

export default async function ProjectDesignKitPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [designKitData, fontData] = await Promise.all([
    getProjectDesignKit(projectId),
    getFontAssets(),
  ]);

  return (
    <ProjectAdminShell
      active="design"
      projectId={projectId}
      title="기관 Design Kit"
      description="기관의 로고, CI 색상, 글꼴, 카드·버튼·이미지 스타일을 한 번 등록해 이후 기사와 템플릿에 공통 적용하는 제작 기준입니다."
      sidebarTitle={
        <>
          기관 디자인
        </>
      }
      sidebarDescription="기관 고유의 시각 기준을 등록해 콘텐츠 제작과 향후 자동조판의 기준으로 사용합니다."
      sidebarNoteTitle="Design Kit 원칙"
      sidebarNote="자유 배치 도구가 아니라 시스템이 따라야 할 로고, 색상, 글꼴, 컴포넌트 스타일 규칙을 관리합니다."
      actions={
        <Link
          href={`/projects/${projectId}/reading`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          콘텐츠 제작으로 이동
        </Link>
      }
    >
      {designKitData.ok ? (
        <ProjectDesignKitForm
          designKit={designKitData.designKit}
          fonts={fontData.fonts}
          projectId={projectId}
        />
      ) : (
        <article className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <h3 className="text-lg font-black">Design Kit을 열지 못했습니다.</h3>
          <p className="mt-2 text-sm leading-6">{designKitData.message}</p>
          <Link
            href={`/projects/${projectId}/settings`}
            className="mt-4 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
          >
            기본 정보로 돌아가기
          </Link>
        </article>
      )}
    </ProjectAdminShell>
  );
}
