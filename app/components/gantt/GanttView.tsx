"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScheduleGroupBy, ScheduleTask, ScheduleZoom } from "../../lib/schedule";
import { addDays, diffDays, getScheduleBounds } from "./gantt-utils";
import { buildHeader, dateToX, getBasePxPerDay, type Scale } from "../../lib/gantt/scale";

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  taskId: string;
  mode: DragMode;
  pointerStartX: number;
  initialStartDate: string;
  initialEndDate: string;
}

interface TaskGroup {
  id: string;
  label: string;
  tasks: ScheduleTask[];
}

type DisplayRow =
  | { kind: "group"; groupId: string; label: string }
  | { kind: "task"; groupId: string; task: ScheduleTask };

const LEFT_COLUMN_WIDTH = 420;
const START_COLUMN_WIDTH = 120;
const ROW_HEIGHT = 44;
const MAX_BODY_HEIGHT = 560;

function statusClass(status: ScheduleTask["status"]): string {
  if (status === "done") return "bg-emerald-500";
  if (status === "in_progress") return "bg-sky-500";
  if (status === "blocked") return "bg-rose-500";
  return "bg-[#8C7860]";
}

function statusDotClass(status: ScheduleTask["status"]): string {
  if (status === "done") return "bg-emerald-500";
  if (status === "in_progress") return "bg-sky-500";
  if (status === "blocked") return "bg-rose-500";
  return "bg-[#8C7860]";
}

function groupLabel(task: ScheduleTask, groupBy: ScheduleGroupBy): string {
  if (groupBy === "category") {
    if (task.category === "pre") return "Förproduktion";
    if (task.category === "build") return "Produktion";
    if (task.category === "post") return "Efterarbete";
    return "Löpande underhåll";
  }
  if (groupBy === "project") return task.projectId;
  return task.phase || "Övrigt";
}

function sortTasks(a: ScheduleTask, b: ScheduleTask): number {
  if (a.startDate === b.startDate) return a.title.localeCompare(b.title, "sv");
  return a.startDate.localeCompare(b.startDate, "sv");
}

function buildGroups(tasks: ScheduleTask[], groupBy: ScheduleGroupBy): TaskGroup[] {
  const byGroup = new Map<string, ScheduleTask[]>();
  tasks.forEach((task) => {
    const key = groupLabel(task, groupBy);
    const list = byGroup.get(key) || [];
    list.push(task);
    byGroup.set(key, list);
  });

  return Array.from(byGroup.entries())
    .sort(([a], [b]) => a.localeCompare(b, "sv"))
    .map(([label, groupTasks]) => ({
      id: `group-${label}`,
      label,
      tasks: [...groupTasks].sort(sortTasks),
    }));
}

function clampRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  if (new Date(`${endDate}T00:00:00`).getTime() < new Date(`${startDate}T00:00:00`).getTime()) {
    return { startDate, endDate: startDate };
  }
  return { startDate, endDate };
}

function toScale(zoom: ScheduleZoom): Scale {
  if (zoom === "week") return "week";
  if (zoom === "year") return "year";
  return "month";
}

