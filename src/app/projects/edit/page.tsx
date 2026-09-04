import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { HomeButton } from "@/components/home-button";
import { ProjectEditWorkQueue } from "@/components/project-edit-work-queue";
import { filterProjectsForUser, requireAppUser } from "@/lib/app-auth";
import { getEditableProjects } from "@/lib/newsletter-repository";

export default async function EditProjectsPage() {
  const user = await requireAppUser("/projects/edit");
  const editableData = await getEditableProjects();
  const projects = filterProjectsForUser(editableData.projects, user);

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
                여러 소식지가 동시에 진행될 때 먼저 작업 대상을 고르고, 기본 정보·일반형·프리미엄·소재·음성 작업으로 들어갑니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HomeButton />
              <Link
                href="/projects/new"
                className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
              >
                + 새 프로젝트 생성
              </Link>
            </div>
          </header>

          <ProjectEditWorkQueue
            isAdmin={user.role === "admin"}
            message={editableData.message}
            projects={projects}
          />
        </section>
      </div>
    </main>
  );
}
