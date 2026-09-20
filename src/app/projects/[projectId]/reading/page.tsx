import Link from "next/link";
import { AdminMobilePreviewFrame } from "@/components/admin-mobile-preview-frame";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectArticleEditorForm } from "@/components/project-article-editor-form";
import { StatusPill } from "@/components/status-pill";
import {
  getProjectAssetFiles,
  getProjectContent,
  getProjectOriginalPdf,
  getProjectPageImages,
  getProjectSurveys,
  getProjectWorkspace,
  type ProjectContentArticle,
} from "@/lib/newsletter-repository";

const statusLabels: Record<string, string> = {
  draft: "작성 중",
  editing: "작성 중",
  review: "검수 요청",
  approved: "검수 완료",
  published: "발행 반영",
  needs_revision: "수정 필요",
};

const blockLabels: Record<string, string> = {
  paragraph: "본문",
  image: "이미지",
  video_link: "영상",
  map_link: "지도",
  button_group: "버튼",
  audio: "음성 대본",
  overlay_notice: "오버레이",
};

function getArticleStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function getArticleSourceLabel(article: ProjectContentArticle, index: number) {
  if (article.pageNumber) {
    return `${article.pageNumber}쪽 원본`;
  }

  return `${index + 1}번 기사`;
}

function getArticleSortLabel(article: ProjectContentArticle) {
  return article.sortOrder > 0 ? `노출 ${article.sortOrder}` : "노출 순서 미정";
}

