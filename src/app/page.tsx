import Link from "next/link";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { StatusPill } from "@/components/status-pill";
import {
  assetChecks,
  dashboardProjects,
  dashboardSummaryCards,
  dashboardSummaryDetails,
  workflowSteps,
} from "@/lib/newsletter-data";

const navigationItems = [
  { label: "프로젝트", href: "/", status: "active" },
  { label: "PDF·페이지", href: "/projects/muan-2025-94/pages", status: "ready" },
  { label: "읽기 보기", href: "/projects/muan-2025-94/reading", status: "ready" },
  { label: "이미지 자산", href: "/projects/muan-2025-94/assets", status: "new" },
  { label: "음성 MP3", href: "/projects/muan-2025-94/audio", status: "ready" },
  { label: "미리보기·발행", href: "/projects/muan-2025-94/publish", status: "ready" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              모바일 소식지
              <br />
              제작 관리
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              작업설계도 v0.2 기준의 관리자 MVP 화면
            </p>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const className = `flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                  item.status === "active"
                    ? "bg-white text-[#071f46] shadow-lg shadow-blue-950/20"
                    : "text-slate-200 hover:bg-white/10"
                }`;
              const content = (
                <>
                  <span>{item.label}</span>
                  {item.status === "new" && (
                    <span className="rounded-full bg-sky-300 px-2 py-0.5 text-[10px] font-bold text-[#071f46]">
                      NEW
                    </span>
                  )}
                </>
              );

              if (item.status === "active") {
                return (
                  <span key={item.label} className={className}>
                    {content}
                  </span>
                );
              }

              return (
                <Link key={item.label} href={item.href} className={className}>
                  {content}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">공개 화면 원칙</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              모바일은 읽기 보기와 음성 듣기 중심, PC는 e-book 원본 보기 중심으로
              설계합니다.
            </p>
          </div>
        </aside>

        <section className="px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">DataDiction 1차 MVP 베이스</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">
                프로젝트 대시보드
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                PDF 기반 공공 소식지를 모바일 읽기 콘텐츠와 PC e-book으로 발행합니다.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]"
            >
              + 새 소식지 만들기
            </Link>
          </header>

          <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

          <section className="mb-7 grid gap-5 xl:grid-cols-[1fr_360px]">
            <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">소식지 프로젝트</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    상태, 페이지 수, 읽기 보기, 음성 등록 여부를 한 화면에서 확인합니다.
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
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead className="bg-[#092046] text-white">
                    <tr>
                      <th className="px-4 py-3 font-bold">소식지명</th>
                      <th className="px-4 py-3 font-bold">기관</th>
                      <th className="px-4 py-3 font-bold">발행</th>
                      <th className="px-4 py-3 font-bold">상태</th>
                      <th className="px-4 py-3 font-bold">페이지</th>
                      <th className="px-4 py-3 font-bold">읽기 보기</th>
                      <th className="px-4 py-3 font-bold">음성</th>
                      <th className="px-4 py-3 font-bold">최근 수정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardProjects.map((project) => (
                      <tr key={project.title} className="border-b border-slate-200 last:border-0">
                        <td className="px-4 py-4 font-bold text-[#092046]">{project.title}</td>
                        <td className="px-4 py-4 text-slate-700">{project.organization}</td>
                        <td className="px-4 py-4 text-slate-700">{project.issue}</td>
                        <td className="px-4 py-4">
                          <StatusPill value={project.status} />
                        </td>
                        <td className="px-4 py-4 text-slate-700">{project.pages}</td>
                        <td className="px-4 py-4 text-slate-700">{project.reading}</td>
                        <td className="px-4 py-4 text-slate-700">{project.audio}</td>
                        <td className="px-4 py-4 text-slate-500">{project.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="space-y-5">
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
