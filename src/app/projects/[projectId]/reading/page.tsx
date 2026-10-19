import { mapFullLayouts } from "@/lib/article-full-layout-server";
import { mapAiImageArticles } from "@/lib/ai-image-article-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/lib/app-auth";
import { isArticleProductionPattern } from "@/lib/article-production-pattern";
import { ArticleWorkspaceTabs, type ArticleWorkspaceTab } from "@/components/article-workspace-tabs";
import { ArticleCompositionEditor } from "@/components/design/article-composition-editor";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectArticleEditorForm } from "@/components/project-article-editor-form";
import { StatusPill } from "@/components/status-pill";
import {
  getProjectArticleComposition,
  getProjectArticleCompositionSources,
} from "@/lib/article-composition-repository";
import {
  getFontAssets,
  getProjectAssetFiles,
  getProjectContent,
  getProjectDesignAssets,
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

function getArticleSortLabel(article: ProjectContentArticle) {
  return article.sortOrder > 0 ? `노출 ${article.sortOrder}` : "노출 순서 미정";
}

export default async function ReadingEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ articleId?: string; tab?: string; recommendedPattern?: string }>;
}) {
  const { projectId } = await params;
  await requireAppUser(`/projects/${projectId}/reading`);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [workspace, pageImageData, assetData, contentData, surveyData, designAssetData, fontData] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectPageImages(projectId),
    getProjectAssetFiles(projectId),
    getProjectContent(projectId),
    getProjectSurveys(projectId),
    getProjectDesignAssets(projectId),
    getFontAssets({ activeOnly: true }),
  ]);
  const project = workspace.project;
  const articles = contentData.articles;
  const requestedArticleId = resolvedSearchParams.articleId;
  const selectedArticle = requestedArticleId
    ? articles.find((article) => article.id === requestedArticleId) ?? null
    : null;
  if (requestedArticleId && !selectedArticle) {
    if (contentData.source !== "supabase") throw new Error("기사 목록을 불러오지 못했습니다. 다시 확인해 주세요.");
    notFound();
  }
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
  const previewArticle = selectedArticle && project ? (await mapAiImageArticles(project.id,projectId,await mapFullLayouts(project.id,projectId,[selectedArticle],"preview"),"preview"))[0] : selectedArticle;
  const mobilePreviewHref = selectedArticle
    ? `/newsletters/${projectId}?preview=admin&articleId=${selectedArticle.id}`
    : `/newsletters/${projectId}?preview=admin`;
  const listArticles = articles;

  return (
    <ProjectAdminShell
      active="reading"
      projectId={projectId}
      title={selectedArticle ? "기사 수정" : "새 기사 작성"}
      description="원본자료를 바탕으로 기사 내용과 미디어를 만들고 모바일 디자인을 조정합니다."
      sidebarTitle="콘텐츠 제작"
      sidebarDescription="발행호의 기사, 미디어와 화면 구성을 제작합니다."
      sidebarNoteTitle="작성 기준"
      sidebarNote="공개 화면은 저장된 기사 블록 기준입니다."
      actions={<Link href={`/projects/${projectId}/articles`} className="dd-btn dd-btn-secondary">기사 목록으로</Link>}
    >
      <div className="min-w-0">
        <ArticleWorkspaceTabs
          articleIds={contentData.articles.map(article => article.id)}
          key={`${selectedArticle?.id ?? "new"}:${initialTab}:${isArticleProductionPattern(resolvedSearchParams.recommendedPattern) ? resolvedSearchParams.recommendedPattern : ""}`}
          articleId={selectedArticle?.id ?? null}
          articleStatus={selectedArticle ? getArticleStatusLabel(selectedArticle.status) : "신규 작성"}
          articleTitle={selectedArticle?.title ?? "새 기사 작성"}
          blockCount={selectedArticle?.blocks.length ?? 0}
          initialTab={initialTab}
          linkCount={selectedArticle?.links.length ?? 0}
          previewHref={mobilePreviewHref}
          publishHref={`/projects/${projectId}/publish`}
          content={
            <ProjectArticleEditorForm
              key={selectedArticle?.id ?? "new"}
              article={selectedArticle}
              assets={assetData.assets}
              fonts={fontData.fonts}
              projectTitleFontAssetId={project?.titleFontAssetId}
              projectBodyFontAssetId={project?.bodyFontAssetId}
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
                  articleType: selectedArticle.articleType,
                  publicInfo: selectedArticle.publicInfo,
                  institutionPriority: selectedArticle.institutionPriority,
                  urgency: selectedArticle.urgency,
                  publicationKind: selectedArticle.publicationKind,
                  blocks: previewArticle?.blocks ?? selectedArticle.blocks,
                  links: selectedArticle.links,
                  id: selectedArticle.id,
                  summary: selectedArticle.summary,
                  title: selectedArticle.title,
                  showPublicTitle: selectedArticle.showPublicTitle,
                }}
                previewArticle={previewArticle ?? selectedArticle}
                previewContext={{
                  fontAssets: fontData.fonts,
                  projectBodyFontAssetId: project?.bodyFontAssetId,
                  projectTitleFontAssetId: project?.titleFontAssetId,
                  slug: projectId,
                  survey: surveyData.surveys.find(survey => survey.id === selectedArticle.surveyId),
                }}
                assets={designAssetData.ok ? designAssetData.assets : []}
                initialComposition={compositionData.data}
                initialStatus={compositionData.status}
                projectSlug={projectId}
                recommendedPattern={isArticleProductionPattern(resolvedSearchParams.recommendedPattern) ? resolvedSearchParams.recommendedPattern : undefined}
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
                        상단 저장본 미리보기에서 저장본을 보고, 기관 검토·발행으로 이동하세요.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={getArticleStatusLabel(selectedArticle.status)} />
                    </div>
                  </div>
                </article>

                <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <summary className="cursor-pointer text-sm font-black text-[#092046]">저장된 내용·표시 순서 확인</summary>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                </details>

                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-black text-[#092046]">기관 검토·발행</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">모바일 확인을 마치면 기관 검토 상태와 공개 가능 여부를 확인하세요.</p>
                    </div>
                    <Link
                      href={`/projects/${projectId}/publish`}
                      className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-[#123a78]"
                    >
                      기관 검토·발행으로 이동
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
