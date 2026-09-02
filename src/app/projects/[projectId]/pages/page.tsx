import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";

const pageCards = Array.from({ length: 16 }, (_, index) => ({
  number: index + 1,
  title:
    index === 0
      ? "표지"
      : index === 1
        ? "군정 주요 소식"
        : index === 15
          ? "뒷표지"
          : `기사 페이지 ${index + 1}`,
  status: index < 4 ? "변환 완료" : index < 12 ? "검수 대기" : "제목 입력 필요",
}));

const conversionSteps = [
  { label: "PDF 업로드", status: "대기" },
  { label: "페이지 이미지 변환", status: "샘플 완료" },
  { label: "PC e-book 구성", status: "준비됨" },
  { label: "모바일 읽기 보기", status: "다음 단계" },
];

const qualityChecks = [
  "페이지 순서가 원본 PDF와 같은지 확인",
  "표지와 뒷표지가 잘리지 않았는지 확인",
  "PC e-book에서 확대했을 때 글자와 이미지가 흐리지 않은지 확인",
  "클릭 영역을 추가할 페이지를 미리 표시",
];

export default function ProjectPagesPage() {
  return (
    <ProjectAdminShell
      active="pages"
      title="PDF 업로드·페이지 관리"
      description="1차 MVP에서는 실제 변환 전, 업로드 상태와 16쪽 페이지 관리 흐름을 먼저 구현합니다."
      sidebarTitle={
        <>
          PDF·페이지
          <br />
          관리
        </>
      }
      sidebarDescription="원본 PDF를 PC e-book용 페이지 이미지로 변환하고 페이지별 상태를 확인합니다."
      sidebarNoteTitle="현재 기준"
      sidebarNote="PC는 e-book 원본 보기를 중심으로, 모바일은 다음 단계의 읽기 보기 편집을 중심으로 설계합니다."
      actions={
        <Link
          href="/projects/new"
          className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
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
                    <h3 className="text-lg font-bold text-[#092046]">PDF 파일 업로드</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      PDF를 업로드하면 페이지 이미지 변환, PC e-book 구성, 모바일 읽기 보기 편집 순서로 진행합니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    실제 업로드 연동 전
                  </span>
                </div>

                <div className="mt-5 rounded-lg border-2 border-dashed border-sky-200 bg-[#f4f8ff] px-5 py-8 text-center">
                  <p className="text-base font-bold text-[#092046]">PDF 파일을 선택하거나 이 영역에 끌어다 놓기</p>
                  <p className="mt-2 text-sm text-slate-600">
                    권장: 10~20쪽 지자체 소식지 PDF, 최대 용량 기준은 저장소 연동 단계에서 확정
                  </p>
                  <button className="mt-5 rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                    PDF 선택
                  </button>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#092046]">페이지 변환 결과</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      샘플 기준 16쪽 페이지 카드를 먼저 배치했습니다.
                    </p>
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

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {pageCards.map((page) => (
                    <article key={page.number} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="aspect-[3/4] rounded-md border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-3">
                        <div className="h-full rounded border border-slate-200 bg-white p-3">
                          <div className="h-3 w-2/3 rounded bg-[#092046]" />
                          <div className="mt-3 space-y-2">
                            <div className="h-2 rounded bg-slate-200" />
                            <div className="h-2 rounded bg-slate-200" />
                            <div className="h-2 w-4/5 rounded bg-slate-200" />
                          </div>
                          <div className="mt-5 h-16 rounded bg-sky-100" />
                          <div className="mt-3 space-y-2">
                            <div className="h-2 rounded bg-slate-200" />
                            <div className="h-2 w-3/5 rounded bg-slate-200" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-[#092046]">{page.number}쪽</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{page.title}</p>
                        </div>
                        <StatusPill value={page.status} />
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">변환 진행 상태</h3>
                <div className="mt-4 space-y-3">
                  {conversionSteps.map((step, index) => (
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
                  {qualityChecks.map((check) => (
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
                  href="/projects/muan-2025-94/reading"
                  className="mt-5 block w-full rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
                >
                  읽기 보기 편집으로 이동
                </Link>
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
