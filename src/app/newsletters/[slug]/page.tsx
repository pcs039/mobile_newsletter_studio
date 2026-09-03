import Link from "next/link";
import { NewsletterViewTracker } from "@/components/newsletter-view-tracker";
import {
  getProjectContent,
  getProjectPageImages,
  getPublicProjectSurveys,
  getProjectWorkspace,
  type ProjectContentArticle,
  type ProjectContentBlock,
} from "@/lib/newsletter-repository";

type PublicNewsletterPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ articleId?: string | string[]; preview?: string | string[] }>;
};

function getPreviewBody(article: ProjectContentArticle) {
  const body = article.body.trim();

  if (!body) {
    return "본문이 아직 입력되지 않았습니다.";
  }

  return body;
}

function getVisibleBlocks(article: ProjectContentArticle) {
  return article.blocks
    .filter((block) => block.isVisible && (block.title || block.body))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getBlockLink(article: ProjectContentArticle, block: ProjectContentBlock) {
  if (block.linkActionId) {
    return article.links.find((link) => link.id === block.linkActionId) ?? null;
  }

  if (block.type === "video_link") {
    return article.links.find((link) => link.actionType === "video" && link.targetValue === block.body) ?? null;
  }

  if (block.type === "map_link") {
    return article.links.find((link) => link.actionType === "map" && link.targetValue === block.body) ?? null;
  }

  if (block.type === "button_group") {
    return article.links.find((link) => link.displayStyle === "button" && link.targetValue === block.body) ?? null;
  }

  return null;
}

function getYoutubeId(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "");
    }

    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop() ?? "";
    }
  } catch {
    return "";
  }

  return "";
}

