import Link from "next/link";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { NewsletterViewTracker } from "@/components/newsletter-view-tracker";
import { getProjectContent, getProjectWorkspace, type ProjectContentArticle } from "@/lib/newsletter-repository";

type PublicNewsletterPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string | string[] }>;
};

function getPreviewBody(article: ProjectContentArticle) {
  const body = article.body.trim();

  if (!body) {
    return "본문이 아직 입력되지 않았습니다.";
  }

  return body;
}

function getAudioScript(article: ProjectContentArticle) {
  return article.blocks.find((block) => block.type === "audio")?.body ?? "";
}

export default async function PublicNewsletterPage({ params, searchParams }: PublicNewsletterPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const previewMode = resolvedSearchParams?.preview;
  const isAdminPreview = Array.isArray(previewMode) ? previewMode.includes("admin") : previewMode === "admin";
  const [workspace, contentData] = await Promise.all([getProjectWorkspace(slug), getProjectContent(slug)]);
  const project = workspace.project;
  const articles = contentData.articles.filter((article) =>
    isAdminPreview ? true : article.status === "approved" || article.status === "published",
  );
  const ebookHref = isAdminPreview ? `/newsletters/${slug}/ebook?preview=admin` : project?.ebookUrl ?? `/newsletters/${slug}/ebook`;
  const headerColor = project?.primaryColor ?? "#071f46";

  return (
    <main className="min-h-screen bg-[#edf4fb] text-slate-950">
      <NewsletterViewTracker slug={slug} viewMode="reading" disabled={isAdminPreview || !project} />
      {isAdminPreview && (
        <div className="sticky top-0 z-20 border-b border-slate-300 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[520px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">관리자 미리보기</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projects/${slug}/reading`}
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
        <header className="px-5 pb-7 pt-6 text-white" style={{ backgroundColor: headerColor }}>
          <div className="mb-6">
            <DatadictionBrand compact theme="light" />
          </div>
          <p className="text-sm font-semibold text-sky-200">
            {project?.organization ?? "프로젝트 정보 확인 필요"}
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight">{project?.title ?? slug}</h1>
          <p className="mt-2 text-lg font-bold text-white/95">{project?.issue ?? "-"}</p>
          <p className="mt-4 text-sm leading-6 text-slate-200">{project?.description ?? workspace.message}</p>
          <div className="mt-5 flex gap-2">
            <Link href={ebookHref} className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046]">
              PC e-book 보기
            </Link>
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-slate-200">
              모바일 읽기 보기
            </span>
          </div>
        </header>

        <section className="space-y-5 px-5 py-5">
          {articles.length > 0 ? (
            articles.map((article, index) => {
              const audioScript = getAudioScript(article);

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
                  <div className="mt-4 whitespace-pre-line text-base leading-8 text-slate-700">
                    {getPreviewBody(article)}
                  </div>
                  {article.contactName || article.contactPhone ? (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      <p className="text-xs font-black text-[#184a88]">문의</p>
                      <p className="mt-1 font-bold">
                        {[article.contactName, article.contactPhone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  ) : null}
                  {audioScript ? (
                    <details className="mt-5 rounded-xl bg-[#f4f8ff] px-4 py-3">
                      <summary className="cursor-pointer text-sm font-black text-[#092046]">음성 대본 보기</summary>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{audioScript}</p>
                    </details>
                  ) : null}
                  {article.links.length > 0 ? (
                    <div className="mt-5 grid gap-2">
                      {article.links.map((link) => (
                        <a
                          key={link.id}
                          href={link.targetValue}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[#092046] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
                        >
                          {link.label}
                        </a>
                      ))}
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
        </section>

        <footer className="border-t border-slate-200 px-5 py-5 text-center">
          <p className="text-xs font-semibold text-slate-500">제작·운영 DataDiction Newsletter Studio</p>
        </footer>
      </section>
    </main>
  );
}
