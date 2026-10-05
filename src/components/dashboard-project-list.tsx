"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProjectArchiveButton } from "@/components/project-archive-button";
import { StatusPill } from "@/components/status-pill";
import type { DashboardProject } from "@/types/newsletter";

const dashboardActionClass =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-[#092046] shadow-sm shadow-blue-950/5 transition hover:-translate-y-0.5 hover:border-[#184a88] hover:bg-[#eaf2ff] hover:shadow-md";
const dashboardPrimaryActionClass =
  "inline-flex h-8 items-center justify-center rounded-md bg-[#092046] px-3 text-xs font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md";

const projectFilters = ["전체", "제작 중", "검수 중", "비공개", "발행 완료", "작업 필요"] as const;
type ProjectFilter = (typeof projectFilters)[number];

type DashboardProjectListProps = {
  editableProjectIds: string[];
  message: string;
  projects: DashboardProject[];
};

function matchesProjectFilter(project: DashboardProject, filter: ProjectFilter) {
  if (filter === "전체") return true;
  if (filter === "작업 필요") return ["제작 중", "검수 중", "비공개"].includes(project.status);
  return project.status === filter;
}

export function DashboardProjectList({ editableProjectIds, message, projects }: DashboardProjectListProps) {
  const [filter, setFilter] = useState<ProjectFilter>("전체");
  const editableProjectIdSet = useMemo(() => new Set(editableProjectIds), [editableProjectIds]);
  const filteredProjects = useMemo(
    () => projects.filter((project) => matchesProjectFilter(project, filter)),
    [filter, projects],
  );

  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-[#092046]">소식지 프로젝트</h3>
          <p className="mt-1 text-sm text-slate-500 [word-break:keep-all]">
            {message} 전체 프로젝트를 표시하되, 일반 사용자는 담당 프로젝트만 작성·수정할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="프로젝트 상태 필터">
          {projectFilters.map((item) => {
            const isActive = filter === item;

            return (
              <button
                key={item}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(item)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-[#184a88] bg-[#092046] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#2f73b7] hover:bg-[#eaf3ff]"
                }`}
              >
                {item}
              </button>
            );
          })}
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
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-base font-bold text-[#092046]">등록된 소식지 프로젝트가 없습니다.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    새 프로젝트를 생성하면 Supabase에 저장되고 이 목록에 표시됩니다.
                  </p>
                  <Link
                    href="/projects/new"
                    className="mt-5 inline-flex rounded-lg bg-[#092046] px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#123a78] hover:shadow-md"
                  >
                    + 새 프로젝트 생성
                  </Link>
                </td>
              </tr>
            ) : filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-base font-bold text-[#092046]">조건에 맞는 프로젝트가 없습니다.</p>
                  <button
                    type="button"
                    onClick={() => setFilter("전체")}
                    className="mt-4 rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-bold text-[#092046] transition hover:bg-[#eaf3ff]"
                  >
                    전체 프로젝트 보기
                  </button>
                </td>
              </tr>
            ) : (
              filteredProjects.map((project) => {
                const canEditProject = editableProjectIdSet.has(project.id);

                return (
                  <tr key={project.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-4">
                      <p className="font-bold text-[#092046]">{project.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {project.organization} · {project.issue} · {project.slug}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black text-[#184a88]">담당: {project.assigneeName}</p>
                        {!canEditProject ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                            보기 전용
                          </span>
                        ) : null}
                      </div>
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
                          <p><span className="font-semibold text-[#092046]">페이지</span> {project.pages}</p>
                          <p><span className="font-semibold text-[#092046]">읽기 보기</span> {project.reading}</p>
                          <p><span className="font-semibold text-[#092046]">음성</span> {project.audio}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="w-24 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <p>오늘 <strong className="text-[#092046]">{project.views.today}</strong></p>
                        <p>어제 <strong className="text-[#092046]">{project.views.yesterday}</strong></p>
                        <p>전체 <strong className="text-[#092046]">{project.views.total}</strong></p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                      <span className="block font-semibold text-slate-600">{project.updated.split(" ")[0]}</span>
                      <span className="mt-1 block text-xs font-black text-[#184a88]">
                        {project.updated.split(" ")[1] ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canEditProject ? (
                          <Link href={project.actions.editHref} className={dashboardPrimaryActionClass}>작성/수정</Link>
                        ) : (
                          <span className="inline-flex h-8 items-center justify-center rounded-md bg-slate-100 px-3 text-xs font-black text-slate-400">
                            작성 불가
                          </span>
                        )}
                        <Link href={project.actions.previewHref} className={dashboardActionClass}>미리보기</Link>
                        <Link href={project.actions.analyticsHref} className={dashboardActionClass}>통계</Link>
                        {canEditProject ? (
                          <>
                            <Link href={project.actions.duplicateHref} className={dashboardActionClass}>복사</Link>
                            <ProjectArchiveButton projectId={project.id} projectTitle={project.title} />
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
