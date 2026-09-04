import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { canAccessProject, hasProjectUnlock, requireAppUser } from "@/lib/app-auth";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

type ProjectSection = "settings" | "pages" | "reading" | "assets" | "audio" | "publish" | "distribution" | "survey";

const authoringNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string }> = [
  { key: "settings", label: "기본 정보", path: "settings", guide: "기준·권한" },
  { key: "reading", label: "콘텐츠 블록 제작", path: "reading", guide: "문단·이미지·URL" },
  { key: "pages", label: "이미지 페이지·URL 태깅", path: "pages", guide: "이미지·클릭" },
  { key: "assets", label: "소재 관리", path: "assets", guide: "이미지·URL·유튜브" },
  { key: "audio", label: "음성·대본", path: "audio", guide: "MP3·검수" },
];

const operationNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string }> = [
  { key: "publish", label: "검수·발행", path: "publish", guide: "URL·QR" },
  { key: "distribution", label: "배포 운영", path: "distribution", guide: "대상·발송" },
  { key: "survey", label: "설문·이벤트", path: "survey", guide: "참여·응답" },
];

const processStages: Array<{
  label: string;
  detail: string;
  path: ProjectSection;
  sections: ProjectSection[];
}> = [
  {
    label: "작성",
    detail: "자료 등록과 콘텐츠 입력",
    path: "reading",
    sections: ["settings", "pages", "reading", "assets", "audio"],
  },
  { label: "검수", detail: "모바일 미리보기와 수정", path: "publish", sections: ["publish"] },
  { label: "발행", detail: "공개 URL, QR, 배포 운영", path: "distribution", sections: ["distribution", "survey"] },
];

function getProcessStageIndex(active: ProjectSection) {
  const activeIndex = processStages.findIndex((stage) => stage.sections.includes(active));

  return activeIndex >= 0 ? activeIndex : 0;
}

