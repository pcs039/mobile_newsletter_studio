import Link from "next/link";
import { ArticleWorkspaceTabs, type ArticleWorkspaceTab } from "@/components/article-workspace-tabs";
import { ArticleCompositionEditor } from "@/components/design/article-composition-editor";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectArticleEditorForm } from "@/components/project-article-editor-form";
import { StatusPill } from "@/components/status-pill";
import { isRollingArticleExpired } from "@/lib/article-publication";
import {
  getProjectArticleComposition,
  getProjectArticleCompositionSources,
} from "@/lib/article-composition-repository";
import {
  getProjectAssetFiles,
  getProjectContent,
  getProjectDesignAssets,
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
  searchParams?: Promise<{ articleId?: string; tab?: string }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [workspace, originalPdfData, pageImageData, assetData, contentData, surveyData, designAssetData] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectOriginalPdf(projectId),
    getProjectPageImages(projectId),
    getProjectAssetFiles(projectId),
    getProjectContent(projectId),
    getProjectSurveys(projectId),
    getProjectDesignAssets(projectId),
  ]);
  const project = workspace.project;
  const articles = contentData.articles;
  const requestedArticleId = resolvedSearchParams.articleId;
  const selectedArticle = requestedArticleId
    ? articles.find((article) => article.id === requestedArticleId) ?? null
    : null;
  const requestedTab = resolvedSearchParams.tab;
  const initialTab: ArticleWorkspaceTab = selectedArticle && (requestedTab === "composition" || requestedTab === "review")
    ? requestedTab
    : "content";
  const [compositionData, compositionSourceData] = await Promise.all([
    selectedArticle && project
      ? getProjectArticleComposition(project.id, selectedArticle.id)
      : null,
    project ? getProjectArticleCompositionSources(project.id) : null,
  ]);
  const compositionSourceByArticleId = new Map(
    compositionSourceData?.data.map((source) => [source.articleId, source]) ?? [],
  );
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
      title="기사 제작·배치"
      description="원본자료를 바탕으로 기사 내용과 미디어를 만들고 모바일 디자인을 조정합니다."
      sidebarTitle={
        <>
          콘텐츠
          <br />
          제작
        </>
      }
      sidebarDescription="발행호의 기사, 미디어와 화면 구성을 제작합니다."
      sidebarNoteTitle="작성 기준"
      sidebarNote="공개 화면은 저장된 기사 블록 기준입니다."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/projects/${projectId}/quick-post`}
            className="rounded-lg border border-[#2f73b7] bg-[#eaf3ff] px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-white"
          >
            + 빠른 소식 등록
          </Link>
          <Link
            href={`/projects/${projectId}/pages`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            페이지형 콘텐츠 편집
          </Link>
        </div>
      }
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">발행호 구성</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">기사 목록</h3>
              </div>
              <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                {articles.length}개
              </span>
            </div>

            {articles.length > 0 ? (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {listArticles.map((article, index) => {
                  const isActive = selectedArticle?.id === article.id;
                  const isRolling = article.publicationKind === "rolling";
                  const isExpired = isRollingArticleExpired(article);

                  return (
                    <Link
                      key={article.id}
                      href={`/projects/${projectId}/reading?articleId=${article.id}&tab=content`}
                      className={`block rounded-lg border p-4 transition ${
                        isActive
                          ? "border-[#184a88] bg-[#f4f8ff] shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-black text-[#184a88]">{getArticleSourceLabel(article, index)}</p>
                            {isRolling ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">수시</span> : null}
                            {isRolling && article.urgency === "urgent" ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800">긴급</span> : null}
                            {isExpired ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700">만료</span> : null}
                          </div>
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
              href={`/projects/${projectId}/reading?tab=content`}
              className="mt-4 block rounded-lg bg-[#092046] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
            >
              + 새 기사 작성
            </Link>
          </article>

          <article className="rounded-lg border border-slate-200 bg-[#eef6ff] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">자료·기획</p>
            <h3 className="mt-1 text-lg font-bold text-[#092046]">원본자료 상태</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>{originalPdfData.pdf ? `PDF 등록: ${originalPdfData.pdf.fileName}` : "PDF 원본이 아직 없습니다."}</p>
              <p>페이지 이미지 {pageImageData.pages.length}개</p>
              <p>이미지·링크·영상 소재 {assetData.assets.length}개</p>
            </div>
          </article>
        </aside>

        <ArticleWorkspaceTabs
          key={selectedArticle?.id ?? "new"}
          articleId={selectedArticle?.id ?? null}
          articleStatus={selectedArticle ? getArticleStatusLabel(selectedArticle.status) : "신규 작성"}
          articleTitle={selectedArticle?.title ?? "새 기사 작성"}
          blockCount={selectedArticle?.blocks.length ?? 0}
          initialTab={initialTab}
          linkCount={selectedArticle?.links.length ?? 0}
          previewHref={mobilePreviewHref}
          totalArticleCount={articles.length}
          content={
            <ProjectArticleEditorForm
              key={selectedArticle?.id ?? "new"}
              article={selectedArticle}
              assets={assetData.assets}
              pages={pageImageData.pages}
              surveys={surveyData.surveys}
              projectPageCount={project?.pageCount ?? 0}
              projectSlug={projectId}
              showReviewActions={false}
            />
          }
          composition={
            selectedArticle && compositionData ? (
              <ArticleCompositionEditor
                article={{
                  body: selectedArticle.body,
                  blocks: selectedArticle.blocks,
                  id: selectedArticle.id,
                  summary: selectedArticle.summary,
                  title: selectedArticle.title,
                  showPublicTitle: selectedArticle.showPublicTitle,
                }}
                assets={designAssetData.ok ? designAssetData.assets : []}
                initialComposition={compositionData.data}
                initialStatus={compositionData.status}
                projectSlug={projectId}
                reuseSources={listArticles
                  .filter((article) => article.id !== selectedArticle.id)
                  .map((article) => ({
                    hasComposition: compositionSourceByArticleId.has(article.id),
                    id: article.id,
                    orderLabel: getArticleSortLabel(article),
                    statusLabel: getArticleStatusLabel(article.status),
                    title: article.title,
                  }))}
              />
            ) : (
              <article className="rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] px-5 py-10 text-center">
                <h3 className="text-lg font-black text-[#092046]">기사를 먼저 선택하세요.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">저장된 기사를 선택하면 화면 구성을 편집할 수 있습니다.</p>
              </article>
            )
          }
          review={
            selectedArticle ? (
              <div className="space-y-5">
                <article className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">내부 검수</p>
                      <h3 className="mt-1 text-lg font-black text-[#092046]">저장된 기사 상태 확인</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        현재 저장본의 표시 순서를 확인한 뒤 프로젝트 검수·발행 화면으로 이동합니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={getArticleStatusLabel(selectedArticle.status)} />
                      <StatusPill value="Supabase 반영" />
                    </div>
                  </div>
                </article>

                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">모바일 검수 전 확인</p>
                      <h3 className="mt-1 text-lg font-bold text-[#092046]">현재 기사 블록</h3>
                    </div>
                    <span className="text-xs font-bold text-slate-500">저장된 블록 {selectedArticle.blocks.length}개</span>
                  </div>

                  {selectedArticle.blocks.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {selectedArticle.blocks.map((block, index) => (
                        <div key={block.id} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-xs font-black text-[#184a88]">
                                {index + 1}
                              </span>
                              <p className="truncate text-sm font-black text-[#092046]">{blockLabels[block.type] ?? block.type}</p>
                            </div>
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

                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-black text-[#092046]">프로젝트 검수·발행</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">전체 기사와 공개 URL, QR을 최종 확인합니다.</p>
                    </div>
                    <Link
                      href={`/projects/${projectId}/publish`}
                      className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
                    >
                      검수·발행 화면으로 이동
                    </Link>
                  </div>
                </article>
              </div>
            ) : (
              <article className="rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] px-5 py-10 text-center">
                <h3 className="text-lg font-black text-[#092046]">기사를 먼저 저장하세요.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">저장된 기사부터 검수·발행 단계로 이동할 수 있습니다.</p>
              </article>
            )
          }
        />
      </div>
    </ProjectAdminShell>
  );
}
