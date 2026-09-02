import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";
import {
  linkBlockGuidelines,
  sampleContentBlocks,
  sampleImageOverlays,
  sampleNewsletterArticles,
  sampleNewsletterPages,
} from "@/lib/newsletter-data";
import {
  getProjectAssetFiles,
  getProjectOriginalPdf,
  getProjectPageImages,
  getProjectWorkspace,
} from "@/lib/newsletter-repository";

const blockTools = [
  { label: "제목", detail: "페이지 또는 섹션 제목" },
  { label: "본문", detail: "모바일 문단" },
  { label: "이미지", detail: "소재 보관함 연결" },
  { label: "버튼", detail: "신청·전화·다운로드" },
  { label: "지도", detail: "지도 이미지와 URL" },
  { label: "영상", detail: "YouTube 등 외부 링크" },
  { label: "음성", detail: "MP3와 대본" },
];

const pageSections = [
  { label: "상단 대표 영역", status: "필수", detail: "페이지 제목, 요약, 대표 이미지" },
  { label: "본문 정보 영역", status: "작성 중", detail: "문단, 표 대체 카드, 보조 이미지" },
  { label: "행동 유도 영역", status: "검수 필요", detail: "신청 버튼, 전화 연결, 지도 보기" },
  { label: "접근성 영역", status: "대기", detail: "음성 대본, MP3, 대체텍스트" },
];

const outputChecks = [
  "페이지마다 제목, 요약, 본문, 버튼 역할이 분리되어 있는지 확인",
  "PDF 지면 이미지는 기준 자료로 두고 모바일 화면은 별도 섹션으로 재구성",
  "지도, 영상, 전화, 신청 링크가 같은 위치 규칙으로 배치되는지 확인",
  "대표 이미지와 보조 이미지는 소재 보관함의 권리·품질 상태를 기준으로 선택",
  "음성 대본과 본문 내용이 서로 어긋나지 않는지 확인",
];

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-2 block text-sm font-bold text-[#092046]">{children}</label>;
}

function TextInput({ placeholder, defaultValue }: { placeholder: string; defaultValue?: string }) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
    />
  );
}

