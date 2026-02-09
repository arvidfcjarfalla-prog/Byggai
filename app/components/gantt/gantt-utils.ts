import type { ScheduleTask, ScheduleZoom } from "../../lib/schedule";

export interface DependencyWarning {
  taskId: string;
  dependencyId: string;
  message: string;
}

export interface TimeBucket {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  days: number;
}

export interface DateChangeResult {
  tasks: ScheduleTask[];
  warnings: DependencyWarning[];
  shiftedTaskIds: string[];
}

function parseDate(isoDate: string): Date {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export function toDateOnly(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = parseDate(isoDate);
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

export function diffDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / dayMs);
}

export function taskDurationDays(task: Pick<ScheduleTask, "startDate" | "endDate">): number {
  return Math.max(1, diffDays(task.startDate, task.endDate) + 1);
}

export function clampTaskDates(startDate: string, endDate: string): {
  startDate: string;
  endDate: string;
} {
  if (parseDate(endDate).getTime() < parseDate(startDate).getTime()) {
    return { startDate, endDate: startDate };
  }
  return { startDate, endDate };
}

export function getDayWidth(zoom: ScheduleZoom): number {
  if (zoom === "month") return 24;
  if (zoom === "year") return 4;
  return 10;
}

export function getScheduleBounds(
  tasks: ScheduleTask[],
  fallbackStart?: string,
  fallbackEnd?: string
): { startDate: string; endDate: string } {
  if (tasks.length === 0) {
    const now = toDateOnly(new Date());
    return {
      startDate: fallbackStart || now,
      endDate: fallbackEnd || addDays(now, 180),
    };
  }

  const sortedStart = [...tasks].sort((a, b) =>
    a.startDate.localeCompare(b.startDate, "sv")
  );
  const sortedEnd = [...tasks].sort((a, b) => a.endDate.localeCompare(b.endDate, "sv"));
  return {
    startDate: fallbackStart || sortedStart[0].startDate,
    endDate: fallbackEnd || sortedEnd[sortedEnd.length - 1].endDate,
  };
}

export function getOffsetDays(rangeStartDate: string, date: string): number {
  return diffDays(rangeStartDate, date);
}

export function toTaskBarPosition(
  task: ScheduleTask,
  rangeStartDate: string,
  dayWidth: number
): { left: number; width: number } {
  const left = getOffsetDays(rangeStartDate, task.startDate) * dayWidth;
  const width = taskDurationDays(task) * dayWidth;
  return { left, width };
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("sv-SE", { month: "short", year: "numeric" });
}

function quarterLabel(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

function yearLabel(date: Date): string {
  return `${date.getFullYear()}`;
}

export function buildTimeBuckets(
  startDate: string,
  endDate: string,
  zoom: ScheduleZoom
): TimeBucket[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start.getTime() > end.getTime()) return [];

  const buckets: TimeBucket[] = [];
  let cursor = new Date(start);

  if (zoom === "month") {
    cursor.setDate(1);
    while (cursor.getTime() <= end.getTime()) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      buckets.push({
        id: `${bucketStart.getFullYear()}-${bucketStart.getMonth() + 1}`,
        label: monthLabel(bucketStart),
        startDate: toDateOnly(bucketStart),
        endDate: toDateOnly(bucketEnd),
        days: taskDurationDays({ startDate: toDateOnly(bucketStart), endDate: toDateOnly(bucketEnd) }),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return buckets;
  }

  if (zoom === "quarter") {
    const startQuarterMonth = Math.floor(cursor.getMonth() / 3) * 3;
    cursor = new Date(cursor.getFullYear(), startQuarterMonth, 1);
    while (cursor.getTime() <= end.getTime()) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 0);
      buckets.push({
        id: `${bucketStart.getFullYear()}-q${Math.floor(bucketStart.getMonth() / 3) + 1}`,
        label: quarterLabel(bucketStart),
        startDate: toDateOnly(bucketStart),
        endDate: toDateOnly(bucketEnd),
        days: taskDurationDays({ startDate: toDateOnly(bucketStart), endDate: toDateOnly(bucketEnd) }),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
    }
    return buckets;
  }

  cursor = new Date(cursor.getFullYear(), 0, 1);
  while (cursor.getTime() <= end.getTime()) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor.getFullYear(), 11, 31);
    buckets.push({
      id: `${bucketStart.getFullYear()}`,
      label: yearLabel(bucketStart),
      startDate: toDateOnly(bucketStart),
      endDate: toDateOnly(bucketEnd),
      days: taskDurationDays({ startDate: toDateOnly(bucketStart), endDate: toDateOnly(bucketEnd) }),
    });
    cursor = new Date(cursor.getFullYear() + 1, 0, 1);
  }
  return buckets;
}

