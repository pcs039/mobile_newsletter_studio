/* eslint-disable @next/next/no-img-element */
import { ClientReviewScreen } from "@/components/client-review-screen";
import { PublicMobileArticleReader } from "@/components/public-mobile-article-reader";
import { PublicMobileEbookViewer } from "@/components/public-mobile-ebook-viewer";
import { PublicDesktopEbookViewer } from "@/components/public-desktop-ebook-viewer";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { getClientReviewSession, getClientReviewRenderData } from "@/lib/client-review-render";
import { getValidExternalEbookUrl } from "@/lib/ebook-source";
import { getValidArticleActionHref } from "@/lib/public-article-url";

export const dynamic = "force-dynamic";
export const metadata = { title: "기관 소식지 검토", robots: { index: false, follow: false } };

type Props = {
  searchParams: Promise<{ project?: string | string[]; view?: string; page?: string }>;
};

function ReviewNotice({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf4fb] px-5 py-10 text-slate-950">
      <section className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-[#184a88]">기관 검토용</p>
        <h1 className="mt-3 text-xl font-black">검토를 진행할 수 없습니다.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

function EbookLinks({ mobileHref, desktopHref, external }: {
  mobileHref: string;
  desktopHref: string;
  external: string | null;
}) {
  return (
    <nav aria-label="소식지 보기 방식" className="mx-auto flex max-w-[520px] justify-center gap-5 bg-white p-4">
      {[["모바일 eBook", mobileHref], ["PC eBook", desktopHref]].map(([label, href]) => (
        <a key={label} className="font-bold text-blue-800 underline" href={external || href}
          target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export default async function ClientReviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const slug = (Array.isArray(params.project) ? params.project[0] : params.project)?.trim() ?? "";
  if (!slug) {
    return <ReviewNotice message="링크가 만료되었거나 취소되었을 수 있습니다. 담당자에게 새 검토 링크를 요청해 주세요." />;
  }
  const access = await getClientReviewSession(slug);
  if (access.status !== "ok") return <ReviewNotice message={access.message} />;
  const { project: identity, review } = access.data;
  if (review.status !== "pending") {
    return (
      <ClientReviewScreen projectSlug={slug} title={identity.title} organization={identity.organizationName}
        issue="" expiresAt={review.expiresAt} initialStatus={review.status}>
        {null}
      </ClientReviewScreen>
    );
  }
  const data = await getClientReviewRenderData(slug);
  if (!data || data.project.id !== identity.id) {
    return <ReviewNotice message="소식지 내용을 불러오지 못했습니다. 잠시 후 다시 접속해 주세요." />;
  }
  const { project, articles, pages, coverImageSrc, publicAudio, fonts, hotspots } = data;
  const readingHref = `/client-review?${new URLSearchParams({ project: slug })}`;
  const mobileHref = `${readingHref}&view=ebook`;
  const desktopHref = `${readingHref}&view=ebookDesktop`;
  const requestedPage = Math.max(1, Math.min(pages.length || 1, Number(params.page) || 1));
  const externalEbook = project.ebookSource === "external" ? getValidExternalEbookUrl(project.externalEbookUrl) : null;
  const hasCover = Boolean(project.coverEnabled && coverImageSrc);
  const isEbook = params.view === "ebook" || params.view === "ebookDesktop";
  let content;

  if (isEbook) {
    content = !pages.length ? (
      <p className="p-8 text-center">
        아직 eBook 페이지가 준비되지 않았습니다. <a className="underline" href={readingHref}>모바일 소식지로 돌아가기</a>
      </p>
    ) : params.view === "ebook" ? (
      <PublicMobileEbookViewer ebookHrefBase={mobileHref} desktopEbookHref={desktopHref}
        initialPageNumber={requestedPage} isAdminPreview={false} isEmbeddedAdminPreview={false}
        mobileReadingHref={readingHref} pages={pages} pdfDownloadHref={null}
        projectIssue={project.issue} projectTitle={project.title} publicAudio={publicAudio}
        searchEnabled={false} slug={slug} />
    ) : (
      <PublicDesktopEbookViewer initialPageNumber={requestedPage} isAdminPreview={false}
        isEmbeddedAdminPreview={false} mobileReadingHref={readingHref} pageCount={pages.length}
        pages={pages} pdfDownloadHref={null} publicAudio={publicAudio} projectIssue={project.issue}
        projectOrganization={project.organization} projectTitle={project.title} searchEnabled={false} slug={slug} />
    );
  } else if (project.productionMode === "이미지 페이지형") {
    content = (
      <section className="mx-auto max-w-[520px] bg-white">
        {pages.length ? pages.map((page) => (
          <article key={page.id} className="relative">
            <img src={page.previewHref!} alt={page.title || `${page.pageNumber}페이지`} className="block h-auto w-full" />
            {hotspots.filter((link) => link.pageId === page.id && link.isVisible).map((link) => {
              const action = getValidArticleActionHref(link.targetValue, link.type);
              return action ? (
                <a key={link.id} href={action.href} aria-label={link.label}
                  target={action.actionType === "url" ? "_blank" : undefined} rel="noopener noreferrer"
                  className="absolute rounded border border-blue-500/30"
                  style={{ left: `${link.xPercent}%`, top: `${link.yPercent}%`,
                    width: `${link.widthPercent}%`, height: `${link.heightPercent}%` }} />
              ) : null;
            })}
          </article>
        )) : <p className="p-8 text-center">검토할 페이지가 아직 준비되지 않았습니다.</p>}
      </section>
    );
  } else {
    content = articles.length || hasCover ? (
      <div className="public-newsletter-swipe-shell mx-auto max-w-[520px] bg-white">
        <PublicMobileArticleReader analyticsDisabled articles={articles}
          cover={hasCover ? {
            coverFit: project.coverFit, coverImageSrc, coverIssueText: project.coverIssueText || project.issue,
            coverLayout: project.coverLayout, coverSubtitle: project.coverSubtitle,
            coverTitle: project.coverTitle || project.title,
          } : null}
          fontAssets={fonts} hasCoverPage={hasCover} headerColor={project.primaryColor}
          issue={project.issue} publicationTitle={project.title} projectBodyFontAssetId={project.bodyFontAssetId}
          projectTitleFontAssetId={project.titleFontAssetId} ebookDesktopHref={externalEbook || desktopHref}
          ebookMobileHref={externalEbook || mobileHref} ebookLinkTarget={externalEbook ? "_blank" : undefined}
          ebookLinkRel={externalEbook ? "noopener noreferrer" : undefined} publicAudio={publicAudio}
          showAdminPreviewControls={false} slug={slug} />
      </div>
    ) : <p className="p-8 text-center">검토할 기사가 아직 준비되지 않았습니다.</p>;
  }

  return (
    <ClientReviewScreen key={`${slug}:${review.id}`} projectSlug={slug} title={project.title}
      organization={project.organization} issue={project.issue} expiresAt={review.expiresAt} initialStatus={review.status}>
      <PublicFontFaceStyle fonts={fonts} />
      {!isEbook ? <EbookLinks mobileHref={mobileHref} desktopHref={desktopHref} external={externalEbook} /> : null}
      {content}
    </ClientReviewScreen>
  );
}
