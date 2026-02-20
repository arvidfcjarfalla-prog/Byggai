"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GanttAction, GanttProject } from "./types";

export type ZoomLevel = "month" | "quarter" | "year";

const PIXELS_PER_DAY: Record<ZoomLevel, number> = {
  month: 5,
  quarter: 1.67,
  year: 0.41,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SIDEBAR_WIDTH = 320;
const HEADER_HEIGHT = 72;
const TIMELINE_HEADER_HEIGHT = 64;
const PROJECT_ROW_HEIGHT = 48;
const ACTION_ROW_HEIGHT = 36;
const EXPANDED_STORAGE_KEY = "gantt-expanded";
const PROJECTS_STORAGE_KEY = "gantt-projects-data";

interface Props {
  projects: GanttProject[];
  initialZoom?: ZoomLevel;
}

interface TimeCell {
  id: string;
  label: string;
  start: Date;
  end: Date;
  span: number;
}

interface ProjectSpan {
  project: GanttProject;
  start: Date;
  end: Date;
}

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  projectId: string;
  actionId: string;
  mode: DragMode;
  pointerStartX: number;
  initialStart: Date;
  initialEnd: Date;
}

interface DragStartEventLike {
  clientX: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return new Date("2026-01-01T12:00:00Z");
  return parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));
}

function startOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getUTCMonth() / 3);
  return new Date(Date.UTC(date.getUTCFullYear(), quarter * 3, 1, 12));
}

function endOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getUTCMonth() / 3);
  return new Date(Date.UTC(date.getUTCFullYear(), quarter * 3 + 3, 0, 12));
}

function startOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12));
}

function endOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31, 12));
}

function monthShort(date: Date): string {
  return date.toLocaleDateString("sv-SE", { month: "short", timeZone: "UTC" });
}

