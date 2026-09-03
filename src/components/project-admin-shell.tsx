import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { canAccessProject, hasProjectUnlock, requireAppUser } from "@/lib/app-auth";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

type ProjectSection = "pages" | "reading" | "assets" | "audio" | "publish" | "distribution" | "survey";

const projectNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string }> = [
  { key: "pages", label: "원본 자료", path: "pages", guide: "PDF·지면" },
  { key: "reading", label: "모바일 페이지 작성", path: "reading", guide: "페이지·섹션" },
  { key: "assets", label: "소재 보관함", path: "assets", guide: "이미지·링크" },
  { key: "audio", label: "음성·대본", path: "audio", guide: "MP3·검수" },
  { key: "publish", label: "검수·발행", path: "publish", guide: "URL·QR" },
  { key: "distribution", label: "배포 운영", path: "distribution", guide: "대상·발송" },
  { key: "survey", label: "설문·이벤트", path: "survey", guide: "참여·응답" },
];

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
            className="mt-6 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78]"
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
              <Link
                href="/projects/edit"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
              >
                작성/수정 목록
              </Link>
              {actions}
            </div>
          </header>

          <nav className="mb-7 rounded-lg border border-slate-200 bg-white p-3 shadow-sm" aria-label="프로젝트 작업 흐름">
            <div className="mb-3 flex flex-col gap-1 px-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">작업 흐름</p>
                <h3 className="text-base font-bold text-[#092046]">현재 프로젝트 제작 단계</h3>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                순서대로 진행하되, 필요한 단계는 언제든 다시 열 수 있습니다.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
              {projectNavigation.map((item, index) => {
                const isActive = active === item.key;
                const href = `/projects/${projectId}/${item.path}`;
                const className = `rounded-lg border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-[#092046] bg-[#092046] text-white shadow-sm shadow-blue-950/20"
                    : "border-slate-200 bg-[#f8fbff] text-[#092046] hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                }`;

                return (
                  <Link key={item.key} href={href} className={className}>
                    <span
                      className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        isActive ? "bg-white text-[#092046]" : "bg-[#dfeaff] text-[#184a88]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className={`mt-1 block text-xs font-semibold ${isActive ? "text-sky-100" : "text-slate-500"}`}>
                      {item.guide}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {children}
        </section>
      </div>
    </main>
  );
}
