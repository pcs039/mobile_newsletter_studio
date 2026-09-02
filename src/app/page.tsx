import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { ProjectArchiveButton } from "@/components/project-archive-button";
import { StatusPill } from "@/components/status-pill";
import {
  assetChecks,
  dashboardAnalyticsNotes,
  projectOperationActions,
  workflowSteps,
} from "@/lib/newsletter-data";
import { getDashboardProjects } from "@/lib/newsletter-repository";
import { getSupabaseConfigStatus } from "@/lib/supabase-config";

const dashboardActionClass =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-[#092046] transition hover:border-[#184a88] hover:bg-[#eaf2ff]";
const dashboardPrimaryActionClass =
  "inline-flex h-8 items-center justify-center rounded-md bg-[#092046] px-3 text-xs font-black text-white shadow-sm shadow-blue-950/20 transition hover:bg-[#123a78]";

function parseCount(value: string) {
  return Number(value.replace(/,/g, "")) || 0;
}

export default async function Home() {
  const supabaseConfig = getSupabaseConfigStatus();
  const dashboardData = await getDashboardProjects();
  const projects = dashboardData.projects;
  const dashboardSummaryCards = [
    { label: "전체 프로젝트", value: String(projects.length) },
    { label: "제작 중", value: String(projects.filter((project) => project.status === "제작 중").length) },
    {
      label: "오늘 접속",
      value: projects.reduce((sum, project) => sum + parseCount(project.views.today), 0).toLocaleString("ko-KR"),
    },
    { label: "발행 완료", value: String(projects.filter((project) => project.status === "발행 완료").length) },
  ];
  const dashboardSummaryDetails: Record<string, string> = {
    "전체 프로젝트": dashboardData.source === "supabase" ? "DB 연동" : "샘플 표시",
    "제작 중": "편집 필요",
    "오늘 접속": "집계 예정",
    "발행 완료": "URL·QR 생성",
  };

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              모바일 소식지
              <br />
              제작 관리
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              작업설계도 v0.5 기준의 관리자 MVP 화면
            </p>
          </div>

          <AdminMainNavigation active="dashboard" />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">공개 화면 원칙</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              모바일은 읽기 보기와 음성 듣기 중심, PC는 e-book 원본 보기 중심으로
              설계합니다.
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">DataDiction 1차 MVP 베이스</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                프로젝트 대시보드
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                PDF 원본과 등록 이미지를 바탕으로 모바일 읽기 콘텐츠와 PC e-book을 발행합니다.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
            >
              + 새 소식지 만들기
            </Link>
          </header>

          <section className="mb-7 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {dashboardSummaryCards.map((card) => (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <div className="mt-3 flex items-end justify-between">
                  <strong className="text-3xl font-black text-[#092046]">{card.value}</strong>
                  <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                    {dashboardSummaryDetails[card.label]}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="mb-7 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Supabase 연결 준비</p>
                  <h3 className="mt-1 text-lg font-bold text-[#092046]">저장소 환경 설정</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    프로젝트 조회와 생성에 필요한 Supabase 환경변수, 스키마, 서버 저장 키 상태를 확인합니다.
                  </p>
                </div>
                <StatusPill value={supabaseConfig.isConfigured ? "환경변수 준비" : "설정 필요"} />
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                <div className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="font-bold text-[#092046]">URL</p>
                  <p className="mt-1 text-xs font-semibold">
                    {supabaseConfig.url ? "입력됨" : "NEXT_PUBLIC_SUPABASE_URL 필요"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="font-bold text-[#092046]">Anon Key</p>
                  <p className="mt-1 text-xs font-semibold">
                    {supabaseConfig.anonKey ? "입력됨" : "NEXT_PUBLIC_SUPABASE_ANON_KEY 필요"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="font-bold text-[#092046]">Service Key</p>
                  <p className="mt-1 text-xs font-semibold">
                    {supabaseConfig.hasServiceRoleKey ? "서버용 키 있음" : "선택 사항"}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#092046]">연결 점검</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                스키마를 적용하고 Vercel 환경변수를 넣은 뒤 API 상태를 확인합니다.
              </p>
              <a
                href="/api/supabase/health"
                className="mt-4 inline-flex w-full justify-center rounded-lg bg-[#092046] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
              >
                Supabase 상태 확인
              </a>
            </article>
          </section>

          <section className="mb-7 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
            <article className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">소식지 프로젝트</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {dashboardData.message} 핵심 진행 상태와 다음 작업 이동을 먼저 확인합니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    전체
                  </button>
                  <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    제작 중
                  </button>
                  <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    발행 완료
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[20%]" />
                    <col className="w-[13%]" />
                    <col className="w-[10%]" />
                    <col className="w-[23%]" />
                  </colgroup>
                  <thead className="bg-[#092046] text-white">
                    <tr>
                      <th className="px-4 py-3 font-bold">소식지 정보</th>
                      <th className="px-4 py-3 font-bold">상태·작업</th>
                      <th className="px-4 py-3 font-bold">접속자</th>
                      <th className="px-4 py-3 font-bold">최근 수정</th>
                      <th className="px-4 py-3 font-bold">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <p className="text-base font-bold text-[#092046]">등록된 소식지 프로젝트가 없습니다.</p>
                          <p className="mt-2 text-sm text-slate-500">
                            새 소식지를 만들면 Supabase에 저장되고 이 목록에 표시됩니다.
                          </p>
                          <Link
                            href="/projects/new"
                            className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
                          >
                            + 새 소식지 만들기
                          </Link>
                        </td>
                      </tr>
                    )}
                    {projects.map((project) => (
                      <tr key={project.title} className="border-b border-slate-200 last:border-0">
                        <td className="px-4 py-4">
                          <p className="font-bold text-[#092046]">{project.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {project.organization} · {project.issue} · {project.slug}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-black text-[#184a88]">
                              {project.packageTier}
                            </span>
                            <span className="text-xs font-bold text-[#092046]">{project.productionMode}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{project.workload}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-3">
                            <StatusPill value={project.status} />
                            <div className="space-y-1.5 text-slate-700">
                            <p>
                              <span className="font-semibold text-[#092046]">페이지</span> {project.pages}
                            </p>
                            <p>
                              <span className="font-semibold text-[#092046]">읽기 보기</span> {project.reading}
                            </p>
                            <p>
                              <span className="font-semibold text-[#092046]">음성</span> {project.audio}
                            </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="w-24 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            <p>
                              오늘 <strong className="text-[#092046]">{project.views.today}</strong>
                            </p>
                            <p>
                              어제 <strong className="text-[#092046]">{project.views.yesterday}</strong>
                            </p>
                            <p>
                              전체 <strong className="text-[#092046]">{project.views.total}</strong>
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-500">{project.updated}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={project.actions.editHref}
                              className={dashboardPrimaryActionClass}
                            >
                              작성/수정
                            </Link>
                            <Link
                              href={project.actions.previewHref}
                              className={dashboardActionClass}
                            >
                              미리보기
                            </Link>
                            <a href={project.actions.analyticsHref} className={dashboardActionClass}>
                              통계
                            </a>
                            <Link href={project.actions.duplicateHref} className={dashboardActionClass}>
                              복사
                            </Link>
                            <ProjectArchiveButton projectId={project.id} projectTitle={project.title} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="space-y-5">
              <article id="analytics-preview" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">접속 통계 요약</h3>
                <p className="mt-1 text-sm text-slate-500">
                  접속 통계 테이블 연결 전까지는 샘플 수치로 구조를 먼저 확인합니다.
                </p>
                <div className="mt-4 space-y-3">
                  {dashboardAnalyticsNotes.map((note) => (
                    <div key={note.label} className="rounded-md bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[#092046]">{note.label}</span>
                        <span className="rounded-full bg-[#eaf2ff] px-2.5 py-1 text-xs font-black text-[#184a88]">
                          {note.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{note.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">제작 흐름</h3>
                <ol className="mt-4 space-y-3">
                  {workflowSteps.map((step, index) => (
                    <li key={step} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#092046] text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </article>

              <article id="archive-policy" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">운영 기능 v0.5</h3>
                <div className="mt-4 space-y-3">
                  {projectOperationActions.map((action) => (
                    <div key={action.label} className="rounded-md bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[#092046]">{action.label}</span>
                        <span className="text-xs font-bold text-[#184a88]">{action.status}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{action.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">이미지 자산 기준</h3>
                <div className="mt-4 space-y-3">
                  {assetChecks.map((asset) => (
                    <div key={asset.label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                      <span className="text-sm font-semibold text-slate-700">{asset.label}</span>
                      <span className="text-xs font-bold text-[#184a88]">{asset.value}</span>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>
        </section>
      </div>
    </main>
  );
}
