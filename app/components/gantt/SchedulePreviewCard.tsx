"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ensureScheduleForProject,
  readSchedule,
  subscribeSchedules,
  type ProjectSchedule,
  type ScheduleProjectContext,
} from "../../lib/schedule";
import { GanttView } from "./GanttView";

export function SchedulePreviewCard({
  context,
  heading = "Tidsplan",
  description = "Auto-genererad och redigerbar tidsplan.",
  maxTasks = 10,
}: {
  context: ScheduleProjectContext;
  heading?: string;
  description?: string;
  maxTasks?: number;
}) {
  const [schedule, setSchedule] = useState<ProjectSchedule | null>(() =>
    readSchedule(context.projectId) || ensureScheduleForProject(context)
  );

  useEffect(() => {
    return subscribeSchedules(() => {
      setSchedule(readSchedule(context.projectId));
    });
  }, [context.projectId]);

  if (!schedule) return null;

  return (
    <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#2A2520]">{heading}</h3>
          <p className="text-sm text-[#6B5A47]">{description}</p>
        </div>
        <Link
          href={`/timeline?projectId=${encodeURIComponent(context.projectId)}`}
          className="rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-white"
        >
          Öppna Timeline
        </Link>
      </div>

      <GanttView
        tasks={schedule.tasks.slice(0, maxTasks)}
        zoom={schedule.viewSettings.zoom}
        showWeekends={Boolean(schedule.viewSettings.showWeekends)}
        groupBy={schedule.viewSettings.groupBy || "phase"}
        scheduleStartDate={schedule.startDate}
        scheduleEndDate={schedule.endDate}
      />
    </article>
  );
}
