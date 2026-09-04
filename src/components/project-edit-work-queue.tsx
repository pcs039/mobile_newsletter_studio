"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProjectArchiveButton } from "@/components/project-archive-button";
import { StatusPill } from "@/components/status-pill";
import type { DashboardProject } from "@/types/newsletter";

const editSteps = [
  { label: "기본 정보", path: "settings", detail: "기관, 담당자, 상품 옵션" },
  { label: "일반형 페이지 제작", path: "reading", detail: "기본형, 표준형, 고급형" },
  { label: "프리미엄 페이지 제작", path: "pages", detail: "이미지 페이지와 클릭 영역" },
  { label: "이미지·링크·영상 소재", path: "assets", detail: "이미지, URL, 유튜브" },
  { label: "음성·대본", path: "audio", detail: "MP3와 기사 대본" },
];

const statusFilters = ["전체", "제작 중", "검수 중", "비공개"];

type ProjectEditWorkQueueProps = {
  isAdmin: boolean;
  message: string;
  projects: DashboardProject[];
};

function getProjectSearchText(project: DashboardProject) {
  return [
    project.title,
    project.organization,
    project.assigneeName,
    project.issue,
    project.slug,
    project.status,
    project.packageTier,
    project.productionMode,
  ]
    .join(" ")
    .toLowerCase();
}

export function ProjectEditWorkQueue({ isAdmin, message, projects }: ProjectEditWorkQueueProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [assigneeFilter, setAssigneeFilter] = useState("전체");

  const assignees = useMemo(
    () =>
      Array.from(new Set(projects.map((project) => project.assigneeName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesQuery = !normalizedQuery || getProjectSearchText(project).includes(normalizedQuery);
      const matchesStatus = statusFilter === "전체" || project.status === statusFilter;
      const matchesAssignee = assigneeFilter === "전체" || project.assigneeName === assigneeFilter;

      return matchesQuery && matchesStatus && matchesAssignee;
    });
  }, [assigneeFilter, projects, query, statusFilter]);

  const reviewCount = projects.filter((project) => project.status === "검수 중" || project.status === "비공개").length;
  const hasActiveFilter = Boolean(query.trim()) || statusFilter !== "전체" || assigneeFilter !== "전체";

  return (
    <>
      <section className="mb-7 grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">작성/수정 대상</p>
          <strong className="mt-3 block text-3xl font-black text-[#092046]">{projects.length}</strong>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">제작 중</p>
          <strong className="mt-3 block text-3xl font-black text-[#092046]">
            {projects.filter((project) => project.status === "제작 중").length}
          </strong>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">검수·비공개</p>
          <strong className="mt-3 block text-3xl font-black text-[#092046]">{reviewCount}</strong>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">{isAdmin ? "전체 담당자" : "내 담당 작업"}</p>
          <strong className="mt-3 block text-3xl font-black text-[#092046]">
            {isAdmin ? assignees.length : projects.length}
          </strong>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">작업 목록</p>
              <h3 className="mt-1 text-lg font-bold text-[#092046]">작업 대상 목록</h3>
              <p className="mt-1 text-sm text-slate-500">{message}</p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:items-end">
              <Link
                href="/projects/new"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#092046] px-5 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
              >
                + 새 프로젝트 생성
              </Link>
              <div className="grid w-full gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_170px_auto] xl:w-auto">
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
                  검색
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="소식지명, 기관명, 담당자, slug"
                    className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#092046] outline-none transition placeholder:text-slate-400 focus:border-[#2f73b7] focus:ring-2 focus:ring-[#2f73b7]/15"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
                  상태
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-[#2f73b7]/15"
                  >
                    {statusFilters.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
                  담당자
                  <select
                    value={assigneeFilter}
                    onChange={(event) => setAssigneeFilter(event.target.value)}
                    className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-[#2f73b7]/15"
                  >
                    <option value="전체">전체</option>
                    {assignees.map((assignee) => (
                      <option key={assignee} value={assignee}>
                        {assignee}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("전체");
                    setAssigneeFilter("전체");
                  }}
                  className="h-11 self-end rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-[#092046] transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {projects.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-base font-bold text-[#092046]">작성/수정할 프로젝트가 없습니다.</p>
              <p className="mt-2 text-sm text-slate-500">새 프로젝트를 생성하면 작성/수정 목록에 표시됩니다.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  href="/projects/new"
                  className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
                >
                  + 새 프로젝트 생성
                </Link>
              </div>
            </div>
          )}

          {projects.length > 0 && filteredProjects.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-base font-bold text-[#092046]">조건에 맞는 프로젝트가 없습니다.</p>
              <p className="mt-2 text-sm text-slate-500">검색어 또는 필터를 줄여 다시 확인하세요.</p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("전체");
                    setAssigneeFilter("전체");
                  }}
                  className="mt-5 rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-bold text-[#092046] transition hover:bg-[#eaf3ff]"
                >
                  전체 목록 보기
                </button>
              )}
            </div>
          )}

          {filteredProjects.map((project) => (
            <article key={project.id} className="px-5 py-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-black text-[#092046]">{project.title}</h4>
                    <StatusPill value={project.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {project.organization} · {project.issue} · {project.slug}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                      <p className="text-[11px] font-black text-slate-500">담당</p>
                      <p className="mt-1 text-sm font-black text-[#184a88]">{project.assigneeName}</p>
                    </div>
                    <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                      <p className="text-[11px] font-black text-slate-500">상품</p>
                      <p className="mt-1 text-sm font-black text-[#092046]">{project.packageTier}</p>
                    </div>
                    <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                      <p className="text-[11px] font-black text-slate-500">제작 방식</p>
                      <p className="mt-1 text-sm font-black text-[#092046]">{project.productionMode}</p>
                    </div>
                    <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                      <p className="text-[11px] font-black text-slate-500">최근 수정</p>
                      <p className="mt-1 text-sm font-black text-[#092046]">{project.updated}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">{project.workload}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {editSteps.map((step) => (
                    <Link
                      key={step.path}
                      href={`/projects/${project.slug}/${step.path}`}
                      className="rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3 transition hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                    >
                      <span className="block text-sm font-black text-[#092046]">{step.label}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{step.detail}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={project.actions.editHref}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#092046] px-4 text-xs font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
                >
                  작업 시작
                </Link>
                <Link
                  href={`/projects/${project.slug}/settings`}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-bold text-[#092046] transition hover:border-[#184a88] hover:bg-[#eaf2ff]"
                >
                  기본 정보 수정
                </Link>
                <Link
                  href={project.actions.previewHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-bold text-[#092046] transition hover:border-[#184a88] hover:bg-[#eaf2ff]"
                >
                  미리보기 새 탭
                </Link>
                <ProjectArchiveButton projectId={project.id} projectTitle={project.title} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
