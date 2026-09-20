import Link from "next/link";
import { AdminMobilePreviewFrame } from "@/components/admin-mobile-preview-frame";
import { FileUploadCard } from "@/components/file-upload-card";
import { ProjectPageHotspotManager } from "@/components/project-page-hotspot-manager";
import { ProjectFileDeleteButton } from "@/components/project-file-delete-button";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectEbookSearchIndexPanel } from "@/components/project-ebook-search-index-panel";
import { ProjectEbookTtsAudioPanel } from "@/components/project-ebook-tts-audio-panel";
import { ProjectPageImageBulkDelete } from "@/components/project-page-image-bulk-delete";
import { PdfToPageImageConverter } from "@/components/pdf-to-page-image-converter";
import { StatusPill } from "@/components/status-pill";
import { getProjectEbookSearchStatus } from "@/lib/ebook-page-search";
import { getProjectEbookTtsStatus } from "@/lib/ebook-tts-audio";
import { pageConversionSteps, pageQualityChecks } from "@/lib/newsletter-data";
import {
  getProjectOriginalPdf,
  getProjectPageHotspotLinks,
  getProjectPageImages,
  getProjectWorkspace,
} from "@/lib/newsletter-repository";

const imagePageSpecs = [
  { label: "권장 폭", value: "1080px", detail: "스마트폰 고해상도 기준" },
  { label: "권장 형식", value: "PNG/JPG/WebP", detail: "텍스트가 많은 페이지는 PNG 권장" },
  { label: "페이지 단위", value: "1쪽 = 이미지 1장", detail: "번호 순서대로 모바일에 표시" },
  { label: "링크 처리", value: "투명 클릭 영역", detail: "공개 화면에서 버튼처럼 작동" },
];

const imagePageWorkflow = [
  "디자인 프로그램에서 모바일 페이지 이미지 완성",
  "페이지 번호에 맞춰 이미지 업로드",
  "이미지 위에 URL·유튜브·전화 클릭 영역 지정",
  "미리보기/발행에서 실제 모바일 화면 확인",
];

const imagePageAssemblySteps = [
  {
    label: "1. 페이지 이미지",
    title: "업로드한 이미지가 본문",
    detail: "1쪽, 2쪽, 3쪽 순서대로 모바일 공개 화면에 세로로 표시됩니다.",
  },
  {
    label: "2. 클릭 영역",
    title: "이미지 위에 투명 버튼",
    detail: "관리 화면의 주황색 영역은 공개 화면에서 보이지 않는 링크 버튼으로 작동합니다.",
  },
  {
    label: "3. 공개 URL·QR",
    title: "발행 후 그대로 배포",
    detail: "발행하기 완료 후 공개 URL과 QR로 고객·독자에게 전달합니다.",
  },
];

