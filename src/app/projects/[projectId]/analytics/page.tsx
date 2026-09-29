import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { getProjectArticleAnalytics, type ArticleAnalyticsRow } from "@/lib/article-analytics-repository";
import { normalizeAnalyticsPeriod, type AnalyticsPeriod } from "@/lib/article-analytics-types";

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

const periodOptions: Array<{ label: string; value: AnalyticsPeriod }> = [
  { label: "최근 7일", value: "7d" },
  { label: "최근 30일", value: "30d" },
  { label: "전체", value: "all" },
];

function formatReactionScore(value: number | null) {
  return value === null ? "-" : value.toFixed(1);
}

function formatDateLabel(value: string) {
  return value.replaceAll("-", ".");
}

function getPublicationBadge(article: ArticleAnalyticsRow) {
  if (article.publicationKind !== "rolling") return { className: "bg-slate-100 text-slate-700", label: "정기" };
  if (article.urgency === "urgent") return { className: "bg-rose-100 text-rose-800", label: "긴급" };
  if (article.urgency === "time_sensitive") return { className: "bg-amber-100 text-amber-900", label: "시한성" };
  return { className: "bg-sky-100 text-sky-800", label: "수시" };
}

function getTopArticle(articles: ArticleAnalyticsRow[], getValue: (article: ArticleAnalyticsRow) => number) {
  return articles.reduce<{ article: ArticleAnalyticsRow; value: number } | null>((top, article) => {
    const value = getValue(article);
    return value > 0 && (!top || value > top.value) ? { article, value } : top;
  }, null);
}

