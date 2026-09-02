import Link from "next/link";
import type { ReactNode } from "react";
import { DatadictionBrand } from "@/components/datadiction-brand";

type ProjectSection = "pages" | "reading" | "assets" | "audio" | "publish";

const projectPath = "/projects/muan-2025-94";

const projectNavigation: Array<{ key: ProjectSection; label: string; href: string }> = [
  { key: "pages", label: "PDF·이미지", href: `${projectPath}/pages` },
  { key: "reading", label: "읽기 보기 편집", href: `${projectPath}/reading` },
  { key: "assets", label: "이미지 자산", href: `${projectPath}/assets` },
  { key: "audio", label: "음성 MP3", href: `${projectPath}/audio` },
  { key: "publish", label: "미리보기·발행", href: `${projectPath}/publish` },
];

function SidebarItem({
  active,
  children,
  href,
}: {
  active?: boolean;
  children: ReactNode;
  href: string;
}) {
  const className = active
    ? "flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm font-semibold text-[#071f46] shadow-lg shadow-blue-950/20"
    : "flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10";

  if (active) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function ProjectAdminShell({
  active,
  actions,
  children,
  description,
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
  sidebarDescription: string;
  sidebarNote: string;
  sidebarNoteTitle: string;
  sidebarTitle: ReactNode;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">{sidebarTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{sidebarDescription}</p>
          </div>

          <nav className="space-y-2">
            <SidebarItem href="/">프로젝트 대시보드</SidebarItem>
            <SidebarItem href="/projects/new">새 소식지 생성</SidebarItem>
            {projectNavigation.map((item) => (
              <SidebarItem key={item.key} href={item.href} active={active === item.key}>
                {item.label}
              </SidebarItem>
            ))}
          </nav>

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">{sidebarNoteTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{sidebarNote}</p>
          </div>
        </aside>

        <section className="px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">황토골 무안소식지 2025년 제94호</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>
            {actions}
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
