import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { getProjectArticleAnalytics } from "@/lib/article-analytics-repository";

const articleTypeLabels: Record<string, string> = {
  general: "일반 기사",
  welfare_health: "복지·건강",
  application_recruitment: "신청·모집",
  event_festival: "행사·축제",
  tourism_place: "관광·장소",
  life_civil: "생활·민원",
  government_major: "주요 행정",
  local_news: "지역 소식",
  emergency: "긴급 안내",
};

function formatRate(value: number | null) {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}

export default async function ProjectAnalyticsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const analytics = await getProjectArticleAnalytics(projectId);
  const totals = analytics.articles.reduce(
    (result, article) => ({
      views: result.views + article.articleViews,
      phone: result.phone + article.phoneClicks,
      map: result.map + article.mapClicks,
      cta: result.cta + article.ctaClicks,
      survey: result.survey + article.surveyClicks,
      audio: result.audio + article.audioPlays,
    }),
    { views: 0, phone: 0, map: 0, cta: 0, survey: 0, audio: 0 },
  );
  const hasEvents = Object.values(totals).some((value) => value > 0);
  const needsMigration = analytics.source === "migration_required";

  return (
    <ProjectAdminShell
      active="analytics"
      projectId={projectId}
      title="반응 통계"
      description="기사별 열람과 전화·지도·신청·설문·음성 이용 반응을 확인합니다."
      sidebarTitle={<>반응<br />통계</>}
      sidebarDescription="공개 모바일 기사에서 발생한 열람과 행동 이벤트를 기사별로 집계합니다."
      sidebarNoteTitle="집계 기준"
      sidebarNote="수치는 개인 수가 아닌 이벤트 수입니다. 기사 열람과 음성 재생은 한 임시 브라우저 세션에서 기사별 1회만 기록합니다."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={`/newsletters/${projectId}`} target="_blank" rel="noreferrer" className="dd-btn dd-btn-secondary dd-btn-lg text-sm">
            공개 화면
          </Link>
          <Link href={`/projects/${projectId}/distribution`} className="dd-btn dd-btn-primary dd-btn-lg text-sm">
            배포 관리
          </Link>
        </div>
      }
    >
      <section className="space-y-5">
        {needsMigration ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-900">
            {analytics.message}
          </div>
        ) : analytics.source === "error" || analytics.source === "unconfigured" ? (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold leading-6 text-slate-600">
            {analytics.message}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "기사 열람", value: totals.views },
            { label: "전화 클릭", value: totals.phone },
            { label: "지도 클릭", value: totals.map },
            { label: "CTA 클릭", value: totals.cta },
            { label: "설문 이동", value: totals.survey },
            { label: "음성 재생", value: totals.audio },
          ].map((item) => (
            <article key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">{item.label}</p>
              <strong className="mt-2 block text-2xl font-black text-[#092046]">{item.value.toLocaleString("ko-KR")}</strong>
            </article>
          ))}
        </section>

        {!hasEvents && !needsMigration ? (
          <div className="rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] px-5 py-8 text-center">
            <h3 className="text-base font-black text-[#092046]">아직 기사 반응 데이터가 없습니다.</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 [word-break:keep-all]">
              공개 소식지에서 기사 열람이나 전화·지도·신청 등의 행동이 발생하면 이 화면에 집계됩니다.
            </p>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기사별 집계</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">기사 반응 목록</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">현재 기사 배치순서로 표시합니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-600">
                <tr>
                  <th className="px-5 py-3">기사</th>
                  <th className="px-3 py-3 text-right">열람</th>
                  <th className="px-3 py-3 text-right">전화</th>
                  <th className="px-3 py-3 text-right">지도</th>
                  <th className="px-3 py-3 text-right">CTA</th>
                  <th className="px-3 py-3 text-right">설문</th>
                  <th className="px-3 py-3 text-right">음성</th>
                  <th className="px-5 py-3 text-right">행동률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {analytics.articles.length > 0 ? (
                  analytics.articles.map((article, index) => (
                    <tr key={article.articleId}>
                      <td className="max-w-[360px] px-5 py-4">
                        <p className="font-black leading-6 text-[#092046] [overflow-wrap:anywhere] [word-break:keep-all]">
                          {article.title}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {index + 1}번 · {articleTypeLabels[article.articleType] ?? article.articleType}
                        </p>
                      </td>
                      <td className="px-3 py-4 text-right font-bold">{article.articleViews}</td>
                      <td className="px-3 py-4 text-right font-bold">{article.phoneClicks}</td>
                      <td className="px-3 py-4 text-right font-bold">{article.mapClicks}</td>
                      <td className="px-3 py-4 text-right font-bold">{article.ctaClicks}</td>
                      <td className="px-3 py-4 text-right font-bold">{article.surveyClicks}</td>
                      <td className="px-3 py-4 text-right font-bold">{article.audioPlays}</td>
                      <td className="px-5 py-4 text-right font-black text-[#184a88]">{formatRate(article.actionRate)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center font-bold text-slate-500">
                      집계할 모바일 기사가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </ProjectAdminShell>
  );
}
