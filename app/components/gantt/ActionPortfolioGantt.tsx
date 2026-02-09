"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { GanttAction, GanttProject } from "./types";

export type ZoomLevel = "month" | "quarter" | "year";

const PIXELS_PER_DAY: Record<ZoomLevel, number> = {
  month: 4,
  quarter: 1.33,
  year: 0.33,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPANDED_STORAGE_KEY = "gantt-expanded";

interface ActionPortfolioGanttProps {
  projects: GanttProject[];
  initialZoom?: ZoomLevel;
}

interface TimelineMonthCell {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

interface TimelineBandCell {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

interface ProjectWithSpan {
  project: GanttProject;
  spanStart: Date;
  spanEnd: Date;
  actionCount: number;
}

function parseISODate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date("2026-01-01T00:00:00");
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function differenceInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("sv-SE", { month: "short" });
}

function quarterLabel(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

function buildMonthCells(timelineStart: Date, timelineEnd: Date): TimelineMonthCell[] {
  const cells: TimelineMonthCell[] = [];
  let cursor = startOfMonth(timelineStart);

  while (cursor.getTime() <= timelineEnd.getTime()) {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    cells.push({
      id: `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`,
      label: monthLabel(monthStart),
      startDate: monthStart,
      endDate: monthEnd,
    });
    cursor = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  }

  return cells;
}

function buildYearCells(months: TimelineMonthCell[]): TimelineBandCell[] {
  if (months.length === 0) return [];

  const cells: TimelineBandCell[] = [];
  let currentYear = months[0].startDate.getFullYear();
  let bandStart = months[0].startDate;
  let bandEnd = months[0].endDate;

  months.forEach((month, index) => {
    const year = month.startDate.getFullYear();
    if (year !== currentYear) {
      cells.push({
        id: `year-${currentYear}`,
        label: `${currentYear}`,
        startDate: bandStart,
        endDate: bandEnd,
      });
      currentYear = year;
      bandStart = month.startDate;
      bandEnd = month.endDate;
      return;
    }
    bandEnd = month.endDate;

    if (index === months.length - 1) {
      cells.push({
        id: `year-${currentYear}`,
        label: `${currentYear}`,
        startDate: bandStart,
        endDate: bandEnd,
      });
    }
  });

  return cells;
}

function buildQuarterCells(months: TimelineMonthCell[]): TimelineBandCell[] {
  if (months.length === 0) return [];

  const cells: TimelineBandCell[] = [];
  let currentQuarter = quarterLabel(months[0].startDate);
  let bandStart = months[0].startDate;
  let bandEnd = months[0].endDate;

  months.forEach((month, index) => {
    const quarter = quarterLabel(month.startDate);
    if (quarter !== currentQuarter) {
      cells.push({
        id: `quarter-${currentQuarter.replace(" ", "-")}`,
        label: currentQuarter,
        startDate: bandStart,
        endDate: bandEnd,
      });
      currentQuarter = quarter;
      bandStart = month.startDate;
      bandEnd = month.endDate;
      return;
    }
    bandEnd = month.endDate;

    if (index === months.length - 1) {
      cells.push({
        id: `quarter-${currentQuarter.replace(" ", "-")}`,
        label: currentQuarter,
        startDate: bandStart,
        endDate: bandEnd,
      });
    }
  });

  return cells;
}

function projectSpan(project: GanttProject): ProjectWithSpan {
  const actionStarts = project.actions.map((action) => parseISODate(action.startDate));
  const actionEnds = project.actions.map((action) => parseISODate(action.endDate));
  const defaultStart = parseISODate(project.startDate);
  const defaultEnd = parseISODate(project.endDate);

  const spanStart = actionStarts.length
    ? new Date(Math.min(...actionStarts.map((date) => date.getTime())))
    : defaultStart;
  const spanEnd = actionEnds.length
    ? new Date(Math.max(...actionEnds.map((date) => date.getTime())))
    : defaultEnd;

  return {
    project,
    spanStart,
    spanEnd,
    actionCount: project.actions.length,
  };
}

function durationText(startDate: Date, endDate: Date): string {
  const days = Math.max(1, differenceInDays(startDate, endDate) + 1);
  const months = Math.round(days / 30);
  if (months >= 2) return `${months} manader`;
  if (days >= 14) return `${Math.round(days / 7)} veckor`;
  return `${days} dagar`;
}

function actionBarClass(status: GanttAction["status"]): string {
  if (status === "completed") return "bg-[#6B5A47]";
  if (status === "in-progress") return "bg-[#8C7860]";
  return "bg-[#CDB49B] opacity-60";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const ActionPortfolioGantt = memo(function ActionPortfolioGantt({
  projects,
  initialZoom = "quarter",
}: ActionPortfolioGanttProps) {
  const [zoom, setZoom] = useState<ZoomLevel>(initialZoom);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(EXPANDED_STORAGE_KEY);
  });

  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const syncLockRef = useRef<"header" | "body" | null>(null);
  const pendingScrollRatioRef = useRef<number | null>(null);

  useEffect(() => {
    if (expandedProjectId) {
      localStorage.setItem(EXPANDED_STORAGE_KEY, expandedProjectId);
      return;
    }
    localStorage.removeItem(EXPANDED_STORAGE_KEY);
  }, [expandedProjectId]);

  const projectsWithSpan = useMemo(() => {
    return projects
      .map((project) => projectSpan(project))
      .sort((a, b) => a.spanStart.getTime() - b.spanStart.getTime());
  }, [projects]);

  const timelineBounds = useMemo(() => {
    if (projectsWithSpan.length === 0) {
      const start = new Date("2026-01-01T00:00:00");
      const end = new Date("2026-12-31T00:00:00");
      return { start, end };
    }

    const earliest = new Date(
      Math.min(...projectsWithSpan.map((item) => item.spanStart.getTime()))
    );
    const latest = new Date(
      Math.max(...projectsWithSpan.map((item) => item.spanEnd.getTime()))
    );

    const start = startOfYear(addDays(earliest, -45));
    const end = endOfYear(addDays(latest, 45));
    return { start, end };
  }, [projectsWithSpan]);

  const pixelsPerDay = PIXELS_PER_DAY[zoom];
  const totalTimelineDays = Math.max(
    1,
    differenceInDays(timelineBounds.start, timelineBounds.end) + 1
  );

  // Pixel mapping is always based on day distance from a single timeline start.
  const timelineWidth = totalTimelineDays * pixelsPerDay;

  const monthCells = useMemo(
    () => buildMonthCells(timelineBounds.start, timelineBounds.end),
    [timelineBounds.end, timelineBounds.start]
  );
  const yearCells = useMemo(() => buildYearCells(monthCells), [monthCells]);
  const quarterCells = useMemo(() => buildQuarterCells(monthCells), [monthCells]);

  const topBandCells = zoom === "year" ? quarterCells : yearCells;
  const bottomBandCells = monthCells;

  const handleProjectToggle = (projectId: string) => {
    setExpandedProjectId((current) => (current === projectId ? null : projectId));
  };

  const handleZoomChange = (nextZoom: ZoomLevel) => {
    if (!bodyScrollRef.current || nextZoom === zoom) return;

    // Keep relative horizontal position when changing zoom level.
    const body = bodyScrollRef.current;
    const maxScroll = Math.max(1, body.scrollWidth - body.clientWidth);
    pendingScrollRatioRef.current = body.scrollLeft / maxScroll;
    setZoom(nextZoom);
  };

  useEffect(() => {
    if (!bodyScrollRef.current || pendingScrollRatioRef.current === null) return;

    const ratio = pendingScrollRatioRef.current;
    const body = bodyScrollRef.current;
    const header = headerScrollRef.current;
    const nextMaxScroll = Math.max(0, body.scrollWidth - body.clientWidth);
    const nextLeft = clamp(nextMaxScroll * ratio, 0, nextMaxScroll);

    body.scrollLeft = nextLeft;
    if (header) header.scrollLeft = nextLeft;
    pendingScrollRatioRef.current = null;
  }, [timelineWidth, zoom]);

  // Header/body scroll sync so labels and bars always stay aligned.
  const onBodyScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!headerScrollRef.current) return;
    if (syncLockRef.current === "header") return;

    syncLockRef.current = "body";
    headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    requestAnimationFrame(() => {
      syncLockRef.current = null;
    });
  };

  const onHeaderScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!bodyScrollRef.current) return;
    if (syncLockRef.current === "body") return;

    syncLockRef.current = "header";
    bodyScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    requestAnimationFrame(() => {
      syncLockRef.current = null;
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = differenceInDays(timelineBounds.start, today);
  const todayLeft = todayOffset * pixelsPerDay;
  const showToday = todayOffset >= 0 && todayOffset <= totalTimelineDays;

  const timelinePx = (date: Date): number => {
    // Core conversion used by both project bars and action bars.
    return differenceInDays(timelineBounds.start, date) * pixelsPerDay;
  };

  return (
    <div className="rounded-3xl border-2 border-[#E8E3DC] bg-white shadow-lg">
      <div className="border-b-2 border-[#E8E3DC] bg-white p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#2A2520]">Projektportfolj</h1>
            <p className="mt-1 text-sm text-[#766B60]">
              Oversikt per projekt. Klicka pa projekt for detaljvyn med atgarder.
            </p>
          </div>
          <fieldset className="flex flex-wrap items-center gap-2" aria-label="Valj zoomniva">
            {([
              ["month", "Manad"],
              ["quarter", "Kvartal"],
              ["year", "Ar"],
            ] as const).map(([value, label]) => {
              const active = zoom === value;
              return (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold transition-colors duration-200 ${
                    active
                      ? "border-[#8C7860] bg-[#8C7860] text-white"
                      : "border-[#E8E3DC] bg-[#FAF8F5] text-[#6B5A47] hover:border-[#CDB49B]"
                  }`}
                >
                  <input
                    type="radio"
                    name="zoom"
                    value={value}
                    checked={active}
                    onChange={() => handleZoomChange(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              );
            })}
          </fieldset>
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr]">
        <div className="border-r-2 border-[#E8E3DC] bg-white">
          <div className="sticky top-0 z-20 h-[64px] border-b-2 border-[#E8E3DC] bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">Projekt</p>
          </div>

          <div>
            {projectsWithSpan.map(({ project, spanStart, spanEnd, actionCount }) => {
              const expanded = expandedProjectId === project.id;
              return (
                <section key={project.id}>
                  <button
                    type="button"
                    onClick={() => handleProjectToggle(project.id)}
                    aria-expanded={expanded}
                    aria-controls={`project-panel-${project.id}`}
                    className="flex h-9 w-full items-center justify-between gap-2 border-b border-[#E8E3DC] px-3 text-left transition-colors duration-200 hover:bg-[#FAF8F5]"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-[#2A2520]">
                      {project.name}
                    </span>
                    <span className="rounded-full border border-[#CDB49B] bg-[#FAF8F5] px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]">
                      {actionCount} atgarder
                    </span>
                  </button>

                  {/* Accordion state: only one expanded project at a time. */}
                  <div
                    id={`project-panel-${project.id}`}
                    className="overflow-hidden border-b border-[#E8E3DC] transition-all duration-200 ease-in-out"
                    style={{
                      maxHeight: expanded ? `${project.actions.length * 28}px` : "0px",
                      opacity: expanded ? 1 : 0,
                    }}
                  >
                    {project.actions.map((action) => (
                      <div
                        key={action.id}
                        className="flex h-7 items-center border-b border-[#F1ECE6] pl-4 pr-3 last:border-b-0"
                        title={`${action.name}\n${action.startDate} -> ${action.endDate}\n${
                          action.progress ?? 0
                        }% klart`}
                      >
                        <span className="min-w-0 truncate text-xs font-medium text-[#2A2520]">
                          {action.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {!expanded && (
                    <div className="border-b border-[#E8E3DC] px-3 py-1.5 text-[11px] text-[#766B60]">
                      {durationText(spanStart, spanEnd)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden bg-[#FAF8F5]">
          <div
            ref={headerScrollRef}
            onScroll={onHeaderScroll}
            className="sticky top-0 z-10 overflow-x-auto overflow-y-hidden border-b-2 border-[#E8E3DC] bg-white"
          >
            <div style={{ width: timelineWidth }}>
              <div className="relative h-8 border-b border-[#E8E3DC] bg-[#F3EEE7]">
                {topBandCells.map((cell) => {
                  const left = timelinePx(cell.startDate);
                  const width = Math.max(
                    1,
                    (differenceInDays(cell.startDate, cell.endDate) + 1) * pixelsPerDay
                  );
                  return (
                    <div
                      key={cell.id}
                      className="absolute inset-y-0 border-r border-[#E8E3DC] px-2 py-1 text-xs font-semibold text-[#6B5A47]"
                      style={{ left, width }}
                    >
                      <span className="block truncate">{cell.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="relative h-8 bg-white">
                {bottomBandCells.map((cell, index) => {
                  const left = timelinePx(cell.startDate);
                  const width = Math.max(
                    1,
                    (differenceInDays(cell.startDate, cell.endDate) + 1) * pixelsPerDay
                  );
                  return (
                    <div
                      key={`month-${cell.id}`}
                      className={`absolute inset-y-0 border-r border-[#E8E3DC] px-2 py-1 text-xs font-medium text-[#766B60] ${
                        index % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]"
                      }`}
                      style={{ left, width }}
                    >
                      <span className="block truncate">{cell.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div ref={bodyScrollRef} onScroll={onBodyScroll} className="overflow-x-auto overflow-y-hidden">
            <div style={{ width: timelineWidth }}>
              {projectsWithSpan.map(({ project, spanStart, spanEnd }) => {
                const expanded = expandedProjectId === project.id;
                const projectLeft = timelinePx(spanStart);
                const projectWidth = Math.max(
                  12,
                  (differenceInDays(spanStart, spanEnd) + 1) * pixelsPerDay
                );

                return (
                  <section key={`timeline-${project.id}`}>
                    <div className="relative h-9 border-b border-[#E8E3DC] bg-white/90">
                      {showToday && (
                        <div
                          className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 bg-[#B8666B]"
                          style={{ left: todayLeft }}
                        >
                          <span className="absolute -top-6 -left-5 rounded bg-[#B8666B] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Idag
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleProjectToggle(project.id)}
                        className="absolute top-1/2 h-6 -translate-y-1/2 rounded-lg border border-[#8C7860] bg-gradient-to-r from-[#CDB49B] to-[#8C7860] px-2 text-left text-xs font-semibold text-white opacity-70 shadow-sm transition-all duration-200 hover:opacity-100 hover:shadow-md"
                        style={{ left: projectLeft, width: projectWidth }}
                        title={`${project.name}\n${dateOnly(spanStart)} -> ${dateOnly(spanEnd)}\n${durationText(
                          spanStart,
                          spanEnd
                        )}`}
                      >
                        <span className="block truncate">{project.name}</span>
                      </button>
                    </div>

                    <div
                      className="overflow-hidden transition-all duration-200 ease-in-out"
                      style={{
                        maxHeight: expanded ? `${project.actions.length * 28}px` : "0px",
                        opacity: expanded ? 1 : 0,
                      }}
                    >
                      {project.actions.map((action, index) => {
                        const actionStart = parseISODate(action.startDate);
                        const actionEnd = parseISODate(action.endDate);
                        const left = timelinePx(actionStart);
                        const width = Math.max(
                          10,
                          (differenceInDays(actionStart, actionEnd) + 1) * pixelsPerDay
                        );

                        return (
                          <div
                            key={`${project.id}-${action.id}`}
                            className={`relative h-7 border-b border-[#F1ECE6] ${
                              index % 2 === 0 ? "bg-[#FAF8F5]" : "bg-white"
                            }`}
                          >
                            <div
                              className={`absolute top-1/2 h-5 -translate-y-1/2 rounded px-2 text-xs font-semibold text-white ${actionBarClass(
                                action.status
                              )}`}
                              style={{ left, width }}
                              title={`${action.name}\n${action.startDate} -> ${action.endDate}\n${
                                action.progress ?? 0
                              }% klart`}
                            >
                              <span className="block truncate">{action.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