function renderContentBlock(article: ProjectContentArticle, block: ProjectContentBlock) {
  const link = getBlockLink(article, block);
  const href = link?.targetValue || block.body;

  if (block.type === "paragraph") {
    return (
      <section key={block.id}>
        {block.title ? <h3 className="text-base font-black leading-7 text-[#092046]">{block.title}</h3> : null}
        {block.body ? <p className="mt-2 whitespace-pre-line text-base leading-8 text-slate-700">{block.body}</p> : null}
      </section>
    );
  }

  if (block.type === "image") {
    return (
      <figure key={block.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {block.body ? <img src={block.body} alt={block.title || article.title} className="w-full object-cover" /> : null}
        {block.title ? <figcaption className="px-4 py-3 text-sm font-bold leading-6 text-slate-700">{block.title}</figcaption> : null}
      </figure>
    );
  }

  if (block.type === "video_link") {
    const youtubeId = getYoutubeId(href);

    return (
      <section
        key={block.id}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm"
      >
        {youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            title={block.title || "영상 보기"}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : null}
        <div className="px-4 py-3">
          <p className="text-xs font-black text-sky-200">영상 보기</p>
          <p className="mt-1 text-sm font-black leading-6">{block.title || link?.label || "영상 보기"}</p>
          <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-sky-100 underline">
            새 창에서 열기
          </a>
        </div>
      </section>
    );
  }

  if (block.type === "map_link") {
    return (
      <a
        key={block.id}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-4"
      >
        <p className="text-xs font-black text-[#184a88]">지도 보기</p>
        <p className="mt-1 text-base font-black leading-7 text-[#092046]">{block.title || link?.label || "위치 확인"}</p>
      </a>
    );
  }

  if (block.type === "button_group") {
    return (
      <a
        key={block.id}
        href={href.startsWith("tel:") || href.startsWith("http") ? href : `tel:${href}`}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        className="block rounded-xl bg-[#092046] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
      >
        {block.title || link?.label || "바로가기"}
      </a>
    );
  }

  if (block.type === "audio") {
    return (
      <details key={block.id} className="rounded-xl bg-[#f4f8ff] px-4 py-3">
        <summary className="cursor-pointer text-sm font-black text-[#092046]">{block.title || "음성 대본 보기"}</summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{block.body}</p>
      </details>
    );
  }

  return null;
}

function PublicUnavailablePage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf4fb] px-5 text-slate-950">
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
  const previewArticleParam = resolvedSearchParams?.articleId;
  const previewArticleId = Array.isArray(previewArticleParam) ? previewArticleParam[0] : previewArticleParam;
  const isAdminPreview = Array.isArray(previewMode) ? previewMode.includes("admin") : previewMode === "admin";
  const backToEditorHref = previewArticleId
    ? `/projects/${slug}/reading?articleId=${previewArticleId}`
    : `/projects/${slug}/reading`;
  const [workspace, contentData, pageImageData, surveyData] = await Promise.all([
    getProjectWorkspace(slug),
    getProjectContent(slug),
    getProjectPageImages(slug),
    getPublicProjectSurveys(slug),
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
        message="이 소식지는 현재 제작 또는 검수 중입니다. 발행 완료 처리 후 공개 화면이 열립니다."
      />
    );
  }

  const articles = contentData.articles.filter((article) =>
    isAdminPreview ? true : article.status === "approved" || article.status === "published",
  );
  const pageImages = pageImageData.pages.filter((page) => page.previewHref);
  const isPremiumImageMode = project?.packageTier === "프리미엄" || project?.productionMode === "전체 이미지형";
  const ebookHref = isAdminPreview ? `/newsletters/${slug}/ebook?preview=admin` : project?.ebookUrl ?? `/newsletters/${slug}/ebook`;
  const headerColor = project?.primaryColor ?? "#071f46";

  return (
    <main className="min-h-screen bg-[#edf4fb] text-slate-950">
      <NewsletterViewTracker slug={slug} viewMode="reading" disabled={isAdminPreview || !isPublished} />
      {isAdminPreview && (
        <div className="sticky top-0 z-20 border-b border-slate-300 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[520px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">관리자 미리보기</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={backToEditorHref}
                className="rounded-md border border-[#2f73b7] bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              >
                작성 화면으로 돌아가기
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
        <header className="px-5 pb-7 pt-7 text-white" style={{ backgroundColor: headerColor }}>
          <p className="text-sm font-semibold text-sky-200">{project?.organization ?? "프로젝트 정보 확인 필요"}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">{project?.title ?? slug}</h1>
          <p className="mt-2 text-lg font-bold text-white/95">{project?.issue ?? "-"}</p>
          <p className="mt-4 text-sm leading-6 text-slate-200">{project?.description ?? workspace.message}</p>
          <div className="mt-5 flex gap-2">
            <Link href={ebookHref} className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046]">
              PC e-book 보기
            </Link>
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-slate-200">
              {isPremiumImageMode ? "이미지형 모바일 보기" : "모바일 읽기 보기"}
            </span>
          </div>
        </header>

        <section className="space-y-5 px-5 py-5">
          {isPremiumImageMode && pageImages.length > 0 ? (
            <section className="space-y-4">
              {pageImages.map((page) => (
                <article key={page.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {isAdminPreview ? (
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.previewHref ?? ""} alt={`${page.pageNumber}쪽 ${page.title}`} className="w-full" />
                </article>
              ))}
            </section>
          ) : articles.length > 0 ? (
            articles.map((article, index) => {
              const visibleBlocks = getVisibleBlocks(article);

              return (
                <article key={article.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-[#184a88]">
                      {article.pageNumber ? `${article.pageNumber}쪽` : `${index + 1}번 기사`}
                    </p>
                    {isAdminPreview ? (
                      <Link
                        href={`/projects/${slug}/reading?articleId=${article.id}`}
                        className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]"
                      >
                        수정
                      </Link>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-black leading-tight text-[#092046]">{article.title}</h2>
                  {article.summary ? (
                    <p className="mt-3 rounded-xl bg-[#f4f8ff] px-4 py-3 text-sm font-bold leading-6 text-[#092046]">
                      {article.summary}
                    </p>
                  ) : null}
                  {visibleBlocks.length > 0 ? (
                    <div className="mt-4 space-y-5">{visibleBlocks.map((block) => renderContentBlock(article, block))}</div>
                  ) : (
                    <div className="mt-4 whitespace-pre-line text-base leading-8 text-slate-700">
                      {getPreviewBody(article)}
                    </div>
                  )}
                  {article.contactName || article.contactPhone ? (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      <p className="text-xs font-black text-[#184a88]">문의</p>
                      <p className="mt-1 font-bold">
                        {[article.contactName, article.contactPhone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-black text-[#092046]">
                {isAdminPreview ? "저장된 모바일 기사가 없습니다." : "공개된 모바일 기사가 없습니다."}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {isAdminPreview
                  ? "작성/수정 화면에서 기사를 저장하면 이 공개 화면에 바로 표시됩니다."
                  : "관리자가 공개 승인한 뒤 이 화면에 표시됩니다."}
              </p>
              {isAdminPreview ? (
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
            <section className="rounded-2xl border border-[#b8d7ff] bg-[#f4f8ff] p-5">
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
    </main>
  );
}
