"use client";

import type { ScheduleGroupBy, ScheduleZoom } from "../../lib/schedule";

export function GanttToolbar({
  zoom,
  showWeekends,
  groupBy,
  onZoomChange,
  onShowWeekendsChange,
  onGroupByChange,
  onZoomIn,
  onZoomOut,
  onToday,
  onAddTask,
}: {
  zoom: ScheduleZoom;
  showWeekends: boolean;
  groupBy: ScheduleGroupBy;
  onZoomChange: (zoom: ScheduleZoom) => void;
  onShowWeekendsChange: (enabled: boolean) => void;
  onGroupByChange: (groupBy: ScheduleGroupBy) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onToday?: () => void;
  onAddTask?: () => void;
}) {
  const effectiveZoom: Exclude<ScheduleZoom, "quarter"> =
    zoom === "quarter" ? "month" : zoom;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E6DFD6] bg-white p-3">
      <div className="inline-flex rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] p-1">
        {(["week", "month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onZoomChange(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              effectiveZoom === value
                ? "bg-[#8C7860] text-white"
                : "text-[#6B5A47] hover:bg-white"
            }`}
          >
            {value === "week" ? "Veckor" : value === "month" ? "Månader" : "År"}
          </button>
        ))}
      </div>

      {onToday && (
        <button
          type="button"
          onClick={onToday}
          className="rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-white"
        >
          Idag
        </button>
      )}

      {onZoomOut && (
        <button
          type="button"
          onClick={onZoomOut}
          className="rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-white"
        >
          Förminska
        </button>
      )}

      {onZoomIn && (
        <button
          type="button"
          onClick={onZoomIn}
          className="rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-white"
        >
          Förstora
        </button>
      )}

      <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
        <input
          type="checkbox"
          checked={showWeekends}
          onChange={(event) => onShowWeekendsChange(event.target.checked)}
        />
        Visa helger
      </label>

      <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
        Gruppera:
        <select
          value={groupBy}
          onChange={(event) => onGroupByChange(event.target.value as ScheduleGroupBy)}
          className="rounded-md border border-[#D9D1C6] bg-white px-2 py-1 text-xs"
        >
          <option value="phase">Fas</option>
          <option value="category">Kategori</option>
          <option value="project">Projekt</option>
        </select>
      </label>

      {onAddTask && (
        <button
          type="button"
          onClick={onAddTask}
          className="ml-auto rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
        >
          + Task
        </button>
      )}
    </div>
  );
}
