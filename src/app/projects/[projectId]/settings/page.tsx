import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectCreateForm } from "@/components/project-create-form";
import { getProjectBasicInfo } from "@/lib/newsletter-repository";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const basicInfoData = await getProjectBasicInfo(projectId);

  return (
    <ProjectAdminShell
      active="settings"
      projectId={projectId}
      title="기본 정보"
      description="기관명, 발행월, 담당자, 공개 주소처럼 제작 기준이 되는 정보를 확인하고 수정합니다."
      sidebarTitle={
        <>
          기본 정보
        </>
      }
      sidebarDescription="작업을 시작하기 전 기관명, 발행 표기, 담당자, 제작 방식을 먼저 확인합니다."
      sidebarNoteTitle="수정 기준"
      sidebarNote="공개 주소 slug를 바꾸면 모바일 보기와 PC e-book의 공개 URL도 함께 바뀝니다."
      actions={
        <Link
          href={`/projects/${projectId}/pages`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          이미지 페이지 편집
        </Link>
      }
    >
      {basicInfoData.project ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <ProjectCreateForm mode="edit" initialValues={basicInfoData.project} />

          <aside className="space-y-5">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">수정 가능 항목</p>
              <h3 className="mt-1 text-lg font-bold text-[#092046]">프로젝트 기준 정보</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>기관 사정에 따라 발행일과 발행 표기를 수정할 수 있습니다.</li>
                <li>작업자명이 바뀌면 대시보드와 프로젝트 작업 화면에 바로 반영됩니다.</li>
                <li>slug를 바꾸면 공개 URL도 바뀌므로 외부 공유 전후를 확인해야 합니다.</li>
                <li>상품 옵션과 제작 방식은 견적 또는 제작 범위가 바뀔 때 조정합니다.</li>
              </ul>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#092046]">저장 후 이동</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                수정 내용을 저장하면 선택한 제작 방식에 맞는 작성 화면으로 이동합니다. 이후 기사 작성/편집,
                이미지 페이지 편집, 사진·이미지 관리 작업을 순서대로 진행하면 됩니다.
              </p>
            </article>
          </aside>
        </div>
      ) : (
        <article className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <h3 className="text-lg font-black">프로젝트를 찾지 못했습니다.</h3>
          <p className="mt-2 text-sm leading-6">{basicInfoData.message}</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
          >
            처음 화면
          </Link>
        </article>
      )}
    </ProjectAdminShell>
  );
}
