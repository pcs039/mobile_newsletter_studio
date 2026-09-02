import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { ProjectArchiveButton } from "@/components/project-archive-button";
import { StatusPill } from "@/components/status-pill";
import { getEditableProjects } from "@/lib/newsletter-repository";

const editSteps = [
  { label: "원본 자료", path: "pages", detail: "PDF와 지면 이미지" },
  { label: "모바일 페이지 작성", path: "reading", detail: "페이지, 섹션, 블록" },
  { label: "소재 보관함", path: "assets", detail: "이미지와 링크 소재" },
  { label: "음성·대본", path: "audio", detail: "MP3와 기사 대본" },
];

export default async function EditProjectsPage() {
  const editableData = await getEditableProjects();
  const projects = editableData.projects;

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              작성/수정
              <br />
              작업 관리
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              아직 발행 완료되지 않은 프로젝트만 모아 실제 제작 작업으로 진입합니다.
            </p>
          </div>

          <AdminMainNavigation active="edit" />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">작업 대상 기준</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              제작 중, 검수 중, 비공개 프로젝트를 작성/수정 대상으로 봅니다. 발행 완료 프로젝트는 배포/관리에서 다룹니다.
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">제작 작업 큐</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                작성/수정 프로젝트
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                여러 소식지가 동시에 진행될 때 먼저 작업 대상을 고르고, 각 프로젝트의 세부 작업으로 들어갑니다.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
            >
              + 새 프로젝트 생성
            </Link>
          </header>

          <section className="mb-7 grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">작성/수정 대상</p>
              <strong className="mt-3 block text-3xl font-black text-[#092046]">{projects.length}</strong>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">제작 중</p>
              <strong className="mt-3 block text-3xl font-black text-[#092046]">
                {projects.filter((project) => project.status === "제작 중").length}
              </strong>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">검수·비공개</p>
              <strong className="mt-3 block text-3xl font-black text-[#092046]">
                {projects.filter((project) => project.status === "검수 중" || project.status === "비공개").length}
              </strong>
            </article>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-bold text-[#092046]">작업 대상 목록</h3>
              <p className="mt-1 text-sm text-slate-500">{editableData.message}</p>
            </div>

            <div className="divide-y divide-slate-200">
              {projects.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-bold text-[#092046]">작성/수정할 프로젝트가 없습니다.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    새 프로젝트를 만들거나 Supabase 연결 상태를 확인하세요.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Link
                      href="/projects/new"
                      className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
                    >
                      + 새 프로젝트 생성
                    </Link>
                    <Link
                      href="/api/supabase/health"
                      className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-bold text-[#092046] transition hover:bg-[#eaf3ff]"
                    >
                      Supabase 상태 확인
                    </Link>
                  </div>
                </div>
              )}

              {projects.map((project) => (
                <article key={project.id} className="px-5 py-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-black text-[#092046]">{project.title}</h4>
                        <StatusPill value={project.status} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {project.organization} · {project.issue} · {project.slug}
                      </p>
                      <p className="mt-1 text-xs font-black text-[#184a88]">담당: {project.assigneeName}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-[#184a88]">{project.packageTier}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{project.productionMode}</span>
                        <span className="text-slate-500">{project.workload}</span>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {editSteps.map((step) => (
                        <Link
                          key={step.path}
                          href={`/projects/${project.slug}/${step.path}`}
                          className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3 transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                        >
                          <span className="block text-sm font-black text-[#092046]">{step.label}</span>
                          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{step.detail}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={project.actions.editHref}
                      className="inline-flex h-9 items-center justify-center rounded-md bg-[#092046] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#123a78]"
                    >
                      작성/수정 열기
                    </Link>
                    <Link
                      href={project.actions.previewHref}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-bold text-[#092046] transition hover:border-[#184a88] hover:bg-[#eaf2ff]"
                    >
                      미리보기
                    </Link>
                    <ProjectArchiveButton projectId={project.id} projectTitle={project.title} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
