import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { canAccessProject, hasProjectUnlock, requireAppUser } from "@/lib/app-auth";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

type ProjectSection = "settings" | "pages" | "reading" | "assets" | "audio" | "publish" | "distribution" | "survey";

const contentToolNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string }> = [
  { key: "reading", label: "기사 작성/편집", path: "reading", guide: "문단·이미지·URL 버튼" },
  { key: "pages", label: "이미지 페이지 편집", path: "pages", guide: "이미지·클릭 영역" },
  { key: "assets", label: "사진·이미지 관리", path: "assets", guide: "이미지·URL·유튜브 소재" },
  { key: "audio", label: "음성 소식지 검수", path: "audio", guide: "MP3·대본 확인" },
];

const operationNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string }> = [
  { key: "publish", label: "검수·발행", path: "publish", guide: "최종 확인·공개 URL" },
  { key: "distribution", label: "배포 관리", path: "distribution", guide: "배포 기록" },
  { key: "survey", label: "설문·이벤트", path: "survey", guide: "참여·응답" },
];

const workflowStages: Array<{
  label: string;
  detail: string;
  path: ProjectSection;
  sections: ProjectSection[];
}> = [
  {
    label: "기본정보",
    detail: "기관·발행월·담당자 확인",
    path: "settings",
    sections: ["settings"],
  },
  {
    label: "콘텐츠 제작",
    detail: "기사·이미지·URL·음성 대본 작성",
    path: "reading",
    sections: ["reading", "pages", "assets", "audio"],
  },
  {
    label: "검수·발행",
    detail: "모바일·e-book·음성·URL·QR 확인",
    path: "publish",
    sections: ["publish"],
  },
  {
    label: "배포 관리",
    detail: "배포 기록·공유 문안 관리",
    path: "distribution",
    sections: ["distribution", "survey"],
  },
];

const nextSteps: Partial<Record<ProjectSection, { label: string; path: ProjectSection; detail: string }>> = {
  settings: { label: "콘텐츠 제작", path: "reading", detail: "기사, 이미지, URL, 음성 대본을 작성합니다." },
  reading: { label: "검수·발행", path: "publish", detail: "모바일 화면, e-book, 음성, 공개 URL, QR을 최종 확인합니다." },
  pages: { label: "검수·발행", path: "publish", detail: "이미지와 클릭 영역을 확인한 뒤 최종 검수 화면으로 이동합니다." },
  assets: { label: "검수·발행", path: "publish", detail: "사진·이미지 소재를 확인한 뒤 최종 검수 화면으로 이동합니다." },
  audio: { label: "검수·발행", path: "publish", detail: "음성 파일과 대본을 확인한 뒤 최종 검수 화면으로 이동합니다." },
  publish: { label: "배포 관리", path: "distribution", detail: "공개 URL과 QR을 어디에 배포했는지 기록합니다." },
};

function getWorkflowStageIndex(active: ProjectSection) {
  const activeIndex = workflowStages.findIndex((stage) => stage.sections.includes(active));

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
            className="dd-btn dd-btn-primary dd-btn-lg mt-6 text-sm"
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
  const workflowStageActiveIndex = getWorkflowStageIndex(active);
  const nextStep = nextSteps[active];
  const isContentToolActive = contentToolNavigation.some((item) => item.key === active);
  const isOperationToolActive = operationNavigation.some((item) => item.key === active);

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
                className="dd-btn dd-btn-secondary dd-btn-lg border-slate-300 text-sm"
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
                <h3 className="mt-1 text-lg font-black text-[#092046]">기본정보 → 콘텐츠 제작 → 검수·발행 → 배포 관리</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                  이미지 페이지, 사진·이미지, 음성은 콘텐츠 제작 안의 하위 도구로 정리했습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/newsletters/${projectId}?preview=admin`}
                  target="_blank"
                  rel="noreferrer"
                  className="dd-btn dd-btn-secondary px-4 py-2.5 text-sm"
                >
                  모바일 미리보기
                </Link>
                {nextStep ? (
                  <Link
                    href={`/projects/${projectId}/${nextStep.path}`}
                    className="dd-btn dd-btn-primary px-4 py-2.5 text-sm"
                  >
                    다음 단계: {nextStep.label}
                  </Link>
                ) : null}
              </div>
            </div>

            {nextStep ? (
              <p className="mt-3 rounded-lg border border-[#d8e8ff] bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                다음 단계 안내: {nextStep.detail}
              </p>
            ) : null}

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {workflowStages.map((stage, index) => {
                const isActive = index === workflowStageActiveIndex;
                const isDone = index < workflowStageActiveIndex;

                return (
                  <Link
                    key={stage.label}
                    href={`/projects/${projectId}/${stage.path}`}
                    className={`dd-btn flex-col !items-start !justify-start rounded-lg border px-3 py-3 text-left ${
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
              className="mt-4 grid gap-3 border-t border-[#d8e8ff] pt-4 xl:grid-cols-2"
              aria-label="프로젝트 하위 작업"
            >
              <details open={active === "settings" || isContentToolActive} className="rounded-lg border border-[#d8e8ff] bg-white px-3 py-3">
                <summary className="cursor-pointer text-xs font-black text-slate-600">콘텐츠 제작 도구</summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contentToolNavigation.map((item) => {
                    const isActive = active === item.key;

                    return (
                      <Link
                        key={item.key}
                        href={`/projects/${projectId}/${item.path}`}
                        className={`dd-btn dd-btn-sm rounded-full border px-3 py-2 text-xs ${
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
              </details>
              <details open={isOperationToolActive} className="rounded-lg border border-[#d8e8ff] bg-white px-3 py-3">
                <summary className="cursor-pointer text-xs font-black text-slate-600">운영 도구</summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {operationNavigation.map((item) => {
                    const isActive = active === item.key;

                    return (
                      <Link
                        key={item.key}
                        href={`/projects/${projectId}/${item.path}`}
                        className={`dd-btn dd-btn-sm rounded-full border px-3 py-2 text-xs ${
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
              </details>
            </nav>
          </section>

          {children}
        </section>
      </div>
    </main>
  );
}
