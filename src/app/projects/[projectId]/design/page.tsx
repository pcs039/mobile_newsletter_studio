import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectDesignIntakeSection } from "@/components/project-design-intake-section";
import { ProjectDesignKitForm } from "@/components/project-design-kit-form";
import { getFontAssets, getProjectDesignAssets, getProjectDesignKit } from "@/lib/newsletter-repository";

export default async function ProjectDesignKitPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [designKitData, designAssetsData, fontData] = await Promise.all([
    getProjectDesignKit(projectId),
    getProjectDesignAssets(projectId),
    getFontAssets(),
  ]);

  return (
    <ProjectAdminShell
      active="design"
      projectId={projectId}
      title="디자인 워크스페이스"
      description="기관 공통 기준을 정하고 이번 발행호의 디자인 밑작업을 준비한 뒤, 기사별 디자인 조정으로 이어갑니다."
      sidebarTitle={
        <>
          디자인 작업
        </>
      }
      sidebarDescription="기관 공통 디자인, 이번 호 디자인, 개별 기사 디자인을 작업 순서에 따라 구분합니다."
      sidebarNoteTitle="디자인 계층"
      sidebarNote="기관 기준은 공통 규칙으로, 이번 호 자산은 발행호 밑작업으로, Composition은 기사별 예외 조정으로 사용합니다."
      actions={
        <Link
          href={`/projects/${projectId}/reading`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          기사 제작으로 이동
        </Link>
      }
    >
      {designKitData.ok ? (
        <div className="space-y-8">
          <section className="border-y border-[#c9d7e8] bg-[#f7fbff] px-4 py-5 sm:px-6">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">디자인 작업 흐름</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <a href="#institution-design" className="rounded-lg border border-[#c9d7e8] bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]">
                1. 기관 공통 디자인
              </a>
              <a href="#issue-design" className="rounded-lg border border-[#c9d7e8] bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]">
                2. 이번 호 디자인
              </a>
              <Link href={`/projects/${projectId}/reading`} className="rounded-lg border border-[#c9d7e8] bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]">
                3. 개별 기사 디자인
              </Link>
            </div>
          </section>

          <section id="institution-design" className="scroll-mt-6 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">1. 기관 공통 디자인</p>
              <h2 className="mt-1 text-2xl font-black text-[#092046]">브랜드 기준</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">기관 로고, 브랜드 컬러, 글꼴과 공통 컴포넌트 스타일을 이 발행호의 제작 기준으로 설정합니다.</p>
            </div>
            <ProjectDesignKitForm
              assets={designAssetsData.ok ? designAssetsData.assets.filter((asset) => asset.assetType === "logo") : []}
              assetsMessage={designAssetsData.message}
              designKit={designKitData.designKit}
              fonts={fontData.fonts}
              projectId={projectId}
            />
          </section>

          <section id="issue-design" className="scroll-mt-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">2. 이번 호 디자인</p>
                <h2 className="mt-1 text-2xl font-black text-[#092046]">발행호 디자인 밑작업</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">이번 호의 표지와 여러 기사에 반복 사용할 배경, 장식, 이미지 자산을 준비합니다.</p>
              </div>
              <Link href={`/projects/${projectId}/settings`} className="rounded-lg border border-[#2f73b7] bg-white px-4 py-2.5 text-sm font-black text-[#184a88] transition hover:bg-[#eaf3ff]">
                이번 호 표지 설정
              </Link>
            </div>
            <ProjectDesignIntakeSection
              assets={designAssetsData.ok ? designAssetsData.assets : []}
              initialSourceMode={designKitData.designKit.sourceMode}
              projectId={projectId}
            />
          </section>

          <section className="border-t border-[#c9d7e8] pt-6">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">3. 개별 기사 디자인</p>
            <h2 className="mt-1 text-2xl font-black text-[#092046]">기사별 배치와 예외 조정</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">기사 제작 화면의 디자인 조정에서 배경, 장식, 이미지 배치와 위치·회전·크기·투명도·레이어를 기사별로 조정합니다.</p>
            <Link href={`/projects/${projectId}/reading`} className="mt-4 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md">
              기사 선택 후 디자인 조정
            </Link>
          </section>
        </div>
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