export default async function ReadingEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ articleId?: string }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [workspace, originalPdfData, pageImageData, assetData, contentData, surveyData] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectOriginalPdf(projectId),
    getProjectPageImages(projectId),
    getProjectAssetFiles(projectId),
    getProjectContent(projectId),
    getProjectSurveys(projectId),
  ]);
  const project = workspace.project;
  const articles = contentData.articles;
  const requestedArticleId = resolvedSearchParams.articleId;
  const selectedArticle = requestedArticleId
    ? articles.find((article) => article.id === requestedArticleId) ?? null
    : null;
  const mobilePreviewHref = selectedArticle
    ? `/newsletters/${projectId}?preview=admin&articleId=${selectedArticle.id}`
    : `/newsletters/${projectId}?preview=admin`;
  const listArticles = [...articles].sort((first, second) => {
    const firstPage = first.pageNumber ?? Number.MAX_SAFE_INTEGER;
    const secondPage = second.pageNumber ?? Number.MAX_SAFE_INTEGER;

    if (firstPage !== secondPage) {
      return firstPage - secondPage;
    }

    if (first.sortOrder !== second.sortOrder) {
      return first.sortOrder - second.sortOrder;
    }

    return first.title.localeCompare(second.title, "ko");
  });

  return (
    <ProjectAdminShell
      active="reading"
      projectId={projectId}
      title="기사 작성/편집"
      description="기사 제목, 본문, 이미지, 버튼을 작성합니다."
      sidebarTitle={
        <>
          기사 작성
          <br />
          편집
        </>
      }
      sidebarDescription="기사와 콘텐츠 블록을 작성합니다."
      sidebarNoteTitle="작성 기준"
      sidebarNote="공개 화면은 저장된 기사 블록 기준입니다."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/projects/${projectId}/pages`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            이미지 페이지 편집
          </Link>
          <Link
            href={mobilePreviewHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
          >
            모바일 미리보기 새 탭
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 2xl:grid-cols-[300px_minmax(0,1fr)_minmax(400px,460px)]">
        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기사 목록</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">모바일 산출물</h3>
              </div>
              <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                {articles.length}개
              </span>
            </div>

            {articles.length > 0 ? (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {listArticles.map((article, index) => {
                  const isActive = selectedArticle?.id === article.id;

                  return (
                    <Link
                      key={article.id}
                      href={`/projects/${projectId}/reading?articleId=${article.id}`}
                      className={`block rounded-lg border p-4 transition ${
                        isActive
                          ? "border-[#184a88] bg-[#f4f8ff] shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#184a88]">{getArticleSourceLabel(article, index)}</p>
                          <p className="mt-1 text-[11px] font-bold leading-4 text-slate-500">
                            {getArticleSortLabel(article)}
                          </p>
                        </div>
                        <StatusPill value={getArticleStatusLabel(article.status)} />
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-black leading-6 text-[#092046]">{article.title}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {article.summary || "요약 미입력"}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-black text-slate-600">
                        <span className="rounded-md bg-[#eef6ff] px-2 py-2">
                          블록 <strong className="text-[#092046]">{article.blocks.length}</strong>
                        </span>
                        <span className="rounded-md bg-[#eef6ff] px-2 py-2">
                          링크 <strong className="text-[#092046]">{article.links.length}</strong>
                        </span>
                        <span className="rounded-md bg-[#eef6ff] px-2 py-2">
                          수정 <strong className="block text-[#092046]">{article.updated}</strong>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] px-4 py-8 text-center">
                <p className="text-sm font-black text-[#092046]">등록된 기사가 없습니다.</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">가운데 입력폼으로 첫 기사를 저장하세요.</p>
              </div>
            )}

            <Link
              href={`/projects/${projectId}/reading`}
              className="mt-4 block rounded-lg bg-[#092046] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
            >
              + 새 기사 작성
            </Link>
          </article>

          <article className="rounded-lg border border-slate-200 bg-[#eef6ff] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">상태</p>
            <h3 className="mt-1 text-lg font-bold text-[#092046]">제작 자료 상태</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>{originalPdfData.pdf ? `PDF 등록: ${originalPdfData.pdf.fileName}` : "PDF 원본이 아직 없습니다."}</p>
              <p>페이지 이미지 {pageImageData.pages.length}개</p>
              <p>이미지·링크·영상 소재 {assetData.assets.length}개</p>
            </div>
          </article>
        </aside>

        <section className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">선택 기사</p>
                <h3 className="mt-1 text-xl font-black text-[#092046]">
                  {selectedArticle ? selectedArticle.title : "새 기사 작성"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{contentData.message}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
                <div className="rounded-lg bg-[#eef6ff] px-3 py-2">
                  기사
                  <strong className="mt-1 block text-lg text-[#092046]">{articles.length}</strong>
                </div>
                <div className="rounded-lg bg-[#eef6ff] px-3 py-2">
                  블록
                  <strong className="mt-1 block text-lg text-[#092046]">
                    {selectedArticle?.blocks.length ?? 0}
                  </strong>
                </div>
                <div className="rounded-lg bg-[#eef6ff] px-3 py-2">
                  링크
                  <strong className="mt-1 block text-lg text-[#092046]">{selectedArticle?.links.length ?? 0}</strong>
                </div>
              </div>
            </div>
          </article>

          <ProjectArticleEditorForm
            key={selectedArticle?.id ?? "new"}
            article={selectedArticle}
            assets={assetData.assets}
            pages={pageImageData.pages}
            surveys={surveyData.surveys}
            projectPageCount={project?.pageCount ?? 0}
            projectSlug={projectId}
          />

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장된 구성</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">현재 기사 블록</h3>
              </div>
              <StatusPill value={selectedArticle ? "Supabase 반영" : "저장 전"} />
            </div>

            {selectedArticle && selectedArticle.blocks.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedArticle.blocks.map((block) => (
                  <div key={block.id} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#092046]">{blockLabels[block.type] ?? block.type}</p>
                      <StatusPill value={block.isVisible ? "표시" : "숨김"} />
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                      {block.title || block.body || "내용 없음"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-bold text-slate-700">저장된 콘텐츠 블록이 없습니다.</p>
              </div>
            )}
          </article>
        </section>

        <aside className="space-y-5">
          <div className="xl:sticky xl:top-6">
            <AdminMobilePreviewFrame previewHref={mobilePreviewHref} />
          </div>
        </aside>
      </div>
    </ProjectAdminShell>
  );
}
