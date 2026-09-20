import Link from "next/link";
import { NewsletterViewTracker } from "@/components/newsletter-view-tracker";
import { PublicAudioTextSyncPlayer } from "@/components/public-audio-text-sync-player";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { PublicMobileArticleReader } from "@/components/public-mobile-article-reader";
import { getValidExternalEbookUrl } from "@/lib/ebook-source";
import { getDisplayArticleTitle } from "@/lib/korean-title-breaks";
import { getUsableEbookPages } from "@/lib/ebook-pages";
import {
  getProjectAudioFiles,
  getProjectContent,
  getFontAssets,
  getProjectPageHotspotLinks,
  getProjectPageImages,
  getProjectSurveys,
  getPublicProjectSurveys,
  getProjectWorkspace,
  isProjectSurveyPubliclyActive,
  makePublicStoragePreviewHref,
  type ProjectSurveyItem,
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

function sanitizeReaderSurveys(surveys: ProjectSurveyItem[]) {
  return surveys.map((survey) => ({
    ...survey,
    description: survey.statusCode === "open" && survey.questionCount > 0 ? survey.description : "",
    questions: [],
  }));
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
  const surveyDataPromise = isAdminPreview ? getProjectSurveys(slug) : getPublicProjectSurveys(slug);
  const [workspace, contentData, pageImageData, hotspotData, surveyData, audioData, fontData] = await Promise.all([
    getProjectWorkspace(slug),
    getProjectContent(slug),
    getProjectPageImages(slug),
    getProjectPageHotspotLinks(slug),
    surveyDataPromise,
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
  const publicSurveyLinks = surveyData.surveys.filter((survey) => isProjectSurveyPubliclyActive(survey));
  console.info("[public-newsletter] article visibility", {
    rawArticleCount: contentData.articles.length,
    slug,
    visibleArticleCount: articles.length,
  });
  const pageImages = getUsableEbookPages(pageImageData.pages);
  const hotspotLinks = hotspotData.links;
  const isImagePageMode = project?.productionMode === "이미지 페이지형";
  const externalEbookUrl = getValidExternalEbookUrl(project?.externalEbookUrl);
  const useExternalEbook = project?.ebookSource === "external" && Boolean(externalEbookUrl);
  const internalEbookDesktopHref = isAdminPreview
    ? `/newsletters/${slug}/ebook?preview=admin`
    : project?.ebookUrl ?? `/newsletters/${slug}/ebook`;
  const internalEbookMobileHref = isAdminPreview ? `/newsletters/${slug}/ebook/mobile?preview=admin` : `/newsletters/${slug}/ebook/mobile`;
  const ebookDesktopHref = useExternalEbook ? externalEbookUrl ?? internalEbookDesktopHref : internalEbookDesktopHref;
  const ebookMobileHref = useExternalEbook ? externalEbookUrl ?? internalEbookMobileHref : internalEbookMobileHref;
  const ebookLinkTarget = useExternalEbook ? "_blank" : undefined;
  const ebookLinkRel = useExternalEbook ? "noopener noreferrer" : undefined;
  const headerColor = project?.primaryColor ?? "#071f46";
  const publicAudioFile = audioData.files[0] ?? null;
  const publicAudioSrc = publicAudioFile ? makePublicStoragePreviewHref("audio-files", publicAudioFile.filePath) : null;
  const coverImageSrc = project?.coverImagePath
    ? makePublicStoragePreviewHref("mobile-assets", project.coverImagePath) ?? ""
    : project?.coverImageUrl || "";
  const showCoverSection = Boolean(project?.coverEnabled && coverImageSrc && !isImagePageMode);
  const isEngagementOnly = Boolean(project && !project.capabilities.hasNewsletter && project.capabilities.hasEngagement);
  const useArticleReaderShell = !isImagePageMode && (articles.length > 0 || showCoverSection);

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
        {!useArticleReaderShell ? (
          <header className="px-5 pb-7 pt-[calc(1.75rem+env(safe-area-inset-top))] text-white" style={{ backgroundColor: headerColor }}>
            <p className="text-sm font-semibold text-sky-200">{project?.organization ?? "프로젝트 정보 확인 필요"}</p>
            <h1 className="mt-3 text-3xl font-black leading-tight">{project?.title ?? slug}</h1>
            <p className="mt-2 text-lg font-bold text-white/95">{project?.issue ?? "-"}</p>
            <p className="mt-4 text-sm leading-6 text-slate-200">{project?.description ?? workspace.message}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!isEmbeddedAdminPreview ? (
                <>
                  <Link
                    href={ebookMobileHref}
                    target={ebookLinkTarget}
                    rel={ebookLinkRel}
                    className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046] md:hidden"
                  >
                    e-book 보기
                  </Link>
                  <Link
                    href={ebookDesktopHref}
                    target={ebookLinkTarget}
                    rel={ebookLinkRel}
                    className="hidden rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046] md:inline-flex"
                  >
                    e-book 보기
                  </Link>
                </>
              ) : null}
              <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-slate-200">
                {isEngagementOnly ? "참여 콘텐츠" : isImagePageMode ? "이미지형 모바일 보기" : "모바일 읽기 보기"}
              </span>
            </div>
          </header>
        ) : null}

        <div id="newsletter-articles" />
        <section
          className={
            useArticleReaderShell
              ? ""
              : `space-y-5 px-5 py-5 ${isImagePageMode && publicAudioSrc ? "pb-[calc(9rem+env(safe-area-inset-bottom))]" : ""}`
          }
        >
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
          ) : useArticleReaderShell ? (
            <PublicMobileArticleReader
              articles={articles}
              cover={
                showCoverSection
                  ? {
                      coverFit: project.coverFit,
                      coverImageSrc,
                      coverIssueText: project.coverIssueText || project.issue,
                      coverLayout: project.coverLayout,
                      coverSubtitle: project.coverSubtitle,
                      coverTitle: project.coverTitle || project.title,
                    }
                  : null
              }
              fontAssets={fontData.fonts}
              hasCoverPage={showCoverSection}
              headerColor={headerColor}
              initialArticleId={previewArticleId}
              issue={project?.issue}
              publicationTitle={project?.title ?? slug}
              projectBodyFontAssetId={project?.bodyFontAssetId}
              projectTitleFontAssetId={project?.titleFontAssetId}
              publicSurveyLinks={publicSurveyLinks}
              ebookDesktopHref={!isEmbeddedAdminPreview ? ebookDesktopHref : undefined}
              ebookLinkRel={ebookLinkRel}
              ebookLinkTarget={ebookLinkTarget}
              ebookMobileHref={!isEmbeddedAdminPreview ? ebookMobileHref : undefined}
              showSurveyConnectionStatus={isAdminPreview}
              surveys={sanitizeReaderSurveys(surveyData.surveys)}
              showAdminPreviewControls={showAdminPreviewControls}
              slug={slug}
            />
          ) : isEngagementOnly ? (
            <section className="space-y-4 px-5 py-5">
              <div className="public-card rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-xs font-black text-[#184a88]">참여 콘텐츠</p>
                <h2 className="mt-2 text-xl font-black leading-tight text-[#092046]">{project.title}</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">
                  {project.description || "현재 참여 가능한 설문·이벤트를 확인해 주세요."}
                </p>
              </div>
              {publicSurveyLinks.length > 0 ? (
                <div className="grid gap-3">
                  {publicSurveyLinks.map((survey) => (
                    <Link
                      key={survey.id}
                      href={`/newsletters/${slug}/survey/${survey.id}`}
                      className="block rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] px-5 py-5 shadow-sm transition hover:border-[#2f73b7] hover:bg-white"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#184a88]">
                          {survey.kind}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                          {survey.questionCount}개 문항
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-black leading-7 text-[#092046] [word-break:keep-all]">
                        {survey.title}
                      </h3>
                      {survey.description ? (
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
                          {survey.description}
                        </p>
                      ) : null}
                      <p className="mt-3 text-sm font-black text-[#184a88]">참여하기</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-black text-[#092046]">현재 참여 가능한 설문·이벤트가 없습니다.</p>
                </div>
              )}
            </section>
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
          {!useArticleReaderShell && !isEngagementOnly && publicSurveyLinks.length > 0 ? (
            <section
              className={`public-card rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] p-5 ${
                useArticleReaderShell ? "mx-5 my-5" : ""
              }`}
            >
              <p className="text-xs font-black text-[#184a88]">참여하기</p>
              <h2 className="mt-2 text-xl font-black leading-tight text-[#092046]">설문·이벤트</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">
                모바일 소식지를 읽은 뒤 만족도 조사나 이벤트에 참여할 수 있습니다.
              </p>
              <div className="mt-4 grid gap-3">
                {publicSurveyLinks.map((survey) => (
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
