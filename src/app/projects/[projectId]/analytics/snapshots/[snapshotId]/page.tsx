import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { canAccessProject, requireAppUser } from "@/lib/app-auth";
import { getProjectWorkspace } from "@/lib/newsletter-repository";
import { getOperationsReportSnapshot } from "@/lib/operations-report-snapshot-repository";
import type { PeriodComparisonMetric } from "@/lib/period-comparison";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatRate(value: number | null) {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}

function formatComparison(metric: PeriodComparisonMetric) {
  if (metric.direction === "unavailable" || metric.absoluteChange === null) return "비교 불가";
  if (metric.direction === "new") return "새로 관측";
  if (metric.direction === "same") return "변화 없음";
  const amount = metric.unit === "percentage_point"
    ? `${Math.abs(metric.absoluteChange).toFixed(1)}%p`
    : `${Math.abs(metric.absoluteChange).toLocaleString("ko-KR")}건`;
  return `${amount} ${metric.direction === "up" ? "증가" : "감소"}`;
}

export default async function OperationsReportSnapshotPage({
  params,
}: {
  params: Promise<{ projectId: string; snapshotId: string }>;
}) {
  const { projectId, snapshotId } = await params;
  const user = await requireAppUser(`/projects/${projectId}/analytics/snapshots/${snapshotId}`);
  const workspace = await getProjectWorkspace(projectId);

  if (!workspace.ok) notFound();
  if (!canAccessProject(user, workspace.project)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f7fc] px-5">
        <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-[#092046]">저장된 운영 리포트를 열 수 없습니다.</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">프로젝트 접근 권한을 확인해 주세요.</p>
        </section>
      </main>
    );
  }

  const result = await getOperationsReportSnapshot(workspace.project.id, snapshotId);
  if (result.status === "not_found") notFound();
  const snapshot = result.data;

  return (
    <ProjectAdminShell
      active="analytics"
      projectId={projectId}
      title="저장된 운영 리포트"
      description="저장 시점의 집계 결과를 변경 없이 확인합니다. 현재 실시간 통계는 다시 조회하지 않습니다."
      sidebarTitle={<>저장<br />리포트</>}
      sidebarDescription="운영 리포트 저장 시점의 수치와 해설을 읽기 전용으로 확인합니다."
      sidebarNoteTitle="보존 기준"
      sidebarNote="저장본은 생성 이후 갱신되지 않으며, 현재 통계와 값이 다를 수 있습니다."
      actions={
        <Link href={`/projects/${projectId}/analytics`} className="dd-btn dd-btn-secondary dd-btn-lg text-sm">
          현재 통계로 돌아가기
        </Link>
      }
    >
      {!snapshot ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-6 text-sm font-bold leading-6 text-amber-900">
          {result.message}
          {result.status === "migration_required" ? (
            <p className="mt-2 text-xs font-semibold">`supabase/schema_v1_20_operations_report_snapshots.sql` 적용 후 저장 이력을 사용할 수 있습니다.</p>
          ) : null}
        </section>
      ) : (
        <div className="space-y-5">
          <section className="rounded-lg border border-[#b8d7ff] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">읽기 전용 저장본</p>
                <h1 className="mt-1 text-2xl font-black leading-tight text-[#092046] [overflow-wrap:anywhere]">{snapshot.title}</h1>
                <p className="mt-2 text-sm font-semibold text-slate-600">{snapshot.payload.project.organization} · {snapshot.payload.project.issue}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#eaf2ff] px-3 py-1.5 text-xs font-black text-[#184a88]">스키마 v{snapshot.schemaVersion}</span>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-xs font-bold text-slate-500">분석 기간</dt><dd className="mt-1 font-black text-[#092046]">{snapshot.periodLabel}</dd></div>
              <div><dt className="text-xs font-bold text-slate-500">기간 범위</dt><dd className="mt-1 font-black text-[#092046]">{snapshot.periodStart && snapshot.periodEnd ? `${snapshot.periodStart} ~ ${snapshot.periodEnd}` : "전체 누적"}</dd></div>
              <div><dt className="text-xs font-bold text-slate-500">저장 시각</dt><dd className="mt-1 font-black text-[#092046]">{formatDateTime(snapshot.createdAt)}</dd></div>
              <div><dt className="text-xs font-bold text-slate-500">저장자</dt><dd className="mt-1 font-black text-[#092046]">{snapshot.createdBy}</dd></div>
            </dl>
          </section>

          <section>
            <div className="mb-3">
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장 시점 요약</p>
              <h2 className="mt-1 text-lg font-black text-[#092046]">주요 운영 수치</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "전체 접속", value: snapshot.payload.report.totalVisits },
                { label: "기사 열람", value: snapshot.payload.report.articleViews },
                { label: "후속 행동", value: snapshot.payload.report.reactionCount },
                { label: "참여 제출", value: snapshot.payload.report.survey.totalSubmissions },
              ].map((item) => (
                <article key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">{item.label}</p>
                  <strong className="mt-2 block text-2xl font-black text-[#092046]">{item.value === null ? "-" : item.value.toLocaleString("ko-KR")}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Deterministic summary</p>
              <h2 className="mt-1 text-lg font-black text-[#092046]">저장된 운영 인사이트</h2>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2 sm:p-5">
              {snapshot.payload.report.insights.map((insight) => (
                <article key={insight.id} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-black leading-6 text-[#092046] [overflow-wrap:anywhere]">{insight.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 [overflow-wrap:anywhere]">{insight.description}</p>
                  <p className="mt-3 text-xs font-bold leading-5 text-[#184a88]">근거: {insight.evidence.join(" · ")}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기간 비교</p>
              <h2 className="mt-1 text-lg font-black text-[#092046]">이전 기간 대비</h2>
            </div>
            {!snapshot.payload.comparison.available || !snapshot.payload.comparison.metrics ? (
              <p className="px-5 py-8 text-center text-sm font-bold text-slate-500">이 저장본에는 이전 기간 비교값이 없습니다.</p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
                {Object.values(snapshot.payload.comparison.metrics).map((metric) => (
                  <article key={metric.key} className="rounded-lg bg-[#f8fbff] p-4">
                    <p className="text-xs font-bold text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-lg font-black text-[#092046]">{formatComparison(metric)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {snapshot.aiCommentary ? (
            <section className="overflow-hidden rounded-lg border border-[#b8d7ff] bg-white shadow-sm">
              <div className="border-b border-[#d8e8fb] bg-[#f7fbff] px-5 py-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">저장된 AI 해설</p>
                <h2 className="mt-1 text-lg font-black text-[#092046]">{snapshot.aiCommentary.headline}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{snapshot.aiCommentary.summary}</p>
              </div>
              <div className="space-y-5 p-4 sm:p-5">
                {[
                  { items: snapshot.aiCommentary.observations, label: "관측사항" },
                  { items: snapshot.aiCommentary.nextActions, label: "다음 운영 제안" },
                ].map((group) => (
                  <section key={group.label}>
                    <h3 className="text-sm font-black text-[#092046]">{group.label}</h3>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {group.items.map((item, index) => (
                        <article key={`${group.label}-${index}`} className="rounded-lg border border-slate-200 p-4">
                          <h4 className="font-black text-[#092046]">{item.title}</h4>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                          <p className="mt-3 text-xs font-bold text-[#184a88]">
                            근거: {item.evidenceIds.map((id) => snapshot.evidenceCatalog.find((evidence) => evidence.id === id)?.label ?? id).join(", ")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
                {snapshot.aiCommentary.cautions.length > 0 ? (
                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-sm font-black text-amber-950">해석 시 주의사항</h3>
                    <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-amber-900">
                      {snapshot.aiCommentary.cautions.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </section>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
              <p className="text-sm font-black text-[#092046]">이 저장본에는 AI 운영 해설이 포함되지 않았습니다.</p>
            </section>
          )}

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기사 집계</p>
              <h2 className="mt-1 text-lg font-black text-[#092046]">저장 시점 기사별 반응</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-600">
                  <tr><th className="px-5 py-3">기사</th><th className="px-3 py-3 text-right">열람</th><th className="px-3 py-3 text-right">후속 행동</th><th className="px-5 py-3 text-right">반응도</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {snapshot.payload.analytics.articles.map((article) => (
                    <tr key={article.articleId}>
                      <th className="max-w-[460px] px-5 py-4 font-black text-[#092046] [overflow-wrap:anywhere]">{article.title}</th>
                      <td className="px-3 py-4 text-right font-bold">{article.articleViews.toLocaleString("ko-KR")}</td>
                      <td className="px-3 py-4 text-right font-bold">{article.reactionCount.toLocaleString("ko-KR")}</td>
                      <td className="px-5 py-4 text-right font-black text-[#184a88]">{formatRate(article.reactionScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold leading-5 text-slate-600">
            이 화면은 저장된 스냅샷 데이터만 표시합니다. 현재 통계, 원시 이벤트, 기사 본문 또는 개별 설문 응답을 다시 조회하지 않습니다.
          </p>
        </div>
      )}
    </ProjectAdminShell>
  );
}
