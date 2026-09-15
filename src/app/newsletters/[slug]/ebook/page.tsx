import { NewsletterViewTracker } from "@/components/newsletter-view-tracker";
import { PublicDesktopEbookViewer } from "@/components/public-desktop-ebook-viewer";
import { getProjectPageImages, getProjectWorkspace } from "@/lib/newsletter-repository";

type PublicEbookPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ embedded?: string | string[]; page?: string | string[]; preview?: string | string[] }>;
};

function hasSearchParamValue(value: string | string[] | undefined, expectedValue: string) {
  return Array.isArray(value) ? value.includes(expectedValue) : value === expectedValue;
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function PublicEbookPage({ params, searchParams }: PublicEbookPageProps) {
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
        title="PC e-book을 찾지 못했습니다."
        message="프로젝트 주소가 변경됐거나 아직 공개 준비가 끝나지 않았습니다."
      />
    );
  }

  if (!isPubliclyVisible) {
    return (
      <PublicUnavailablePage
        title="아직 공개 전입니다."
        message="이 PC e-book은 현재 제작 또는 검수 중입니다. 발행 완료 처리 후 공개 화면이 열립니다."
      />
    );
  }

  const pages = pageImageData.pages;
  const initialPageNumber = Number(pageParam) || pages[0]?.pageNumber || 1;
  const mobileHref = isAdminPreview ? `/newsletters/${slug}?preview=admin` : project?.publicUrl ?? `/newsletters/${slug}`;
  const mobileEbookHref = isAdminPreview ? `/newsletters/${slug}/ebook/mobile?preview=admin` : `/newsletters/${slug}/ebook/mobile`;

  return (
    <>
      <NewsletterViewTracker slug={slug} viewMode="ebook" disabled={isAdminPreview || !isPublished} />
      <PublicDesktopEbookViewer
        initialPageNumber={initialPageNumber}
        isEmbeddedAdminPreview={isEmbeddedAdminPreview}
        mobileEbookHref={mobileEbookHref}
        mobileReadingHref={mobileHref}
        pageCount={project.pageCount ?? 0}
        pages={pages}
        projectIssue={project.issue}
        projectOrganization={project.organization}
        projectTitle={project.title}
      />
    </>
  );
}