export function GanttView({
  tasks,
  zoom,
  showWeekends,
  groupBy,
  scheduleStartDate,
  scheduleEndDate,
  editable = false,
  zoomFactor = 1,
  scrollToTodayToken,
  onTaskClick,
  onTaskDatesChange,
}: {
  tasks: ScheduleTask[];
  zoom: ScheduleZoom;
  showWeekends: boolean;
  groupBy: ScheduleGroupBy;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  editable?: boolean;
  zoomFactor?: number;
  scrollToTodayToken?: number;
  onTaskClick?: (task: ScheduleTask) => void;
  onTaskDatesChange?: (taskId: string, nextStartDate: string, nextEndDate: string) => void;
}) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<
    Record<string, { startDate: string; endDate: string }>
  >({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => buildGroups(tasks, groupBy), [groupBy, tasks]);
  const effectiveCollapsed = useMemo(() => {
    const map: Record<string, boolean> = {};
    groups.forEach((group) => {
      map[group.id] = collapsedGroups[group.id] ?? false;
    });
    return map;
  }, [collapsedGroups, groups]);

  const rows = useMemo(() => {
    const next: DisplayRow[] = [];
    groups.forEach((group) => {
      next.push({ kind: "group", groupId: group.id, label: group.label });
      if (!effectiveCollapsed[group.id]) {
        group.tasks.forEach((task) => next.push({ kind: "task", groupId: group.id, task }));
      }
    });
    return next;
  }, [effectiveCollapsed, groups]);

  const bounds = useMemo(
    () => getScheduleBounds(tasks, scheduleStartDate, scheduleEndDate),
    [scheduleEndDate, scheduleStartDate, tasks]
  );

  const scale = toScale(zoom);
  const dayWidth = useMemo(
    () => Math.max(2, getBasePxPerDay(scale) * Math.max(0.5, zoomFactor)),
    [scale, zoomFactor]
  );
  const header = useMemo(
    () => buildHeader({ startDate: bounds.startDate, endDate: bounds.endDate }, scale, { padDays: 30 }),
    [bounds.endDate, bounds.startDate, scale]
  );
  const paddedStart = header.paddedStartDate;
  const timelineDays = header.totalDays;
  const timelineWidth = Math.max(1, timelineDays * dayWidth);

  const today = new Date();
  const todayDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today
    .getDate()
    .toString()
    .padStart(2, "0")}`}`;
  const todayOffset = diffDays(paddedStart, todayDate);
  const showTodayLine = todayOffset >= 0 && todayOffset <= timelineDays;

  useEffect(() => {
    if (!dragState || !onTaskDatesChange) return;

    const onPointerMove = (event: PointerEvent) => {
      const deltaDays = Math.round((event.clientX - dragState.pointerStartX) / dayWidth);
      let nextStartDate = dragState.initialStartDate;
      let nextEndDate = dragState.initialEndDate;

      if (dragState.mode === "move") {
        nextStartDate = addDays(dragState.initialStartDate, deltaDays);
        nextEndDate = addDays(dragState.initialEndDate, deltaDays);
      } else if (dragState.mode === "resize-start") {
        nextStartDate = addDays(dragState.initialStartDate, deltaDays);
      } else {
        nextEndDate = addDays(dragState.initialEndDate, deltaDays);
      }

      setPreviewDates((current) => ({
        ...current,
        [dragState.taskId]: clampRange(nextStartDate, nextEndDate),
      }));
    };

    const onPointerUp = () => {
      const preview = previewDates[dragState.taskId];
      if (preview) {
        onTaskDatesChange(dragState.taskId, preview.startDate, preview.endDate);
      }
      setDragState(null);
      setPreviewDates((current) => {
        const next = { ...current };
        delete next[dragState.taskId];
        return next;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dayWidth, dragState, onTaskDatesChange, previewDates]);

  const weekendOffsets = useMemo(() => {
    if (!showWeekends) return [];
    const offsets: number[] = [];
    for (let i = 0; i < timelineDays; i += 1) {
      const date = new Date(`${addDays(paddedStart, i)}T00:00:00`);
      const day = date.getDay();
      if (day === 0 || day === 6) offsets.push(i);
    }
    return offsets;
  }, [paddedStart, showWeekends, timelineDays]);

  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const leftBodyRef = useRef<HTMLDivElement | null>(null);
  const rightBodyRef = useRef<HTMLDivElement | null>(null);
  const syncXRef = useRef<"header" | "body" | null>(null);
  const syncYRef = useRef<"left" | "right" | null>(null);

  useEffect(() => {
    const headerScroll = headerScrollRef.current;
    const leftBody = leftBodyRef.current;
    const rightBody = rightBodyRef.current;
    if (!headerScroll || !leftBody || !rightBody) return;

    const onHeaderScroll = () => {
      if (syncXRef.current === "body") return;
      syncXRef.current = "header";
      rightBody.scrollLeft = headerScroll.scrollLeft;
      requestAnimationFrame(() => {
        syncXRef.current = null;
      });
    };

    const onRightBodyScroll = () => {
      if (syncXRef.current !== "header") {
        syncXRef.current = "body";
        headerScroll.scrollLeft = rightBody.scrollLeft;
      }
      if (syncYRef.current !== "left") {
        syncYRef.current = "right";
        leftBody.scrollTop = rightBody.scrollTop;
      }
      requestAnimationFrame(() => {
        syncXRef.current = null;
        syncYRef.current = null;
      });
    };

    const onLeftBodyScroll = () => {
      if (syncYRef.current === "right") return;
      syncYRef.current = "left";
      rightBody.scrollTop = leftBody.scrollTop;
      requestAnimationFrame(() => {
        syncYRef.current = null;
      });
    };

    headerScroll.addEventListener("scroll", onHeaderScroll, { passive: true });
    rightBody.addEventListener("scroll", onRightBodyScroll, { passive: true });
    leftBody.addEventListener("scroll", onLeftBodyScroll, { passive: true });

    return () => {
      headerScroll.removeEventListener("scroll", onHeaderScroll);
      rightBody.removeEventListener("scroll", onRightBodyScroll);
      leftBody.removeEventListener("scroll", onLeftBodyScroll);
    };
  }, [timelineWidth]);

  useEffect(() => {
    if (scrollToTodayToken === undefined) return;
    const rightBody = rightBodyRef.current;
    const headerScroll = headerScrollRef.current;
    if (!rightBody || !headerScroll) return;

    const targetDate = showTodayLine ? todayDate : bounds.startDate;
    const targetLeft = Math.max(
      0,
      dateToX(targetDate, paddedStart, dayWidth) - rightBody.clientWidth / 2
    );
    rightBody.scrollTo({ left: targetLeft, behavior: "smooth" });
    headerScroll.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [bounds.startDate, dayWidth, paddedStart, scrollToTodayToken, showTodayLine, todayDate]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DFD6] bg-white">
      <div
        className="grid border-b border-[#E6DFD6] bg-[#FAF8F5]"
        style={{ gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px 1fr` }}
      >
        <div className="sticky left-0 z-10 border-r border-[#E6DFD6] px-4 py-3">
          <div
            className="grid text-xs font-semibold uppercase tracking-wide text-[#8C7860]"
            style={{ gridTemplateColumns: `1fr ${START_COLUMN_WIDTH}px` }}
          >
            <span>Namn</span>
            <span className="text-right">Start</span>
          </div>
        </div>

        <div ref={headerScrollRef} className="hide-scrollbar overflow-x-auto overflow-y-hidden">
          <div style={{ width: timelineWidth }} className="relative">
            <div className="relative h-8 border-b border-[#E8E3DC] bg-[#F3EEE7]">
              {header.top.map((segment) => (
                <div
                  key={`top-${segment.id}`}
                  className="absolute inset-y-0 flex items-center justify-center border-r border-[#E8E3DC] px-2 text-xs font-semibold text-[#6B5A47]"
                  style={{
                    left: dateToX(segment.startDate, paddedStart, dayWidth),
                    width: segment.days * dayWidth,
                  }}
                >
                  <span className="truncate">{segment.label}</span>
                </div>
              ))}
            </div>
            <div className="relative h-8 bg-white">
              {header.bottom.map((segment, index) => (
                <div
                  key={`bottom-${segment.id}`}
                  className={`absolute inset-y-0 flex items-center justify-center border-r border-[#E8E3DC] px-1 text-xs font-medium text-[#766B60] ${
                    index % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]"
                  }`}
                  style={{
                    left: dateToX(segment.startDate, paddedStart, dayWidth),
                    width: segment.days * dayWidth,
                  }}
                >
                  <span className="truncate">{segment.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px 1fr` }}>
        <div ref={leftBodyRef} className="hide-scrollbar overflow-auto border-r border-[#E6DFD6] bg-white" style={{ maxHeight: MAX_BODY_HEIGHT }}>
          {rows.map((row) => {
            if (row.kind === "group") {
              const collapsed = Boolean(effectiveCollapsed[row.groupId]);
              return (
                <button
                  key={row.groupId}
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((current) => ({
                      ...current,
                      [row.groupId]: !collapsed,
                    }))
                  }
                  className="grid h-11 w-full items-center border-b border-[#F0EBE3] bg-[#FAF8F5] px-4 text-left text-xs font-semibold uppercase tracking-wide text-[#8C7860] hover:bg-[#F6F2EC]"
                  style={{ gridTemplateColumns: `1fr ${START_COLUMN_WIDTH}px` }}
                >
                  <span className="truncate">{collapsed ? "▸" : "▾"} {row.label}</span>
                  <span />
                </button>
              );
            }

            return (
              <button
                key={row.task.id}
                type="button"
                onClick={() => onTaskClick?.(row.task)}
                className="grid h-11 w-full items-center border-b border-[#F5F1EB] px-4 text-left text-sm hover:bg-[#FAF8F5]"
                style={{ gridTemplateColumns: `1fr ${START_COLUMN_WIDTH}px` }}
              >
                <span className="flex min-w-0 items-center gap-2 pl-5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(row.task.status)}`} />
                  <span className="truncate text-[#2A2520]">{row.task.title}</span>
                </span>
                <span className="truncate text-right text-xs font-mono text-[#6B5A47]">
                  {row.task.startDate}
                </span>
              </button>
            );
          })}
        </div>

        <div ref={rightBodyRef} className="hide-scrollbar overflow-auto bg-white" style={{ maxHeight: MAX_BODY_HEIGHT }}>
          <div className="relative" style={{ width: timelineWidth, minHeight: rows.length * ROW_HEIGHT }}>
            {header.bottom.map((segment, index) => (
              <div
                key={`bg-${segment.id}`}
                className={`pointer-events-none absolute bottom-0 top-0 border-r border-[#E8E3DC] ${
                  index % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]"
                }`}
                style={{
                  left: dateToX(segment.startDate, paddedStart, dayWidth),
                  width: segment.days * dayWidth,
                }}
              />
            ))}

            {weekendOffsets.map((offset) => (
              <div
                key={`weekend-${offset}`}
                className="pointer-events-none absolute bottom-0 top-0 bg-[#F7F3EE]"
                style={{ left: offset * dayWidth, width: dayWidth }}
              />
            ))}

            {showTodayLine && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-[#E7B54A]"
                style={{ left: todayOffset * dayWidth }}
              />
            )}

            {rows.map((row, index) => {
              const top = index * ROW_HEIGHT;
              if (row.kind === "group") {
                return (
                  <div
                    key={`grid-group-${row.groupId}-${index}`}
                    className="absolute left-0 right-0 border-b border-[#F0EBE3] bg-[#FAF8F5]"
                    style={{ top, height: ROW_HEIGHT }}
                  />
                );
              }

              const preview = previewDates[row.task.id];
              const task = preview
                ? { ...row.task, startDate: preview.startDate, endDate: preview.endDate }
                : row.task;
              const left = dateToX(task.startDate, paddedStart, dayWidth);
              const width = Math.max(26, (diffDays(task.startDate, task.endDate) + 1) * dayWidth);

              return (
                <div
                  key={`grid-task-${row.task.id}`}
                  className="absolute left-0 right-0 border-b border-[#F5F1EB]"
                  style={{ top, height: ROW_HEIGHT }}
                >
                  <button
                    type="button"
                    onClick={() => onTaskClick?.(row.task)}
                    className={`absolute top-1/2 h-7 -translate-y-1/2 rounded-md px-2 text-left text-[11px] font-semibold text-white shadow ${statusClass(
                      row.task.status
                    )}`}
                    style={{ left, width }}
                  >
                    <span className="truncate">{row.task.title}</span>
                  </button>

                  {editable && onTaskDatesChange && (
                    <>
                      <button
                        type="button"
                        onClick={() => onTaskClick?.(row.task)}
                        aria-label="Flytta task"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setDragState({
                            taskId: row.task.id,
                            mode: "move",
                            pointerStartX: event.clientX,
                            initialStartDate: row.task.startDate,
                            initialEndDate: row.task.endDate,
                          });
                        }}
                        className="absolute top-1/2 h-7 -translate-y-1/2 cursor-grab rounded-md border border-white/30 bg-white/10"
                        style={{ left, width }}
                      />
                      <button
                        type="button"
                        aria-label="Justera start"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setDragState({
                            taskId: row.task.id,
                            mode: "resize-start",
                            pointerStartX: event.clientX,
                            initialStartDate: row.task.startDate,
                            initialEndDate: row.task.endDate,
                          });
                        }}
                        className="absolute top-1/2 h-7 w-2 -translate-y-1/2 rounded-l-md bg-black/25"
                        style={{ left }}
                      />
                      <button
                        type="button"
                        aria-label="Justera slut"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setDragState({
                            taskId: row.task.id,
                            mode: "resize-end",
                            pointerStartX: event.clientX,
                            initialStartDate: row.task.startDate,
                            initialEndDate: row.task.endDate,
                          });
                        }}
                        className="absolute top-1/2 h-7 w-2 -translate-y-1/2 rounded-r-md bg-black/25"
                        style={{ left: left + width - 8 }}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