export default async function ProjectPagesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [workspace, originalPdfData, pageImageData, hotspotData, ebookSearchStatus, ebookTtsStatus] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectOriginalPdf(projectId),
    getProjectPageImages(projectId),
    getProjectPageHotspotLinks(projectId),
    getProjectEbookSearchStatus(projectId),
    getProjectEbookTtsStatus(projectId),
  ]);
  const project = workspace.project;
  const originalPdf = originalPdfData.pdf;
  const pages = pageImageData.pages;
  const isImagePageMode = project?.productionMode === "이미지 페이지형";
  const ebookPreviewHref = `/newsletters/${projectId}/ebook?preview=admin`;

  return (
    <ProjectAdminShell
      active="pages"
      projectId={projectId}
      title="이미지 페이지 편집"
      description="페이지 이미지와 클릭 영역을 관리합니다."
      sidebarTitle={
        <>
          이미지 페이지
          <br />
          편집
        </>
      }
      sidebarDescription="페이지 이미지와 클릭 영역을 정리합니다."
      sidebarNoteTitle="운영 기준"
      sidebarNote="URL과 영상은 이미지 위 클릭 영역으로 연결합니다."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/newsletters/${projectId}?preview=admin`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78]"
          >
            모바일 미리보기
          </Link>
          <Link
            href={ebookPreviewHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            e-book 보기
          </Link>
          <Link
            href={`/projects/${projectId}/settings`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            기본 정보 수정
          </Link>
        </div>
      }
    >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]">
            <section className="space-y-5">
              <article className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">이미지 페이지 구성</p>
                    <h3 className="mt-1 text-lg font-black text-[#092046]">
                      페이지 이미지 {pages.length}개 등록
                    </h3>
                  </div>
                  <StatusPill value={isImagePageMode ? "이미지 페이지형" : "공통 자료 관리"} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {imagePageSpecs.map((spec) => (
                    <div key={spec.label} className="rounded-lg border border-[#d8e8ff] bg-white px-4 py-3">
                      <p className="text-xs font-black text-slate-500">{spec.label}</p>
                      <p className="mt-1 text-base font-black text-[#092046]">{spec.value}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{spec.detail}</p>
                    </div>
                  ))}
                </div>

                <details className="mt-4 rounded-lg border border-[#d8e8ff] bg-white p-4">
                  <summary className="cursor-pointer text-sm font-black text-[#092046]">도움말 보기</summary>
                  <ol className="mt-3 grid gap-2 lg:grid-cols-4">
                    {imagePageWorkflow.map((item, index) => (
                      <li key={item} className="rounded-lg bg-[#f4f8ff] px-3 py-3 text-sm font-bold leading-6 text-slate-700">
                        <span className="mr-2 font-black text-[#184a88]">{index + 1}.</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </details>

                <details className="mt-4 rounded-lg border border-[#b8d7ff] bg-white p-4">
                  <summary className="cursor-pointer text-sm font-black text-[#092046]">반영 방식</summary>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">페이지 이미지와 클릭 영역을 공개 화면에서 함께 표시합니다.</p>
                    </div>
                    <Link
                      href={`/newsletters/${projectId}?preview=admin`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg border border-[#2f73b7] bg-[#f7fbff] px-4 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                    >
                      반영 화면 확인
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {imagePageAssemblySteps.map((step) => (
                      <div key={step.label} className="rounded-lg bg-[#f4f8ff] px-4 py-3">
                        <p className="text-xs font-black text-[#184a88]">{step.label}</p>
                        <p className="mt-1 text-sm font-black text-[#092046]">{step.title}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">선택</span>
                    <h3 className="text-lg font-bold text-[#092046]">PDF 원본 업로드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">원본 PDF를 보관합니다.</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <FileUploadCard
                  accept="application/pdf"
                  buttonLabel="PDF 선택"
                  description="PDF 원본을 저장합니다."
                  kind="pdf_original"
                  projectSlug={projectId}
                  title="PDF 파일을 선택하거나 이 영역에 끌어다 놓기"
                />

                <PdfToPageImageConverter projectSlug={projectId} />
                <ProjectEbookSearchIndexPanel projectSlug={projectId} status={ebookSearchStatus} />
                <ProjectEbookTtsAudioPanel projectSlug={projectId} status={ebookTtsStatus} />

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
                      <p className="text-sm font-bold text-slate-600">PDF 원본 미등록</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <span className="rounded-full bg-[#092046] px-3 py-1 text-xs font-black text-white">필수</span>
                    <h3 className="text-lg font-bold text-[#092046]">페이지 이미지 업로드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">페이지 번호와 이미지를 저장하세요.</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Supabase Storage 저장
                  </span>
                </div>

                <FileUploadCard
                  accept="image/png,image/jpeg,image/webp"
                  buttonLabel="페이지 이미지 선택"
                  description="PNG, JPG, WebP를 업로드합니다."
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
                    <p className="mt-2 text-sm leading-6 text-slate-500">페이지 이미지를 업로드하세요.</p>
                  </div>
                ) : (
                  <ProjectPageImageBulkDelete pages={pages} projectSlug={projectId} />
                )}
              </article>

              <details className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-sm font-black text-[#092046]">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">선택</span>
                  <span className="ml-2">고급 편집: 클릭 영역·URL 연결</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-500">필요한 링크만 이미지 위에 지정합니다.</p>
                <div className="mt-4">
                  <ProjectPageHotspotManager links={hotspotData.links} pages={pages} projectSlug={projectId} />
                </div>
              </details>
            </section>

            <aside className="space-y-5">
              <div className="xl:sticky xl:top-6">
                <AdminMobilePreviewFrame
                  previewHref={ebookPreviewHref}
                  title="e-book 미리보기"
                  description="e-book 화면을 미리 확인합니다."
                  iframeTitle="저장된 e-book 소식지 미리보기"
                />
              </div>

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
                {isImagePageMode ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">이미지와 클릭 영역 반영을 확인하세요.</p>
                    <Link
                      href={`/newsletters/${projectId}?preview=admin`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                    >
                      모바일 미리보기 확인
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">기사 화면은 작성/편집에서 관리합니다.</p>
                    <Link
                      href={`/projects/${projectId}/reading`}
                      className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                    >
                      기사 작성/편집으로 이동
                    </Link>
                  </>
                )}
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
