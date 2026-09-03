import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";
import { publishChecks } from "@/lib/newsletter-data";
import {
  getProjectAudioFiles,
  getProjectContent,
  getProjectOriginalPdf,
  getProjectPageImages,
  getProjectWorkspace,
} from "@/lib/newsletter-repository";

function QrMock() {
  const filled = new Set([0, 1, 2, 4, 6, 8, 10, 11, 14, 16, 18, 20, 21, 22, 24, 27, 30, 31, 32, 34, 36, 38, 40, 41, 42, 44, 46, 48]);

  return (
    <div className="grid h-32 w-32 grid-cols-7 gap-1 rounded-lg bg-white p-3 shadow-inner">
      {Array.from({ length: 49 }, (_, index) => (
        <span key={index} className={`rounded-sm ${filled.has(index) ? "bg-[#092046]" : "bg-slate-100"}`} />
      ))}
    </div>
  );
}

function getReadinessStatus(done: boolean, label = "완료") {
  return done ? label : "보완 필요";
}

export default async function PublishPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [workspace, contentData, pageImageData, originalPdfData, audioData] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectContent(projectId),
    getProjectPageImages(projectId),
    getProjectOriginalPdf(projectId),
    getProjectAudioFiles(projectId),
  ]);
  const project = workspace.project;
  const articles = contentData.articles;
  const firstArticle = articles[0] ?? null;
  const firstPages = pageImageData.pages.slice(0, 2);
  const publicPreviewHref = `/newsletters/${projectId}?preview=admin`;
  const ebookPreviewHref = `/newsletters/${projectId}/ebook?preview=admin`;
  const readyCount = [
    Boolean(originalPdfData.pdf),
    pageImageData.pages.length > 0,
    articles.length > 0,
    articles.some((article) => article.links.length > 0),
    audioData.files.length > 0 || articles.some((article) => article.blocks.some((block) => block.type === "audio")),
  ].filter(Boolean).length;
  const readinessItems = [
    {
      label: "PDF 원본",
      status: getReadinessStatus(Boolean(originalPdfData.pdf), "등록됨"),
      detail: originalPdfData.pdf ? originalPdfData.pdf.fileName : "원본 자료 화면에서 PDF를 업로드하세요.",
    },
    {
      label: "PC e-book",
      status: getReadinessStatus(pageImageData.pages.length > 0, "이미지 등록"),
      detail:
        pageImageData.pages.length > 0
          ? `페이지 이미지 ${pageImageData.pages.length}개 등록`
          : "PC e-book용 페이지 이미지를 등록하세요.",
    },
    {
      label: "모바일 기사",
      status: getReadinessStatus(articles.length > 0, "작성됨"),
      detail: articles.length > 0 ? `모바일 기사 ${articles.length}개 작성` : "모바일 페이지 작성 화면에서 기사를 저장하세요.",
    },
    {
      label: "연결 링크",
      status: getReadinessStatus(articles.some((article) => article.links.length > 0), "연결됨"),
      detail: `${articles.reduce((total, article) => total + article.links.length, 0)}개 링크 등록`,
    },
    {
      label: "음성·대본",
      status: getReadinessStatus(
        audioData.files.length > 0 || articles.some((article) => article.blocks.some((block) => block.type === "audio")),
        "준비됨",
      ),
      detail: `MP3 ${audioData.files.length}개 · 기사 대본 ${
        articles.filter((article) => article.blocks.some((block) => block.type === "audio")).length
      }개`,
    },
  ];
  const distributionItems = [
    { label: "공개 URL", value: project?.publicUrl ?? `/newsletters/${projectId}` },
    { label: "PC e-book URL", value: project?.ebookUrl ?? `/newsletters/${projectId}/ebook` },
    { label: "공개 상태", value: project?.status ?? "프로젝트 확인 필요" },
    { label: "최종 수정", value: project?.updated ?? "-" },
  ];

  return (
    <ProjectAdminShell
      active="publish"
      projectId={projectId}
      title="검수·발행"
      description="모바일 페이지, PC e-book, 링크, 음성 상태를 실제 등록 데이터 기준으로 최종 확인합니다."
      sidebarTitle={
        <>
          검수
          <br />
          발행
        </>
      }
      sidebarDescription="공개 전 모바일 산출물, PC e-book, URL·QR 발행 상태를 최종 확인합니다."
      sidebarNoteTitle="공개 기준"
      sidebarNote="모바일은 작성 기사와 연결 블록, PC는 등록된 페이지 이미지 기준으로 검수합니다."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/projects/${projectId}/reading`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            작성 화면으로 돌아가기
          </Link>
          <Link
            href={publicPreviewHref}
            className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
          >
            공개 화면 열기
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#092046]">발행 준비 상태</h3>
                <p className="mt-1 text-sm text-slate-500">
                  실제 저장된 프로젝트 자료를 기준으로 완료 여부를 확인합니다.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  readyCount === readinessItems.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {readyCount}/{readinessItems.length} 준비
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {readinessItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-[#f9fbfe] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-[#092046]">{item.label}</p>
                    <StatusPill value={item.status} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <section className="grid gap-5 2xl:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">모바일 읽기 보기</h3>
                  <p className="mt-1 text-sm text-slate-500">저장된 기사 기준 모바일 공개 화면</p>
                </div>
                <StatusPill value={articles.length > 0 ? "기사 있음" : "기사 없음"} />
              </div>
              <Link
                href={publicPreviewHref}
                className="mb-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                공개 화면 열기
              </Link>
              <div className="mx-auto max-w-[300px] rounded-[30px] border border-slate-200 bg-slate-950 p-3 shadow-sm">
                <div className="overflow-hidden rounded-[24px] bg-white">
                  <div className="px-4 py-4 text-white" style={{ backgroundColor: project?.primaryColor ?? "#092046" }}>
                    <p className="text-xs font-semibold text-sky-200">
                      {project?.organization ?? "프로젝트 정보 확인 필요"}
                    </p>
                    <h4 className="mt-2 text-lg font-black">{firstArticle?.title ?? project?.title ?? projectId}</h4>
                  </div>
                  <div className="p-4">
                    {firstArticle ? (
                      <>
                        <p className="rounded-lg bg-[#f4f8ff] px-3 py-3 text-sm font-black leading-6 text-[#092046]">
                          {firstArticle.summary || "요약 미입력"}
                        </p>
                        <p className="mt-4 line-clamp-5 text-sm leading-7 text-slate-600">
                          {firstArticle.body || "본문 미입력"}
                        </p>
                        <div className="mt-4 grid gap-2">
                          {firstArticle.links.slice(0, 3).map((link) => (
                            <div key={link.id} className="rounded-lg bg-[#092046] px-3 py-2 text-center text-xs font-bold text-white">
                              {link.label}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center">
                        <p className="text-sm font-black text-[#092046]">저장된 모바일 기사가 없습니다.</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">작성 화면에서 첫 기사를 저장하세요.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">PC e-book 보기</h3>
                  <p className="mt-1 text-sm text-slate-500">등록 페이지 이미지 기준 PC 화면</p>
                </div>
                <StatusPill value={pageImageData.pages.length > 0 ? "이미지 있음" : "이미지 없음"} />
              </div>
              <Link
                href={ebookPreviewHref}
                className="mb-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                PC e-book 열기
              </Link>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
                <div className="rounded-t-lg bg-[#092046] px-4 py-3 text-sm font-bold text-white">
                  PC e-book 미리보기
                </div>
                {firstPages.length > 0 ? (
                  <div className="grid gap-4 rounded-b-lg bg-white p-4 md:grid-cols-2">
                    {firstPages.map((page) => (
                      <div key={page.id} className="aspect-[3/4] overflow-hidden rounded-md border border-slate-200 bg-white">
                        {page.previewHref ? (
                          <img src={page.previewHref} alt={page.title} className="h-full w-full object-contain" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs font-bold text-slate-500">이미지 경로 없음</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-b-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                    <p className="text-sm font-black text-[#092046]">등록된 페이지 이미지가 없습니다.</p>
                  </div>
                )}
              </div>
            </article>
          </section>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">발행 전 체크리스트</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {publishChecks.map((check) => (
                <label key={check} className="flex gap-3 rounded-lg bg-[#f4f8ff] px-3 py-3 text-sm leading-6 text-slate-600">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#092046]" />
                  <span>{check}</span>
                </label>
              ))}
            </div>
          </article>
        </section>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">공개 정보</h3>
            <div className="mt-4 space-y-3">
              {distributionItems.map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="text-xs font-black text-[#184a88]">{item.label}</p>
                  <p className="mt-1 break-words text-sm font-bold text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#092046]">QR 코드</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  QR 생성 기능을 연결하면 공개 URL 기준 이미지로 내려받을 수 있습니다.
                </p>
              </div>
              <QrMock />
            </div>
            <button className="mt-5 w-full rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              QR PNG 다운로드
            </button>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">공개 상태 변경</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              현재 상태: <strong className="text-[#092046]">{project?.status ?? "확인 필요"}</strong>
            </p>
            <button className="mt-4 w-full rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
              공개 URL 발행
            </button>
          </article>
        </aside>
      </div>
    </ProjectAdminShell>
  );
}