export default async function ReadingEditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [workspace, originalPdfData, pageImageData, assetData] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectOriginalPdf(projectId),
    getProjectPageImages(projectId),
    getProjectAssetFiles(projectId),
  ]);
  const project = workspace.project;
  const selectedArticle = sampleNewsletterArticles[0];
  const registeredPages = pageImageData.pages;
  const visiblePages = registeredPages.length > 0 ? registeredPages : sampleNewsletterPages.slice(0, 6);
  const selectedPageTitle = registeredPages[0]?.title ?? selectedArticle.title;
  const selectedPageNumber = registeredPages[0]?.pageNumber ?? 1;

  return (
    <ProjectAdminShell
      active="reading"
      projectId={projectId}
      title="모바일 페이지 작성"
      description="페이지별 섹션을 만들고 제목, 본문, 이미지, 영상, 지도, 버튼, 음성을 하나의 산출물로 조립합니다."
      sidebarTitle={
        <>
          모바일 페이지
          <br />
          작성
        </>
      }
      sidebarDescription="파일을 따로 관리하는 화면이 아니라 실제 모바일 소식지 화면을 페이지와 섹션 단위로 구성합니다."
      sidebarNoteTitle="작성 기준"
      sidebarNote="PDF와 지면 이미지는 참고 원본입니다. 최종 산출물은 모바일 페이지 안의 섹션과 콘텐츠 블록으로 정리합니다."
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
      <div className="grid gap-5 2xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">페이지 목록</p>
              <h3 className="mt-1 text-lg font-bold text-[#092046]">모바일 산출물</h3>
            </div>
            <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
              {visiblePages.length}개
            </span>
          </div>

          <div className="space-y-3">
            {visiblePages.map((page, index) => {
              const pageNumber = "pageNumber" in page ? page.pageNumber : page.number;
              const status = "status" in page ? page.status : "구성 대기";
              const isActive = index === 0;

              return (
                <button
                  key={`${pageNumber}-${page.title}`}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    isActive
                      ? "border-[#184a88] bg-[#f4f8ff] shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-[#184a88]">{pageNumber}페이지</span>
                    <StatusPill value={status} />
                  </div>
                  <p className="mt-3 text-sm font-black text-[#092046]">{page.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    섹션과 콘텐츠 블록을 조합해 모바일 화면을 구성합니다.
                  </p>
                </button>
              );
            })}
          </div>

          <button className="mt-4 w-full rounded-lg border border-dashed border-[#2f73b7] bg-[#f8fbff] px-4 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]">
            + 모바일 페이지 추가
          </button>
        </aside>

        <section className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">선택 페이지</p>
                <h3 className="mt-1 text-xl font-black text-[#092046]">
                  {selectedPageNumber}페이지 · {selectedPageTitle}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  페이지 안에서 섹션을 나누고 필요한 콘텐츠 블록을 배치합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-[#2f73b7] bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]">
                  섹션 순서 변경
                </button>
                <button className="rounded-lg bg-[#092046] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]">
                  + 섹션 추가
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {pageSections.map((section) => (
                <div key={section.label} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#092046]">{section.label}</p>
                    <StatusPill value={section.status} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{section.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#092046]">섹션 편집</h3>
                <p className="mt-1 text-sm text-slate-500">
                  원고를 그대로 붙이는 것이 아니라, 모바일에서 읽히는 단위로 나눠 배치합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {blockTools.map((tool) => (
                  <button
                    key={tool.label}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                    title={tool.detail}
                  >
                    + {tool.label}
                  </button>
                ))}
              </div>
            </div>

            <form className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel>섹션 제목</FieldLabel>
                  <TextInput defaultValue={selectedArticle.title} placeholder="예: 군정 주요 소식" />
                </div>
                <div>
                  <FieldLabel>섹션 상태</FieldLabel>
                  <select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                    <option>작성 중</option>
                    <option>검수 필요</option>
                    <option>완료</option>
                  </select>
                </div>
              </div>

              <div>
                <FieldLabel>요약 문장</FieldLabel>
                <TextInput defaultValue={selectedArticle.summary} placeholder="목차와 카드에 표시될 요약" />
              </div>

              <div>
                <FieldLabel>본문 블록</FieldLabel>
                <textarea
                  defaultValue={selectedArticle.body}
                  className="min-h-52 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-dashed border-sky-200 bg-[#f4f8ff] p-5">
                  <FieldLabel>이미지 블록</FieldLabel>
                  <p className="text-sm leading-6 text-slate-600">
                    소재 보관함의 대표 이미지, 배너, 지도 이미지를 이 섹션에 연결합니다.
                  </p>
                  <Link
                    href={`/projects/${projectId}/assets`}
                    className="mt-4 inline-flex rounded-lg border border-[#2f73b7] bg-white px-4 py-2 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                  >
                    소재 보관함 열기
                  </Link>
                </div>

                <div className="rounded-lg border border-dashed border-sky-200 bg-[#f4f8ff] p-5">
                  <FieldLabel>행동 버튼 블록</FieldLabel>
                  <div className="grid gap-3">
                    <TextInput defaultValue="자세히 보기" placeholder="버튼명" />
                    <TextInput defaultValue="https://www.muan.go.kr" placeholder="URL, 전화번호, 지도 링크" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black text-[#092046]">동영상 카드</h4>
                    <StatusPill value="외부 링크" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    YouTube 등은 직접 저장하지 않고 썸네일 카드와 외부 URL을 연결합니다.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <TextInput defaultValue="홍보 영상 보기" placeholder="영상 카드 제목" />
                    <TextInput defaultValue="https://www.youtube.com" placeholder="영상 URL" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black text-[#092046]">지도 카드</h4>
                    <StatusPill value="외부 링크" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    지도 이미지를 보여주고 카카오·네이버·구글 지도 URL로 이동하게 합니다.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <TextInput defaultValue="행사장 지도 보기" placeholder="지도 카드 제목" />
                    <TextInput defaultValue="https://map.kakao.com" placeholder="지도 URL" />
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel>음성 대본 블록</FieldLabel>
                <textarea
                  defaultValue="무안군의 주요 정책과 생활 정보를 안내드립니다. 자세한 내용은 본문과 연결 버튼을 확인해 주세요."
                  className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div>
                <FieldLabel>현재 블록 구성</FieldLabel>
                <div className="grid gap-3 md:grid-cols-2">
                  {sampleContentBlocks.map((block) => (
                    <div key={block.id} className="rounded-lg border border-slate-200 bg-[#f4f8ff] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-[#092046]">{block.title}</p>
                        <StatusPill value={block.status} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{block.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  초안 저장
                </button>
                <button className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                  검수 요청으로 변경
                </button>
              </div>
            </form>
          </article>
        </section>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">모바일 미리보기</h3>
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-sm">
              <div className="overflow-hidden rounded-[22px] bg-white">
                <div className="bg-[#092046] px-4 py-4 text-white">
                  <p className="text-xs font-semibold text-sky-200">
                    {project?.organization ?? "프로젝트 정보 확인 필요"}
                  </p>
                  <h4 className="mt-2 text-lg font-black">{selectedPageTitle}</h4>
                </div>
                <div className="p-4">
                  <div className="h-32 rounded-xl bg-gradient-to-br from-sky-100 to-blue-50" />
                  <p className="mt-4 text-sm font-bold leading-6 text-[#092046]">{selectedArticle.summary}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    PDF 원본의 내용을 모바일 독자가 읽기 쉬운 섹션과 블록으로 재구성합니다.
                  </p>
                  <div className="mt-4 rounded-xl bg-[#f4f8ff] px-4 py-3">
                    <p className="text-xs font-bold text-[#184a88]">본문 듣기</p>
                    <div className="mt-3 h-2 rounded-full bg-sky-100">
                      <div className="h-2 w-1/3 rounded-full bg-[#092046]" />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {["신청 안내", "전화 연결", "지도 보기"].map((button) => (
                      <button key={button} className="rounded-lg bg-[#092046] px-4 py-2 text-sm font-bold text-white">
                        {button}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">참고 자료 패널</h3>
            <div className="mt-4 grid gap-3">
              <Link
                href={`/projects/${projectId}/pages`}
                className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3 transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
              >
                <p className="text-sm font-black text-[#092046]">원본 자료</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {originalPdfData.pdf ? "PDF 원본 등록됨" : "PDF 원본 미등록"} · 페이지 이미지 {registeredPages.length}개
                </p>
              </Link>
              <Link
                href={`/projects/${projectId}/assets`}
                className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3 transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
              >
                <p className="text-sm font-black text-[#092046]">소재 보관함</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">이미지·배너·지도 소재 {assetData.assets.length}개</p>
              </Link>
              <Link
                href={`/projects/${projectId}/audio`}
                className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3 transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
              >
                <p className="text-sm font-black text-[#092046]">음성·대본</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">대본 작성 후 MP3를 연결합니다.</p>
              </Link>
            </div>
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

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">링크·오버레이 기준</h3>
            <div className="mt-4 space-y-3">
              {linkBlockGuidelines.map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[#092046]">{item.label}</p>
                    <span className="text-xs font-black text-[#184a88]">{item.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">이미지 오버레이 예고</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이미지 위 클릭 영역은 다음 단계에서 좌표 기반 편집기로 확장합니다.
            </p>
            <div className="mt-4 space-y-3">
              {sampleImageOverlays.map((overlay) => (
                <div key={overlay.id} className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="text-sm font-bold text-[#092046]">{overlay.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    x {overlay.xPercent}% · y {overlay.yPercent}% · w {overlay.widthPercent}% · h {overlay.heightPercent}%
                  </p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </ProjectAdminShell>
  );
}
