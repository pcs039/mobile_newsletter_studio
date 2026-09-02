import Link from "next/link";
import type { ReactNode } from "react";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

type ProjectSection = "pages" | "reading" | "assets" | "audio" | "publish";

const projectNavigation: Array<{ key: ProjectSection; label: string; path: string; guide: string }> = [
  { key: "pages", label: "PDF·이미지", path: "pages", guide: "원본·페이지" },
  { key: "reading", label: "읽기 보기 편집", path: "reading", guide: "기사·본문" },
  { key: "assets", label: "이미지 자산", path: "assets", guide: "대표·배너" },
  { key: "audio", label: "음성 MP3", path: "audio", guide: "파일·대본" },
  { key: "publish", label: "미리보기·발행", path: "publish", guide: "URL·QR" },
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
  const workspace = await getProjectWorkspace(projectId);
  const project = workspace.project;
  const projectEyebrow = project
    ? `${project.organization} · ${project.issue}`
    : "프로젝트 정보 확인 필요";
  const projectDescription = project
    ? `${project.title} · ${project.status} · ${project.pageCount}쪽`
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

          <AdminMainNavigation active={active === "publish" ? "publish" : "edit"} projectId={projectId} />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">{sidebarNoteTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{sidebarNote}</p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">{projectEyebrow}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{projectDescription}</p>
            </div>
            {actions}
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
            <div className="grid gap-2 md:grid-cols-5">
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