export function collectDependents(tasks: ScheduleTask[], taskId: string): string[] {
  const dependents: string[] = [];
  const queue = [taskId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    tasks.forEach((task) => {
      if (task.dependencies.includes(current) && !dependents.includes(task.id)) {
        dependents.push(task.id);
        queue.push(task.id);
      }
    });
  }

  return dependents;
}

export function getDependencyWarnings(tasks: ScheduleTask[]): DependencyWarning[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const warnings: DependencyWarning[] = [];

  tasks.forEach((task) => {
    task.dependencies.forEach((dependencyId) => {
      const dependency = byId.get(dependencyId);
      if (!dependency) return;
      const earliestStart = addDays(dependency.endDate, 1);
      if (parseDate(task.startDate).getTime() < parseDate(earliestStart).getTime()) {
        warnings.push({
          taskId: task.id,
          dependencyId,
          message: `"${task.title}" startar före att beroendet "${dependency.title}" är klart.`,
        });
      }
    });
  });

  return warnings;
}

export function autoShiftDependentTasks(tasks: ScheduleTask[], changedTaskId: string): ScheduleTask[] {
  const byId = new Map<string, ScheduleTask>(
    tasks.map((task) => [task.id, { ...task }])
  );
  const queue = [changedTaskId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
    const currentTask = byId.get(currentId);
    if (!currentTask) continue;

    byId.forEach((task, taskId) => {
      if (!task.dependencies.includes(currentId)) return;
      const dependencyEndDates = task.dependencies
        .map((depId) => byId.get(depId)?.endDate)
        .filter((value): value is string => Boolean(value));
      if (dependencyEndDates.length === 0) return;
      const latestDependencyEnd = dependencyEndDates.sort((a, b) =>
        b.localeCompare(a, "sv")
      )[0];
      const earliestStart = addDays(latestDependencyEnd, 1);
      if (parseDate(task.startDate).getTime() >= parseDate(earliestStart).getTime()) return;

      const duration = taskDurationDays(task);
      const nextStart = earliestStart;
      const nextEnd = addDays(nextStart, duration - 1);
      const shiftedTask: ScheduleTask = {
        ...task,
        startDate: nextStart,
        endDate: nextEnd,
        source: "manual",
        updatedAt: new Date().toISOString(),
      };
      byId.set(taskId, shiftedTask);
      queue.push(taskId);
    });
  }

  return tasks.map((task) => byId.get(task.id) || task);
}

export function applyTaskDateChange(
  tasks: ScheduleTask[],
  taskId: string,
  nextStartDate: string,
  nextEndDate: string,
  options?: { autoShiftDependents?: boolean }
): DateChangeResult {
  const clamped = clampTaskDates(nextStartDate, nextEndDate);
  let nextTasks: ScheduleTask[] = tasks.map((task): ScheduleTask => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      startDate: clamped.startDate,
      endDate: clamped.endDate,
      source: "manual",
      updatedAt: new Date().toISOString(),
    };
  });

  const beforeWarnings = getDependencyWarnings(nextTasks);
  let shiftedTaskIds: string[] = [];

  if (options?.autoShiftDependents) {
    const beforeMap = new Map(nextTasks.map((task) => [task.id, task]));
    nextTasks = autoShiftDependentTasks(nextTasks, taskId);
    shiftedTaskIds = nextTasks
      .filter((task) => {
        const before = beforeMap.get(task.id);
        return (
          Boolean(before) &&
          (before?.startDate !== task.startDate || before?.endDate !== task.endDate)
        );
      })
      .map((task) => task.id);
  }

  return {
    tasks: nextTasks,
    warnings: options?.autoShiftDependents ? getDependencyWarnings(nextTasks) : beforeWarnings,
    shiftedTaskIds,
  };
}
