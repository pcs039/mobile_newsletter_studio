import Link from "next/link";
import { NewsletterViewTracker } from "@/components/newsletter-view-tracker";
import { PublicAudioTextSyncPlayer } from "@/components/public-audio-text-sync-player";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import {
  PublicMobileArticleReader,
  PublicMobileArticleTocButton,
  PublicMobileFirstArticleLink,
  PublicPageTurnSoundToggle,
} from "@/components/public-mobile-article-reader";
import { getDisplayArticleTitle } from "@/lib/korean-title-breaks";
import {
  getProjectAudioFiles,
  getProjectContent,
  getFontAssets,
  getProjectPageHotspotLinks,
  getProjectPageImages,
  getPublicProjectSurveys,
  getProjectWorkspace,
  makePublicStoragePreviewHref,
  type ProjectPageHotspotLink,
} from "@/lib/newsletter-repository";

type PublicNewsletterPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ articleId?: string | string[]; embedded?: string | string[]; preview?: string | string[] }>;
};

function hasSearchParamValue(value: string | string[] | undefined, expectedValue: string) {
  return Array.isArray(value) ? value.includes(expectedValue) : value === expectedValue;
}

function getHotspotHref(link: ProjectPageHotspotLink) {
  if (link.type === "phone") {
    return link.targetValue.startsWith("tel:") ? link.targetValue : `tel:${link.targetValue}`;
  }

  return link.targetValue;
}

function getHotspotsForPage(links: ProjectPageHotspotLink[], pageId: string) {
  return links
    .filter((link) => link.pageId === pageId && link.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function hasPublicArticleTitle(article: { displayTitle?: string | null; title?: string | null }) {
  return Boolean(getDisplayArticleTitle(article, "").trim());
}

function PublicUnavailablePage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="public-newsletter-screen grid min-h-screen place-items-center bg-[#edf4fb] px-5 text-slate-950">
      <section className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xl shadow-blue-950/10">
        <p className="text-sm font-black text-[#184a88]">DataDiction Newsletter</p>
        <h1 className="mt-3 text-2xl font-black leading-tight text-[#092046]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 [word-break:keep-all]">{message}</p>
      </section>
    </main>
  );
}

