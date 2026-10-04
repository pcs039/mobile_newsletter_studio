"use client";

export function AnalyticsReportExportButton() {
  return (
    <div className="flex flex-col items-start gap-1" data-print-control>
      <button
        type="button"
        className="dd-btn dd-btn-secondary dd-btn-lg text-sm"
        aria-describedby="analytics-report-export-description"
        onClick={() => window.print()}
      >
        운영 리포트 내보내기
      </button>
      <span id="analytics-report-export-description" className="text-[11px] font-semibold text-slate-500">
        인쇄 창에서 PDF로 저장할 수 있습니다.
      </span>
    </div>
  );
}
