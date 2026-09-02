import Link from "next/link";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { getProjectWorkspace } from "@/lib/newsletter-repository";

type PublicNewsletterPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string | string[] }>;
};

export default async function PublicNewsletterPage({ params, searchParams }: PublicNewsletterPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const previewMode = resolvedSearchParams?.preview;
  const isAdminPreview = Array.isArray(previewMode) ? previewMode.includes("admin") : previewMode === "admin";
  const workspace = await getProjectWorkspace(slug);
  const project = workspace.project;
  const ebookHref = isAdminPreview ? `/newsletters/${slug}/ebook?preview=admin` : project?.ebookUrl ?? `/newsletters/${slug}/ebook`;

  return (
    <main className="min-h-screen bg-[#edf4fb] text-slate-950">
      {isAdminPreview && (
        <div className="sticky top-0 z-20 border-b border-slate-300 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[520px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
      <section className="mx-auto min-h-screen max-w-[520px] bg-white shadow-xl shadow-blue-950/10">
        <header className="bg-[#071f46] px-5 pb-7 pt-6 text-white">
          <div className="mb-6">
            <DatadictionBrand compact theme="light" />
          </div>
          <p className="text-sm font-semibold text-sky-200">
            {project?.organization ?? "프로젝트 정보 확인 필요"}
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight">{project?.title ?? slug}</h1>
          <p className="mt-2 text-lg font-bold text-white/95">{project?.issue ?? "-"}</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">{project?.description ?? workspace.message}</p>
          <div className="mt-5 flex gap-2">
            <Link
              href={ebookHref}
              className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046]"
            >
              PC e-book 보기
            </Link>
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-slate-200">
              모바일 읽기 보기
            </span>
          </div>
        </header>

        <section className="px-5 py-5">
          <div className="rounded-2xl bg-gradient-to-br from-sky-100 to-blue-50 p-5">
            <div className="min-h-44 rounded-xl border border-white/70 bg-white/50 p-4">
              <p className="text-sm font-black text-[#092046]">대표 이미지 영역</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                기관 제공 원본 이미지나 디자이너 제작 배너를 연결해 공개 화면 첫 인상을 구성합니다.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm font-black text-[#092046]">모바일 읽기 콘텐츠가 아직 등록되지 않았습니다.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              작성/수정 화면에서 기사, 링크, 이미지, 음성을 저장하면 이 공개 화면에 표시됩니다.
            </p>
          </div>
        </section>

        <section className="px-5 pb-8">
          {isAdminPreview && (
            <Link
              href={`/projects/${slug}/reading`}
              className="block rounded-lg bg-[#092046] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
            >
              읽기 보기 작성/수정으로 이동
            </Link>
          )}
        </section>

        <footer className="border-t border-slate-200 px-5 py-5 text-center">
          <p className="text-xs font-semibold text-slate-500">
            제작·운영 DataDiction Newsletter Studio
          </p>
        </footer>
      </section>
    </main>
  );
}
