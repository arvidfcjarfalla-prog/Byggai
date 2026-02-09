"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleGroupBy, ScheduleTask, ScheduleZoom } from "../../lib/schedule";
import {
  addDays,
  buildTimeBuckets,
  diffDays,
  getDayWidth,
  getScheduleBounds,
  toTaskBarPosition,
} from "./gantt-utils";

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  taskId: string;
  mode: DragMode;
  pointerStartX: number;
  initialStartDate: string;
  initialEndDate: string;
}

type GroupRow =
  | { type: "group"; id: string; label: string }
  | { type: "task"; id: string; task: ScheduleTask };

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

function buildRows(tasks: ScheduleTask[], groupBy: ScheduleGroupBy): GroupRow[] {
  const byGroup = new Map<string, ScheduleTask[]>();
  tasks.forEach((task) => {
    const key = groupLabel(task, groupBy);
    const existing = byGroup.get(key) || [];
    existing.push(task);
    byGroup.set(key, existing);
  });

  const rows: GroupRow[] = [];
  Array.from(byGroup.entries())
    .sort(([a], [b]) => a.localeCompare(b, "sv"))
    .forEach(([label, groupTasks]) => {
      rows.push({ type: "group", id: `g-${label}`, label });
      groupTasks
        .slice()
        .sort((a, b) => a.startDate.localeCompare(b.startDate, "sv"))
        .forEach((task) => {
          rows.push({ type: "task", id: task.id, task });
        });
    });

  return rows;
}

