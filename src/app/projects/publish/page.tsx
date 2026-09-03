import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { StatusPill } from "@/components/status-pill";
import { getDashboardProjects } from "@/lib/newsletter-repository";

function getPublishLabel(status: string) {
  if (status === "발행 완료") {
    return "발행됨";
  }

  if (status === "검수 중") {
    return "검수 대상";
  }

  return "발행 준비 전";
}

export default async function PublishProjectsPage() {
  const dashboardData = await getDashboardProjects();
  const projects = dashboardData.projects.filter((project) => project.status !== "삭제됨");
  const reviewTargets = projects.filter((project) => project.status === "검수 중" || project.status === "비공개");
  const publishedProjects = projects.filter((project) => project.status === "발행 완료");

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              미리보기
              <br />
              발행 관리
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              프로젝트를 먼저 선택한 뒤 모바일 보기, PC e-book, 공개 URL, QR 상태를 확인합니다.
            </p>
          </div>

          <AdminMainNavigation active="publish" />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">검수 기준</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              작성 화면에서 저장한 기사와 업로드 자료를 기준으로 공개 전 상태를 점검합니다.
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">발행 검수 큐</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                미리보기/발행 프로젝트
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                특정 프로젝트 하나가 아니라, 발행 검수와 공개 확인이 필요한 프로젝트를 목록에서 선택합니다.
              </p>
            </div>
            <Link
              href="/projects/edit"
              className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
            >
              작성/수정 목록 보기
            </Link>
          </header>

          <section className="mb-7 grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">발행 검수 대상</p>
              <strong className="mt-3 block text-3xl font-black text-[#092046]">{reviewTargets.length}</strong>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">전체 활성 프로젝트</p>
              <strong className="mt-3 block text-3xl font-black text-[#092046]">{projects.length}</strong>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">발행 완료</p>
              <strong className="mt-3 block text-3xl font-black text-[#092046]">{publishedProjects.length}</strong>
            </article>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-bold text-[#092046]">프로젝트별 미리보기/발행</h3>
              <p className="mt-1 text-sm text-slate-500">{dashboardData.message}</p>
            </div>

            <div className="divide-y divide-slate-200">
              {projects.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-bold text-[#092046]">미리보기/발행할 프로젝트가 없습니다.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    새 프로젝트를 만들고 작성/수정 단계에서 콘텐츠를 저장하면 이 목록에 표시됩니다.
                  </p>
                  <Link
                    href="/projects/new"
                    className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
                  >
                    + 새 프로젝트 생성
                  </Link>
                </div>
              )}

              {projects.map((project) => (
                <article key={project.id} className="px-5 py-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_500px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-black text-[#092046]">{project.title}</h4>
                        <StatusPill value={project.status} />
                        <StatusPill value={getPublishLabel(project.status)} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {project.organization} · {project.issue} · {project.slug}
                      </p>
                      <p className="mt-1 text-xs font-black text-[#184a88]">담당: {project.assigneeName}</p>
                      <div className="mt-3 grid gap-2 text-xs font-bold sm:grid-cols-3">
                        <span className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[#184a88]">페이지 {project.pages}</span>
                        <span className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[#184a88]">읽기 {project.reading}</span>
                        <span className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[#184a88]">오늘 {project.views.today}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Link
                        href={`/projects/${project.slug}/publish`}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-[#092046] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#123a78]"
                      >
                        검수·발행 열기
                      </Link>
                      <Link
                        href={project.actions.previewHref}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-4 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                      >
                        모바일 보기
                      </Link>
                      <Link
                        href={`/newsletters/${project.slug}/ebook?preview=admin`}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
                      >
                        PC e-book 보기
                      </Link>
                      <Link
                        href={`/projects/${project.slug}/reading`}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
                      >
                        작성/수정
                      </Link>
                    </div>
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
