import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { StatusPill } from "@/components/status-pill";
import { getPublishQueueProjects } from "@/lib/newsletter-repository";

function getSiteOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "";
}

function makeAbsoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const origin = getSiteOrigin();

  return origin ? `${origin}${path.startsWith("/") ? path : `/${path}`}` : path;
}

function splitDateTime(value: string) {
  const [date, time] = value.split(" ");

  return {
    date: date || "-",
    time: time || "",
  };
}

function parseViewCount(value: string) {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function readinessPercent(readyCount: number, totalCount: number) {
  if (totalCount === 0) {
    return 0;
  }

  return Math.round((readyCount / totalCount) * 100);
}

export default async function DistributionProjectsPage() {
  const publishData = await getPublishQueueProjects();
  const projects = publishData.projects.filter((project) => project.status !== "삭제됨");
  const publishedProjects = projects.filter((project) => project.status === "발행 완료");
  const waitingProjects = projects.filter((project) => project.status !== "발행 완료");
  const todayViews = publishedProjects.reduce((total, project) => total + parseViewCount(project.views.today), 0);
  const totalViews = publishedProjects.reduce((total, project) => total + parseViewCount(project.views.total), 0);

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              배포
              <br />
              운영 관리
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300 [word-break:keep-all]">
              발행 완료된 소식지의 공개 주소, QR, 접속 현황, 후속 관리 이동을 한곳에서 확인합니다.
            </p>
          </div>

          <AdminMainNavigation active="distribution" />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">운영 기준</p>
            <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
              이 화면에는 실제 공개 처리된 프로젝트를 중심으로 표시합니다. 발행 전 프로젝트는 대기 목록에서 검수 상태를 확인합니다.
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">공개 운영대장</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">배포/관리 프로젝트</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
                발행 완료된 모바일 소식지의 공개 링크와 QR 파일, 접속 현황을 운영자 기준으로 정리합니다.
              </p>
            </div>
            <Link
              href="/projects/publish"
              className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
            >
              미리보기/발행 목록
            </Link>
          </header>

          <section className="mb-7 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {[
              { label: "공개 운영", value: publishedProjects.length, detail: "발행 완료" },
              { label: "배포 대기", value: waitingProjects.length, detail: "검수·보완" },
              { label: "오늘 접속", value: todayViews.toLocaleString("ko-KR"), detail: "공개 URL 기준" },
              { label: "전체 접속", value: totalViews.toLocaleString("ko-KR"), detail: "누적 집계" },
            ].map((card) => (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <strong className="text-3xl font-black text-[#092046]">{card.value}</strong>
                  <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                    {card.detail}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#092046]">공개 중인 소식지</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                  발행 완료 상태인 프로젝트만 운영 목록에 표시합니다. QR은 현재 공개 URL 기준 SVG 파일로 내려받습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">운영 {publishedProjects.length}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">대기 {waitingProjects.length}</span>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {publishedProjects.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-bold text-[#092046]">공개 운영 중인 프로젝트가 없습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                    미리보기/발행 화면에서 검수를 마치고 발행 완료 처리하면 이 목록에 표시됩니다.
                  </p>
                  <Link
                    href="/projects/publish"
                    className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
                  >
                    발행 검수 목록으로 이동
                  </Link>
                </div>
              )}

              {publishedProjects.map((project) => {
                const publicUrl = makeAbsoluteUrl(`/newsletters/${project.slug}`);
                const ebookUrl = makeAbsoluteUrl(`/newsletters/${project.slug}/ebook`);
                const qrHref = `/api/qr?value=${encodeURIComponent(publicUrl)}`;
                const updated = splitDateTime(project.updated);
                const percent = readinessPercent(project.readiness.readyCount, project.readiness.totalCount);

                return (
                  <article key={project.id} className="px-5 py-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black tracking-normal text-[#092046] [word-break:keep-all]">
                            {project.title}
                          </h4>
                          <StatusPill value={project.status} />
                          <StatusPill value={project.packageTier} />
                        </div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
                          {project.organization} · {project.issue} · {project.slug}
                        </p>
                        <p className="mt-1 text-xs font-black text-[#184a88]">담당: {project.assigneeName}</p>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[150px_150px_minmax(0,1fr)]">
                          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                            <p className="text-xs font-bold text-slate-500">최근 수정</p>
                            <p className="mt-1 whitespace-nowrap text-sm font-black text-[#092046]">{updated.date}</p>
                            <p className="whitespace-nowrap text-xs font-black text-[#184a88]">{updated.time}</p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                            <p className="text-xs font-bold text-slate-500">접속</p>
                            <p className="mt-1 text-sm font-black text-[#092046]">오늘 {project.views.today}</p>
                            <p className="text-xs font-black text-[#184a88]">전체 {project.views.total}</p>
                          </div>

                          <div className="min-w-0 rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold text-slate-500">최종 자료 완성도</p>
                              <p className="text-xs font-black text-[#184a88]">
                                {project.readiness.readyCount}/{project.readiness.totalCount}
                              </p>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-[#184a88]" style={{ width: `${percent}%` }} />
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-500 [word-break:keep-all]">
                              PDF, 이미지, 기사, 링크, 음성 항목을 발행 상세에서 계속 보완할 수 있습니다.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 lg:grid-cols-2">
                          <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3">
                            <p className="text-xs font-black text-[#184a88]">공개 URL</p>
                            <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">{publicUrl}</p>
                          </div>
                          <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-3">
                            <p className="text-xs font-black text-[#184a88]">PC e-book URL</p>
                            <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">{ebookUrl}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center gap-2">
                        <Link
                          href={`/newsletters/${project.slug}`}
                          className="inline-flex h-11 items-center justify-center rounded-md bg-[#092046] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
                        >
                          모바일 공개 화면
                        </Link>
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href={`/projects/${project.slug}/distribution`}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-[#092046] bg-[#eaf2ff] px-3 text-xs font-black text-[#092046] transition hover:bg-[#dbeafe]"
                          >
                            배포 운영
                          </Link>
                          <Link
                            href={`/newsletters/${project.slug}/ebook`}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-3 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                          >
                            PC e-book
                          </Link>
                          <Link
                            href={qrHref}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-3 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                          >
                            QR 다운로드
                          </Link>
                          <Link
                            href={`/projects/${project.slug}/publish`}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
                          >
                            발행 상세
                          </Link>
                          <Link
                            href={`/projects/${project.slug}/reading`}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
                          >
                            작성/수정
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {waitingProjects.length > 0 && (
            <section className="mt-7 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-lg font-bold text-[#092046]">배포 대기 프로젝트</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 [word-break:keep-all]">
                  아직 발행 완료 처리되지 않은 프로젝트입니다. 검수 화면에서 부족한 항목을 확인하세요.
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                {waitingProjects.map((project) => {
                  const updated = splitDateTime(project.updated);

                  return (
                    <article key={project.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_140px_220px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black text-[#092046] [word-break:keep-all]">{project.title}</h4>
                          <StatusPill value={project.status} />
                          <StatusPill value={project.readiness.label} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {project.organization} · {project.issue} · 담당: {project.assigneeName}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                        <p className="text-xs font-bold text-slate-500">최근 수정</p>
                        <p className="mt-1 whitespace-nowrap text-sm font-black text-[#092046]">{updated.date}</p>
                        <p className="whitespace-nowrap text-xs font-black text-[#184a88]">{updated.time}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/projects/${project.slug}/publish`}
                          className="inline-flex h-10 items-center justify-center rounded-md bg-[#092046] px-3 text-xs font-black text-white transition hover:bg-[#123a78]"
                        >
                          검수하기
                        </Link>
                        <Link
                          href={`/projects/${project.slug}/reading`}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-[#2f73b7] bg-white px-3 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                        >
                          작성/수정
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
