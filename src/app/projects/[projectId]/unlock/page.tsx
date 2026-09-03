import Link from "next/link";
import { redirect } from "next/navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { ProjectUnlockForm } from "@/components/project-unlock-form";
import { canAccessProject, getSafeNextPath, hasProjectUnlock, requireAppUser } from "@/lib/app-auth";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

export default async function ProjectUnlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { projectId } = await params;
  const { next } = await searchParams;
  const nextPath = getSafeNextPath(next) || `/projects/${projectId}/pages`;
  const user = await requireAppUser(`/projects/${projectId}/unlock`);
  const workspace = await getProjectWorkspace(projectId);
  const project = workspace.project;

  if (!project) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf4fb] px-5 text-slate-950">
        <section className="w-full max-w-[440px] rounded-2xl border border-rose-200 bg-white px-6 py-10 text-center shadow-xl shadow-blue-950/10">
          <p className="text-sm font-black text-[#184a88]">프로젝트 확인</p>
          <h1 className="mt-3 text-2xl font-black text-[#092046]">프로젝트를 찾지 못했습니다.</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{workspace.message}</p>
          <Link
            href="/projects/edit"
            className="mt-6 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78]"
          >
            작업 목록으로 이동
          </Link>
        </section>
      </main>
    );
  }

  if (!canAccessProject(user, project)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf4fb] px-5 text-slate-950">
        <section className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xl shadow-blue-950/10">
          <p className="text-sm font-black text-[#184a88]">접근 권한 확인</p>
          <h1 className="mt-3 text-2xl font-black text-[#092046]">이 프로젝트를 열 수 없습니다.</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
            일반 사용자는 본인이 작업자로 지정된 프로젝트만 열 수 있습니다.
          </p>
          <Link
            href="/projects/edit"
            className="mt-6 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78]"
          >
            작업 목록으로 이동
          </Link>
        </section>
      </main>
    );
  }

  if (user.role === "admin" || !project.hasProjectPassword || (await hasProjectUnlock(user, project.slug))) {
    redirect(nextPath);
  }

  return (
    <main className="min-h-screen bg-[#071f46] text-slate-950">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
        <div className="relative hidden overflow-hidden bg-[#071f46] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(77,151,226,0.45),transparent_30%),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.16),transparent_24%),linear-gradient(135deg,#071f46_0%,#0b326d_58%,#092046_100%)]" />
          <div className="absolute inset-x-12 top-20 rounded-2xl border border-white/15 bg-white/10 p-8 text-white shadow-2xl shadow-blue-950/30 backdrop-blur">
            <DatadictionBrand theme="light" />
            <h1 className="mt-10 max-w-xl text-5xl font-black leading-tight [word-break:keep-all]">
              프로젝트 비밀번호 확인
            </h1>
            <p className="mt-5 max-w-lg text-base font-semibold leading-8 text-slate-200 [word-break:keep-all]">
              로그인한 사용자에게 배정된 프로젝트라도, 프로젝트별 비밀번호가 설정된 경우 한 번 더 확인합니다.
            </p>
          </div>
        </div>

        <div className="grid place-items-center bg-[#edf4fb] px-5 py-10">
          <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-blue-950/10">
            <p className="text-sm font-black text-[#184a88]">{project.organization}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#092046] [word-break:keep-all]">{project.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
              이 프로젝트에 설정된 비밀번호를 입력하면 작업 화면으로 이동합니다.
            </p>
            <div className="mt-7">
              <ProjectUnlockForm projectSlug={project.slug} nextPath={nextPath} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