function quarterLabel(date: Date): string {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${quarter}`;
}

function yearLabel(date: Date): string {
  return `${date.getUTCFullYear()}`;
}

function buildMonths(start: Date, end: Date): TimeCell[] {
  const cells: TimeCell[] = [];
  let cursor = startOfMonth(start);

  while (cursor <= end) {
    const monthEnd = endOfMonth(cursor);
    cells.push({
      id: `month-${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`,
      label: monthShort(cursor),
      start: cursor,
      end: monthEnd,
      span: diffDays(cursor, monthEnd) + 1,
    });
    cursor = addDays(monthEnd, 1);
  }

  return cells;
}

function buildQuarters(start: Date, end: Date): TimeCell[] {
  const cells: TimeCell[] = [];
  let cursor = startOfQuarter(start);

  while (cursor <= end) {
    const quarterEnd = endOfQuarter(cursor);
    cells.push({
      id: `quarter-${cursor.getUTCFullYear()}-${Math.floor(cursor.getUTCMonth() / 3)}`,
      label: quarterLabel(cursor),
      start: cursor,
      end: quarterEnd,
      span: diffDays(cursor, quarterEnd) + 1,
    });
    cursor = addDays(quarterEnd, 1);
  }

  return cells;
}

function buildYears(start: Date, end: Date): TimeCell[] {
  const cells: TimeCell[] = [];
  let cursor = startOfYear(start);

  while (cursor <= end) {
    const yearEnd = endOfYear(cursor);
    cells.push({
      id: `year-${cursor.getUTCFullYear()}`,
      label: yearLabel(cursor),
      start: cursor,
      end: yearEnd,
      span: diffDays(cursor, yearEnd) + 1,
    });
    cursor = addDays(yearEnd, 1);
  }

  return cells;
}

function calculateSpan(project: GanttProject): ProjectSpan {
  const dates = project.actions.flatMap((action) => [
    parseDate(action.startDate),
    parseDate(action.endDate),
  ]);

  if (dates.length === 0) {
    return {
      project,
      start: parseDate(project.startDate),
      end: parseDate(project.endDate),
    };
  }

  const start = new Date(Math.min(...dates.map((date) => date.getTime())));
  const end = new Date(Math.max(...dates.map((date) => date.getTime())));
  return { project, start, end };
}

function clampDateWithin(start: Date, end: Date, mode: DragMode, deltaDays: number): { start: Date; end: Date } {
  if (mode === "move") {
    return {
      start: addDays(start, deltaDays),
      end: addDays(end, deltaDays),
    };
  }

  if (mode === "resize-start") {
    const nextStart = addDays(start, deltaDays);
    if (nextStart.getTime() > end.getTime()) {
      return { start: end, end };
    }
    return { start: nextStart, end };
  }

  const nextEnd = addDays(end, deltaDays);
  if (nextEnd.getTime() < start.getTime()) {
    return { start, end: start };
  }
  return { start, end: nextEnd };
}

function isActionStatus(value: unknown): value is GanttAction["status"] {
  return value === "completed" || value === "in-progress" || value === "not-started";
}

function isGanttAction(value: unknown): value is GanttAction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.startDate === "string" &&
    typeof candidate.endDate === "string" &&
    isActionStatus(candidate.status)
  );
}

function isGanttProject(value: unknown): value is GanttProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.startDate === "string" &&
    typeof candidate.endDate === "string" &&
    Array.isArray(candidate.actions) &&
    candidate.actions.every((action) => isGanttAction(action))
  );
}

function loadProjectsFromStorage(fallback: GanttProject[]): GanttProject[] {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((project) => isGanttProject(project))) {
      return parsed;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function actionBarClass(status: GanttAction["status"]): string {
  if (status === "completed") return "bg-[#6B5A47]";
  if (status === "in-progress") return "bg-[#8C7860]";
  return "bg-[#CDB49B] opacity-70";
}

const ProfessionalGantt = memo(function ProfessionalGantt({
  projects,
  initialZoom = "month",
}: Props) {
  const [zoom, setZoom] = useState<ZoomLevel>(initialZoom);
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(EXPANDED_STORAGE_KEY);
  });
  const [projectsState, setProjectsState] = useState<GanttProject[]>(() =>
    loadProjectsFromStorage(projects)
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [newActionProjectId, setNewActionProjectId] = useState<string>(projects[0]?.id ?? "");
  const [newActionName, setNewActionName] = useState("");
  const [newActionStartDate, setNewActionStartDate] = useState("");
  const [newActionEndDate, setNewActionEndDate] = useState("");
  const [newActionStatus, setNewActionStatus] = useState<GanttAction["status"]>("not-started");
  const [formError, setFormError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const pendingScrollRatioRef = useRef<number | null>(null);

  useEffect(() => {
    if (expandedId) {
      window.localStorage.setItem(EXPANDED_STORAGE_KEY, expandedId);
      return;
    }
    window.localStorage.removeItem(EXPANDED_STORAGE_KEY);
  }, [expandedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectsState));
  }, [projectsState]);

  const effectiveNewActionProjectId = useMemo(() => {
    if (projectsState.length === 0) return "";
    return projectsState.some((project) => project.id === newActionProjectId)
      ? newActionProjectId
      : projectsState[0].id;
  }, [newActionProjectId, projectsState]);

  const spans = useMemo(() => projectsState.map((project) => calculateSpan(project)), [projectsState]);

  const bounds = useMemo(() => {
    if (spans.length === 0) {
      return {
        start: new Date("2026-01-01T12:00:00Z"),
        end: new Date("2026-12-31T12:00:00Z"),
      };
    }

    const earliest = new Date(Math.min(...spans.map((span) => span.start.getTime())));
    const latest = new Date(Math.max(...spans.map((span) => span.end.getTime())));

    return {
      start: startOfMonth(addDays(earliest, -30)),
      end: endOfMonth(addDays(latest, 30)),
    };
  }, [spans]);

  const totalDays = diffDays(bounds.start, bounds.end) + 1;
  const pixelsPerDay = PIXELS_PER_DAY[zoom];
  const timelineWidth = totalDays * pixelsPerDay;

  const months = useMemo(() => buildMonths(bounds.start, bounds.end), [bounds]);
  const quarters = useMemo(() => buildQuarters(bounds.start, bounds.end), [bounds]);
  const years = useMemo(() => buildYears(bounds.start, bounds.end), [bounds]);

  const topBand = zoom === "year" ? years : quarters;
  const bottomBand = months;

  const toPx = useCallback(
    (date: Date): number => diffDays(bounds.start, date) * pixelsPerDay,
    [bounds.start, pixelsPerDay]
  );

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now;
  }, []);

  const todayPx = toPx(today);
  const showToday = today >= bounds.start && today <= bounds.end;

  const handleBodyScroll = useCallback(() => {
    if (!bodyRef.current || !headerRef.current) return;
    headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
  }, []);

  const handleZoomChange = useCallback(
    (nextZoom: ZoomLevel) => {
      if (!bodyRef.current || nextZoom === zoom) return;
      const maxScroll = Math.max(1, bodyRef.current.scrollWidth - bodyRef.current.clientWidth);
      pendingScrollRatioRef.current = bodyRef.current.scrollLeft / maxScroll;
      setZoom(nextZoom);
    },
    [zoom]
  );

  useEffect(() => {
    if (!bodyRef.current || pendingScrollRatioRef.current === null) return;
    const maxScroll = Math.max(0, bodyRef.current.scrollWidth - bodyRef.current.clientWidth);
    const nextLeft = Math.max(0, Math.min(maxScroll, maxScroll * pendingScrollRatioRef.current));
    bodyRef.current.scrollLeft = nextLeft;
    if (headerRef.current) headerRef.current.scrollLeft = nextLeft;
    pendingScrollRatioRef.current = null;
  }, [timelineWidth, zoom]);

  const jumpToToday = useCallback(() => {
    if (!bodyRef.current) return;
    const target = todayPx - bodyRef.current.clientWidth / 2;
    bodyRef.current.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [todayPx]);

  const toggleProject = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const updateActionDates = useCallback(
    (projectId: string, actionId: string, start: Date, end: Date) => {
      const nextStart = formatDate(start);
      const nextEnd = formatDate(end);

      setProjectsState((current) =>
        current.map((project) => {
          if (project.id !== projectId) return project;
          return {
            ...project,
            actions: project.actions.map((action) =>
              action.id === actionId
                ? { ...action, startDate: nextStart, endDate: nextEnd }
                : action
            ),
          };
        })
      );
    },
    []
  );

  const startActionDrag = useCallback(
    (
      event: DragStartEventLike,
      projectId: string,
      actionId: string,
      startDate: string,
      endDate: string,
      mode: DragMode
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setDragState({
        projectId,
        actionId,
        mode,
        pointerStartX: event.clientX,
        initialStart: parseDate(startDate),
        initialEnd: parseDate(endDate),
      });
    },
    []
  );

  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (event: PointerEvent) => {
      const deltaPx = event.clientX - dragState.pointerStartX;
      const deltaDays = Math.round(deltaPx / pixelsPerDay);
      const next = clampDateWithin(
        dragState.initialStart,
        dragState.initialEnd,
        dragState.mode,
        deltaDays
      );
      updateActionDates(dragState.projectId, dragState.actionId, next.start, next.end);
    };

    const onPointerEnd = () => {
      setDragState(null);
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = dragState.mode === "move" ? "grabbing" : "ew-resize";

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [dragState, pixelsPerDay, updateActionDates]);

  const addAction = useCallback(() => {
    setFormError(null);
    if (!effectiveNewActionProjectId) {
      setFormError("Valj projekt.");
      return;
    }
    if (!newActionName.trim()) {
      setFormError("Skriv ett namn for atgarden.");
      return;
    }
    if (!newActionStartDate || !newActionEndDate) {
      setFormError("Valj start- och slutdatum.");
      return;
    }

    const start = parseDate(newActionStartDate);
    const end = parseDate(newActionEndDate);
    if (end.getTime() < start.getTime()) {
      setFormError("Slutdatum maste vara samma dag eller senare an startdatum.");
      return;
    }

    setProjectsState((current) =>
      current.map((project) => {
        if (project.id !== effectiveNewActionProjectId) return project;

        const newAction: GanttAction = {
          id: `${project.id}-manual-${Date.now()}`,
          name: newActionName.trim(),
          startDate: newActionStartDate,
          endDate: newActionEndDate,
          status: newActionStatus,
          progress: newActionStatus === "completed" ? 100 : 0,
        };

        return {
          ...project,
          actions: [...project.actions, newAction],
        };
      })
    );

    setExpandedId(effectiveNewActionProjectId);
    setNewActionName("");
    setNewActionStartDate("");
    setNewActionEndDate("");
    setNewActionStatus("not-started");
  }, [
    effectiveNewActionProjectId,
    newActionEndDate,
    newActionName,
    newActionStartDate,
    newActionStatus,
  ]);

  return (
    <div className="flex h-screen flex-col bg-[#FAF8F5]">
      <header
        className="border-b-2 border-[#E8E3DC] bg-white px-6 py-5"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#2A2520]">
              Projektportfolj
            </h1>
            <p className="mt-0.5 text-sm text-[#766B60]">
              Dra bars for att flytta datum eller andra spann. Lagg till egna atgarder direkt.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={jumpToToday}
              className="flex items-center gap-2 rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] transition-all hover:border-[#8C7860] hover:bg-[#8C7860] hover:text-white"
              aria-label="Hoppa till idag"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Idag
            </button>

            <div
              className="flex gap-1 rounded-xl border-2 border-[#E8E3DC] bg-white p-1"
              role="radiogroup"
              aria-label="Valj zoomniva"
            >
              {(["month", "quarter", "year"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleZoomChange(level)}
                  role="radio"
                  aria-checked={zoom === level}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    zoom === level
                      ? "bg-[#8C7860] text-white shadow-sm"
                      : "text-[#766B60] hover:bg-[#FAF8F5]"
                  }`}
                >
                  {level === "month" ? "Manad" : level === "quarter" ? "Kvartal" : "Ar"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-[#E8E3DC] bg-[#FAF8F5] px-6 py-3">
        <div className="grid gap-2 md:grid-cols-[1fr_220px_150px_150px_150px_auto] md:items-end">
          <label className="text-xs font-semibold text-[#6B5A47]">
            Ny atgard
            <input
              type="text"
              value={newActionName}
              onChange={(event) => setNewActionName(event.target.value)}
              placeholder="Ex. Byte av armaturer i trapphus"
              className="mt-1 w-full rounded-lg border border-[#E8E3DC] bg-white px-3 py-2 text-sm text-[#2A2520] outline-none focus:border-[#8C7860]"
            />
          </label>

          <label className="text-xs font-semibold text-[#6B5A47]">
            Projekt
            <select
              value={effectiveNewActionProjectId}
              onChange={(event) => setNewActionProjectId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E8E3DC] bg-white px-3 py-2 text-sm text-[#2A2520] outline-none focus:border-[#8C7860]"
            >
              {projectsState.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-[#6B5A47]">
            Start
            <input
              type="date"
              value={newActionStartDate}
              onChange={(event) => setNewActionStartDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E8E3DC] bg-white px-3 py-2 text-sm text-[#2A2520] outline-none focus:border-[#8C7860]"
            />
          </label>

          <label className="text-xs font-semibold text-[#6B5A47]">
            Slut
            <input
              type="date"
              value={newActionEndDate}
              onChange={(event) => setNewActionEndDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E8E3DC] bg-white px-3 py-2 text-sm text-[#2A2520] outline-none focus:border-[#8C7860]"
            />
          </label>

          <label className="text-xs font-semibold text-[#6B5A47]">
            Status
            <select
              value={newActionStatus}
              onChange={(event) => setNewActionStatus(event.target.value as GanttAction["status"])}
              className="mt-1 w-full rounded-lg border border-[#E8E3DC] bg-white px-3 py-2 text-sm text-[#2A2520] outline-none focus:border-[#8C7860]"
            >
              <option value="not-started">Planerad</option>
              <option value="in-progress">Pagar</option>
              <option value="completed">Klar</option>
            </select>
          </label>

          <button
            type="button"
            onClick={addAction}
            className="h-10 rounded-xl bg-[#8C7860] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6B5A47]"
          >
            + Lagg till
          </button>
        </div>
        {formError && (
          <p className="mt-2 text-xs font-semibold text-[#A4555B]">{formError}</p>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="border-r-2 border-[#E8E3DC] bg-white"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <div
            className="sticky top-0 z-20 flex items-center border-b border-[#E8E3DC] bg-[#F3EEE7] px-4"
            style={{ height: TIMELINE_HEADER_HEIGHT }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B5A47]">
              Projekt och atgarder
            </span>
          </div>

          <div className="hide-scrollbar overflow-y-auto" style={{ height: `calc(100vh - ${HEADER_HEIGHT + TIMELINE_HEADER_HEIGHT + 68}px)` }}>
            {spans.map(({ project }) => {
              const isExpanded = expandedId === project.id;
              return (
                <div key={project.id}>
                  <button
                    type="button"
                    onClick={() => toggleProject(project.id)}
                    className="group flex w-full items-center gap-2 border-b border-[#E8E3DC] px-4 transition-colors hover:bg-[#FAF8F5]"
                    style={{ height: PROJECT_ROW_HEIGHT }}
                    aria-expanded={isExpanded}
                    aria-controls={`project-actions-${project.id}`}
                  >
                    <svg
                      className={`h-3 w-3 flex-shrink-0 text-[#8C7860] transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 16 16"
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>

                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[#2A2520]">
                      {project.name}
                    </span>

                    <span className="flex-shrink-0 rounded-full bg-[#CDB49B]/20 px-2 py-0.5 text-[10px] font-bold text-[#6B5A47]">
                      {project.actions.length}
                    </span>
                  </button>

                  <div
                    id={`project-actions-${project.id}`}
                    className="overflow-hidden border-b border-[#E8E3DC] bg-[#FAF8F5]/50 transition-all duration-200 ease-in-out"
                    style={{
                      maxHeight: isExpanded ? `${project.actions.length * ACTION_ROW_HEIGHT}px` : "0px",
                    }}
                  >
                    {project.actions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center gap-2 border-b border-[#F1ECE6] px-4 pl-9 last:border-b-0"
                        style={{ height: ACTION_ROW_HEIGHT }}
                      >
                        <div
                          className={`h-2 w-2 flex-shrink-0 rounded-full ${
                            action.status === "completed"
                              ? "bg-[#6B5A47]"
                              : action.status === "in-progress"
                              ? "bg-[#8C7860]"
                              : "bg-[#CDB49B]"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs text-[#2A2520]">
                          {action.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div
            ref={headerRef}
            className="overflow-x-hidden overflow-y-hidden border-b-2 border-[#E8E3DC] bg-white"
            style={{ height: TIMELINE_HEADER_HEIGHT }}
          >
            <div style={{ width: timelineWidth }} className="relative">
              <div className="relative h-8 border-b border-[#E8E3DC] bg-[#F3EEE7]">
                {topBand.map((cell) => (
                  <div
                    key={cell.id}
                    className="absolute inset-y-0 flex items-center justify-center border-r border-[#E8E3DC] px-1 text-xs font-bold text-[#6B5A47]"
                    style={{ left: toPx(cell.start), width: cell.span * pixelsPerDay }}
                  >
                    <span className="block truncate">{cell.label}</span>
                  </div>
                ))}
              </div>

              <div className="relative h-8 bg-white">
                {bottomBand.map((cell, index) => (
                  <div
                    key={cell.id}
                    className={`absolute inset-y-0 flex items-center justify-center border-r border-[#E8E3DC] px-1 text-xs font-medium text-[#766B60] ${
                      index % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]"
                    }`}
                    style={{ left: toPx(cell.start), width: cell.span * pixelsPerDay }}
                  >
                    <span className="block truncate">{cell.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            ref={bodyRef}
            onScroll={handleBodyScroll}
            className="hide-scrollbar overflow-auto bg-[#FAF8F5]"
            style={{ height: `calc(100vh - ${HEADER_HEIGHT + TIMELINE_HEADER_HEIGHT + 68}px)` }}
          >
            <div style={{ width: timelineWidth }} className="relative">
              {spans.map(({ project, start, end }) => {
                const isExpanded = expandedId === project.id;
                const left = toPx(start);
                const width = Math.max(40, (diffDays(start, end) + 1) * pixelsPerDay);

                return (
                  <div key={project.id}>
                    <div
                      className="relative border-b border-[#E8E3DC] bg-white"
                      style={{ height: PROJECT_ROW_HEIGHT }}
                    >
                      {showToday && (
                        <div
                          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-[#B8666B]"
                          style={{ left: todayPx }}
                        >
                          <div className="absolute -top-5 -left-6 rounded bg-[#B8666B] px-1.5 py-0.5 text-[9px] font-bold text-white">
                            IDAG
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="absolute top-1/2 -translate-y-1/2 rounded-lg border border-[#8C7860] bg-gradient-to-r from-[#CDB49B] to-[#8C7860] px-3 py-2 text-left shadow-sm transition-all hover:opacity-100 hover:shadow-md"
                        style={{ left, width, opacity: 0.72 }}
                        onClick={() => toggleProject(project.id)}
                        title={`${project.name}\n${formatDate(start)} -> ${formatDate(end)}\n${project.actions.length} atgarder`}
                      >
                        <div className="truncate text-xs font-semibold text-white">
                          {project.name}
                        </div>
                      </button>
                    </div>

                    <div
                      className="overflow-hidden border-b border-[#E8E3DC] bg-[#FAF8F5]/50 transition-all duration-200 ease-in-out"
                      style={{
                        maxHeight: isExpanded ? `${project.actions.length * ACTION_ROW_HEIGHT}px` : "0px",
                      }}
                    >
                      {project.actions.map((action) => {
                        const actionStart = parseDate(action.startDate);
                        const actionEnd = parseDate(action.endDate);
                        const actionLeft = toPx(actionStart);
                        const actionWidth = Math.max(
                          24,
                          (diffDays(actionStart, actionEnd) + 1) * pixelsPerDay
                        );

                        return (
                          <div
                            key={action.id}
                            className="relative border-b border-[#F1ECE6] last:border-b-0"
                            style={{ height: ACTION_ROW_HEIGHT }}
                          >
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 overflow-hidden rounded px-2 py-1 text-[10px] font-semibold text-white shadow-sm ${actionBarClass(
                                action.status
                              )}`}
                              style={{ left: actionLeft, width: actionWidth }}
                              title={`${action.name}\n${action.startDate} -> ${action.endDate}\n${
                                action.progress ?? 0
                              }% klart`}
                              onPointerDown={(event) =>
                                startActionDrag(
                                  event,
                                  project.id,
                                  action.id,
                                  action.startDate,
                                  action.endDate,
                                  "move"
                                )
                              }
                            >
                              <button
                                type="button"
                                aria-label="Andra startdatum"
                                className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                                onPointerDown={(event) =>
                                  startActionDrag(
                                    event,
                                    project.id,
                                    action.id,
                                    action.startDate,
                                    action.endDate,
                                    "resize-start"
                                  )
                                }
                              />

                              <div className="truncate px-1">{action.name}</div>

                              <button
                                type="button"
                                aria-label="Andra slutdatum"
                                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                                onPointerDown={(event) =>
                                  startActionDrag(
                                    event,
                                    project.id,
                                    action.id,
                                    action.startDate,
                                    action.endDate,
                                    "resize-end"
                                  )
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ProfessionalGantt.displayName = "ProfessionalGantt";

export { ProfessionalGantt, ProfessionalGantt as ActionPortfolioGantt };
