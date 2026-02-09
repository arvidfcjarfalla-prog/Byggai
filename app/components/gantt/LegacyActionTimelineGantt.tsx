"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScheduleZoom } from "../../lib/schedule";
import { addDays, diffDays } from "./gantt-utils";

export interface ActionPortfolioRow {
  id: string;
  projectId: string;
  actionTaskId: string;
  title: string;
  projectTitle: string;
  startDate: string;
  endDate: string;
  status: "planned" | "in_progress" | "blocked" | "done";
}

interface MonthSegment {
  id: string;
  label: string;
  quarterLabel: string;
  startDate: string;
  endDate: string;
}

interface QuarterSegment {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface TimeBand {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface ProjectGroup {
  key: string;
  projectId: string;
  projectTitle: string;
  rows: ActionPortfolioRow[];
  startDate: string;
  endDate: string;
}

type RenderRow =
  | {
      type: "project";
      key: string;
      projectId: string;
      projectTitle: string;
      count: number;
      startDate: string;
      endDate: string;
    }
  | {
      type: "action";
      key: string;
      row: ActionPortfolioRow;
      indexInProject: number;
    };

function parseDate(isoDate: string): Date {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function toDateOnly(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthShort(date: Date): string {
  return date.toLocaleDateString("sv-SE", { month: "short" });
}

function buildMonthSegments(startDate: string, endDate: string): MonthSegment[] {
  const end = parseDate(endDate);
  const cursor = parseDate(startDate);
  cursor.setDate(1);
  const segments: MonthSegment[] = [];

  while (cursor.getTime() <= end.getTime()) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const quarter = Math.floor(monthStart.getMonth() / 3) + 1;
    segments.push({
      id: `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`,
      label: monthShort(monthStart),
      quarterLabel: `Q${quarter} ${monthStart.getFullYear()}`,
      startDate: toDateOnly(monthStart),
      endDate: toDateOnly(monthEnd),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return segments;
}

function buildQuarterSegments(months: MonthSegment[]): QuarterSegment[] {
  if (months.length === 0) return [];
  const quarters: QuarterSegment[] = [];
  let current: QuarterSegment = {
    id: months[0].quarterLabel,
    label: months[0].quarterLabel,
    startDate: months[0].startDate,
    endDate: months[0].endDate,
  };

  for (let i = 1; i < months.length; i += 1) {
    const month = months[i];
    if (month.quarterLabel !== current.label) {
      quarters.push(current);
      current = {
        id: month.quarterLabel,
        label: month.quarterLabel,
        startDate: month.startDate,
        endDate: month.endDate,
      };
      continue;
    }
    current.endDate = month.endDate;
  }
  quarters.push(current);
  return quarters;
}

function buildYearSegments(months: MonthSegment[]): TimeBand[] {
  if (months.length === 0) return [];

  const years: TimeBand[] = [];
  let current: TimeBand = {
    id: months[0].startDate.slice(0, 4),
    label: months[0].startDate.slice(0, 4),
    startDate: months[0].startDate,
    endDate: months[0].endDate,
  };

  for (let i = 1; i < months.length; i += 1) {
    const month = months[i];
    const year = month.startDate.slice(0, 4);
    if (year !== current.label) {
      years.push(current);
      current = {
        id: year,
        label: year,
        startDate: month.startDate,
        endDate: month.endDate,
      };
      continue;
    }
    current.endDate = month.endDate;
  }

  years.push(current);
  return years;
}

function statusText(status: ActionPortfolioRow["status"]): string {
  if (status === "done") return "Klar";
  if (status === "in_progress") return "Pågår";
  if (status === "blocked") return "Blockerad";
  return "Planerad";
}

function statusClass(status: ActionPortfolioRow["status"]): string {
  if (status === "done") return "border-[#A8D8C6] bg-[#ECF8F2] text-[#2E6C58]";
  if (status === "in_progress") return "border-[#BFD0DD] bg-[#EEF3F7] text-[#425D73]";
  if (status === "blocked") return "border-[#E5BEC1] bg-[#FDF1F2] text-[#A4555B]";
  return "border-[#D9D1C6] bg-[#FAF8F5] text-[#6B5A47]";
}

function barClass(status: ActionPortfolioRow["status"]): string {
  if (status === "done") return "bg-[#4F8A73] hover:bg-[#3F735F]";
  if (status === "in_progress") return "bg-[#5F7F95] hover:bg-[#4D6B80]";
  if (status === "blocked") return "bg-[#B8666B] hover:bg-[#9F585D]";
  return "bg-[#7B6853] hover:bg-[#665543]";
}

function zoomDayWidth(zoom: ScheduleZoom, compact: boolean): number {
  const base = zoom === "month" ? 10 : zoom === "quarter" ? 3.2 : 1.4;
  return compact ? base * 0.9 : base;
}

function formatRange(startDate: string, endDate: string): string {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const startMonth = monthShort(start);
  const endMonth = monthShort(end);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear && startMonth === endMonth) return `${startMonth} ${startYear}`;
  if (startYear === endYear) return `${startMonth}-${endMonth} ${startYear}`;
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}

function groupRowsByProject(rows: ActionPortfolioRow[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  rows.forEach((row) => {
    const key = `${row.projectId}::${row.projectTitle}`;
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(row);
      if (row.startDate < existing.startDate) existing.startDate = row.startDate;
      if (row.endDate > existing.endDate) existing.endDate = row.endDate;
      return;
    }
    map.set(key, {
      key,
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      rows: [row],
      startDate: row.startDate,
      endDate: row.endDate,
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    a.startDate === b.startDate
      ? a.projectTitle.localeCompare(b.projectTitle, "sv")
      : a.startDate.localeCompare(b.startDate, "sv")
  );
}

export function LegacyActionTimelineGantt({
  rows,
  zoom,
  startDate,
  endDate,
  onActionOpen,
  onProjectOpen,
}: {
  rows: ActionPortfolioRow[];
  zoom: ScheduleZoom;
  startDate: string;
  endDate: string;
  onActionOpen: (projectId: string, actionTaskId: string) => void;
  onProjectOpen?: (projectId: string) => void;
}) {
  const [compact, setCompact] = useState(true);
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const leftColWidth = compact ? 340 : 440;
  const actionRowHeight = compact ? 48 : 66;
  const projectRowHeight = 34;
  const headerTotalHeight = 62;
  const dayWidth = zoomDayWidth(zoom, compact);

  const paddedStartDate = useMemo(() => addDays(startDate, -12), [startDate]);
  const paddedEndDate = useMemo(() => addDays(endDate, 18), [endDate]);
  const timelineDays = Math.max(1, diffDays(paddedStartDate, paddedEndDate) + 1);
  const timelineWidth = timelineDays * dayWidth;

  const monthSegments = useMemo(
    () => buildMonthSegments(paddedStartDate, paddedEndDate),
    [paddedEndDate, paddedStartDate]
  );
  const quarterSegments = useMemo(
    () => buildQuarterSegments(monthSegments),
    [monthSegments]
  );
  const yearSegments = useMemo(() => buildYearSegments(monthSegments), [monthSegments]);
  const topBands = useMemo<TimeBand[]>(() => {
    if (zoom === "month") return quarterSegments;
    return yearSegments;
  }, [quarterSegments, yearSegments, zoom]);
  const bottomBands = useMemo<TimeBand[]>(() => {
    if (zoom === "month") return monthSegments;
    if (zoom === "quarter") return quarterSegments;
    return quarterSegments.map((quarter) => ({
      ...quarter,
      label: quarter.label.slice(0, 2),
    }));
  }, [monthSegments, quarterSegments, zoom]);
  const yearAnchors = useMemo(() => {
    const years = Array.from(new Set(monthSegments.map((segment) => segment.startDate.slice(0, 4))));
    return years.map((year) => ({ year, date: `${year}-01-01` }));
  }, [monthSegments]);

  const grouped = useMemo(() => groupRowsByProject(rows), [rows]);
  const effectiveCollapsed = useMemo(() => {
    const next: Record<string, boolean> = {};
    grouped.forEach((group, index) => {
      next[group.key] = collapsedProjects[group.key] ?? (index > 0 && grouped.length > 3);
    });
    return next;
  }, [collapsedProjects, grouped]);

  const renderRows = useMemo(() => {
    const flattened: RenderRow[] = [];
    grouped.forEach((group) => {
      flattened.push({
        type: "project",
        key: `project-${group.key}`,
        projectId: group.projectId,
        projectTitle: group.projectTitle,
        count: group.rows.length,
        startDate: group.startDate,
        endDate: group.endDate,
      });
      if (!effectiveCollapsed[group.key]) {
        group.rows.forEach((row, indexInProject) => {
          flattened.push({
            type: "action",
            key: `action-${row.id}`,
            row,
            indexInProject,
          });
        });
      }
    });
    return flattened;
  }, [effectiveCollapsed, grouped]);

  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<"header" | "body" | null>(null);
  const [moreRight, setMoreRight] = useState(false);

  useEffect(() => {
    const header = headerScrollRef.current;
    const body = bodyScrollRef.current;
    if (!header || !body) return;

    const updateHint = (source: HTMLDivElement) => {
      setMoreRight(source.scrollLeft + source.clientWidth < source.scrollWidth - 2);
    };

    const syncFromHeader = () => {
      if (syncingRef.current === "body") return;
      syncingRef.current = "header";
      body.scrollLeft = header.scrollLeft;
      updateHint(header);
      requestAnimationFrame(() => {
        syncingRef.current = null;
      });
    };
    const syncFromBody = () => {
      if (syncingRef.current === "header") return;
      syncingRef.current = "body";
      header.scrollLeft = body.scrollLeft;
      updateHint(body);
      requestAnimationFrame(() => {
        syncingRef.current = null;
      });
    };

    header.addEventListener("scroll", syncFromHeader, { passive: true });
    body.addEventListener("scroll", syncFromBody, { passive: true });
    updateHint(body);

    return () => {
      header.removeEventListener("scroll", syncFromHeader);
      body.removeEventListener("scroll", syncFromBody);
    };
  }, [timelineWidth]);

  const jumpToDate = (isoDate: string) => {
    const header = headerScrollRef.current;
    const body = bodyScrollRef.current;
    if (!header || !body) return;
    const left = Math.max(0, diffDays(paddedStartDate, isoDate) * dayWidth - 36);
    header.scrollTo({ left, behavior: "smooth" });
    body.scrollTo({ left, behavior: "smooth" });
  };

  const today = new Date();
  const todayDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today
    .getDate()
    .toString()
    .padStart(2, "0")}`}`;
  const todayOffset = diffDays(paddedStartDate, todayDate);
  const showTodayLine = todayOffset >= 0 && todayOffset <= timelineDays;

  const totalHeight = renderRows.reduce((sum, row) => {
    return sum + (row.type === "project" ? projectRowHeight : actionRowHeight);
  }, 0);

  let cursorTop = 0;
  const positionedRows = renderRows.map((row) => {
    const top = cursorTop;
    const height = row.type === "project" ? projectRowHeight : actionRowHeight;
    cursorTop += height;
    return { row, top, height };
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DFD6] bg-white">
      <div className="grid border-b border-[#E6DFD6]" style={{ gridTemplateColumns: `${leftColWidth}px 1fr` }}>
        <div className="sticky left-0 z-10 border-r border-[#E6DFD6] bg-[#6B5A47] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-[#F8F4EE]">
          Åtgärder i underhållsplanen
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DFD6] bg-[#F8F4EE] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompact((value) => !value)}
              className="rounded-lg border border-[#D9D1C6] bg-white px-2.5 py-1 text-[11px] font-semibold"
            >
              {compact ? "Luftigare vy" : "Kompakt vy"}
            </button>
            <button
              type="button"
              onClick={() =>
                setCollapsedProjects(() =>
                  Object.fromEntries(grouped.map((group) => [group.key, false]))
                )
              }
              className="rounded-lg border border-[#D9D1C6] bg-white px-2.5 py-1 text-[11px] font-semibold"
            >
              Expandera alla
            </button>
            <button
              type="button"
              onClick={() =>
                setCollapsedProjects(() =>
                  Object.fromEntries(grouped.map((group) => [group.key, true]))
                )
              }
              className="rounded-lg border border-[#D9D1C6] bg-white px-2.5 py-1 text-[11px] font-semibold"
            >
              Fäll ihop alla
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {yearAnchors.map((anchor) => (
              <button
                key={anchor.year}
                type="button"
                onClick={() => jumpToDate(anchor.date)}
                className="rounded-md border border-[#D9D1C6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                {anchor.year}
              </button>
            ))}
            <button
              type="button"
              onClick={() => jumpToDate(todayDate)}
              className="rounded-md border border-[#D9D1C6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Idag
            </button>
            <span>{moreRight ? "Fler år finns åt höger →" : "Visar hela tidsfönstret"}</span>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `${leftColWidth}px 1fr` }}>
        <div className="sticky left-0 z-10 border-r border-[#E6DFD6] bg-white">
          <div style={{ height: headerTotalHeight }} className="border-b border-[#E6DFD6] bg-[#F8F4EE]" />
          {positionedRows.map(({ row, top, height }) => {
            if (row.type === "project") {
              const isCollapsed = Boolean(
                effectiveCollapsed[`${row.projectId}::${row.projectTitle}`]
              );
              return (
                <div
                  key={row.key}
                  className="absolute left-0 right-0 overflow-hidden border-b border-[#EDE7DE] bg-[#F4EFE7] px-3"
                  style={{ top: headerTotalHeight + top, height }}
                >
                  <div className="flex h-full items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedProjects((current) => ({
                          ...current,
                          [`${row.projectId}::${row.projectTitle}`]: !isCollapsed,
                        }))
                      }
                      className="min-w-0 max-w-full truncate text-left text-xs font-semibold uppercase tracking-wide text-[#6B5A47]"
                    >
                      {isCollapsed ? "▸" : "▾"} {row.projectTitle} ({row.count})
                    </button>
                    {onProjectOpen && (
                      <button
                        type="button"
                        onClick={() => onProjectOpen(row.projectId)}
                        className="rounded-md border border-[#D9D1C6] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6B5A47]"
                      >
                        Projektvy
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <button
                key={row.key}
                type="button"
                onClick={() => onActionOpen(row.row.projectId, row.row.actionTaskId)}
                className={`absolute left-0 right-0 overflow-hidden border-b border-[#F0EBE3] px-4 text-left hover:bg-[#FAF8F5] ${
                  row.indexInProject % 2 === 0 ? "bg-white" : "bg-[#FCFAF7]"
                }`}
                style={{ top: headerTotalHeight + top, height }}
              >
                <div className="flex h-full items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`${compact ? "text-xs" : "text-sm"} truncate font-semibold text-[#2A2520]`}>
                      {row.row.title}
                    </p>
                    {!compact && (
                      <p className="truncate text-xs text-[#766B60]">
                        {row.row.projectTitle} · {formatRange(row.row.startDate, row.row.endDate)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(
                      row.row.status
                    )}`}
                  >
                    {statusText(row.row.status)}
                  </span>
                </div>
              </button>
            );
          })}
          <div style={{ height: headerTotalHeight + totalHeight }} />
        </div>

        <div>
          <div ref={headerScrollRef} className="overflow-x-auto border-b border-[#E6DFD6]">
            <div className="relative border-b border-[#E6DFD6]" style={{ width: timelineWidth, height: 34 }}>
              {topBands.map((band) => {
                const left = diffDays(paddedStartDate, band.startDate) * dayWidth;
                const width = (diffDays(band.startDate, band.endDate) + 1) * dayWidth;
                return (
                  <div
                    key={`top-${band.id}`}
                    className="absolute inset-y-0 border-r border-white/20 bg-[#8C7860] px-2 py-2 text-xs font-semibold text-[#F8F4EE]"
                    style={{ left, width }}
                    title={band.label}
                  >
                    <span className="block truncate">{band.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="relative border-b border-[#E6DFD6]" style={{ width: timelineWidth, height: 32 }}>
              {bottomBands.map((band, index) => {
                const left = diffDays(paddedStartDate, band.startDate) * dayWidth;
                const width = (diffDays(band.startDate, band.endDate) + 1) * dayWidth;
                return (
                  <div
                    key={`bottom-${band.id}-${index}`}
                    className={`absolute inset-y-0 border-r border-[#D9D1C6] px-2 py-1 text-xs font-semibold text-[#4A4036] ${
                      index % 2 === 0 ? "bg-[#F8F4EE]" : "bg-[#EEE6DA]"
                    }`}
                    style={{ left, width }}
                    title={band.label}
                  >
                    <span className="block truncate">{band.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div ref={bodyScrollRef} className="overflow-x-auto">
            <div className="relative" style={{ width: timelineWidth, minHeight: headerTotalHeight + totalHeight }}>
              {bottomBands.map((band, index) => {
                const left = diffDays(paddedStartDate, band.startDate) * dayWidth;
                const width = (diffDays(band.startDate, band.endDate) + 1) * dayWidth;
                return (
                  <div
                    key={`bg-${band.id}-${index}`}
                    className={`absolute inset-y-0 border-r border-[#E6DFD6] ${
                      index % 2 === 0 ? "bg-white/90" : "bg-[#FAF7F1]"
                    }`}
                    style={{ left, width }}
                  />
                );
              })}

              {showTodayLine && (
                <div
                  className="absolute inset-y-0 z-30 w-0.5 bg-[#D6A93A]"
                  style={{ left: todayOffset * dayWidth }}
                />
              )}

              {positionedRows.map(({ row, top, height }) => {
                if (row.type === "project") {
                  return (
                    <div
                      key={`grid-${row.key}`}
                      className="absolute left-0 right-0 border-b border-[#EDE7DE] bg-[#F4EFE7]/70"
                      style={{ top: headerTotalHeight + top, height }}
                    />
                  );
                }

                const left = Math.max(0, diffDays(paddedStartDate, row.row.startDate) * dayWidth);
                const width = Math.max(16, (diffDays(row.row.startDate, row.row.endDate) + 1) * dayWidth);
                const showTitle = width >= 96;
                const showDateOnBar = width >= 180;

                return (
                  <div
                    key={`row-${row.key}`}
                    className="absolute left-0 right-0 border-b border-[#F0EBE3]"
                    style={{ top: headerTotalHeight + top, height }}
                  >
                    <button
                      type="button"
                      onClick={() => onActionOpen(row.row.projectId, row.row.actionTaskId)}
                      className={`absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md px-2 text-left text-xs font-semibold text-white shadow-sm ${barClass(
                        row.row.status
                      )} ${compact ? "h-6" : "h-9"}`}
                      style={{ left, width }}
                      title={`${row.row.title} (${formatRange(row.row.startDate, row.row.endDate)})`}
                    >
                      {showTitle ? (
                        <span className="block truncate">{row.row.title}</span>
                      ) : (
                        <span className="sr-only">{row.row.title}</span>
                      )}
                      {!compact && showDateOnBar && (
                        <span className="ml-2 shrink-0 text-[10px] font-medium text-white/90">
                          {formatRange(row.row.startDate, row.row.endDate)}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
