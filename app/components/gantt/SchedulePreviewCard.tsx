"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GanttToolbar } from "./GanttToolbar";
import { TaskDrawer } from "./TaskDrawer";
import { applyTaskDateChange, getDependencyWarnings } from "./gantt-utils";
import {
  appendScheduleLog,
  ensureScheduleForProject,
  readSchedule,
  subscribeSchedules,
  writeSchedule,
  type ProjectSchedule,
  type ScheduleProjectContext,
  type ScheduleTask,
} from "../../lib/schedule";
import { GanttView } from "./GanttView";

function planningHrefForAudience(
  audience: ScheduleProjectContext["audience"],
  projectId: string
): string {
  const segment = audience === "brf" ? "brf" : "privat";
  return `/dashboard/${segment}/planering?projectId=${encodeURIComponent(projectId)}`;
}

export function SchedulePreviewCard({
  context,
  heading = "Tidsplan",
  description = "Auto-genererad och redigerbar tidsplan.",
  maxTasks = 10,
  editable = false,
}: {
  context: ScheduleProjectContext;
  heading?: string;
  description?: string;
  maxTasks?: number;
  editable?: boolean;
}) {
  const [schedule, setSchedule] = useState<ProjectSchedule | null>(() =>
    readSchedule(context.projectId) || ensureScheduleForProject(context)
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [warningTaskId, setWarningTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSchedules(() => {
      setSchedule(readSchedule(context.projectId));
    });
  }, [context.projectId]);

  const dependencyWarnings = useMemo(
    () => (schedule ? getDependencyWarnings(schedule.tasks) : []),
    [schedule]
  );
  const autoShiftTaskId = warningTaskId || dependencyWarnings[0]?.taskId || null;
  const selectedTask = useMemo(
    () => schedule?.tasks.find((task) => task.id === selectedTaskId) || null,
    [schedule, selectedTaskId]
  );
  const visibleTasks = useMemo(() => {
    if (!schedule) return [];
    return editable ? schedule.tasks : schedule.tasks.slice(0, maxTasks);
  }, [editable, maxTasks, schedule]);

  const updateSchedule = (updater: (current: ProjectSchedule) => ProjectSchedule) => {
    if (!schedule) return;
    const next = updater(schedule);
    const persisted = writeSchedule(context.projectId, next);
    setSchedule(persisted);
  };

  const onTaskDatesChange = (
    taskId: string,
    nextStartDate: string,
    nextEndDate: string
  ) => {
    if (!schedule) return;
    const previousTask = schedule.tasks.find((task) => task.id === taskId);
    if (!previousTask) return;

    const changed = applyTaskDateChange(schedule.tasks, taskId, nextStartDate, nextEndDate);
    let nextSchedule: ProjectSchedule = {
      ...schedule,
      tasks: changed.tasks,
      startDate: changed.tasks.reduce(
        (acc, task) => (task.startDate < acc ? task.startDate : acc),
        changed.tasks[0]?.startDate || schedule.startDate
      ),
      endDate: changed.tasks.reduce(
        (acc, task) => (task.endDate > acc ? task.endDate : acc),
        changed.tasks[0]?.endDate || schedule.endDate
      ),
    };
    nextSchedule = appendScheduleLog(nextSchedule, [
      {
        taskId,
        field: "date_range",
        fromValue: `${previousTask.startDate} -> ${previousTask.endDate}`,
        toValue: `${nextStartDate} -> ${nextEndDate}`,
        actor: "local-user",
      },
    ]);

    const persisted = writeSchedule(context.projectId, nextSchedule);
    setSchedule(persisted);
    setWarningTaskId(changed.warnings.length > 0 ? taskId : null);
    setNotice(changed.warnings.length > 0 ? "Beroendevarning hittad i planen." : null);
  };

  const autoShiftDependents = () => {
    if (!schedule || !autoShiftTaskId) return;
    const currentTask = schedule.tasks.find((task) => task.id === autoShiftTaskId);
    if (!currentTask) return;

    const shifted = applyTaskDateChange(
      schedule.tasks,
      autoShiftTaskId,
      currentTask.startDate,
      currentTask.endDate,
      { autoShiftDependents: true }
    );

    let nextSchedule: ProjectSchedule = {
      ...schedule,
      tasks: shifted.tasks,
    };
    nextSchedule = appendScheduleLog(
      nextSchedule,
      shifted.shiftedTaskIds.map((taskId) => ({
        taskId,
        field: "dependency_auto_shift",
        fromValue: "dependency warning",
        toValue: "auto-shifted",
        actor: "local-user",
      }))
    );
    const persisted = writeSchedule(context.projectId, nextSchedule);
    setSchedule(persisted);
    setWarningTaskId(null);
    setNotice("Beroenden auto-shiftade.");
  };

  const onTaskSave = (task: ScheduleTask) => {
    if (!schedule) return;
    const previousTask = schedule.tasks.find((item) => item.id === task.id);
    if (!previousTask) return;

    const changes: Array<{ field: string; from: string; to: string }> = [];
    if (previousTask.title !== task.title) {
      changes.push({ field: "title", from: previousTask.title, to: task.title });
    }
    if (previousTask.phase !== task.phase) {
      changes.push({ field: "phase", from: previousTask.phase, to: task.phase });
    }
    if (previousTask.status !== task.status) {
      changes.push({ field: "status", from: previousTask.status, to: task.status });
    }
    if (
      previousTask.startDate !== task.startDate ||
      previousTask.endDate !== task.endDate
    ) {
      changes.push({
        field: "date_range",
        from: `${previousTask.startDate} -> ${previousTask.endDate}`,
        to: `${task.startDate} -> ${task.endDate}`,
      });
    }

    let nextSchedule: ProjectSchedule = {
      ...schedule,
      tasks: schedule.tasks.map((item) => (item.id === task.id ? task : item)),
    };
    nextSchedule = appendScheduleLog(
      nextSchedule,
      changes.map((entry) => ({
        taskId: task.id,
        field: entry.field,
        fromValue: entry.from,
        toValue: entry.to,
        actor: "local-user",
      }))
    );
    const persisted = writeSchedule(context.projectId, nextSchedule);
    setSchedule(persisted);
    setNotice("Aktivitet uppdaterad.");
  };

  const onTaskDelete = (taskId: string) => {
    if (!schedule) return;
    const task = schedule.tasks.find((item) => item.id === taskId);
    if (!task) return;

    let nextSchedule: ProjectSchedule = {
      ...schedule,
      tasks: schedule.tasks
        .filter((item) => item.id !== taskId)
        .map((item) => ({
          ...item,
          dependencies: item.dependencies.filter((dependencyId) => dependencyId !== taskId),
        })),
    };
    nextSchedule = appendScheduleLog(nextSchedule, [
      {
        taskId,
        field: "task_deleted",
        fromValue: task.title,
        toValue: "deleted",
        actor: "local-user",
      },
    ]);
    const persisted = writeSchedule(context.projectId, nextSchedule);
    setSchedule(persisted);
    setSelectedTaskId(null);
    setNotice("Aktivitet borttagen.");
  };

  const onAddTask = () => {
    if (!schedule) return;
    const task: ScheduleTask = {
      id: `${schedule.projectId}-manual-${Date.now()}`,
      projectId: schedule.projectId,
      title: "Ny aktivitet",
      category: "pre",
      phase: "Planering",
      startDate: schedule.endDate,
      endDate: schedule.endDate,
      status: "planned",
      dependencies: [],
      kind: "pipeline",
      source: "manual",
      updatedAt: new Date().toISOString(),
    };

    let nextSchedule: ProjectSchedule = {
      ...schedule,
      tasks: [...schedule.tasks, task],
      endDate: task.endDate > schedule.endDate ? task.endDate : schedule.endDate,
    };
    nextSchedule = appendScheduleLog(nextSchedule, [
      {
        taskId: task.id,
        field: "task_created",
        fromValue: "-",
        toValue: task.title,
        actor: "local-user",
      },
    ]);
    const persisted = writeSchedule(context.projectId, nextSchedule);
    setSchedule(persisted);
    setSelectedTaskId(task.id);
    setNotice("Ny aktivitet skapad.");
  };

  if (!schedule) return null;

  return (
    <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#2A2520]">{heading}</h3>
          <p className="text-sm text-[#6B5A47]">{description}</p>
        </div>
        <Link
          href={planningHrefForAudience(context.audience, context.projectId)}
          className="rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-white"
        >
          Öppna planering
        </Link>
      </div>

      {editable && (
        <div className="mb-3 space-y-3">
          <GanttToolbar
            zoom={schedule.viewSettings.zoom}
            showWeekends={Boolean(schedule.viewSettings.showWeekends)}
            groupBy={schedule.viewSettings.groupBy || "phase"}
            onZoomChange={(zoom) =>
              updateSchedule((current) => ({
                ...current,
                viewSettings: { ...current.viewSettings, zoom },
              }))
            }
            onShowWeekendsChange={(showWeekends) =>
              updateSchedule((current) => ({
                ...current,
                viewSettings: { ...current.viewSettings, showWeekends },
              }))
            }
            onGroupByChange={(groupBy) =>
              updateSchedule((current) => ({
                ...current,
                viewSettings: { ...current.viewSettings, groupBy },
              }))
            }
            onAddTask={onAddTask}
          />

          {notice && (
            <p className="rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
              {notice}
            </p>
          )}

          {dependencyWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-semibold">Beroendevarningar</p>
              <ul className="mt-1 list-inside list-disc">
                {dependencyWarnings.slice(0, 3).map((warning) => (
                  <li key={`${warning.taskId}-${warning.dependencyId}`}>{warning.message}</li>
                ))}
              </ul>
              {autoShiftTaskId && (
                <button
                  type="button"
                  onClick={autoShiftDependents}
                  className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                >
                  Auto-shifta beroenden
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <GanttView
        tasks={visibleTasks}
        zoom={schedule.viewSettings.zoom}
        showWeekends={Boolean(schedule.viewSettings.showWeekends)}
        groupBy={schedule.viewSettings.groupBy || "phase"}
        scheduleStartDate={schedule.startDate}
        scheduleEndDate={schedule.endDate}
        editable={editable}
        onTaskClick={editable ? (task) => setSelectedTaskId(task.id) : undefined}
        onTaskDatesChange={editable ? onTaskDatesChange : undefined}
      />

      {editable && selectedTask && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => setSelectedTaskId(null)} />
          <TaskDrawer
            key={selectedTask.id}
            task={selectedTask}
            allTasks={schedule.tasks}
            onClose={() => setSelectedTaskId(null)}
            onSave={onTaskSave}
            onDelete={onTaskDelete}
          />
        </>
      )}
    </article>
  );
}
