import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { StatusPill } from "@/components/status-pill";
import { filterProjectsForUser, requireAppUser } from "@/lib/app-auth";
import { getPublishQueueProjects } from "@/lib/newsletter-repository";

function readinessPercent(readyCount: number, totalCount: number) {
  if (totalCount === 0) {
    return 0;
  }

  return Math.round((readyCount / totalCount) * 100);
}

function splitDateTime(value: string) {
  const [date, time] = value.split(" ");

  return {
    date: date || "-",
    time: time || "",
  };
}

export default async function PublishProjectsPage() {
  const user = await requireAppUser("/projects/publish");
  const publishData = await getPublishQueueProjects();
  const projects = filterProjectsForUser(
    publishData.projects.filter((project) => project.status !== "삭제됨"),
    user,
  );
  const readyProjects = projects.filter((project) => project.readiness.readyCount === project.readiness.totalCount);
  const reviewTargets = projects.filter(
    (project) => project.status === "검수 중" || project.readiness.readyCount >= 3,
  );
  const publishedProjects = projects.filter((project) => project.status === "발행 완료");
  const needsWorkProjects = projects.filter(
    (project) => project.readiness.readyCount < project.readiness.totalCount && project.status !== "발행 완료",
  );

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
            <p className="mt-3 text-sm leading-6 text-slate-300 [word-break:keep-all]">
              프로젝트를 먼저 선택한 뒤 모바일 보기, PC e-book, 공개 URL, QR 상태를 확인합니다.
            </p>
          </div>

          <AdminMainNavigation active="publish" />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">검수 기준</p>
            <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
              PDF, 페이지 이미지, 모바일 기사, 연결 링크, 음성·대본을 모두 확인한 뒤 공개합니다.
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
              <p className="mt-2 text-sm text-slate-600 [word-break:keep-all]">
                발행을 앞둔 프로젝트를 목록에서 선택하고, 부족한 작업을 바로 보완합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HomeButton />
              <Link
                href="/projects/edit"
                className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              >
                작성/수정 목록 보기
              </Link>
            </div>
          </header>

          <section className="mb-7 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {[
              { label: "전체 대상", value: projects.length, detail: "삭제 제외" },
              { label: "보완 필요", value: needsWorkProjects.length, detail: "작업 이어가기" },
              { label: "발행 가능", value: readyProjects.length, detail: "최종 검수" },
              { label: "발행 완료", value: publishedProjects.length, detail: "공개 운영" },
            ].map((card) => (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <strong className="text-3xl font-black text-[#092046]">{card.value}</strong>
                  <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                    {card.detail}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#092046]">프로젝트별 발행 준비 상태</h3>
                <p className="mt-1 text-sm text-slate-500 [word-break:keep-all]">{publishData.message}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">검수 대상 {reviewTargets.length}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">실제 저장 데이터 기준</span>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {projects.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-bold text-[#092046]">미리보기/발행할 프로젝트가 없습니다.</p>
                  <p className="mt-2 text-sm text-slate-500 [word-break:keep-all]">
                    새 프로젝트 기본 정보를 입력하고 작성/수정 단계에서 콘텐츠를 저장하면 이 목록에 표시됩니다.
                  </p>
                  <Link
                    href="/projects/new"
                    className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
                  >
                    + 새 프로젝트 기본 정보 입력
                  </Link>
                </div>
              )}

              {projects.map((project) => {
                const percent = readinessPercent(project.readiness.readyCount, project.readiness.totalCount);
                const updated = splitDateTime(project.updated);

                return (
                  <article key={project.id} className="px-5 py-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black text-[#092046]">{project.title}</h4>
                          <StatusPill value={project.status} />
                          <StatusPill value={project.readiness.label} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {project.organization} · {project.issue} · {project.slug}
                        </p>
                        <p className="mt-1 text-xs font-black text-[#184a88]">담당: {project.assigneeName}</p>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
                          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                            <p className="text-xs font-bold text-slate-500">최근 수정</p>
                            <p className="mt-1 text-sm font-black text-[#092046]">{updated.date}</p>
                            <p className="text-xs font-black text-[#184a88]">{updated.time}</p>
                          </div>

                          <div className="min-w-0 rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold text-slate-500">발행 준비율</p>
                              <p className="text-xs font-black text-[#184a88]">
                                {project.readiness.readyCount}/{project.readiness.totalCount}
                              </p>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-[#184a88]" style={{ width: `${percent}%` }} />
                            </div>
                            <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
                              <span className="rounded-md bg-white px-2 py-2">PDF {project.readiness.pdfReady ? "완료" : "대기"}</span>
                              <span className="rounded-md bg-white px-2 py-2">이미지 {project.readiness.pageImageCount}</span>
                              <span className="rounded-md bg-white px-2 py-2">기사 {project.readiness.articleCount}</span>
                              <span className="rounded-md bg-white px-2 py-2">링크 {project.readiness.linkCount}</span>
                              <span className="rounded-md bg-white px-2 py-2">
                                음성 {project.readiness.audioFileCount + project.readiness.audioScriptCount}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center gap-2">
                        <Link
                          href={project.readiness.nextHref}
                          className="inline-flex h-11 items-center justify-center rounded-md bg-[#092046] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                        >
                          {project.readiness.nextAction}
                        </Link>
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href={`/projects/${project.slug}/publish`}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-3 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                          >
                            발행 상세
                          </Link>
                          <Link
                            href={project.actions.previewHref}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-3 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                          >
                            모바일 보기
                          </Link>
                          <Link
                            href={`/newsletters/${project.slug}/ebook?preview=admin`}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
                          >
                            PC e-book
                          </Link>
                          <Link
                            href={`/projects/${project.slug}/reading`}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
                          >
                            작성/수정
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