export async function ProjectAdminShell({
  active,
  actions,
  children,
  description,
  projectId,
  sidebarDescription,
  sidebarNote,
  sidebarNoteTitle,
  sidebarTitle,
  title,
}: {
  active: ProjectSection;
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  projectId: string;
  sidebarDescription: string;
  sidebarNote: string;
  sidebarNoteTitle: string;
  sidebarTitle: ReactNode;
  title: string;
}) {
  const user = await requireAppUser(`/projects/${projectId}/${active}`);
  const workspace = await getProjectWorkspace(projectId);
  const project = workspace.project;

  if (project && !canAccessProject(user, project)) {
    return (
      <main className="admin-workspace grid min-h-screen place-items-center bg-[#f3f7fc] px-5 text-slate-950">
        <section className="w-full max-w-[520px] rounded-lg border border-slate-200 bg-white px-6 py-10 text-center shadow-xl shadow-blue-950/10">
          <p className="text-sm font-black text-[#184a88]">접근 권한 확인</p>
          <h1 className="mt-3 text-2xl font-black leading-tight text-[#092046]">이 프로젝트를 열 수 없습니다.</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
            일반 사용자는 본인이 작업자로 지정된 프로젝트만 열 수 있습니다. 관리자에게 권한을 확인해 주세요.
          </p>
          <Link
            href="/projects/edit"
            className="mt-6 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
          >
            작업 목록으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  if (project && user.role !== "admin" && project.hasProjectPassword && !(await hasProjectUnlock(user, project.slug))) {
    redirect(`/projects/${project.slug}/unlock?next=${encodeURIComponent(`/projects/${project.slug}/${active}`)}`);
  }

  const projectEyebrow = project
    ? `${project.organization} · ${project.issue}`
    : "프로젝트 정보 확인 필요";
  const projectTitle = project ? project.title : title;
  const projectMeta = project
    ? `담당: ${project.assigneeName} · ${project.status} · ${project.pageCount}쪽`
    : workspace.message;
  const processStageActiveIndex = getProcessStageIndex(active);

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">{sidebarTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{sidebarDescription}</p>
          </div>

          <AdminMainNavigation
            active={
              active === "publish" ? "publish" : active === "distribution" ? "distribution" : active === "survey" ? "survey" : "edit"
            }
            projectId={projectId}
          />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">{sidebarNoteTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{sidebarNote}</p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-5 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#184a88]">{projectEyebrow}</p>
              <h2 className="mt-1 text-3xl font-black leading-tight tracking-tight text-[#092046] [word-break:keep-all]">
                {projectTitle}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">
                  현재 화면: {title}
                </span>
                <span className="text-xs font-semibold text-slate-500">{projectMeta}</span>
              </div>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 [word-break:keep-all]">{description}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <HomeButton />
              <Link
                href="/projects/edit"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-black text-[#092046] shadow-sm shadow-blue-950/10 transition hover:-translate-y-0.5 hover:border-[#2f73b7] hover:bg-[#eaf3ff] hover:shadow-md"
              >
                작성/수정 목록
              </Link>
              {actions}
            </div>
          </header>

          <section className="mb-7 rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">제작 흐름</p>
                <h3 className="mt-1 text-lg font-black text-[#092046]">작성하고, 검수한 뒤, 발행합니다.</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                  세부 작업은 아래 하위 메뉴에서 고르고, 확인은 모바일 미리보기에서 바로 합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/newsletters/${projectId}?preview=admin`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[#2f73b7] bg-white px-4 py-2.5 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                >
                  모바일 미리보기
                </Link>
                <Link
                  href={`/projects/${projectId}/publish`}
                  className="rounded-lg bg-[#092046] px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:bg-[#123a78]"
                >
                  발행 준비
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {processStages.map((stage, index) => {
                const isActive = index === processStageActiveIndex;
                const isDone = index < processStageActiveIndex;

                return (
                  <Link
                    key={stage.label}
                    href={`/projects/${projectId}/${stage.path}`}
                    className={`rounded-lg border px-3 py-3 transition hover:-translate-y-0.5 hover:shadow-sm ${
                      isActive
                        ? "border-[#092046] bg-[#092046] text-white shadow-sm shadow-blue-950/20"
                        : isDone
                          ? "border-[#b8d7ff] bg-white text-[#092046] hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                          : "border-slate-200 bg-white text-[#092046] hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        isActive
                          ? "bg-white text-[#092046]"
                          : isDone
                            ? "bg-[#184a88] text-white"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="mt-2 block text-sm font-black">{stage.label}</span>
                    <span className={`mt-1 block text-xs font-semibold ${isActive ? "text-sky-100" : "text-slate-500"}`}>
                      {stage.detail}
                    </span>
                  </Link>
                );
              })}
            </div>

            <nav
              className="mt-4 grid gap-3 border-t border-[#d8e8ff] pt-4 xl:grid-cols-[minmax(0,1fr)_auto]"
              aria-label="프로젝트 하위 작업"
            >
              <div>
                <p className="mb-2 text-xs font-black text-slate-500">작성 하위 작업</p>
                <div className="flex flex-wrap gap-2">
                  {authoringNavigation.map((item) => {
                    const isActive = active === item.key;

                    return (
                      <Link
                        key={item.key}
                        href={`/projects/${projectId}/${item.path}`}
                        className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                          isActive
                            ? "border-[#092046] bg-[#092046] text-white"
                            : "border-[#d8e8ff] bg-white text-[#092046] hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                        }`}
                      >
                        {item.label}
                        <span className={`ml-1 font-semibold ${isActive ? "text-sky-100" : "text-slate-400"}`}>
                          {item.guide}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-black text-slate-500">운영 하위 작업</p>
                <div className="flex flex-wrap gap-2">
                  {operationNavigation.map((item) => {
                    const isActive = active === item.key;

                    return (
                      <Link
                        key={item.key}
                        href={`/projects/${projectId}/${item.path}`}
                        className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                          isActive
                            ? "border-[#092046] bg-[#092046] text-white"
                            : "border-[#d8e8ff] bg-white text-[#092046] hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>
          </section>

          {children}
        </section>
      </div>
    </main>
  );
}
