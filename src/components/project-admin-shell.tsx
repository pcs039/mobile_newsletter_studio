import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { canAccessProject, hasProjectUnlock, requireAppUser } from "@/lib/app-auth";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

type ProjectSection = "settings" | "pages" | "reading" | "assets" | "audio" | "publish" | "distribution" | "survey";
type ProjectModule = "newsletter" | "ebook" | "engagement" | "common";

const contentToolNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string; module: ProjectModule }> = [
  { key: "reading", label: "모바일 소식지", path: "reading", guide: "기사·문단·URL", module: "newsletter" },
  { key: "pages", label: "eBook", path: "pages", guide: "페이지·클릭 영역", module: "ebook" },
  { key: "assets", label: "자산 관리", path: "assets", guide: "이미지·유튜브 소재", module: "common" },
  { key: "audio", label: "음성 관리", path: "audio", guide: "음성 파일·대본", module: "newsletter" },
];

const operationNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string; module: ProjectModule }> = [
  { key: "publish", label: "검수·발행", path: "publish", guide: "최종 확인·공개 URL", module: "common" },
  { key: "distribution", label: "배포 관리", path: "distribution", guide: "배포 기록", module: "common" },
  { key: "survey", label: "참여 콘텐츠", path: "survey", guide: "설문·이벤트", module: "engagement" },
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
    detail: "기사·이미지·음성",
    path: "reading",
    sections: ["reading", "pages", "assets", "audio"],
  },
  {
    label: "검수·발행",
    detail: "화면·URL·QR",
    path: "publish",
    sections: ["publish"],
  },
  {
    label: "배포 관리",
    detail: "기록·공유 문안",
    path: "distribution",
    sections: ["distribution", "survey"],
  },
];

const nextSteps: Partial<Record<ProjectSection, { label: string; path: ProjectSection; detail: string }>> = {
  settings: { label: "콘텐츠 제작", path: "reading", detail: "기사와 이미지 작업으로 이동합니다." },
  reading: { label: "검수·발행", path: "publish", detail: "공개 전 상태를 확인합니다." },
  pages: { label: "검수·발행", path: "publish", detail: "페이지 이미지 상태를 확인합니다." },
  assets: { label: "검수·발행", path: "publish", detail: "소재 상태를 확인합니다." },
  audio: { label: "검수·발행", path: "publish", detail: "음성 상태를 확인합니다." },
  publish: { label: "배포 관리", path: "distribution", detail: "배포 기록을 남깁니다." },
};

function isNavigationItemVisible(module: ProjectModule, capabilities: { hasNewsletter: boolean; hasEbook: boolean; hasEngagement: boolean }) {
  if (module === "common") {
    return true;
  }

  if (module === "newsletter") {
    return capabilities.hasNewsletter;
  }

  if (module === "ebook") {
    return capabilities.hasEbook;
  }

  return capabilities.hasEngagement;
}

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
    ? `유형: ${project.projectTypeLabel} · 담당: ${project.assigneeName} · ${project.status} · ${project.pageCount}쪽`
    : workspace.message;
  const workflowStageActiveIndex = getWorkflowStageIndex(active);
  const capabilities = project?.capabilities ?? { hasNewsletter: true, hasEbook: true, hasEngagement: true };
  const nextStep =
    active === "settings" && !capabilities.hasNewsletter && capabilities.hasEbook
      ? { label: "eBook", path: "pages" as const, detail: "페이지 이미지 작업으로 이동합니다." }
      : active === "settings" && !capabilities.hasNewsletter && capabilities.hasEngagement
        ? { label: "참여 콘텐츠", path: "survey" as const, detail: "설문·이벤트 구성으로 이동합니다." }
        : nextSteps[active];
  const visibleContentToolNavigation = contentToolNavigation.filter(
    (item) => isNavigationItemVisible(item.module, capabilities) || item.key === active,
  );
  const visibleOperationNavigation = operationNavigation.filter(
    (item) => isNavigationItemVisible(item.module, capabilities) || item.key === active,
  );
  const isContentToolActive = visibleContentToolNavigation.some((item) => item.key === active);
  const isOperationToolActive = visibleOperationNavigation.some((item) => item.key === active);

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
            <p className="mt-2 text-xs leading-5 text-slate-300">{sidebarNote}</p>
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
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500 [word-break:keep-all]">{description}</p>
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
                <h3 className="mt-1 text-lg font-black text-[#092046]">
                  {project?.projectTypeLabel ?? "통합 프로젝트"} 제작 흐름
                </h3>
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
              <p className="mt-3 rounded-lg border border-[#d8e8ff] bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-500">
                다음: {nextStep.detail}
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
                  {visibleContentToolNavigation.map((item) => {
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
                  {visibleOperationNavigation.map((item) => {
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
