import Link from "next/link";
import { AnalyticsReportExportButton } from "@/components/analytics-report-export-button";
import { AiOperationsCommentary } from "@/components/ai-operations-commentary";
import { ArticleAnalyticsDailyTrendChart } from "@/components/article-analytics-daily-trend-chart";
import {
  OperationsReportSnapshotList,
  OperationsReportSnapshotProvider,
  OperationsReportSnapshotSaveButton,
} from "@/components/operations-report-snapshot-manager";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import {
  getProjectArticleAnalytics,
  type AccessDeviceAnalytics,
  type ArticleAnalyticsBreakdownRow,
  type ArticleAnalyticsDailyTrendRow,
  type ArticleAnalyticsRow,
  type ChannelAnalytics,
  type ReferrerAnalytics,
  type SurveyConversionAnalytics,
} from "@/lib/article-analytics-repository";
import {
  getAnalyticsPeriodRange,
  getPreviousAnalyticsPeriodRange,
  normalizeAnalyticsPeriod,
  type AnalyticsPeriod,
} from "@/lib/article-analytics-types";
import {
  buildOperationsReportSummary,
  type OperationsReportSummary,
} from "@/lib/operations-report";
import {
  buildPeriodComparisonSummary,
  type PeriodComparisonMetric,
  type PeriodComparisonSummary,
} from "@/lib/period-comparison";

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

const publicationGroupLabels: Record<string, string> = {
  regular: "정기",
  rolling: "수시",
  time_sensitive: "시한성",
  urgent: "긴급",
};

const channelLabels: Record<string, string> = {
  email: "이메일",
  facebook: "페이스북",
  homepage: "홈페이지",
  instagram: "인스타그램",
  kakao: "카카오톡",
  naver: "네이버",
  newsletter: "뉴스레터",
  qr: "QR",
  sms: "문자",
};

const periodOptions: Array<{ label: string; value: AnalyticsPeriod }> = [
  { label: "최근 7일", value: "7d" },
  { label: "최근 30일", value: "30d" },
  { label: "전체", value: "all" },
];

function formatReactionScore(value: number | null) {
  return value === null ? "-" : value.toFixed(1);
}

function formatSubmissionRate(value: number | null) {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}

function formatDeviceRate(value: number | null) {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}

function formatDateLabel(value: string) {
  return value.replaceAll("-", ".");
}

function formatKstDateTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}.${getPart("month")}.${getPart("day")} ${getPart("hour")}:${getPart("minute")} KST`;
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

function OperationsReportSection({ report }: { report: OperationsReportSummary }) {
  const insightStyles = {
    attention: {
      badge: "bg-amber-100 text-amber-900",
      border: "border-amber-200",
      label: "확인 필요",
    },
    information: {
      badge: "bg-slate-100 text-slate-700",
      border: "border-slate-200",
      label: "정보",
    },
    positive: {
      badge: "bg-[#dcecff] text-[#184a88]",
      border: "border-[#b8d7ff]",
      label: "운영 포인트",
    },
  };
  const summaryItems = [
    `전체 접속 ${report.totalVisits === null ? "확인 필요" : `${report.totalVisits.toLocaleString("ko-KR")}건`}`,
    `기사 열람 ${report.articleViews.toLocaleString("ko-KR")}건`,
    `후속 행동 ${report.reactionCount.toLocaleString("ko-KR")}건`,
    `참여 제출 ${report.survey.totalSubmissions === null ? "확인 필요" : `${report.survey.totalSubmissions.toLocaleString("ko-KR")}건`}`,
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-[#b8d7ff] bg-white shadow-sm">
      <div className="border-b border-[#d8e8fb] bg-[#f7fbff] px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">운영 인사이트</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">운영 리포트</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
          선택한 기간의 접속·기사 반응·참여·유입 데이터를 바탕으로 주요 운영 지표를 요약합니다.
        </p>
        <p className="mt-3 text-sm font-bold leading-6 text-[#092046] [word-break:keep-all]">
          {report.periodLabel}: {summaryItems.join(" · ")}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="text-sm font-black text-[#092046]">주요 인사이트</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {report.insights.map((insight) => {
            const style = insightStyles[insight.type];

            return (
              <article key={insight.id} className={`min-w-0 rounded-lg border bg-white p-4 ${style.border}`}>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${style.badge}`}>{style.label}</span>
                <h4 className="mt-3 text-sm font-black leading-6 text-[#092046] [overflow-wrap:anywhere] [word-break:keep-all]">{insight.title}</h4>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600 [overflow-wrap:anywhere] [word-break:keep-all]">{insight.description}</p>
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-[11px] font-black text-slate-500">근거</p>
                  <ul className="mt-1.5 flex flex-wrap gap-2" aria-label={`${insight.title} 근거`}>
                    {insight.evidence.map((evidence) => (
                      <li key={evidence} className="max-w-full rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold leading-5 text-slate-700 [overflow-wrap:anywhere]">
                        {evidence}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold leading-5 text-slate-600">
        운영 리포트는 집계된 이벤트를 규칙에 따라 요약하며, 주민 만족도·정책 효과·개인별 행동을 추론하지 않습니다.
      </p>
    </section>
  );
}

function formatComparisonValue(value: number | null, unit: PeriodComparisonMetric["unit"]) {
  if (value === null) return "-";
  return unit === "percentage_point" ? `${value.toFixed(1)}%` : `${value.toLocaleString("ko-KR")}건`;
}

function getComparisonChange(metric: PeriodComparisonMetric) {
  if (metric.direction === "unavailable" || metric.absoluteChange === null) {
    return { detail: "-", label: "비교 불가" };
  }

  if (metric.direction === "same") {
    return {
      detail: metric.unit === "percentage_point" ? "0.0%p" : "0건",
      label: "변화 없음",
    };
  }

  const prefix = metric.absoluteChange > 0 ? "+" : "";

  if (metric.unit === "percentage_point") {
    const value = `${prefix}${metric.absoluteChange.toFixed(1)}%p`;
    return {
      detail: value,
      label: `${Math.abs(metric.absoluteChange).toFixed(1)}%p ${metric.direction === "up" ? "증가" : "감소"}`,
    };
  }

  const absolute = `${prefix}${metric.absoluteChange.toLocaleString("ko-KR")}건`;

  if (metric.direction === "new") {
    return { detail: absolute, label: "새로 관측" };
  }

  return {
    detail: absolute,
    label: metric.percentChange === null
      ? "비교 불가"
      : `${Math.abs(metric.percentChange).toFixed(1)}% ${metric.direction === "up" ? "증가" : "감소"}`,
  };
}

function PeriodComparisonSection({ comparison }: { comparison: PeriodComparisonSummary }) {
  if (!comparison.available || !comparison.metrics) {
    const message = comparison.unavailableReason === "all"
      ? "전체 기간은 직전 동일 길이 기간 비교를 제공하지 않습니다. 최근 7일 또는 최근 30일을 선택하면 직전 동일 기간과 비교할 수 있습니다."
      : "이전 기간 데이터를 불러오지 못해 비교할 수 없습니다. 현재 기간의 나머지 운영 지표는 정상적으로 확인할 수 있습니다.";

    return (
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">변화 분석</p>
          <h2 className="mt-1 text-lg font-black text-[#092046]">이전 기간 대비</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">선택한 기간의 주요 운영 지표를 직전 동일 길이 기간과 비교합니다.</p>
        </div>
        <p className="px-5 py-8 text-center text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">{message}</p>
      </section>
    );
  }

  const metrics = [
    comparison.metrics.totalVisits,
    comparison.metrics.articleViews,
    comparison.metrics.reactionCount,
    comparison.metrics.surveySubmissions,
    comparison.metrics.mobileRate,
    comparison.metrics.channelAttributedRate,
  ];
  const currentRange = comparison.currentRange.startDate
    ? `${formatDateLabel(comparison.currentRange.startDate)} ~ ${formatDateLabel(comparison.currentRange.endDate ?? "")}`
    : comparison.currentLabel;
  const previousRange = comparison.previousRange?.startDate
    ? `${formatDateLabel(comparison.previousRange.startDate)} ~ ${formatDateLabel(comparison.previousRange.endDate ?? "")}`
    : comparison.previousLabel;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">변화 분석</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">이전 기간 대비</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">선택한 기간의 주요 운영 지표를 직전 동일 길이 기간과 비교합니다.</p>
        <div className="mt-3 flex flex-col gap-1 text-xs font-bold leading-5 text-slate-600 sm:flex-row sm:gap-4">
          <span>현재: {currentRange}</span>
          <span>이전: {previousRange}</span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {metrics.map((metric) => {
          const change = getComparisonChange(metric);

          return (
            <article key={metric.key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-[#092046]">{metric.label}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="font-bold text-slate-500">현재</dt>
                  <dd className="mt-1 text-base font-black text-[#092046]">{formatComparisonValue(metric.current, metric.unit)}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500">이전</dt>
                  <dd className="mt-1 text-base font-black text-slate-700">{formatComparisonValue(metric.previous, metric.unit)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <strong className="text-sm font-black text-[#184a88]">{change.detail}</strong>
                <span className="text-right text-xs font-bold text-slate-600">{change.label}</span>
              </div>
            </article>
          );
        })}
      </div>

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold leading-5 text-slate-600">
        증감은 이벤트 수와 집계 비중의 변화이며, 주민 관심도·정책 효과·콘텐츠 품질을 의미하지 않습니다. UTM 값은 식별 가능한 접속 비중의 변화입니다.
      </p>
    </section>
  );
}

function DailyTrendSection({ rows }: { rows: ArticleAnalyticsDailyTrendRow[] }) {
  const hasData = rows.some((row) => row.totalVisits + row.articleViews + row.reactionCount > 0);

  if (!hasData) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기간 흐름</p>
          <h2 className="mt-1 text-lg font-black text-[#092046]">일별 반응 추이</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">전체 접속, 기사 열람, 후속 행동의 날짜별 변화를 확인합니다.</p>
        </div>
        <p className="px-5 py-10 text-center text-sm font-bold text-slate-500">선택한 기간에 집계된 일별 반응 데이터가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기간 흐름</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">일별 반응 추이</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">전체 접속, 기사 열람, 후속 행동의 날짜별 변화를 확인합니다.</p>
      </div>

      <ArticleAnalyticsDailyTrendChart key={`${rows[0]?.date}-${rows.at(-1)?.date}`} rows={rows} />

      <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
        <p className="mb-3 text-xs font-bold text-slate-500">정확한 수치는 아래 일별 표에서 확인할 수 있습니다.</p>
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[520px] border-collapse text-sm" data-daily-trend-table>
            <caption className="sr-only">날짜별 전체 접속, 기사 열람, 후속 행동 수치</caption>
            <thead className="sticky top-0 bg-slate-50 text-xs font-black text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">날짜</th>
                <th scope="col" className="px-3 py-3 text-right">전체 접속</th>
                <th scope="col" className="px-3 py-3 text-right">기사 열람</th>
                <th scope="col" className="px-4 py-3 text-right">후속 행동</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.date}>
                  <th scope="row" className="px-4 py-3 text-left font-bold text-[#092046]">{formatDateLabel(row.date)}</th>
                  <td className="px-3 py-3 text-right font-bold">{row.totalVisits.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-3 text-right font-bold">{row.articleViews.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-right font-black text-[#184a88]">{row.reactionCount.toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AccessDeviceSection({ analytics }: { analytics: AccessDeviceAnalytics }) {
  const devices = [
    { count: analytics.mobile, label: "모바일", rate: analytics.mobileRate },
    { count: analytics.pc, label: "PC", rate: analytics.pcRate },
    { count: analytics.tablet, label: "태블릿", rate: analytics.tabletRate },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">접속 환경</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">접속 기기</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">선택한 기간의 공개 화면 접속을 모바일·PC·태블릿 기준으로 비교합니다.</p>
      </div>

      {analytics.total === 0 ? (
        <p className="px-5 py-10 text-center text-sm font-bold text-slate-500">선택한 기간에 집계된 기기별 접속 데이터가 없습니다.</p>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-3 md:p-5">
          {devices.map((device) => (
            <article key={device.label} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
              <p className="text-xs font-black text-[#184a88]">{device.label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <strong className="text-2xl font-black text-[#092046]">{device.count.toLocaleString("ko-KR")}</strong>
                <span className="text-sm font-black text-slate-600">{formatDeviceRate(device.rate)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-[#2f73b7]"
                  style={{ width: `${device.rate ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">접속 수 · 구성 비율</p>
            </article>
          ))}
        </div>
      )}

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold leading-5 text-slate-600">
        기기별 수치는 고유 사용자 수가 아니라 공개 화면 접속 이벤트 기준입니다.
      </p>
    </section>
  );
}

function ReferrerAnalyticsSection({ analytics }: { analytics: ReferrerAnalytics }) {
  const topDomains = analytics.domains.slice(0, 10);
  const sourceCards = [
    { count: analytics.directInternal, label: "직접·내부", rate: analytics.directInternalRate },
    { count: analytics.external, label: "외부 유입", rate: analytics.externalRate },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">접속 환경</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">유입경로</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">선택한 기간의 공개 화면 접속이 직접·내부 유입인지 외부 사이트 유입인지 비교합니다.</p>
      </div>

      {analytics.warning ? (
        <p className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900 sm:mx-5">
          {analytics.warning}
        </p>
      ) : null}

      {analytics.total === 0 ? (
        <p className="px-5 py-10 text-center text-sm font-bold text-slate-500">유입경로 수집 방식 보정 이후 집계된 데이터가 아직 없습니다.</p>
      ) : (
        <>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {sourceCards.map((source) => (
              <article key={source.label} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
                <p className="text-xs font-black text-[#184a88]">{source.label}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <strong className="text-2xl font-black text-[#092046]">{source.count.toLocaleString("ko-KR")}</strong>
                  <span className="text-sm font-black text-slate-600">{formatDeviceRate(source.rate)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                  <div className="h-full rounded-full bg-[#2f73b7]" style={{ width: `${source.rate ?? 0}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500">접속 수 · 전체 대비 비율</p>
              </article>
            ))}
          </div>

          <div className="border-t border-slate-200">
            <div className="px-4 py-4 sm:px-5">
              <h3 className="text-sm font-black text-[#092046]">외부 유입 도메인</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">접속 수가 많은 상위 10개 도메인을 표시합니다.</p>
            </div>

            {topDomains.length === 0 ? (
              <p className="border-t border-slate-200 px-5 py-8 text-center text-sm font-bold text-slate-500">외부 유입 도메인이 없습니다.</p>
            ) : (
              <>
                <div className="space-y-2 border-t border-slate-200 p-4 md:hidden">
                  {topDomains.map((row) => (
                    <article key={row.domain} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="min-w-0 font-black text-[#092046] [overflow-wrap:anywhere]">{row.domain}</h4>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-xs font-bold text-slate-500">접속</dt><dd className="mt-1 font-black text-[#092046]">{row.count.toLocaleString("ko-KR")}</dd></div>
                        <div><dt className="text-xs font-bold text-slate-500">외부 유입 내 비율</dt><dd className="mt-1 font-black text-[#184a88]">{formatDeviceRate(row.rate)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto border-t border-slate-200 md:block">
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <caption className="sr-only">외부 유입 도메인별 접속 수와 구성 비율</caption>
                    <thead className="bg-slate-50 text-xs font-black text-slate-600">
                      <tr>
                        <th scope="col" className="px-5 py-3">도메인</th>
                        <th scope="col" className="px-3 py-3 text-right">접속</th>
                        <th scope="col" className="px-5 py-3 text-right">외부 유입 내 비율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {topDomains.map((row) => (
                        <tr key={row.domain}>
                          <th scope="row" className="max-w-[360px] px-5 py-4 font-black text-[#092046] [overflow-wrap:anywhere]">{row.domain}</th>
                          <td className="px-3 py-4 text-right font-bold">{row.count.toLocaleString("ko-KR")}</td>
                          <td className="px-5 py-4 text-right font-black text-[#184a88]">{formatDeviceRate(row.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold leading-5 text-slate-600">
        {analytics.legacyExcludedCount > 0 ? (
          <p>유입경로 수집 방식 보정 이전 데이터 {analytics.legacyExcludedCount.toLocaleString("ko-KR")}건은 현재 유입경로 비율과 외부 도메인 집계에서 제외했습니다.</p>
        ) : null}
        <p className={analytics.legacyExcludedCount > 0 ? "mt-1" : undefined}>보정 이후 수집된 데이터부터 유입경로 분석에 반영합니다.</p>
      </div>
    </section>
  );
}

function ChannelAnalyticsSection({ analytics }: { analytics: ChannelAnalytics }) {
  const topCampaigns = analytics.campaigns.slice(0, 10);
  const summaryCards = [
    { count: analytics.attributed, label: "식별된 채널", rate: analytics.attributedRate },
    { count: analytics.unattributed, label: "채널 미지정", rate: analytics.unattributedRate },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">유입 분석</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">배포 채널</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">UTM이 포함된 배포 링크를 기준으로 어떤 채널에서 접속했는지 확인합니다.</p>
      </div>

      {analytics.warning ? (
        <p className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900 sm:mx-5">
          {analytics.warning}
        </p>
      ) : null}

      {analytics.total === 0 ? (
        <p className="px-5 py-10 text-center text-sm font-bold text-slate-500">선택한 기간에 배포 채널 데이터가 없습니다.</p>
      ) : (
        <>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {summaryCards.map((item) => (
              <article key={item.label} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
                <p className="text-xs font-black text-[#184a88]">{item.label}</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <strong className="text-2xl font-black text-[#092046]">{item.count.toLocaleString("ko-KR")}</strong>
                  <span className="text-sm font-black text-slate-600">{formatDeviceRate(item.rate)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                  <div className="h-full rounded-full bg-[#2f73b7]" style={{ width: `${item.rate ?? 0}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500">접속 수 · 전체 대비 비율</p>
              </article>
            ))}
          </div>

          {analytics.attributed === 0 ? (
            <p className="mx-4 mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-600 sm:mx-5">
              선택한 기간에는 UTM이 포함된 배포 링크 접속이 없습니다.
            </p>
          ) : null}

          <div className="border-t border-slate-200">
            <div className="px-4 py-4 sm:px-5">
              <h3 className="text-sm font-black text-[#092046]">채널별 접속</h3>
            </div>

            {analytics.rows.length === 0 ? (
              <p className="border-t border-slate-200 px-5 py-8 text-center text-sm font-bold text-slate-500">식별된 배포 채널이 없습니다.</p>
            ) : (
              <>
                <div className="space-y-2 border-t border-slate-200 p-4 md:hidden">
                  {analytics.rows.map((row) => (
                    <article key={row.source} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="font-black text-[#092046] [overflow-wrap:anywhere]">{channelLabels[row.source] ?? row.source}</h4>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-xs font-bold text-slate-500">접속</dt><dd className="mt-1 font-black text-[#092046]">{row.count.toLocaleString("ko-KR")}</dd></div>
                        <div><dt className="text-xs font-bold text-slate-500">전체 대비 비율</dt><dd className="mt-1 font-black text-[#184a88]">{formatDeviceRate(row.rate)}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto border-t border-slate-200 md:block">
                  <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                    <caption className="sr-only">배포 채널별 접속 수와 전체 대비 비율</caption>
                    <thead className="bg-slate-50 text-xs font-black text-slate-600">
                      <tr>
                        <th scope="col" className="px-5 py-3">채널</th>
                        <th scope="col" className="px-3 py-3 text-right">접속</th>
                        <th scope="col" className="px-5 py-3 text-right">전체 대비 비율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {analytics.rows.map((row) => (
                        <tr key={row.source}>
                          <th scope="row" className="max-w-[360px] px-5 py-4 font-black text-[#092046]">
                            <span className="block [overflow-wrap:anywhere]">{channelLabels[row.source] ?? row.source}</span>
                          </th>
                          <td className="px-3 py-4 text-right font-bold">{row.count.toLocaleString("ko-KR")}</td>
                          <td className="px-5 py-4 text-right font-black text-[#184a88]">{formatDeviceRate(row.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-slate-200">
            <div className="px-4 py-4 sm:px-5">
              <h3 className="text-sm font-black text-[#092046]">캠페인별 접속</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">접속 수가 많은 상위 10개 캠페인을 표시합니다.</p>
            </div>

            {topCampaigns.length === 0 ? (
              <p className="border-t border-slate-200 px-5 py-8 text-center text-sm font-bold text-slate-500">집계된 캠페인이 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-200 border-t border-slate-200">
                {topCampaigns.map((row) => (
                  <article key={row.campaign} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
                    <h4 className="min-w-0 font-black text-[#092046] [overflow-wrap:anywhere]">{row.campaign}</h4>
                    <div className="text-right">
                      <strong className="block text-sm font-black text-[#092046]">{row.count.toLocaleString("ko-KR")}</strong>
                      <span className="text-[11px] font-bold text-[#184a88]">{formatDeviceRate(row.rate)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold leading-5 text-slate-600">
        배포 채널은 UTM이 포함된 링크로 접속한 경우에만 식별됩니다. UTM이 없는 접속은 &apos;채널 미지정&apos;으로 표시됩니다.
      </p>
    </section>
  );
}

function AnalyticsBreakdownSection({
  description,
  emptyMessage,
  eyebrow,
  getLabel,
  rows,
  title,
}: {
  description: string;
  emptyMessage: string;
  eyebrow: string;
  getLabel: (row: ArticleAnalyticsBreakdownRow) => string;
  rows: ArticleAnalyticsBreakdownRow[];
  title: string;
}) {
  const maxReactionCount = Math.max(...rows.map((row) => row.reactionCount), 0);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">{title}</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{description}</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm font-bold text-slate-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="space-y-3 p-4 md:hidden">
            {rows.map((row) => (
              <article key={row.key} className="min-w-0 rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
                <h3 className="font-black leading-6 text-[#092046] [overflow-wrap:anywhere]">{getLabel(row)}</h3>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-[#2f73b7]"
                    style={{ width: `${maxReactionCount > 0 ? (row.reactionCount / maxReactionCount) * 100 : 0}%` }}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs font-bold text-slate-500">등록 기사</dt><dd className="mt-1 font-black text-[#092046]">{row.articleCount.toLocaleString("ko-KR")}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">열람</dt><dd className="mt-1 font-black text-[#092046]">{row.articleViews.toLocaleString("ko-KR")}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">반응</dt><dd className="mt-1 font-black text-[#092046]">{row.reactionCount.toLocaleString("ko-KR")}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">반응도</dt><dd className="mt-1 font-black text-[#184a88]">{formatReactionScore(row.reactionScore)}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="bg-slate-50 text-xs font-black text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3">구분</th>
                  <th scope="col" className="px-3 py-3 text-right">등록 기사</th>
                  <th scope="col" className="px-3 py-3 text-right">열람</th>
                  <th scope="col" className="px-3 py-3 text-right">반응</th>
                  <th scope="col" className="px-5 py-3 text-right">반응도<span className="block text-[10px] font-semibold">열람 100회당</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="min-w-[220px] px-5 py-4 font-black text-[#092046]">
                      <span className="block [overflow-wrap:anywhere]">{getLabel(row)}</span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-[#2f73b7]"
                          style={{ width: `${maxReactionCount > 0 ? (row.reactionCount / maxReactionCount) * 100 : 0}%` }}
                        />
                      </span>
                    </th>
                    <td className="px-3 py-4 text-right font-bold">{row.articleCount.toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-4 text-right font-bold">{row.articleViews.toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-4 text-right font-black text-[#092046]">{row.reactionCount.toLocaleString("ko-KR")}</td>
                    <td className="px-5 py-4 text-right font-black text-[#184a88]">{formatReactionScore(row.reactionScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SurveyConversionSection({ analytics }: { analytics: SurveyConversionAnalytics }) {
  const isSubmissionRateAbove100 = analytics.submissionRate !== null && analytics.submissionRate > 100;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">참여 행동 참고 지표</p>
        <h2 className="mt-1 text-lg font-black text-[#092046]">참여 콘텐츠 제출 현황</h2>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
          기사에서 참여 콘텐츠로 이동한 횟수와 실제 제출 건수를 비교합니다. 이동과 제출은 동일 사용자를 연결한 값이 아니므로 참고 지표로 확인하세요.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        {[
          { isReference: false, label: "참여 콘텐츠 이동", value: analytics.totalClicks.toLocaleString("ko-KR") },
          { isReference: false, label: "실제 제출", value: analytics.totalSubmissions === null ? "-" : analytics.totalSubmissions.toLocaleString("ko-KR") },
          { isReference: isSubmissionRateAbove100, label: "이동 대비 제출 비율", value: formatSubmissionRate(analytics.submissionRate) },
        ].map((item) => (
          <article key={item.label} className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
            <p className="text-xs font-bold text-slate-500">{item.label}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <strong className="text-2xl font-black text-[#092046]">{item.value}</strong>
              {item.isReference ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">참고</span> : null}
            </div>
            {item.isReference ? <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">직접 접근·반복 제출 포함 가능</p> : null}
          </article>
        ))}
      </div>

      {analytics.warning ? (
        <p className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900 sm:mx-5">
          {analytics.warning}
        </p>
      ) : null}

      {analytics.rows.length === 0 ? (
        <p className="border-t border-slate-200 px-5 py-8 text-center text-sm font-bold text-slate-500">선택한 기간에 표시할 참여 콘텐츠 이동·제출 데이터가 없습니다.</p>
      ) : (
        <>
          <div className="space-y-3 border-t border-slate-200 p-4 md:hidden">
            {analytics.rows.map((row) => (
              <article key={row.surveyId} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <h3 className="min-w-0 font-black leading-6 text-[#092046] [overflow-wrap:anywhere]">{row.title}</h3>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{row.kind === "event" ? "이벤트" : "설문"}</span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs font-bold text-slate-500">이동</dt><dd className="mt-1 font-black text-[#092046]">{row.clickCount.toLocaleString("ko-KR")}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">제출</dt><dd className="mt-1 font-black text-[#092046]">{row.submissionCount.toLocaleString("ko-KR")}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">이동 대비 제출</dt><dd className="mt-1 font-black text-[#184a88]">{formatSubmissionRate(row.submissionRate)}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto border-t border-slate-200 md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <caption className="sr-only">참여 콘텐츠별 이동 및 실제 제출 현황</caption>
              <thead className="bg-slate-50 text-xs font-black text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3">참여 콘텐츠</th>
                  <th scope="col" className="px-3 py-3">유형</th>
                  <th scope="col" className="px-3 py-3 text-right">이동</th>
                  <th scope="col" className="px-3 py-3 text-right">제출</th>
                  <th scope="col" className="px-5 py-3 text-right">이동 대비 제출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {analytics.rows.map((row) => (
                  <tr key={row.surveyId}>
                    <th scope="row" className="max-w-[360px] px-5 py-4 font-black text-[#092046] [overflow-wrap:anywhere]">{row.title}</th>
                    <td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{row.kind === "event" ? "이벤트" : "설문"}</span></td>
                    <td className="px-3 py-4 text-right font-bold">{row.clickCount.toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-4 text-right font-bold">{row.submissionCount.toLocaleString("ko-KR")}</td>
                    <td className="px-5 py-4 text-right font-black text-[#184a88]">{formatSubmissionRate(row.submissionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold leading-5 text-slate-600">
        이동과 제출은 동일 사용자를 연결한 값이 아니므로 직접 접근·반복 제출 등에 따라 이동 대비 제출 비율이 100%를 넘을 수 있습니다.
      </p>
    </section>
  );
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
  const analyticsNow = new Date();
  const currentRange = getAnalyticsPeriodRange(period, analyticsNow);
  const previousRange = getPreviousAnalyticsPeriodRange(currentRange);
  const [analytics, previousAnalytics] = await Promise.all([
    getProjectArticleAnalytics(projectId, { now: analyticsNow, period }),
    previousRange
      ? getProjectArticleAnalytics(projectId, { period, rangeOverride: previousRange })
      : Promise.resolve(null),
  ]);
  const operationsReport = buildOperationsReportSummary(analytics);
  const periodComparison = buildPeriodComparisonSummary(analytics, previousAnalytics);
  const breakdowns = operationsReport.breakdowns;
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
  const reportGeneratedAt = formatKstDateTime(analyticsNow);
  const reactionSummaries = [
    { label: "가장 많이 읽힌 기사", suffix: "열람", result: getTopArticle(analytics.articles, (article) => article.articleViews) },
    { label: "반응 수가 가장 많은 기사", suffix: "반응", result: getTopArticle(analytics.articles, (article) => article.reactionCount) },
    { label: "전화 연결이 가장 많은 기사", suffix: "전화 연결", result: getTopArticle(analytics.articles, (article) => article.phoneClicks) },
    { label: "CTA 클릭이 가장 많은 기사", suffix: "CTA 클릭", result: getTopArticle(analytics.articles, (article) => article.ctaClicks) },
    { label: "음성 재생이 가장 많은 기사", suffix: "음성 재생", result: getTopArticle(analytics.articles, (article) => article.audioPlays) },
  ];

  return (
    <OperationsReportSnapshotProvider key={`${projectId}-${period}`} period={period} projectId={projectId}>
      <ProjectAdminShell
        active="analytics"
        projectId={projectId}
        title="반응 통계"
        description="기간별 전체 접속과 기사 열람·후속 행동을 확인합니다."
        sidebarTitle={<>반응<br />통계</>}
        sidebarDescription="공개 화면 접속과 기사별 열람·행동 이벤트를 운영 관점에서 집계합니다."
        sidebarNoteTitle="집계 기준"
        sidebarNote="수치는 개인 수가 아닌 이벤트 수입니다. 반응도는 기사 열람 100회당 후속 행동 건수이며 음성 재생은 제외합니다."
        showDefaultHeaderActions={false}
        printScope="analytics-report"
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <Link href="/" className="dd-btn dd-btn-secondary dd-btn-lg border-slate-300 text-sm">
              전체 프로젝트
            </Link>
            <span className="hidden h-11 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />
            <div className="flex flex-wrap items-start gap-2">
              <Link href={`/newsletters/${projectId}`} target="_blank" rel="noreferrer" className="dd-btn dd-btn-secondary dd-btn-lg text-sm">공개 화면</Link>
              <OperationsReportSnapshotSaveButton />
              <AnalyticsReportExportButton />
            </div>
          </div>
        }
      >
        <section className="space-y-5" data-analytics-report>
        <header className="analytics-report-print-only" aria-label="운영 리포트 출력 정보">
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">DataDiction</p>
          <h1 className="mt-2 text-2xl font-black text-[#092046]">모바일 소식지 운영 리포트</h1>
          <dl className="mt-5 grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm leading-6">
            <dt className="font-black text-slate-500">프로젝트</dt>
            <dd className="font-bold text-[#092046]">{analytics.projectTitle}</dd>
            <dt className="font-black text-slate-500">분석 기간</dt>
            <dd className="font-bold text-slate-700">{periodDescription}</dd>
            <dt className="font-black text-slate-500">출력 기준</dt>
            <dd className="font-bold text-slate-700">{reportGeneratedAt}</dd>
          </dl>
          <p className="mt-4 border-t border-slate-300 pt-3 text-xs font-semibold leading-5 text-slate-600">
            수치는 개인 수가 아닌 집계 이벤트 수입니다.
          </p>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" data-print-control>
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

        <OperationsReportSection report={operationsReport} />

        <AiOperationsCommentary key={`${projectId}-${period}`} period={period} projectId={projectId} />

        <PeriodComparisonSection comparison={periodComparison} />

        <DailyTrendSection rows={analytics.dailyTrends} />

        <AccessDeviceSection analytics={analytics.deviceAnalytics} />

        <ReferrerAnalyticsSection analytics={analytics.referrerAnalytics} />

        <ChannelAnalyticsSection analytics={analytics.channelAnalytics} />

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

        <SurveyConversionSection analytics={analytics.surveyConversions} />

        <div className="grid gap-5 xl:grid-cols-2">
          <AnalyticsBreakdownSection
            eyebrow="콘텐츠 구성 분석"
            title="기사 유형별 성과"
            description="기사 유형별 열람과 후속 행동을 비교합니다. 데이터가 있는 유형만 표시합니다."
            emptyMessage="집계할 기사 유형 데이터가 없습니다."
            rows={breakdowns.articleTypes}
            getLabel={(row) => articleTypeLabels[row.key] ?? row.key}
          />
          <AnalyticsBreakdownSection
            eyebrow="콘텐츠 관심 분야 분석"
            title="관심분야별 성과"
            description="한 기사가 여러 관심분야에 포함될 수 있어 관심분야 합계는 전체 기사 합계와 다를 수 있습니다."
            emptyMessage="설정된 관심분야 데이터가 없습니다."
            rows={breakdowns.interestTags}
            getLabel={(row) => row.key}
          />
        </div>

        <AnalyticsBreakdownSection
          eyebrow="운영 방식 분석"
          title="발행 성격별 성과"
          description="정기·수시·시한성·긴급 기사별 열람과 후속 행동을 비교합니다."
          emptyMessage="집계할 발행 성격 데이터가 없습니다."
          rows={breakdowns.publicationGroups}
          getLabel={(row) => publicationGroupLabels[row.key] ?? row.key}
        />

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">기사별 반응</p>
            <h3 className="mt-1 text-lg font-black text-[#092046]">기사 반응 목록</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">현재 기사 배치순서로 표시합니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm" data-analytics-article-table>
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

        <OperationsReportSnapshotList />

        <section className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="text-sm font-black text-[#092046]">데이터 해석 기준</h2>
          <ul className="mt-2 grid gap-1 text-xs font-semibold leading-5 text-slate-600 md:grid-cols-2">
            <li>수치는 개인 수가 아닌 이벤트 수입니다.</li>
            <li>기사 열람과 음성 재생은 임시 브라우저 세션 기준 기사별 1회입니다.</li>
            <li>전화·지도·CTA·설문은 실제 클릭 시도 횟수입니다.</li>
            <li>반응도는 기사 열람 100회당 후속 행동 건수이며 100을 넘을 수 있습니다.</li>
            <li>음성 재생은 반응도 계산에서 제외됩니다.</li>
            <li>관심분야별 수치는 콘텐츠 분류 기준이며 개인의 선호도 분석을 의미하지 않습니다.</li>
            <li>행동 데이터는 주민 전체의 의견이나 정책 선호도를 의미하지 않습니다.</li>
          </ul>
        </section>

        <footer className="analytics-report-print-only border-t border-slate-300 pt-4 text-xs font-semibold leading-5 text-slate-600">
          본 리포트의 수치는 개인 수가 아닌 집계 이벤트 수입니다. 접속·열람·행동 변화만으로 주민 관심도, 콘텐츠 품질, 정책 효과를 판단하지 않습니다.
        </footer>
        </section>
      </ProjectAdminShell>
    </OperationsReportSnapshotProvider>
  );
}