export function GanttView({
  tasks,
  zoom,
  showWeekends,
  groupBy,
  scheduleStartDate,
  scheduleEndDate,
  editable = false,
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
  onTaskClick?: (task: ScheduleTask) => void;
  onTaskDatesChange?: (taskId: string, nextStartDate: string, nextEndDate: string) => void;
}) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<Record<string, { startDate: string; endDate: string }>>({});
  const dayWidth = getDayWidth(zoom);
  const rows = useMemo(() => buildRows(tasks, groupBy), [groupBy, tasks]);

  const bounds = useMemo(
    () => getScheduleBounds(tasks, scheduleStartDate, scheduleEndDate),
    [scheduleEndDate, scheduleStartDate, tasks]
  );

  const paddedStart = useMemo(() => addDays(bounds.startDate, -14), [bounds.startDate]);
  const paddedEnd = useMemo(() => addDays(bounds.endDate, 21), [bounds.endDate]);
  const timelineDays = Math.max(1, diffDays(paddedStart, paddedEnd) + 1);
  const timelineWidth = timelineDays * dayWidth;
  const buckets = useMemo(
    () => buildTimeBuckets(paddedStart, paddedEnd, zoom),
    [paddedEnd, paddedStart, zoom]
  );
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
  const todayOffset = diffDays(paddedStart, todayDate);
  const showTodayLine = todayOffset >= 0 && todayOffset <= timelineDays;

  useEffect(() => {
    if (!dragState || !onTaskDatesChange) return;

    const onPointerMove = (event: PointerEvent) => {
      const deltaDays = Math.round((event.clientX - dragState.pointerStartX) / dayWidth);
      if (deltaDays === 0) {
        setPreviewDates((current) => ({
          ...current,
          [dragState.taskId]: {
            startDate: dragState.initialStartDate,
            endDate: dragState.initialEndDate,
          },
        }));
        return;
      }

      const movedStart = addDays(dragState.initialStartDate, deltaDays);
      const movedEnd = addDays(dragState.initialEndDate, deltaDays);
      let nextStartDate = movedStart;
      let nextEndDate = movedEnd;

      if (dragState.mode === "resize-start") {
        nextStartDate = addDays(dragState.initialStartDate, deltaDays);
        if (new Date(`${nextStartDate}T00:00:00`).getTime() > new Date(`${dragState.initialEndDate}T00:00:00`).getTime()) {
          nextStartDate = dragState.initialEndDate;
        }
        nextEndDate = dragState.initialEndDate;
      } else if (dragState.mode === "resize-end") {
        nextEndDate = addDays(dragState.initialEndDate, deltaDays);
        if (new Date(`${nextEndDate}T00:00:00`).getTime() < new Date(`${dragState.initialStartDate}T00:00:00`).getTime()) {
          nextEndDate = dragState.initialStartDate;
        }
        nextStartDate = dragState.initialStartDate;
      }

      setPreviewDates((current) => ({
        ...current,
        [dragState.taskId]: {
          startDate: nextStartDate,
          endDate: nextEndDate,
        },
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

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6DFD6] bg-white">
      <div className="grid grid-cols-[320px_1fr] border-b border-[#E6DFD6] bg-[#FAF8F5]">
        <div className="sticky left-0 z-10 border-r border-[#E6DFD6] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
          Task / fas
        </div>
        <div className="overflow-x-auto">
          <div className="relative h-12" style={{ width: timelineWidth }}>
            {buckets.map((bucket) => {
              const left = diffDays(paddedStart, bucket.startDate) * dayWidth;
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

      <div className="grid grid-cols-[320px_1fr]">
        <div className="sticky left-0 z-10 border-r border-[#E6DFD6] bg-white">
          {rows.map((row) => {
            if (row.type === "group") {
              return (
                <div
                  key={row.id}
                  className="flex h-11 items-center border-b border-[#F0EBE3] bg-[#FAF8F5] px-4 text-xs font-semibold uppercase tracking-wide text-[#8C7860]"
                >
                  {row.label}
                </div>
              );
            }
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onTaskClick?.(row.task)}
                className="flex h-11 w-full items-center justify-between border-b border-[#F5F1EB] px-4 text-left text-sm hover:bg-[#FAF8F5]"
              >
                <span className="truncate pr-2 text-[#2A2520]">{row.task.title}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(row.task.status)}`} />
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <div className="relative" style={{ width: timelineWidth }}>
            {weekendOffsets.map((offset) => (
              <div
                key={`w-${offset}`}
                className="absolute bottom-0 top-0 bg-[#FAF8F5]"
                style={{ left: offset * dayWidth, width: dayWidth }}
              />
            ))}

            {showTodayLine && (
              <div
                className="absolute bottom-0 top-0 z-20 w-0.5 bg-[#E7B54A]"
                style={{ left: todayOffset * dayWidth }}
              />
            )}

            {rows.map((row, rowIndex) => {
              const top = rowIndex * 44;
              if (row.type === "group") {
                return (
                  <div
                    key={row.id}
                    className="absolute left-0 right-0 border-b border-[#F0EBE3] bg-[#FAF8F5]"
                    style={{ top, height: 44 }}
                  />
                );
              }

              const preview = previewDates[row.task.id];
              const task = preview
                ? { ...row.task, startDate: preview.startDate, endDate: preview.endDate }
                : row.task;
              const bar = toTaskBarPosition(task, paddedStart, dayWidth);

              return (
                <div
                  key={row.id}
                  className="absolute left-0 right-0 border-b border-[#F5F1EB]"
                  style={{ top, height: 44 }}
                >
                  <button
                    type="button"
                    onClick={() => onTaskClick?.(row.task)}
                    className={`absolute top-1/2 h-7 -translate-y-1/2 rounded-md px-2 text-left text-[11px] font-semibold text-white shadow ${statusClass(row.task.status)}`}
                    style={{ left: bar.left, width: Math.max(26, bar.width) }}
                  >
                    <span className="truncate">{row.task.title}</span>
                  </button>

                  {editable && onTaskDatesChange && (
                    <>
                      <button
                        type="button"
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
                        className="absolute top-1/2 h-7 -translate-y-1/2 rounded-md border border-white/30 bg-white/10"
                        style={{ left: bar.left, width: Math.max(26, bar.width) }}
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
                        style={{ left: bar.left }}
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
                        style={{ left: bar.left + Math.max(26, bar.width) - 8 }}
                      />
                    </>
                  )}
                </div>
              );
            })}
            <div style={{ height: rows.length * 44 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