function PublicNewsletterCoverSection({
  coverFit,
  coverImageSrc,
  coverIssueText,
  coverLayout,
  coverSubtitle,
  coverTitle,
}: {
  coverFit: "contain" | "cover";
  coverImageSrc: string;
  coverIssueText: string;
  coverLayout: "image" | "image_info" | "image_overlay";
  coverSubtitle: string;
  coverTitle: string;
}) {
  const hasInfo = Boolean(coverTitle || coverSubtitle || coverIssueText);
  const imageFitClass = coverFit === "cover" || coverLayout === "image_overlay" ? "object-cover" : "object-contain";

  return (
    <section id="newsletter-cover" className="border-b border-slate-200 bg-[#f4f8ff] px-3 py-5">
      <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-lg shadow-blue-950/10">
        {coverLayout === "image_overlay" ? (
          <div className="relative min-h-[76vh] bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageSrc}
              alt={coverTitle || "모바일 소식지 표지"}
              className={`absolute inset-0 h-full w-full ${imageFitClass}`}
            />
            {hasInfo ? (
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent p-6 text-white">
                {coverIssueText ? <p className="text-sm font-black text-sky-100">{coverIssueText}</p> : null}
                {coverTitle ? <h2 className="mt-2 text-4xl font-black leading-tight [word-break:keep-all]">{coverTitle}</h2> : null}
                {coverSubtitle ? <p className="mt-3 text-base font-bold leading-7 text-white/90 [word-break:keep-all]">{coverSubtitle}</p> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="bg-white px-1 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageSrc}
                alt={coverTitle || "모바일 소식지 표지"}
                className={`mx-auto max-h-[82vh] w-full rounded-[1.1rem] ${imageFitClass}`}
              />
            </div>
            {coverLayout === "image_info" && hasInfo ? (
              <div className="border-t border-slate-100 px-5 py-5">
                {coverTitle ? <h2 className="text-2xl font-black leading-tight text-[#092046] [word-break:keep-all]">{coverTitle}</h2> : null}
                {coverSubtitle ? <p className="mt-2 text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">{coverSubtitle}</p> : null}
                {coverIssueText ? <p className="mt-3 text-xs font-black text-[#184a88]">{coverIssueText}</p> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <PublicMobileFirstArticleLink
          href="#newsletter-articles"
          className="dd-btn dd-btn-primary min-h-11 justify-center rounded-full px-4 text-sm"
        >
          첫 기사 읽기
        </PublicMobileFirstArticleLink>
        <PublicMobileArticleTocButton
          ariaLabel="기사 목차 보기"
          className="dd-btn dd-btn-secondary min-h-11 justify-center rounded-full px-4 text-sm"
        >
          목차 보기
        </PublicMobileArticleTocButton>
      </div>
    </section>
  );
}

export default async function PublicNewsletterPage({ params, searchParams }: PublicNewsletterPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const previewMode = resolvedSearchParams?.preview;
  const embeddedMode = resolvedSearchParams?.embedded;
  const previewArticleParam = resolvedSearchParams?.articleId;
  const previewArticleId = Array.isArray(previewArticleParam) ? previewArticleParam[0] : previewArticleParam;
  const isAdminPreview = hasSearchParamValue(previewMode, "admin");
  const isEmbeddedAdminPreview = hasSearchParamValue(embeddedMode, "adminPreview");
  const showAdminPreviewControls = isAdminPreview && !isEmbeddedAdminPreview;
  const backToEditorHref = previewArticleId
    ? `/projects/${slug}/reading?articleId=${previewArticleId}`
    : `/projects/${slug}/reading`;
  const [workspace, contentData, pageImageData, hotspotData, surveyData, audioData, fontData] = await Promise.all([
    getProjectWorkspace(slug),
    getProjectContent(slug),
    getProjectPageImages(slug),
    getProjectPageHotspotLinks(slug),
    getPublicProjectSurveys(slug),
    getProjectAudioFiles(slug),
    getFontAssets({ activeOnly: true }),
  ]);
  const project = workspace.project;
  const isPublished = project?.status === "발행 완료";
  const isPubliclyVisible = isAdminPreview || isPublished;

  if (!project) {
    return (
      <PublicUnavailablePage
        title="공개 화면을 찾지 못했습니다."
        message="프로젝트 주소가 변경됐거나 아직 공개 준비가 끝나지 않았습니다."
      />
    );
  }

  if (!isPubliclyVisible) {
    return (
      <PublicUnavailablePage
        title="아직 공개 전입니다."
        message="이 소식지는 현재 제작 또는 검수 중입니다. 발행하기 완료 후 공개 화면이 열립니다."
      />
    );
  }

  const articles = contentData.articles.filter(hasPublicArticleTitle);
  console.info("[public-newsletter] article visibility", {
    rawArticleCount: contentData.articles.length,
    slug,
    visibleArticleCount: articles.length,
  });
  const pageImages = pageImageData.pages.filter((page) => page.previewHref);
  const hotspotLinks = hotspotData.links;
  const isImagePageMode = project?.productionMode === "이미지 페이지형";
  const ebookDesktopHref = isAdminPreview ? `/newsletters/${slug}/ebook?preview=admin` : project?.ebookUrl ?? `/newsletters/${slug}/ebook`;
  const ebookMobileHref = isAdminPreview ? `/newsletters/${slug}/ebook/mobile?preview=admin` : `/newsletters/${slug}/ebook/mobile`;
  const headerColor = project?.primaryColor ?? "#071f46";
  const publicAudioFile = audioData.files[0] ?? null;
  const publicAudioSrc = publicAudioFile ? makePublicStoragePreviewHref("audio-files", publicAudioFile.filePath) : null;
  const coverImageSrc = project?.coverImagePath
    ? makePublicStoragePreviewHref("mobile-assets", project.coverImagePath) ?? ""
    : project?.coverImageUrl || "";
  const showCoverSection = Boolean(project?.coverEnabled && coverImageSrc && !isImagePageMode);

  return (
    <main className="public-newsletter-screen min-h-screen bg-[#edf4fb] text-slate-950">
      <PublicFontFaceStyle fonts={fontData.fonts} />
      <NewsletterViewTracker slug={slug} viewMode="reading" disabled={isAdminPreview || !isPublished} />
      {showAdminPreviewControls && (
        <div className="border-b border-slate-300 bg-white px-3 py-2 shadow-sm md:sticky md:top-0 md:z-20 md:bg-white/95 md:px-4 md:py-3 md:backdrop-blur">
          <div className="mx-auto flex max-w-[520px] items-center justify-between gap-2 md:flex-row">
            <p className="shrink-0 text-[11px] font-black uppercase tracking-wide text-[#184a88] md:text-xs">관리자 미리보기</p>
            <div className="flex min-w-0 flex-wrap justify-end gap-1.5 md:gap-2">
              <Link
                href={backToEditorHref}
                className="dd-btn dd-btn-secondary dd-btn-sm rounded-md px-2.5 py-1.5 text-[11px] md:px-3 md:py-2 md:text-xs"
              >
                작성 화면
              </Link>
              <Link
                href={`/projects/${slug}/publish`}
                className="dd-btn dd-btn-primary dd-btn-sm rounded-md px-2.5 py-1.5 text-[11px] md:px-3 md:py-2 md:text-xs"
              >
                발행 관리
              </Link>
            </div>
          </div>
        </div>
      )}
      <section
        data-public-mobile-swipe-shell
        className="public-newsletter-swipe-shell mx-auto min-h-screen max-w-[520px] bg-white shadow-xl shadow-blue-950/10"
      >
        <header className="px-5 pb-7 pt-[calc(1.75rem+env(safe-area-inset-top))] text-white" style={{ backgroundColor: headerColor }}>
          <div className="flex items-start justify-between gap-4">
            <p className="min-w-0 pt-1 text-sm font-semibold text-sky-200">{project?.organization ?? "프로젝트 정보 확인 필요"}</p>
            {!isImagePageMode && articles.length > 0 ? (
              <div className="flex shrink-0 items-center gap-2 pr-[env(safe-area-inset-right)] md:hidden">
                <PublicPageTurnSoundToggle />
                <PublicMobileArticleTocButton />
              </div>
            ) : null}
          </div>
          <h1 className="mt-3 text-3xl font-black leading-tight">{project?.title ?? slug}</h1>
          <p className="mt-2 text-lg font-bold text-white/95">{project?.issue ?? "-"}</p>
          <p className="mt-4 text-sm leading-6 text-slate-200">{project?.description ?? workspace.message}</p>
          <div className="mt-5 flex gap-2">
            {!isEmbeddedAdminPreview ? (
              <>
                <Link href={ebookMobileHref} className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046] md:hidden">
                  e-book 보기
                </Link>
                <Link href={ebookDesktopHref} className="hidden rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046] md:inline-flex">
                  e-book 보기
                </Link>
              </>
            ) : null}
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-slate-200">
              {isImagePageMode ? "이미지형 모바일 보기" : "모바일 읽기 보기"}
            </span>
          </div>
        </header>

        {showCoverSection ? (
          <PublicNewsletterCoverSection
            coverFit={project.coverFit}
            coverImageSrc={coverImageSrc}
            coverIssueText={project.coverIssueText || project.issue}
            coverLayout={project.coverLayout}
            coverSubtitle={project.coverSubtitle}
            coverTitle={project.coverTitle || project.title}
          />
        ) : null}

        <div id="newsletter-articles" />
        <section className={`space-y-5 px-5 py-5 ${isImagePageMode && publicAudioSrc ? "pb-[calc(9rem+env(safe-area-inset-bottom))]" : ""}`}>
          {isImagePageMode && pageImages.length > 0 ? (
            <section className="public-image-page-list space-y-4">
              {pageImages.map((page) => (
                <article key={page.id} className="public-card public-image-page-frame overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {showAdminPreviewControls ? (
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#f8fbff] px-4 py-3">
                      <p className="text-xs font-black text-[#184a88]">{page.pageNumber}쪽 이미지 페이지</p>
                      <Link
                        href={`/projects/${slug}/pages`}
                        className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]"
                      >
                        페이지 관리
                      </Link>
                    </div>
                  ) : null}
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page.previewHref ?? ""} alt={`${page.pageNumber}쪽 ${page.title}`} className="w-full" />
                    {getHotspotsForPage(hotspotLinks, page.id).map((link) => (
                      <a
                        key={link.id}
                        href={getHotspotHref(link)}
                        target={link.type === "phone" ? undefined : "_blank"}
                        rel={link.type === "phone" ? undefined : "noreferrer"}
                        aria-label={link.label}
                        title={link.label}
                        className={`absolute rounded-md ${
                          showAdminPreviewControls ? "border-2 border-[#f97316] bg-orange-400/20" : "focus:outline focus:outline-2 focus:outline-[#2f73b7]"
                        }`}
                        style={{
                          left: `${link.xPercent}%`,
                          top: `${link.yPercent}%`,
                          width: `${link.widthPercent}%`,
                          height: `${link.heightPercent}%`,
                        }}
                      >
                        {showAdminPreviewControls ? (
                          <span className="m-1 inline-flex rounded bg-[#f97316] px-2 py-1 text-[11px] font-black text-white">
                            {link.label}
                          </span>
                        ) : (
                          <span className="sr-only">{link.label}</span>
                        )}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          ) : articles.length > 0 ? (
            <PublicMobileArticleReader
              articles={articles}
              fontAssets={fontData.fonts}
              hasCoverPage={showCoverSection}
              initialArticleId={previewArticleId}
              projectBodyFontAssetId={project?.bodyFontAssetId}
              projectTitleFontAssetId={project?.titleFontAssetId}
              showAdminPreviewControls={showAdminPreviewControls}
              slug={slug}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-black text-[#092046]">
                {showAdminPreviewControls ? "저장된 모바일 기사가 없습니다." : "표시할 모바일 기사가 없습니다."}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {showAdminPreviewControls
                  ? "작성/수정 화면에서 기사를 저장하면 이 공개 화면에 바로 표시됩니다."
                  : "기사 내용이 준비되면 이 화면에 표시됩니다."}
              </p>
              {showAdminPreviewControls ? (
                <Link
                  href={`/projects/${slug}/reading`}
                  className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78]"
                >
                  기사 작성으로 이동
                </Link>
              ) : null}
            </div>
          )}
          {surveyData.surveys.length > 0 ? (
            <section className="public-card rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] p-5">
              <p className="text-xs font-black text-[#184a88]">참여하기</p>
              <h2 className="mt-2 text-xl font-black leading-tight text-[#092046]">설문·이벤트</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">
                모바일 소식지를 읽은 뒤 만족도 조사나 이벤트에 참여할 수 있습니다.
              </p>
              <div className="mt-4 grid gap-3">
                {surveyData.surveys.map((survey) => (
                  <Link
                    key={survey.id}
                    href={`/newsletters/${slug}/survey/${survey.id}`}
                    className="block rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-[#2f73b7] hover:bg-white"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">
                        {survey.kind}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {survey.questionCount}개 문항
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-black leading-7 text-[#092046] [word-break:keep-all]">
                      {survey.title}
                    </h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
                      {survey.description}
                    </p>
                    <p className="mt-3 text-sm font-black text-[#184a88]">참여하기</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </section>
      {isImagePageMode && publicAudioSrc ? (
        <PublicAudioTextSyncPlayer src={publicAudioSrc} title={publicAudioFile?.title} segments={[]} />
      ) : null}
    </main>
  );
}
