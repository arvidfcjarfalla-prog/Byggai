"use client";

import { useMemo } from "react";
import type { ScheduleZoom } from "../../lib/schedule";
import { addDays, buildTimeBuckets, diffDays, getDayWidth } from "./gantt-utils";

export interface PortfolioGanttRow {
  projectId: string;
  title: string;
  audience: "brf" | "privat";
  startDate: string;
  endDate: string;
  taskCount: number;
}

function audienceLabel(audience: PortfolioGanttRow["audience"]): string {
  return audience === "brf" ? "BRF" : "Privat";
}

function audienceClass(audience: PortfolioGanttRow["audience"]): string {
  return audience === "brf"
    ? "border-[#A3C7E3] bg-[#EAF4FC] text-[#274E6A]"
    : "border-[#E6D8C5] bg-[#F8F1E6] text-[#6E5637]";
}

export function PortfolioGantt({
  rows,
  zoom,
  startDate,
  endDate,
  onProjectOpen,
}: {
  rows: PortfolioGanttRow[];
  zoom: ScheduleZoom;
  startDate: string;
  endDate: string;
  onProjectOpen: (projectId: string) => void;
}) {
  const dayWidth = getDayWidth(zoom);
  const paddedStartDate = useMemo(() => addDays(startDate, -14), [startDate]);
  const paddedEndDate = useMemo(() => addDays(endDate, 21), [endDate]);
  const timelineDays = Math.max(1, diffDays(paddedStartDate, paddedEndDate) + 1);
  const timelineWidth = timelineDays * dayWidth;
  const buckets = useMemo(
    () => buildTimeBuckets(paddedStartDate, paddedEndDate, zoom),
    [paddedEndDate, paddedStartDate, zoom]
  );

  const today = new Date();
  const todayDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
  const todayOffset = diffDays(paddedStartDate, todayDate);
  const showTodayLine = todayOffset >= 0 && todayOffset <= timelineDays;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DFD6] bg-white">
      <div className="grid grid-cols-[330px_1fr] border-b border-[#E6DFD6] bg-[#FAF8F5]">
        <div className="sticky left-0 z-10 border-r border-[#E6DFD6] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
          Projektportfölj
        </div>
        <div className="hide-scrollbar overflow-x-auto">
          <div className="relative h-12" style={{ width: timelineWidth }}>
            {buckets.map((bucket) => {
              const left = diffDays(paddedStartDate, bucket.startDate) * dayWidth;
              const width = (diffDays(bucket.startDate, bucket.endDate) + 1) * dayWidth;
              return (
                <div
                  key={bucket.id}
                  className="absolute bottom-0 top-0 border-r border-[#E6DFD6] px-2 py-1 text-[11px] font-semibold text-[#6B5A47]"
                  style={{ left, width }}
                >
                  {bucket.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[330px_1fr]">
        <div className="sticky left-0 z-10 border-r border-[#E6DFD6] bg-white">
          {rows.map((row) => (
            <button
              key={row.projectId}
              type="button"
              onClick={() => onProjectOpen(row.projectId)}
              className="flex h-14 w-full items-center justify-between gap-3 border-b border-[#F5F1EB] px-4 text-left hover:bg-[#FAF8F5]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2A2520]">{row.title}</p>
                <p className="text-xs text-[#766B60]">{row.taskCount} tasks</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${audienceClass(
                  row.audience
                )}`}
              >
                {audienceLabel(row.audience)}
              </span>
            </button>
          ))}
        </div>

        <div className="hide-scrollbar overflow-x-auto">
          <div className="relative" style={{ width: timelineWidth, minHeight: rows.length * 56 }}>
            {showTodayLine && (
              <div
                className="absolute bottom-0 top-0 z-20 w-0.5 bg-[#E7B54A]"
                style={{ left: todayOffset * dayWidth }}
              />
            )}

            {rows.map((row, index) => {
              const top = index * 56;
              const left = Math.max(0, diffDays(paddedStartDate, row.startDate) * dayWidth);
              const width = Math.max(36, (diffDays(row.startDate, row.endDate) + 1) * dayWidth);

              return (
                <div
                  key={row.projectId}
                  className="absolute left-0 right-0 border-b border-[#F5F1EB]"
                  style={{ top, height: 56 }}
                >
                  <button
                    type="button"
                    onClick={() => onProjectOpen(row.projectId)}
                    className="absolute top-1/2 h-8 -translate-y-1/2 rounded-lg bg-[#8C7860] px-3 text-left text-xs font-semibold text-white shadow hover:bg-[#6B5A47]"
                    style={{ left, width }}
                  >
                    <span className="truncate">{row.title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
