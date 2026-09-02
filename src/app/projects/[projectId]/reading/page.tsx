import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectArticleEditorForm } from "@/components/project-article-editor-form";
import { StatusPill } from "@/components/status-pill";
import {
  getProjectAssetFiles,
  getProjectContent,
  getProjectOriginalPdf,
  getProjectPageImages,
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

const outputChecks = [
  "제목, 요약, 본문이 모바일 화면에서 바로 이해되는 순서인지 확인",
  "버튼, 영상, 지도 URL이 실제 연결 가능한 주소인지 확인",
  "PDF 원본과 다르게 재구성한 내용이 원문 취지를 벗어나지 않는지 확인",
  "음성 대본이 본문 요지와 일치하는지 확인",
];

function getArticleStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function getPreviewBody(article: ProjectContentArticle) {
  const body = article.body.trim();

  if (!body) {
    return "본문을 입력하면 모바일 미리보기에 반영됩니다.";
  }

  return body.length > 130 ? `${body.slice(0, 130)}...` : body;
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
  const [workspace, originalPdfData, pageImageData, assetData, contentData] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectOriginalPdf(projectId),
    getProjectPageImages(projectId),
    getProjectAssetFiles(projectId),
    getProjectContent(projectId),
  ]);
  const project = workspace.project;
  const articles = contentData.articles;
  const selectedArticle =
    articles.find((article) => article.id === resolvedSearchParams.articleId) ?? articles[0] ?? null;

  return (
    <ProjectAdminShell
      active="reading"
      projectId={projectId}
      title="모바일 페이지 작성"
      description="기사, 본문, 버튼, 영상, 지도, 음성 대본을 실제 Supabase 데이터로 저장하고 모바일 산출물로 조립합니다."
      sidebarTitle={
        <>
          모바일 페이지
          <br />
          작성
        </>
      }
      sidebarDescription="샘플 구성이 아니라 실제 발행할 모바일 기사와 연결 블록을 작성합니다."
      sidebarNoteTitle="작성 기준"
      sidebarNote="PDF와 지면 이미지는 참고 원본입니다. 최종 산출물은 저장된 기사와 콘텐츠 블록을 기준으로 구성합니다."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/projects/${projectId}/pages`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            원본 자료 보기
          </Link>
          <Link
            href={`/newsletters/${projectId}?preview=admin`}
            className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
          >
            모바일 미리보기
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 2xl:grid-cols-[300px_minmax(0,1fr)_360px]">
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
              <div className="space-y-3">
                {articles.map((article, index) => {
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
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black text-[#184a88]">
                          {article.pageNumber ? `${article.pageNumber}쪽` : `${index + 1}번 기사`}
                        </span>
                        <StatusPill value={getArticleStatusLabel(article.status)} />
                      </div>
                      <p className="mt-3 text-sm font-black text-[#092046]">{article.title}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {article.summary || "요약 미입력"}
                      </p>
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
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">참고 설명 영역</p>
            <h3 className="mt-1 text-lg font-bold text-[#092046]">원본 자료 상태</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>{originalPdfData.pdf ? `PDF 등록: ${originalPdfData.pdf.fileName}` : "PDF 원본이 아직 없습니다."}</p>
              <p>페이지 이미지 {pageImageData.pages.length}개</p>
              <p>소재 보관함 이미지 {assetData.assets.length}개</p>
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
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {contentData.message} 저장 후 목록과 오른쪽 모바일 미리보기가 갱신됩니다.
                </p>
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
            pages={pageImageData.pages}
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
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">모바일 미리보기</h3>
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-sm">
              <div className="overflow-hidden rounded-[22px] bg-white">
                <div className="px-4 py-4 text-white" style={{ backgroundColor: project?.primaryColor ?? "#092046" }}>
                  <p className="text-xs font-semibold text-sky-200">
                    {project?.organization ?? "프로젝트 정보 확인 필요"}
                  </p>
                  <h4 className="mt-2 text-lg font-black">{selectedArticle?.title ?? "기사 제목 입력 전"}</h4>
                </div>
                <div className="p-4">
                  <div className="rounded-xl bg-[#f4f8ff] px-4 py-3">
                    <p className="text-sm font-bold leading-6 text-[#092046]">
                      {selectedArticle?.summary || "요약을 입력하면 이 영역에 표시됩니다."}
                    </p>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {selectedArticle ? getPreviewBody(selectedArticle) : "첫 기사를 저장하면 미리보기가 표시됩니다."}
                  </p>
                  {selectedArticle?.contactName || selectedArticle?.contactPhone ? (
                    <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600">
                      <p className="font-black text-[#092046]">문의</p>
                      <p>{[selectedArticle.contactName, selectedArticle.contactPhone].filter(Boolean).join(" · ")}</p>
                    </div>
                  ) : null}
                  {selectedArticle && selectedArticle.links.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                      {selectedArticle.links.map((link) => (
                        <a
                          key={link.id}
                          href={link.targetValue}
                          className="rounded-lg bg-[#092046] px-4 py-2 text-center text-sm font-bold text-white"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-[#eef6ff] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">참고 설명 영역</p>
            <h3 className="mt-1 text-lg font-bold text-[#092046]">작성 흐름</h3>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li className="rounded-lg bg-white px-3 py-2">1. 원본 자료에서 필요한 내용을 확인</li>
              <li className="rounded-lg bg-white px-3 py-2">2. 기사 제목·요약·본문 작성</li>
              <li className="rounded-lg bg-white px-3 py-2">3. 버튼·영상·지도·음성 대본 연결</li>
              <li className="rounded-lg bg-white px-3 py-2">4. 모바일 미리보기에서 검수</li>
            </ol>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">검수 체크</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {outputChecks.map((check) => (
                <li key={check} className="rounded-lg bg-[#f4f8ff] px-3 py-2">
                  {check}
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </ProjectAdminShell>
  );
}
