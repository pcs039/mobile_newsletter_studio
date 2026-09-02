import Link from "next/link";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

type PublicEbookPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string | string[] }>;
};

export default async function PublicEbookPage({ params, searchParams }: PublicEbookPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const previewMode = resolvedSearchParams?.preview;
  const isAdminPreview = Array.isArray(previewMode) ? previewMode.includes("admin") : previewMode === "admin";
  const workspace = await getProjectWorkspace(slug);
  const project = workspace.project;
  const mobileHref = isAdminPreview ? `/newsletters/${slug}?preview=admin` : project?.publicUrl ?? `/newsletters/${slug}`;

  return (
    <main className="min-h-screen bg-[#eef4fb] text-slate-950">
      {isAdminPreview && (
        <div className="border-b border-slate-300 bg-white px-6 py-3 shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">관리자 미리보기</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-md border border-[#2f73b7] bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              >
                대시보드로 돌아가기
              </Link>
              <Link
                href={`/projects/${slug}/publish`}
                className="rounded-md bg-[#092046] px-3 py-2 text-xs font-black text-white transition hover:bg-[#123a78]"
              >
                발행 관리
              </Link>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <DatadictionBrand compact />
            <div className="border-slate-200 sm:border-l sm:pl-4">
              <p className="text-sm font-semibold text-[#184a88]">
                {project?.organization ?? "프로젝트 정보 확인 필요"}
              </p>
              <h1 className="mt-1 text-2xl font-black text-[#092046]">
                {project ? `${project.title} ${project.issue}` : slug}
              </h1>
              <p className="mt-1 text-sm text-slate-600">PC 화면에서 원본 PDF 지면을 확인하는 e-book 보기입니다.</p>
            </div>
          </div>
          <Link
            href={mobileHref}
            className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
          >
            모바일 읽기 보기
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-6 xl:grid-cols-[260px_1fr_300px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#092046]">목차</h2>
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center">
            <p className="text-sm font-bold text-[#092046]">페이지 이미지 미등록</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              페이지 이미지 저장 연동 후 목차와 지면이 표시됩니다.
            </p>
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#092046]">원본 지면 보기</h2>
              <p className="mt-1 text-sm text-slate-500">등록된 페이지 이미지를 PC 화면에서 확인합니다.</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">이전</button>
              <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">다음</button>
              <button className="rounded-md bg-[#092046] px-3 py-2 text-sm font-bold text-white">확대</button>
            </div>
          </div>

          <div className="rounded-lg bg-[#dfeaf5] p-5">
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
              <p className="text-base font-black text-[#092046]">등록된 e-book 페이지 이미지가 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                PDF·이미지 관리 화면에서 페이지 이미지를 업로드하면 이 영역에 실제 지면을 표시합니다.
              </p>
              {isAdminPreview && (
                <Link
                  href={`/projects/${slug}/pages`}
                  className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
                >
                  페이지 이미지 등록으로 이동
                </Link>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#092046]">보기 기준</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              e-book은 PC 중심 원본 확인 화면입니다. 모바일 독자는 읽기 보기에서 본문과 음성을 이용하는 흐름을 우선합니다.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#092046]">페이지 정보</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">전체 페이지</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{project?.pageCount ?? 0}쪽</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">현재 보기</p>
                <p className="mt-1 text-sm font-bold text-slate-700">페이지 선택 전</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">품질 기준</p>
                <p className="mt-1 text-sm font-bold text-slate-700">등록된 페이지 이미지</p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
