import Link from "next/link";
import { FileUploadCard } from "@/components/file-upload-card";
import { ProjectFileDeleteButton } from "@/components/project-file-delete-button";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";
import { pageConversionSteps, pageQualityChecks } from "@/lib/newsletter-data";
import { getProjectOriginalPdf, getProjectPageImages } from "@/lib/newsletter-repository";

export default async function ProjectPagesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [originalPdfData, pageImageData] = await Promise.all([
    getProjectOriginalPdf(projectId),
    getProjectPageImages(projectId),
  ]);
  const originalPdf = originalPdfData.pdf;
  const pages = pageImageData.pages;

  return (
    <ProjectAdminShell
      active="pages"
      projectId={projectId}
      title="PDF 원본·페이지 이미지 관리"
      description="PDF 원본을 보관하고, PC e-book용 페이지 이미지는 수동 등록·검수 흐름으로 관리합니다."
      sidebarTitle={
        <>
          PDF·이미지
          <br />
          관리
        </>
      }
      sidebarDescription="원본 PDF는 보관하고, 페이지 이미지는 별도 등록해 PC e-book과 검수 화면에 사용합니다."
      sidebarNoteTitle="운영 기준"
      sidebarNote="PDF 자동 변환보다 실제 지면 이미지 품질, 페이지 번호, 공개 흐름을 먼저 정확히 관리합니다."
      actions={
        <Link
          href="/projects/new"
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          기본 정보 수정
        </Link>
      }
    >
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <section className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">PDF 원본 업로드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      PDF는 원본 보관용으로 저장하고, PC e-book에 사용할 페이지 이미지는 별도로 등록합니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <FileUploadCard
                  accept="application/pdf"
                  buttonLabel="PDF 선택"
                  description="권장: 10~20쪽 지자체 소식지 PDF. 페이지 이미지는 아래에서 별도 등록합니다."
                  kind="pdf_original"
                  projectSlug={projectId}
                  title="PDF 파일을 선택하거나 이 영역에 끌어다 놓기"
                />

                <div className="mt-5 rounded-lg border border-slate-300 bg-[#f8fbff] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-base font-black text-[#092046]">PDF 원본 등록 현황</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{originalPdfData.message}</p>
                    </div>
                    <StatusPill value={originalPdf ? "업로드 완료" : "미등록"} />
                  </div>

                  {originalPdf ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-sm font-black text-[#092046]">{originalPdf.fileName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">업로드일 {originalPdf.uploadedAt}</p>
                        <p className="mt-2 break-all text-xs font-semibold leading-5 text-slate-500">
                          Storage 경로: {originalPdf.path}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={originalPdf.previewHref}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[#092046] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                        >
                          PDF 열기
                        </Link>
                        <Link
                          href={originalPdf.previewHref}
                          download
                          className="rounded-lg border border-[#2f73b7] bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                        >
                          다운로드
                        </Link>
                        <ProjectFileDeleteButton
                          fileLabel={originalPdf.fileName}
                          kind="pdf_original"
                          path={originalPdf.path}
                          projectSlug={projectId}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center">
                      <p className="text-sm font-bold text-slate-600">
                        PDF를 업로드하면 파일명, 업로드일, Storage 경로가 이곳에 표시됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">페이지 이미지 업로드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      일러스트 등에서 제작한 모바일·e-book용 페이지 이미지를 페이지 번호와 함께 저장합니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <FileUploadCard
                  accept="image/png,image/jpeg,image/webp"
                  buttonLabel="페이지 이미지 선택"
                  description="페이지 번호를 먼저 확인한 뒤 PNG, JPG, WebP 파일을 업로드하세요."
                  kind="page_image"
                  projectSlug={projectId}
                  title="페이지 이미지를 선택하거나 이 영역에 끌어다 놓기"
                />
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">페이지 이미지 등록 현황</h3>
                    <p className="mt-1 text-sm text-slate-500">{pageImageData.message}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      전체
                    </button>
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      검수 대기
                    </button>
                    <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      제목 필요
                    </button>
                  </div>
                </div>

                {pages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                    <p className="text-base font-black text-[#092046]">등록된 페이지 이미지가 없습니다.</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      위 업로드 영역에서 페이지 번호와 이미지를 저장하면 이 목록에 실제 작업 현황이 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {pages.map((page) => (
                      <article key={page.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="aspect-[3/4] overflow-hidden rounded-md border border-slate-200 bg-[#eef4fb]">
                          {page.previewHref ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={page.previewHref}
                              alt={`${page.pageNumber}쪽 페이지 이미지`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full flex-col justify-between bg-white p-3">
                              <div>
                                <div className="h-3 w-2/3 rounded bg-[#092046]" />
                                <div className="mt-4 rounded-lg bg-sky-50 px-3 py-8 text-center">
                                  <p className="text-xs font-black text-[#184a88]">Storage 파일</p>
                                  <p className="mt-2 break-all text-xs font-semibold leading-5 text-slate-500">
                                    이미지 경로 없음
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs font-semibold text-slate-500">최근 수정 {page.updated}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-[#092046]">{page.pageNumber}쪽</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{page.title}</p>
                          </div>
                          <StatusPill value={page.status} />
                        </div>
                        {page.imagePath ? (
                          <div className="mt-3 flex justify-end">
                            <ProjectFileDeleteButton
                              fileLabel={`${page.pageNumber}쪽 페이지 이미지`}
                              kind="page_image"
                              path={page.imagePath}
                              projectSlug={projectId}
                              recordId={page.id}
                            />
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">등록 진행 상태</h3>
                <div className="mt-4 space-y-3">
                  {pageConversionSteps.map((step, index) => (
                    <div key={step.label} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#092046] text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#092046]">{step.label}</p>
                        <p className="text-xs font-semibold text-slate-500">{step.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">품질 확인</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  {pageQualityChecks.map((check) => (
                    <li key={check} className="rounded-lg bg-[#f4f8ff] px-3 py-2">
                      {check}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">다음 작업</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  페이지 확인 후 모바일 읽기 보기 편집 화면으로 이동합니다. 이 단계에서 기사 제목, 본문,
                  대표 이미지, 문의처, 음성 대본을 정리합니다.
                </p>
                <Link
                  href={`/projects/${projectId}/reading`}
                  className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                >
                  읽기 보기 편집으로 이동
                </Link>
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