export default async function ProjectAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const periodParam = Array.isArray(resolvedSearchParams.period) ? resolvedSearchParams.period[0] : resolvedSearchParams.period;
  const period = normalizeAnalyticsPeriod(periodParam);
  const analytics = await getProjectArticleAnalytics(projectId, { period });
  const totals = analytics.articles.reduce(
    (result, article) => ({
      views: result.views + article.articleViews,
      reaction: result.reaction + article.reactionCount,
      phone: result.phone + article.phoneClicks,
      map: result.map + article.mapClicks,
      cta: result.cta + article.ctaClicks,
      survey: result.survey + article.surveyClicks,
      audio: result.audio + article.audioPlays,
    }),
    { views: 0, reaction: 0, phone: 0, map: 0, cta: 0, survey: 0, audio: 0 },
  );
  const totalReactionScore = totals.views > 0 ? (totals.reaction / totals.views) * 100 : null;
  const hasArticleEvents = totals.views + totals.reaction + totals.audio > 0;
  const needsMigration = analytics.source === "migration_required";
  const periodDescription = analytics.periodRange.startDate
    ? `${analytics.periodRange.label} 기준 · ${formatDateLabel(analytics.periodRange.startDate)} ~ ${formatDateLabel(analytics.periodRange.endDate)}`
    : "전체 누적";
  const reactionSummaries = [
    { label: "가장 많이 읽힌 기사", suffix: "열람", result: getTopArticle(analytics.articles, (article) => article.articleViews) },
    { label: "반응 수가 가장 많은 기사", suffix: "반응", result: getTopArticle(analytics.articles, (article) => article.reactionCount) },
    { label: "전화 연결이 가장 많은 기사", suffix: "전화 연결", result: getTopArticle(analytics.articles, (article) => article.phoneClicks) },
    { label: "CTA 클릭이 가장 많은 기사", suffix: "CTA 클릭", result: getTopArticle(analytics.articles, (article) => article.ctaClicks) },
    { label: "음성 재생이 가장 많은 기사", suffix: "음성 재생", result: getTopArticle(analytics.articles, (article) => article.audioPlays) },
  ];

  return (
    <ProjectAdminShell
      active="analytics"
      projectId={projectId}
      title="반응 통계"
      description="기간별 전체 접속과 기사 열람·후속 행동을 확인합니다."
      sidebarTitle={<>반응<br />통계</>}
      sidebarDescription="공개 화면 접속과 기사별 열람·행동 이벤트를 운영 관점에서 집계합니다."
      sidebarNoteTitle="집계 기준"
      sidebarNote="수치는 개인 수가 아닌 이벤트 수입니다. 반응도는 기사 열람 100회당 후속 행동 건수이며 음성 재생은 제외합니다."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={`/newsletters/${projectId}`} target="_blank" rel="noreferrer" className="dd-btn dd-btn-secondary dd-btn-lg text-sm">공개 화면</Link>
          <Link href={`/projects/${projectId}/distribution`} className="dd-btn dd-btn-primary dd-btn-lg text-sm">배포 관리</Link>
        </div>
      }
    >
      <section className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기간</p>
              <h2 className="mt-1 text-lg font-black text-[#092046]">반응 분석 범위</h2>
              <p className="mt-2 text-xs font-semibold text-slate-500">{periodDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="분석 기간 선택">
              {periodOptions.map((option) => (
                <Link
                  key={option.value}
                  href={`/projects/${projectId}/analytics?period=${option.value}`}
                  aria-current={period === option.value ? "page" : undefined}
                  className={`dd-btn dd-btn-sm ${period === option.value ? "dd-btn-primary" : "dd-btn-secondary"}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {needsMigration ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-900">{analytics.message}</div>
        ) : analytics.source === "error" || analytics.source === "unconfigured" ? (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold leading-6 text-slate-600">{analytics.message}</div>
        ) : null}

        {analytics.eventAggregationWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">{analytics.eventAggregationWarning}</div>
        ) : null}

        <section>
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">반응 분석 요약</p>
            <h2 className="mt-1 text-lg font-black text-[#092046]">{analytics.periodRange.label} 주요 수치</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "전체 접속", value: analytics.totalVisits, note: analytics.totalVisitsMessage },
              { label: "기사 열람", value: totals.views },
              { label: "반응 수", value: totals.reaction },
              { label: "전화 연결", value: totals.phone },
              { label: "지도 보기", value: totals.map },
              { label: "CTA 클릭", value: totals.cta },
              { label: "설문 이동", value: totals.survey },
              { label: "음성 재생", value: totals.audio },
            ].map((item) => (
              <article key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-500">{item.label}</p>
                <strong className="mt-2 block text-2xl font-black text-[#092046]">
                  {item.value === null ? "-" : item.value.toLocaleString("ko-KR")}
                </strong>
                {item.note ? <p className="mt-2 text-[11px] font-semibold leading-4 text-amber-700">{item.note}</p> : null}
              </article>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-[#b8d7ff] bg-[#f4f8ff] px-4 py-3 text-sm leading-6 text-slate-700">
            전체 반응도 <strong className="text-[#092046]">{formatReactionScore(totalReactionScore)}</strong>
            <span className="ml-2 text-xs font-semibold text-slate-500">기사 열람 100회당 후속 행동 건수</span>
          </div>
        </section>

        {!hasArticleEvents && !needsMigration ? (
          <div className="rounded-lg border border-dashed border-[#b8d7ff] bg-[#f7fbff] px-5 py-8 text-center">
            <h3 className="text-base font-black text-[#092046]">{analytics.periodRange.label} 동안 기록된 기사 반응이 없습니다.</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 [word-break:keep-all]">전체 기간을 확인하거나 공개 소식지 이용 이후 다시 확인하세요.</p>
          </div>
        ) : null}

        <section>
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">주요 반응 요약</p>
            <h2 className="mt-1 text-lg font-black text-[#092046]">관측 이벤트 기준 주요 기사</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {reactionSummaries.map((summary) => (
              <article key={summary.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black leading-5 text-[#184a88]">{summary.label}</p>
                {summary.result ? (
                  <>
                    <h3 className="mt-2 line-clamp-3 text-sm font-black leading-6 text-[#092046] [overflow-wrap:anywhere]">{summary.result.article.title}</h3>
                    <p className="mt-3 text-xs font-bold text-slate-600">{summary.suffix} {summary.result.value.toLocaleString("ko-KR")}</p>
                  </>
                ) : (
                  <p className="mt-3 text-sm font-bold text-slate-400">데이터 없음</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기사별 반응</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">기사 반응 목록</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">현재 기사 배치순서로 표시합니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-600">
                <tr>
                  <th className="px-5 py-3">기사</th><th className="px-3 py-3">구분</th>
                  <th className="px-3 py-3 text-right">열람</th><th className="px-3 py-3 text-right">전화</th>
                  <th className="px-3 py-3 text-right">지도</th><th className="px-3 py-3 text-right">CTA</th>
                  <th className="px-3 py-3 text-right">설문</th><th className="px-3 py-3 text-right">음성</th>
                  <th className="px-3 py-3 text-right">반응 수</th>
                  <th className="px-5 py-3 text-right">반응도<span className="block text-[10px] font-semibold">열람 100회당</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {analytics.articles.length > 0 ? (
                  analytics.articles.map((article, index) => {
                    const publicationBadge = getPublicationBadge(article);
                    return (
                      <tr key={article.articleId}>
                        <td className="max-w-[360px] px-5 py-4">
                          <p className="font-black leading-6 text-[#092046] [overflow-wrap:anywhere] [word-break:keep-all]">{article.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{index + 1}번 · {articleTypeLabels[article.articleType] ?? article.articleType}</p>
                        </td>
                        <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${publicationBadge.className}`}>{publicationBadge.label}</span></td>
                        <td className="px-3 py-4 text-right font-bold">{article.articleViews}</td>
                        <td className="px-3 py-4 text-right font-bold">{article.phoneClicks}</td>
                        <td className="px-3 py-4 text-right font-bold">{article.mapClicks}</td>
                        <td className="px-3 py-4 text-right font-bold">{article.ctaClicks}</td>
                        <td className="px-3 py-4 text-right font-bold">{article.surveyClicks}</td>
                        <td className="px-3 py-4 text-right font-bold">{article.audioPlays}</td>
                        <td className="px-3 py-4 text-right font-black text-[#092046]">{article.reactionCount}</td>
                        <td className="px-5 py-4 text-right font-black text-[#184a88]">{formatReactionScore(article.reactionScore)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={10} className="px-5 py-10 text-center font-bold text-slate-500">집계할 모바일 기사가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="text-sm font-black text-[#092046]">데이터 해석 기준</h2>
          <ul className="mt-2 grid gap-1 text-xs font-semibold leading-5 text-slate-600 md:grid-cols-2">
            <li>수치는 개인 수가 아닌 이벤트 수입니다.</li>
            <li>기사 열람과 음성 재생은 임시 브라우저 세션 기준 기사별 1회입니다.</li>
            <li>전화·지도·CTA·설문은 실제 클릭 시도 횟수입니다.</li>
            <li>반응도는 기사 열람 100회당 후속 행동 건수이며 100을 넘을 수 있습니다.</li>
            <li>음성 재생은 반응도 계산에서 제외됩니다.</li>
            <li>행동 데이터는 주민 전체의 의견이나 정책 선호도를 의미하지 않습니다.</li>
          </ul>
        </section>
      </section>
    </ProjectAdminShell>
  );
}
