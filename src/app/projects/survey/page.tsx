import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { StatusPill } from "@/components/status-pill";
import { filterProjectsForUser, requireAppUser } from "@/lib/app-auth";
import { getPublishQueueProjects } from "@/lib/newsletter-repository";

function splitDateTime(value: string) {
  const [date, time] = value.split(" ");

  return {
    date: date || "-",
    time: time || "",
  };
}

export default async function SurveyProjectsPage() {
  const user = await requireAppUser("/projects/survey");
  const publishData = await getPublishQueueProjects();
  const projects = filterProjectsForUser(
    publishData.projects.filter((project) => project.status !== "삭제됨"),
    user,
  );
  const publishedProjects = projects.filter((project) => project.status === "발행 완료");
  const activeProjects = projects.filter((project) => project.status !== "발행 완료");

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              설문
              <br />
              이벤트
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300 [word-break:keep-all]">
              공개 소식지와 연결할 만족도 조사, 신청 접수, 참여 이벤트를 프로젝트별로 관리합니다.
            </p>
          </div>

          <AdminMainNavigation active="survey" />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">운영 기준</p>
            <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
              설문은 발행 프로젝트에 연결하는 후속 참여 도구입니다. 제작 중에도 미리 구성하고 공개 후 응답을 받을 수 있습니다.
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">참여 운영 큐</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">설문/이벤트 프로젝트</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
                프로젝트를 선택해 독자 설문, 이벤트 참여, 신청 접수용 문항을 구성합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HomeButton />
              <Link
                href="/projects/distribution"
                className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              >
                배포/관리 목록
              </Link>
            </div>
          </header>

          <section className="mb-7 grid gap-4 sm:grid-cols-3">
            {[
              { label: "전체 프로젝트", value: projects.length, detail: "삭제 제외" },
              { label: "공개 운영", value: publishedProjects.length, detail: "응답 수집 가능" },
              { label: "사전 준비", value: activeProjects.length, detail: "문항 구성" },
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
                <h3 className="text-lg font-bold text-[#092046]">프로젝트별 설문/이벤트 관리</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                  {publishData.message}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                프로젝트 선택
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {projects.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-bold text-[#092046]">설문/이벤트를 연결할 프로젝트가 없습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                    새 프로젝트 기본 정보를 입력한 뒤 이 화면에서 참여 기능을 구성하세요.
                  </p>
                  <Link
                    href="/projects/new"
                    className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
                  >
                    새 프로젝트 기본 정보 입력
                  </Link>
                </div>
              ) : (
                projects.map((project) => {
                  const updated = splitDateTime(project.updated);

                  return (
                    <article key={project.id} className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_150px_260px] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black text-[#092046] [word-break:keep-all]">{project.title}</h4>
                          <StatusPill value={project.status} />
                          <StatusPill value={project.packageTier} />
                        </div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
                          {project.organization} · {project.issue} · 담당: {project.assigneeName}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
                          모바일 공개 화면에 붙일 설문, 이벤트, 신청 접수 문항을 관리합니다.
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                        <p className="text-xs font-bold text-slate-500">최근 수정</p>
                        <p className="mt-1 whitespace-nowrap text-sm font-black text-[#092046]">{updated.date}</p>
                        <p className="whitespace-nowrap text-xs font-black text-[#184a88]">{updated.time}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/projects/${project.slug}/survey`}
                          className="inline-flex h-11 items-center justify-center rounded-md bg-[#092046] px-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                        >
                          설문 관리
                        </Link>
                        <Link
                          href={`/newsletters/${project.slug}?preview=admin`}
                          className="inline-flex h-11 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                        >
                          모바일 보기
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
