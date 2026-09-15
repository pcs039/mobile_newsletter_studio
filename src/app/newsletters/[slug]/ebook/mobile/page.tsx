import Link from "next/link";
import { NewsletterViewTracker } from "@/components/newsletter-view-tracker";
import { getProjectPageImages, getProjectWorkspace } from "@/lib/newsletter-repository";
import { formatPageLabel, getCustomPageTitle } from "@/lib/page-labels";

type PublicMobileEbookPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ embedded?: string | string[]; page?: string | string[]; preview?: string | string[] }>;
};

function hasSearchParamValue(value: string | string[] | undefined, expectedValue: string) {
  return Array.isArray(value) ? value.includes(expectedValue) : value === expectedValue;
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function makeMobileEbookHref(slug: string, pageNumber: number, isAdminPreview: boolean, isEmbeddedAdminPreview: boolean) {
  const searchParams = new URLSearchParams({ page: String(pageNumber) });

  if (isAdminPreview) {
    searchParams.set("preview", "admin");
  }

  if (isEmbeddedAdminPreview) {
    searchParams.set("embedded", "adminPreview");
  }

  return `/newsletters/${slug}/ebook/mobile?${searchParams.toString()}`;
}

function PublicUnavailablePage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="public-newsletter-screen grid min-h-screen place-items-center bg-[#eef4fb] px-5 text-slate-950">
      <section className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xl shadow-blue-950/10">
        <p className="text-sm font-black text-[#184a88]">DataDiction Newsletter</p>
        <h1 className="mt-3 text-2xl font-black leading-tight text-[#092046]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 [word-break:keep-all]">{message}</p>
      </section>
    </main>
  );
}

export default async function PublicMobileEbookPage({ params, searchParams }: PublicMobileEbookPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const previewMode = resolvedSearchParams?.preview;
  const embeddedMode = resolvedSearchParams?.embedded;
  const pageParam = getSearchParamValue(resolvedSearchParams?.page);
  const isAdminPreview = hasSearchParamValue(previewMode, "admin");
  const isEmbeddedAdminPreview = hasSearchParamValue(embeddedMode, "adminPreview");
  const [workspace, pageImageData] = await Promise.all([getProjectWorkspace(slug), getProjectPageImages(slug)]);
  const project = workspace.project;
  const isPublished = project?.status === "발행 완료";
  const isPubliclyVisible = isAdminPreview || isPublished;

  if (!project) {
    return (
      <PublicUnavailablePage
        title="모바일 e-book을 찾지 못했습니다."
        message="프로젝트 주소가 변경됐거나 아직 공개 준비가 끝나지 않았습니다."
      />
    );
  }

  if (!isPubliclyVisible) {
    return (
      <PublicUnavailablePage
        title="아직 공개 전입니다."
        message="이 모바일 e-book은 현재 제작 또는 검수 중입니다. 발행 완료 처리 후 공개 화면이 열립니다."
      />
    );
  }

  const pages = pageImageData.pages;
  const requestedPageNumber = Number(pageParam) || pages[0]?.pageNumber || 1;
  const requestedIndex = pages.findIndex((page) => page.pageNumber === requestedPageNumber);
  const currentIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const currentPage = pages[currentIndex] ?? null;
  const currentPageCustomTitle = currentPage ? getCustomPageTitle(currentPage.title, currentPage.pageNumber) : "";
  const previousPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;
  const mobileReadingHref = isAdminPreview ? `/newsletters/${slug}?preview=admin` : project.publicUrl ?? `/newsletters/${slug}`;
  const desktopEbookHref = isAdminPreview ? `/newsletters/${slug}/ebook?preview=admin` : `/newsletters/${slug}/ebook`;

  return (
    <main className="public-newsletter-screen min-h-screen bg-[#edf4fb] text-slate-950">
      <NewsletterViewTracker slug={slug} viewMode="ebook" disabled={isAdminPreview || !isPublished} />
      <section className="mx-auto min-h-screen max-w-[560px] bg-white shadow-xl shadow-blue-950/10">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Mobile e-book</p>
          <h1 className="mt-1 text-xl font-black leading-tight text-[#092046]">
            {project.title} {project.issue}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-600">
                {currentPage ? `${currentPage.pageNumber}쪽 / ${pages.length}쪽` : "페이지 미등록"}
              </p>
              {currentPageCustomTitle ? <p className="mt-1 truncate text-sm font-bold text-slate-500">{currentPageCustomTitle}</p> : null}
            </div>
            {!isEmbeddedAdminPreview ? (
              <div className="flex flex-wrap gap-2">
                <Link href={mobileReadingHref} className="dd-btn dd-btn-secondary dd-btn-sm rounded-full text-xs">
                  모바일 읽기
                </Link>
                <Link href={desktopEbookHref} className="dd-btn dd-btn-primary dd-btn-sm rounded-full text-xs">
                  PC e-book
                </Link>
              </div>
            ) : null}
          </div>
        </header>

        <section className="px-4 py-5">
          {currentPage ? (
            <article className="public-mobile-ebook-page rounded-2xl bg-[#e7f0f8] p-3 shadow-inner shadow-blue-950/10">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-blue-950/15">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black text-[#092046]">{formatPageLabel(currentPage.pageNumber, currentPage.title)}</h2>
                  <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-bold text-[#184a88]">{currentPage.status}</span>
                </div>
                {currentPage.previewHref ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPage.previewHref}
                    alt={formatPageLabel(currentPage.pageNumber, currentPage.title)}
                    className="mx-auto w-full max-w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
                    <p className="text-sm font-black text-[#092046]">이미지 파일 경로가 없습니다.</p>
                  </div>
                )}
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
              <p className="text-base font-black text-[#092046]">등록된 e-book 페이지 이미지가 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                원본 자료 화면에서 페이지 이미지를 업로드하면 모바일 e-book이 표시됩니다.
              </p>
            </div>
          )}

          {pages.length > 0 ? (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {previousPage ? (
                <Link
                  href={makeMobileEbookHref(slug, previousPage.pageNumber, isAdminPreview, isEmbeddedAdminPreview)}
                  className="dd-btn dd-btn-secondary min-h-12 px-3 py-3 text-center text-sm"
                >
                  이전쪽
                </Link>
              ) : (
                <span className="min-h-12 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-black text-slate-300">
                  이전쪽
                </span>
              )}

              <details className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-center">
                <summary className="cursor-pointer text-sm font-black text-[#092046]">목차</summary>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-left">
                  {pages.map((page) => (
                    <Link
                      key={page.id}
                      href={makeMobileEbookHref(slug, page.pageNumber, isAdminPreview, isEmbeddedAdminPreview)}
                      className={`block rounded-lg border px-3 py-2 text-sm font-bold ${
                        page.id === currentPage?.id
                          ? "border-[#092046] bg-[#092046] text-white"
                          : "border-slate-200 bg-[#f8fbff] text-[#092046]"
                      }`}
                    >
                      {formatPageLabel(page.pageNumber, page.title)}
                    </Link>
                  ))}
                </div>
              </details>

              {nextPage ? (
                <Link
                  href={makeMobileEbookHref(slug, nextPage.pageNumber, isAdminPreview, isEmbeddedAdminPreview)}
                  className="dd-btn dd-btn-primary min-h-12 px-3 py-3 text-center text-sm"
                >
                  다음쪽
                </Link>
              ) : (
                <span className="min-h-12 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center text-sm font-black text-slate-300">
                  다음쪽
                </span>
              )}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
