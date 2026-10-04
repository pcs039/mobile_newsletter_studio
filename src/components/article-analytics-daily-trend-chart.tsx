"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ArticleAnalyticsDailyTrendRow } from "@/lib/article-analytics-repository";

const series = [
  { key: "totalVisits", label: "전체 접속", color: "#184a88" },
  { key: "articleViews", label: "기사 열람", color: "#2f73b7" },
  { key: "reactionCount", label: "후속 행동", color: "#d05b35" },
] as const;

function formatDateLabel(date: string) {
  const [, month = "", day = ""] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function getPointLabel(row: ArticleAnalyticsDailyTrendRow) {
  return `${formatDateLabel(row.date)}, 전체 접속 ${row.totalVisits}, 기사 열람 ${row.articleViews}, 후속 행동 ${row.reactionCount}`;
}

function getDefaultIndex(rows: ArticleAnalyticsDailyTrendRow[]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row && row.totalVisits + row.articleViews + row.reactionCount > 0) return index;
  }

  return Math.max(0, rows.length - 1);
}

export function ArticleAnalyticsDailyTrendChart({ rows }: { rows: ArticleAnalyticsDailyTrendRow[] }) {
  const defaultIndex = getDefaultIndex(rows);
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const chartWidth = Math.max(680, (rows.length - 1) * 40 + 80);
  const chartHeight = 240;
  const chartPadding = { bottom: 38, left: 48, right: 24, top: 20 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const maxValue = Math.max(
    ...rows.flatMap((row) => [row.totalVisits, row.articleViews, row.reactionCount]),
    1,
  );
  const gridStepCount = Math.min(4, maxValue);
  const gridRatios = Array.from({ length: gridStepCount + 1 }, (_, index) => index / gridStepCount);
  const labelStep = Math.max(1, Math.ceil(rows.length / 7));
  const pointSpacing = rows.length === 1 ? plotWidth : plotWidth / (rows.length - 1);
  const hitWidth = rows.length === 1 ? plotWidth : Math.max(24, pointSpacing);
  const xForIndex = (index: number) => chartPadding.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const yForValue = (value: number) => chartPadding.top + plotHeight - (value / maxValue) * plotHeight;
  const selectedRow = rows[selectedIndex] ?? rows[defaultIndex];
  const selectedX = xForIndex(selectedIndex);

  const handlePointerEnter = (event: PointerEvent<SVGRectElement>, index: number) => {
    if (event.pointerType === "mouse") setSelectedIndex(index);
  };

  const handlePointerDown = (event: PointerEvent<SVGRectElement>, index: number) => {
    if (event.pointerType !== "mouse") setSelectedIndex(index);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGRectElement>, index: number) => {
    if (event.key === "Escape") {
      setSelectedIndex(defaultIndex);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedIndex(index);
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const targets = event.currentTarget.ownerSVGElement?.querySelectorAll<SVGRectElement>("[data-trend-point]");
    targets?.[Math.max(0, Math.min(index + direction, rows.length - 1))]?.focus();
  };

  return (
    <div>
      <div className="grid gap-3 px-4 pt-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1" aria-label="일별 반응 추이 범례">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>

        <div
          id="daily-trend-summary"
          role="status"
          aria-live="polite"
          className="rounded-lg border border-[#b8d7ff] bg-[#f7fbff] px-3 py-2.5 text-xs"
        >
          <p className="font-black text-[#092046]">{formatDateLabel(selectedRow.date)}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-slate-600">
            <div><dt className="text-[10px] font-bold">전체 접속</dt><dd className="mt-0.5 font-black text-[#184a88]">{selectedRow.totalVisits.toLocaleString("ko-KR")}</dd></div>
            <div><dt className="text-[10px] font-bold">기사 열람</dt><dd className="mt-0.5 font-black text-[#2f73b7]">{selectedRow.articleViews.toLocaleString("ko-KR")}</dd></div>
            <div><dt className="text-[10px] font-bold">후속 행동</dt><dd className="mt-0.5 font-black text-[#b44727]">{selectedRow.reactionCount.toLocaleString("ko-KR")}</dd></div>
          </dl>
        </div>
      </div>

      <div className="overflow-x-auto px-3 pt-4 sm:px-5">
        <svg
          role="img"
          aria-label="날짜별 전체 접속, 기사 열람, 후속 행동 추이"
          className="block max-w-none"
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <title>일별 반응 추이</title>
          {gridRatios.map((ratio) => {
            const y = chartPadding.top + plotHeight * ratio;
            const value = Math.round(maxValue * (1 - ratio));
            return (
              <g key={ratio}>
                <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="#dbe4ef" strokeWidth="1" />
                <text x={chartPadding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#64748b">{value.toLocaleString("ko-KR")}</text>
              </g>
            );
          })}

          <line
            x1={selectedX}
            x2={selectedX}
            y1={chartPadding.top}
            y2={chartPadding.top + plotHeight}
            stroke="#7c9fc7"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {series.map((item) => (
            <g key={item.key}>
              <polyline
                points={rows.map((row, index) => `${xForIndex(index)},${yForValue(row[item.key])}`).join(" ")}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {rows.map((row, index) => (
                <circle
                  key={row.date}
                  cx={xForIndex(index)}
                  cy={yForValue(row[item.key])}
                  r={selectedIndex === index ? 5 : rows.length <= 31 ? 3 : 2}
                  fill={item.color}
                  stroke={selectedIndex === index ? "white" : "none"}
                  strokeWidth={selectedIndex === index ? 2 : 0}
                />
              ))}
            </g>
          ))}

          {rows.map((row, index) => (
            index % labelStep === 0 || index === rows.length - 1 ? (
              <text key={row.date} x={xForIndex(index)} y={chartHeight - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#64748b">
                {row.date.slice(5).replace("-", ".")}
              </text>
            ) : null
          ))}

          {rows.map((row, index) => (
            <rect
              key={row.date}
              data-trend-point
              role="button"
              tabIndex={0}
              aria-label={getPointLabel(row)}
              aria-describedby={selectedIndex === index ? "daily-trend-summary" : undefined}
              x={xForIndex(index) - hitWidth / 2}
              y={chartPadding.top}
              width={hitWidth}
              height={plotHeight}
              fill="transparent"
              className="cursor-pointer focus:outline-none"
              onPointerEnter={(event) => handlePointerEnter(event, index)}
              onPointerDown={(event) => handlePointerDown(event, index)}
              onFocus={() => setSelectedIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
