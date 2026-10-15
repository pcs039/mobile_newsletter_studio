import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectArticleList } from "@/components/project-article-list";
import { getProjectContent, getProjectWorkspace } from "@/lib/newsletter-repository";
import { getProjectArticleCompositionSources } from "@/lib/article-composition-repository";
import { articlePublicInfoTypeOptions } from "@/lib/article-type-options";
import { requireAppUser } from "@/lib/app-auth";
import { isArticlePubliclyVisible, isRollingArticleExpired } from "@/lib/article-publication";

const statusLabels: Record<string, string> = { draft: "작성 중", editing: "작성 중", review: "검수 요청", approved: "검수 완료", published: "발행 반영", needs_revision: "수정 필요" };

export default async function ArticlesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await requireAppUser(`/projects/${projectId}/articles`);
  const [workspace, content] = await Promise.all([getProjectWorkspace(projectId), getProjectContent(projectId)]);
  const compositions = workspace.project ? await getProjectArticleCompositionSources(workspace.project.id) : null;
  const byId = new Map(compositions?.data.map(row => [row.articleId, row.status]) ?? []);
  return <ProjectAdminShell active="articles" projectId={projectId} title="기사 목록" description="기사 순서를 정하고, 작성·디자인·검수할 기사를 선택하세요." sidebarTitle="콘텐츠 제작" sidebarDescription="기사와 화면 구성을 관리합니다." sidebarNoteTitle="작업 순서" sidebarNote="목록에서 선택 → 작성 → 디자인 → 검수·발행" showDefaultHeaderActions={false}>
    {content.source !== "supabase" && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-4 text-sm">{content.message}</p>}
    <ProjectArticleList projectSlug={projectId} rows={content.articles.map(article => ({
      id: article.id, title: article.title,
      typeLabel: articlePublicInfoTypeOptions.find(option => option.value === article.articleType)?.label ?? "일반형",
      statusLabel: statusLabels[article.status] ?? article.status,
      updated: article.updated,
      visibilityLabel: isRollingArticleExpired(article) ? "기간 만료" : workspace.project?.statusCode !== "published" ? "프로젝트 비공개" : isArticlePubliclyVisible(article) ? "공개 대상" : "수시 비공개",
      designLabel: byId.get(article.id) === "ready" ? "디자인 준비됨" : byId.has(article.id) ? "디자인 조정 중" : "기본 디자인",
      blockCount: article.blocks.length, linkCount: article.links.length,
    }))} />
  </ProjectAdminShell>;
}
