"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "../components/dashboard-shell";
import { useAuth } from "../components/auth-context";
import { GanttToolbar } from "../components/gantt/GanttToolbar";
import { GanttView } from "../components/gantt/GanttView";
import { PortfolioGantt } from "../components/gantt/PortfolioGantt";
import { TaskDrawer } from "../components/gantt/TaskDrawer";
import {
  applyTaskDateChange,
  getDependencyWarnings,
} from "../components/gantt/gantt-utils";
import {
  appendScheduleLog,
  ensureActionScheduleSteps,
  listSchedulesForAudience,
  subscribeSchedules,
  writeSchedule,
  type ProjectSchedule,
  type ScheduleGroupBy,
  type ScheduleZoom,
  type ScheduleTask,
} from "../lib/schedule";

type TimelineMode = "overview" | "project" | "action";
type CategoryFilter = "all" | "pre" | "build" | "post" | "maintenance";

function navForRole(role: "brf" | "privat") {
  if (role === "brf") {
    return [
      { href: "/dashboard/brf", label: "Översikt" },
      { href: "/dashboard/brf/fastighet", label: "Fastighet" },
      { href: "/dashboard/brf/underhallsplan", label: "Underhållsplan" },
      { href: "/dashboard/brf/planering", label: "Planering (Gantt)" },
      { href: "/dashboard/brf/forfragningar", label: "Mina förfrågningar" },
      { href: "/brf/start", label: "Initiera BRF-projekt" },
    ];
  }
  return [
    { href: "/dashboard/privat", label: "Översikt" },
    { href: "/dashboard/privat/underlag", label: "Bostad & underlag" },
    { href: "/dashboard/privat/planering", label: "Planering (Gantt)" },
    { href: "/dashboard/privat/forfragningar", label: "Mina förfrågningar" },
    { href: "/start", label: "Initiera / fortsätt projekt" },
  ];
}

function matchesYearRange(task: ScheduleTask, yearFrom: number, yearTo: number): boolean {
  const startYear = Number(task.startDate.slice(0, 4));
  const endYear = Number(task.endDate.slice(0, 4));
  return startYear <= yearTo && endYear >= yearFrom;
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toEmptyTask(
  projectId: string,
  endDate: string,
  options?: { parentActionId?: string; kind?: ScheduleTask["kind"] }
): ScheduleTask {
  return {
    id: `${projectId}-manual-${Date.now()}`,
    projectId,
    title: "Ny task",
    category: options?.parentActionId ? "build" : "pre",
    phase: options?.parentActionId ? "Utförande" : "Planering",
    startDate: endDate,
    endDate,
    status: "planned",
    dependencies: [],
    parentActionId: options?.parentActionId,
    kind: options?.kind,
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

function adjustZoomFactor(current: number, direction: "in" | "out"): number {
  const delta = direction === "in" ? 0.2 : -0.2;
  return Math.max(0.6, Math.min(3, Number((current + delta).toFixed(2))));
}

export default function TimelinePage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId");
  const initialActionTaskId = searchParams.get("actionTaskId");
  const { user, ready } = useAuth();
  const audienceFilter = user?.role === "brf" ? "brf" : "privat";
  const planningBasePath =
    user?.role === "brf" ? "/dashboard/brf/planering" : "/dashboard/privat/planering";
  const [mode, setMode] = useState<TimelineMode>(
    initialActionTaskId ? "action" : initialProjectId ? "project" : "overview"
  );
  const [overviewZoom, setOverviewZoom] = useState<ScheduleZoom>("month");
  const [overviewShowWeekends, setOverviewShowWeekends] = useState(false);
  const [overviewGroupBy, setOverviewGroupBy] = useState<ScheduleGroupBy>("project");
  const [overviewZoomFactor, setOverviewZoomFactor] = useState(1);
  const [overviewTodayToken, setOverviewTodayToken] = useState(0);
  const [projectZoomFactor, setProjectZoomFactor] = useState(1);
  const [projectTodayToken, setProjectTodayToken] = useState(0);
  const [actionZoomFactor, setActionZoomFactor] = useState(1);
  const [actionTodayToken, setActionTodayToken] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [yearFrom, setYearFrom] = useState(2025);
  const [yearTo, setYearTo] = useState(2030);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);
  const [selectedActionTaskId, setSelectedActionTaskId] = useState<string | null>(
    initialActionTaskId
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [warningTaskId, setWarningTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
    }
  }, [ready, router, user]);

  useEffect(() => {
    if (!ready || !user || user.role === "entreprenor") return;
    if (pathname !== "/timeline") return;
    const query = searchParams.toString();
    router.replace(query ? `${planningBasePath}?${query}` : planningBasePath, { scroll: false });
  }, [pathname, planningBasePath, ready, router, searchParams, user]);

  useEffect(
    () =>
      subscribeSchedules(() => {
        setScheduleVersion((current) => current + 1);
      }),
    []
  );

  const items = useMemo(() => {
    const versionMarker = scheduleVersion;
    void versionMarker;
    if (!ready || !user) return [];
    return listSchedulesForAudience(audienceFilter);
  }, [audienceFilter, ready, scheduleVersion, user]);
  const effectiveSelectedProjectId =
    selectedProjectId && items.some((item) => item.context.projectId === selectedProjectId)
      ? selectedProjectId
      : items[0]?.context.projectId || null;

  const selectedItem = useMemo(
    () => items.find((item) => item.context.projectId === effectiveSelectedProjectId) || null,
    [effectiveSelectedProjectId, items]
  );
  const selectedSchedule = selectedItem?.schedule || null;

  const visibleItems = useMemo(() => {
    return items
      .filter((item) =>
        projectFilter === "all" ? true : item.context.projectId === projectFilter
      )
      .map((item) => {
        const filteredTasks = item.schedule.tasks.filter((task) => {
          const categoryOk = categoryFilter === "all" || task.category === categoryFilter;
          const yearOk = matchesYearRange(task, yearFrom, yearTo);
          return categoryOk && yearOk;
        });
        return { ...item, filteredTasks };
      })
      .filter((item) => item.filteredTasks.length > 0);
  }, [categoryFilter, items, projectFilter, yearFrom, yearTo]);

  const maintenanceActionRows = useMemo(
    () =>
      items
        .filter((item) =>
          projectFilter === "all" ? true : item.context.projectId === projectFilter
        )
        .flatMap((item) =>
          item.schedule.tasks
            .filter((task) => {
              const maintenanceTask =
                task.category === "maintenance" && !task.parentActionId;
              const categoryOk =
                categoryFilter === "all" || categoryFilter === "maintenance";
              const yearOk = matchesYearRange(task, yearFrom, yearTo);
              return maintenanceTask && categoryOk && yearOk;
            })
            .map((task) => ({
              id: `${item.context.projectId}-${task.id}`,
              projectId: item.context.projectId,
              actionTaskId: task.id,
              title: task.title,
              projectTitle: item.context.title,
              startDate: task.startDate,
              endDate: task.endDate,
              status: task.status,
            }))
        )
        .sort((a, b) =>
          a.startDate === b.startDate
            ? a.title.localeCompare(b.title, "sv")
            : a.startDate.localeCompare(b.startDate, "sv")
        ),
    [categoryFilter, items, projectFilter, yearFrom, yearTo]
  );
  const maintenanceProjectOptions = useMemo(
    () =>
      items.map((item) => ({
        projectId: item.context.projectId,
        projectTitle: item.context.title,
      })),
    [items]
  );
  const maintenanceOverviewTaskMetaById = useMemo(() => {
    const meta = new Map<string, { projectId: string; actionTaskId: string }>();
    maintenanceActionRows.forEach((row) => {
      meta.set(row.actionTaskId, {
        projectId: row.projectId,
        actionTaskId: row.actionTaskId,
      });
    });
    return meta;
  }, [maintenanceActionRows]);
  const maintenanceOverviewTasks = useMemo(() => {
    return maintenanceActionRows.map((row) => ({
      id: row.actionTaskId,
      projectId: row.projectTitle,
      title: row.title,
      category: "maintenance" as const,
      phase: "Underhåll",
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      dependencies: [],
      kind: "maintenance_action" as const,
      source: "manual" as const,
      updatedAt: new Date().toISOString(),
    }));
  }, [maintenanceActionRows]);
  const effectiveOverviewProjectId = useMemo(() => {
    if (projectFilter !== "all") return projectFilter;
    return maintenanceProjectOptions[0]?.projectId || "";
  }, [maintenanceProjectOptions, projectFilter]);

  const actionOverviewStartDate = useMemo(() => {
    if (maintenanceActionRows.length === 0) return `${yearFrom}-01-01`;
    return maintenanceActionRows.reduce(
      (acc, row) => (row.startDate < acc ? row.startDate : acc),
      maintenanceActionRows[0].startDate
    );
  }, [maintenanceActionRows, yearFrom]);

  const actionOverviewEndDate = useMemo(() => {
    if (maintenanceActionRows.length === 0) return `${yearTo}-12-31`;
    return maintenanceActionRows.reduce(
      (acc, row) => (row.endDate > acc ? row.endDate : acc),
      maintenanceActionRows[0].endDate
    );
  }, [maintenanceActionRows, yearTo]);

  const portfolioRows = useMemo(
    () =>
      visibleItems.map((item) => {
        const startDate = item.filteredTasks.reduce(
          (acc, task) => (task.startDate < acc ? task.startDate : acc),
          item.filteredTasks[0]?.startDate || item.schedule.startDate
        );
        const endDate = item.filteredTasks.reduce(
          (acc, task) => (task.endDate > acc ? task.endDate : acc),
          item.filteredTasks[0]?.endDate || item.schedule.endDate
        );
        return {
          projectId: item.context.projectId,
          title: item.context.title,
          audience: item.context.audience,
          startDate,
          endDate,
          taskCount: item.filteredTasks.length,
        };
      }),
    [visibleItems]
  );

  const portfolioOverviewStartDate = useMemo(() => {
    if (portfolioRows.length === 0) return `${yearFrom}-01-01`;
    return portfolioRows.reduce(
      (acc, row) => (row.startDate < acc ? row.startDate : acc),
      portfolioRows[0].startDate
    );
  }, [portfolioRows, yearFrom]);

  const portfolioOverviewEndDate = useMemo(() => {
    if (portfolioRows.length === 0) return `${yearTo}-12-31`;
    return portfolioRows.reduce(
      (acc, row) => (row.endDate > acc ? row.endDate : acc),
      portfolioRows[0].endDate
    );
  }, [portfolioRows, yearTo]);

  const selectedActionTask = useMemo(
    () =>
      selectedSchedule?.tasks.find(
        (task) => task.id === selectedActionTaskId && !task.parentActionId
      ) || null,
    [selectedActionTaskId, selectedSchedule]
  );

  const actionStepTasks = useMemo(
    () =>
      selectedActionTask
        ? selectedSchedule?.tasks.filter(
            (task) => task.parentActionId === selectedActionTask.id
          ) || []
        : [],
    [selectedActionTask, selectedSchedule]
  );

  const dependencyWarnings = useMemo(
    () =>
      getDependencyWarnings(
        mode === "action" ? actionStepTasks : selectedSchedule?.tasks || []
      ),
    [actionStepTasks, mode, selectedSchedule]
  );
  const autoShiftTaskId = warningTaskId || dependencyWarnings[0]?.taskId || null;
  const selectedTask = useMemo(
    () => selectedSchedule?.tasks.find((task) => task.id === selectedTaskId) || null,
    [selectedSchedule, selectedTaskId]
  );
  const actionStartDate = useMemo(() => {
    if (!selectedActionTask) return null;
    return actionStepTasks.reduce(
      (acc, task) => (task.startDate < acc ? task.startDate : acc),
      selectedActionTask.startDate
    );
  }, [actionStepTasks, selectedActionTask]);
  const actionEndDate = useMemo(() => {
    if (!selectedActionTask) return null;
    return actionStepTasks.reduce(
      (acc, task) => (task.endDate > acc ? task.endDate : acc),
      selectedActionTask.endDate
    );
  }, [actionStepTasks, selectedActionTask]);

  const updateSchedule = (
    projectId: string,
    updater: (schedule: ProjectSchedule) => ProjectSchedule
  ) => {
    const target = items.find((item) => item.context.projectId === projectId);
    if (!target) return;
    const nextSchedule = updater(target.schedule);
    writeSchedule(projectId, nextSchedule);
    setScheduleVersion((current) => current + 1);
  };

  const openProjectView = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedActionTaskId(null);
    setSelectedTaskId(null);
    setMode("project");
    // QA navigation: base -> project query should keep base in history so browser Back returns base.
    router.push(`${planningBasePath}?projectId=${encodeURIComponent(projectId)}`, {
      scroll: false,
    });
  };

  const openActionView = (projectId: string, actionTaskId: string) => {
    updateSchedule(projectId, (schedule) =>
      ensureActionScheduleSteps(schedule, actionTaskId, user?.email || "local-user")
    );
    setSelectedProjectId(projectId);
    setSelectedActionTaskId(actionTaskId);
    setSelectedTaskId(null);
    setMode("action");
    router.push(
      `${planningBasePath}?projectId=${encodeURIComponent(projectId)}&actionTaskId=${encodeURIComponent(
        actionTaskId
      )}`,
      { scroll: false }
    );
  };

  const onTaskDatesChange = (taskId: string, nextStartDate: string, nextEndDate: string) => {
    if (!selectedSchedule || !selectedItem) return;
    const previousTask = selectedSchedule.tasks.find((task) => task.id === taskId);
    if (!previousTask) return;

    const changed = applyTaskDateChange(selectedSchedule.tasks, taskId, nextStartDate, nextEndDate);
    let nextSchedule: ProjectSchedule = {
      ...selectedSchedule,
      tasks: changed.tasks,
      startDate: changed.tasks.reduce(
        (acc, task) => (task.startDate < acc ? task.startDate : acc),
        changed.tasks[0]?.startDate || selectedSchedule.startDate
      ),
      endDate: changed.tasks.reduce(
        (acc, task) => (task.endDate > acc ? task.endDate : acc),
        changed.tasks[0]?.endDate || selectedSchedule.endDate
      ),
    };
    nextSchedule = appendScheduleLog(nextSchedule, [
      {
        taskId,
        field: "date_range",
        fromValue: `${previousTask.startDate} -> ${previousTask.endDate}`,
        toValue: `${nextStartDate} -> ${nextEndDate}`,
        actor: user?.email || "local-user",
      },
    ]);

    updateSchedule(selectedItem.context.projectId, () => nextSchedule);
    setWarningTaskId(changed.warnings.length > 0 ? taskId : null);
    if (changed.warnings.length > 0) {
      setNotice("Beroendevarning: minst en task bryter beroendelogiken.");
    } else {
      setNotice(null);
    }
  };

  const onMaintenanceActionDatesChange = (
    projectId: string,
    actionTaskId: string,
    nextStartDate: string,
    nextEndDate: string
  ) => {
    const target = items.find((item) => item.context.projectId === projectId);
    if (!target) return;
    const previousTask = target.schedule.tasks.find((task) => task.id === actionTaskId);
    if (!previousTask) return;

    const changed = applyTaskDateChange(
      target.schedule.tasks,
      actionTaskId,
      nextStartDate,
      nextEndDate
    );

    let nextSchedule: ProjectSchedule = {
      ...target.schedule,
      tasks: changed.tasks,
      startDate: changed.tasks.reduce(
        (acc, task) => (task.startDate < acc ? task.startDate : acc),
        changed.tasks[0]?.startDate || target.schedule.startDate
      ),
      endDate: changed.tasks.reduce(
        (acc, task) => (task.endDate > acc ? task.endDate : acc),
        changed.tasks[0]?.endDate || target.schedule.endDate
      ),
    };
    nextSchedule = appendScheduleLog(nextSchedule, [
      {
        taskId: actionTaskId,
        field: "date_range",
        fromValue: `${previousTask.startDate} -> ${previousTask.endDate}`,
        toValue: `${nextStartDate} -> ${nextEndDate}`,
        actor: user?.email || "local-user",
      },
    ]);

    updateSchedule(projectId, () => nextSchedule);
    setNotice(
      changed.warnings.length > 0
        ? "Beroendevarning: minst en task bryter beroendelogiken."
        : "Aktivitet uppdaterad."
    );
  };

  const onAddMaintenanceAction = (projectId: string, title: string): string | null => {
    const target = items.find((item) => item.context.projectId === projectId);
    if (!target) return null;

    const baseDate = target.schedule.endDate;
    const task: ScheduleTask = {
      id: `${projectId}-maintenance-${Date.now()}`,
      projectId,
      title,
      category: "maintenance",
      phase: "Underhåll",
      startDate: baseDate,
      endDate: baseDate,
      status: "planned",
      dependencies: [],
      kind: "maintenance_action",
      source: "manual",
      updatedAt: new Date().toISOString(),
    };

    let nextSchedule: ProjectSchedule = {
      ...target.schedule,
      tasks: [...target.schedule.tasks, task],
      endDate: task.endDate > target.schedule.endDate ? task.endDate : target.schedule.endDate,
    };
    nextSchedule = appendScheduleLog(nextSchedule, [
      {
        taskId: task.id,
        field: "task_created",
        fromValue: "-",
        toValue: task.title,
        actor: user?.email || "local-user",
      },
    ]);
    updateSchedule(projectId, () => nextSchedule);
    setNotice(`Ny aktivitet skapad i ${target.context.title}.`);
    return task.id;
  };

  const onOverviewTaskDatesChange = (
    taskId: string,
    nextStartDate: string,
    nextEndDate: string
  ) => {
    const target = maintenanceOverviewTaskMetaById.get(taskId);
    if (!target) return;
    onMaintenanceActionDatesChange(
      target.projectId,
      target.actionTaskId,
      nextStartDate,
      nextEndDate
    );
  };

  const onAddOverviewTask = () => {
    if (!effectiveOverviewProjectId) {
      setNotice("Välj ett projekt för att lägga till aktivitet.");
      return;
    }
    const createdId = onAddMaintenanceAction(effectiveOverviewProjectId, "Ny aktivitet");
    if (createdId) {
      openActionView(effectiveOverviewProjectId, createdId);
    }
  };

  const autoShiftDependents = () => {
    if (!selectedSchedule || !selectedItem || !autoShiftTaskId) return;
    const currentTask = selectedSchedule.tasks.find((task) => task.id === autoShiftTaskId);
    if (!currentTask) return;
    const shifted = applyTaskDateChange(
      selectedSchedule.tasks,
      autoShiftTaskId,
      currentTask.startDate,
      currentTask.endDate,
      { autoShiftDependents: true }
    );
    let nextSchedule: ProjectSchedule = {
      ...selectedSchedule,
      tasks: shifted.tasks,
    };
    nextSchedule = appendScheduleLog(
      nextSchedule,
      shifted.shiftedTaskIds.map((taskId) => ({
        taskId,
        field: "dependency_auto_shift",
        fromValue: "dependency warning",
        toValue: "auto-shifted",
        actor: user?.email || "local-user",
      }))
    );
    updateSchedule(selectedItem.context.projectId, () => nextSchedule);
    setWarningTaskId(null);
    setNotice("Beroenden auto-shiftade.");
  };

  const onTaskSave = (task: ScheduleTask) => {
    if (!selectedSchedule || !selectedItem) return;
    const previousTask = selectedSchedule.tasks.find((item) => item.id === task.id);
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
      ...selectedSchedule,
      tasks: selectedSchedule.tasks.map((item) => (item.id === task.id ? task : item)),
    };
    nextSchedule = appendScheduleLog(
      nextSchedule,
      changes.map((entry) => ({
        taskId: task.id,
        field: entry.field,
        fromValue: entry.from,
        toValue: entry.to,
        actor: user?.email || "local-user",
      }))
    );
    updateSchedule(selectedItem.context.projectId, () => nextSchedule);
    setNotice("Task uppdaterad.");
  };

  const onTaskDelete = (taskId: string) => {
    if (!selectedSchedule || !selectedItem) return;
    const task = selectedSchedule.tasks.find((item) => item.id === taskId);
    if (!task) return;
    let nextSchedule: ProjectSchedule = {
      ...selectedSchedule,
      tasks: selectedSchedule.tasks
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
        actor: user?.email || "local-user",
      },
    ]);
    updateSchedule(selectedItem.context.projectId, () => nextSchedule);
    setSelectedTaskId(null);
    setNotice("Task borttagen.");
  };

  const onAddTask = () => {
    if (!selectedSchedule || !selectedItem) return;
    const endDate =
      mode === "action" && selectedActionTask
        ? selectedActionTask.startDate
        : selectedSchedule.endDate;
    const task = toEmptyTask(selectedItem.context.projectId, endDate, {
      parentActionId: mode === "action" ? selectedActionTask?.id : undefined,
      kind: mode === "action" ? "action_step" : "pipeline",
    });
    let nextSchedule: ProjectSchedule = {
      ...selectedSchedule,
      tasks: [...selectedSchedule.tasks, task],
      endDate: task.endDate > selectedSchedule.endDate ? task.endDate : selectedSchedule.endDate,
    };
    nextSchedule = appendScheduleLog(nextSchedule, [
      {
        taskId: task.id,
        field: "task_created",
        fromValue: "-",
        toValue: task.title,
        actor: user?.email || "local-user",
      },
    ]);
    updateSchedule(selectedItem.context.projectId, () => nextSchedule);
    setSelectedTaskId(task.id);
    setNotice("Ny task skapad.");
  };

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#F6F3EE] text-[#2A2520] antialiased">
        <div className="mx-auto flex min-h-screen max-w-[1400px] items-center justify-center px-6">
          <p className="rounded-xl border border-[#E6DFD6] bg-white px-4 py-2 text-sm text-[#6B5A47]">
            Laddar konto...
          </p>
        </div>
      </main>
    );
  }

  if (!user || user.role === "entreprenor") return null;

  const role = user.role === "brf" ? "brf" : "privat";
  const navItems = navForRole(role);
  const roleLabel = role === "brf" ? "Bostadsrättsförening" : "Privatperson";

  return (
    <DashboardShell
      roleLabel={roleLabel}
      heading="Planering (Gantt)"
      subheading="Planera pre/build/post och underhåll i en visuell projektplan. Alla ändringar sparas lokalt och loggas."
      navItems={navItems}
      cards={[]}
    >
      <div className="space-y-4">
        <section className="grid gap-3 rounded-2xl border border-[#E6DFD6] bg-white p-4 lg:grid-cols-[auto_auto_auto_1fr]">
          <div className="inline-flex rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("overview");
                setSelectedActionTaskId(null);
                setSelectedTaskId(null);
                router.push(planningBasePath, { scroll: false });
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                mode === "overview" ? "bg-[#8C7860] text-white" : "text-[#6B5A47]"
              }`}
            >
              Översikt
            </button>
            <button
              type="button"
              onClick={() => {
                if (effectiveSelectedProjectId) {
                  openProjectView(effectiveSelectedProjectId);
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                mode === "project" ? "bg-[#8C7860] text-white" : "text-[#6B5A47]"
              }`}
            >
              Projektvy
            </button>
            <button
              type="button"
              onClick={() => {
                if (effectiveSelectedProjectId && selectedActionTaskId) {
                  openActionView(effectiveSelectedProjectId, selectedActionTaskId);
                }
              }}
              disabled={!effectiveSelectedProjectId || !selectedActionTaskId}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                mode === "action"
                  ? "bg-[#8C7860] text-white"
                  : "text-[#6B5A47] disabled:cursor-not-allowed disabled:opacity-40"
              }`}
            >
              Åtgärdsvy
            </button>
          </div>

          {mode === "overview" && (
            <>
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                Kategori:
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                  className="rounded-md border border-[#D9D1C6] bg-white px-2 py-1"
                >
                  <option value="all">Alla</option>
                  <option value="pre">Pre</option>
                  <option value="build">Build</option>
                  <option value="post">Post</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                Projekt:
                <select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  className="min-w-[180px] rounded-md border border-[#D9D1C6] bg-white px-2 py-1"
                >
                  <option value="all">Alla projekt</option>
                  {items.map((item) => (
                    <option key={item.context.projectId} value={item.context.projectId}>
                      {item.context.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                År:
                <input
                  type="number"
                  value={yearFrom}
                  onChange={(event) => setYearFrom(Number(event.target.value) || yearFrom)}
                  className="w-20 rounded-md border border-[#D9D1C6] bg-white px-2 py-1"
                />
                till
                <input
                  type="number"
                  value={yearTo}
                  onChange={(event) => setYearTo(Number(event.target.value) || yearTo)}
                  className="w-20 rounded-md border border-[#D9D1C6] bg-white px-2 py-1"
                />
              </div>

            </>
          )}

          {mode === "project" && selectedSchedule && (
            <>
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                Projekt:
                <select
                  value={effectiveSelectedProjectId || ""}
                  onChange={(event) => openProjectView(event.target.value)}
                  className="min-w-[220px] rounded-md border border-[#D9D1C6] bg-white px-2 py-1"
                >
                  {items.map((item) => (
                    <option key={item.context.projectId} value={item.context.projectId}>
                      {item.context.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="inline-flex items-center rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                Visar hela tidslinjen för valt projekt.
              </p>
              <button
                type="button"
                onClick={() => router.push(planningBasePath, { scroll: false })}
                className="inline-flex items-center rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]"
              >
                ← Till planering
              </button>
            </>
          )}

          {mode === "action" && selectedSchedule && (
            <>
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                Projekt:
                <select
                  value={effectiveSelectedProjectId || ""}
                  onChange={(event) => openProjectView(event.target.value)}
                  className="min-w-[220px] rounded-md border border-[#D9D1C6] bg-white px-2 py-1"
                >
                  {items.map((item) => (
                    <option key={item.context.projectId} value={item.context.projectId}>
                      {item.context.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="inline-flex items-center rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                {selectedActionTask
                  ? `Stegplan för åtgärd: ${selectedActionTask.title}`
                  : "Välj en åtgärd i översikten."}
              </p>
              <button
                type="button"
                onClick={() => router.push(planningBasePath, { scroll: false })}
                className="inline-flex items-center rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]"
              >
                ← Till planering
              </button>
            </>
          )}
        </section>

        {notice && (
          <p className="rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
            {notice}
          </p>
        )}

        {mode === "overview" && (
          <section className="space-y-4">
            {maintenanceActionRows.length > 0 && (
              <>
                <GanttToolbar
                  zoom={overviewZoom}
                  showWeekends={overviewShowWeekends}
                  groupBy={overviewGroupBy}
                  onZoomChange={setOverviewZoom}
                  onShowWeekendsChange={setOverviewShowWeekends}
                  onGroupByChange={setOverviewGroupBy}
                  onToday={() => setOverviewTodayToken((token) => token + 1)}
                  onZoomIn={() =>
                    setOverviewZoomFactor((current) => adjustZoomFactor(current, "in"))
                  }
                  onZoomOut={() =>
                    setOverviewZoomFactor((current) => adjustZoomFactor(current, "out"))
                  }
                  onAddTask={onAddOverviewTask}
                />
                <GanttView
                  tasks={maintenanceOverviewTasks}
                  zoom={overviewZoom}
                  showWeekends={overviewShowWeekends}
                  groupBy={overviewGroupBy}
                  zoomFactor={overviewZoomFactor}
                  scrollToTodayToken={overviewTodayToken}
                  scheduleStartDate={actionOverviewStartDate}
                  scheduleEndDate={actionOverviewEndDate}
                  editable
                  onTaskClick={(task) => {
                    const target = maintenanceOverviewTaskMetaById.get(task.id);
                    if (!target) return;
                    openActionView(target.projectId, target.actionTaskId);
                  }}
                  onTaskDatesChange={onOverviewTaskDatesChange}
                />
              </>
            )}

            {maintenanceActionRows.length > 0 && (
              <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8C7860]">
                  Åtgärder i översikten
                </h3>
                <div className="mt-3 divide-y divide-[#F1EADF]">
                  {maintenanceActionRows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#2A2520]">{row.title}</p>
                        <p className="text-xs text-[#766B60]">
                          {row.projectTitle} · {row.startDate} till {row.endDate}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openActionView(row.projectId, row.actionTaskId)}
                        className="rounded-xl border border-[#D9D1C6] px-3 py-1.5 text-xs font-semibold text-[#6B5A47]"
                      >
                        Öppna åtgärds-Gantt
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {maintenanceActionRows.length === 0 && portfolioRows.length > 0 && (
              <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4">
                <p className="text-sm text-[#766B60]">
                  Inga underhållsåtgärder matchar filtren just nu. Visar projektöversikt i stället.
                </p>
                <div className="mt-3">
                  <PortfolioGantt
                    rows={portfolioRows}
                    zoom={overviewZoom}
                    startDate={portfolioOverviewStartDate}
                    endDate={portfolioOverviewEndDate}
                    onProjectOpen={openProjectView}
                  />
                </div>
              </article>
            )}

            {maintenanceActionRows.length === 0 && portfolioRows.length === 0 && (
              <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 text-sm text-[#766B60]">
                Inga tasks matchar filtren ännu.
              </article>
            )}
          </section>
        )}

        {mode === "project" && selectedSchedule && selectedItem && (
          <section className="space-y-4">
            <GanttToolbar
              zoom={selectedSchedule.viewSettings.zoom}
              showWeekends={Boolean(selectedSchedule.viewSettings.showWeekends)}
              groupBy={selectedSchedule.viewSettings.groupBy || "phase"}
              onZoomChange={(zoom) =>
                updateSchedule(selectedItem.context.projectId, (schedule) => ({
                  ...schedule,
                  viewSettings: { ...schedule.viewSettings, zoom },
                }))
              }
              onShowWeekendsChange={(enabled) =>
                updateSchedule(selectedItem.context.projectId, (schedule) => ({
                  ...schedule,
                  viewSettings: { ...schedule.viewSettings, showWeekends: enabled },
                }))
              }
              onGroupByChange={(groupBy) =>
                updateSchedule(selectedItem.context.projectId, (schedule) => ({
                  ...schedule,
                  viewSettings: { ...schedule.viewSettings, groupBy },
                }))
              }
              onToday={() => setProjectTodayToken((token) => token + 1)}
              onZoomIn={() =>
                setProjectZoomFactor((current) => adjustZoomFactor(current, "in"))
              }
              onZoomOut={() =>
                setProjectZoomFactor((current) => adjustZoomFactor(current, "out"))
              }
              onAddTask={onAddTask}
            />

            {dependencyWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-semibold">Beroendevarningar</p>
                <ul className="mt-1 list-inside list-disc">
                  {dependencyWarnings.slice(0, 4).map((warning) => (
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

            <GanttView
              tasks={selectedSchedule.tasks}
              zoom={selectedSchedule.viewSettings.zoom}
              showWeekends={Boolean(selectedSchedule.viewSettings.showWeekends)}
              groupBy={selectedSchedule.viewSettings.groupBy || "phase"}
              zoomFactor={projectZoomFactor}
              scrollToTodayToken={projectTodayToken}
              scheduleStartDate={selectedSchedule.startDate}
              scheduleEndDate={selectedSchedule.endDate}
              editable
              onTaskClick={(task) => setSelectedTaskId(task.id)}
              onTaskDatesChange={onTaskDatesChange}
            />

            <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#8C7860]">
                Ändringslogg (lokal)
              </h3>
              {selectedSchedule.changeLog.length === 0 && (
                <p className="mt-2 text-sm text-[#766B60]">Inga ändringar loggade ännu.</p>
              )}
              {selectedSchedule.changeLog.length > 0 && (
                <ul className="mt-2 space-y-2 text-sm">
                  {selectedSchedule.changeLog.slice(0, 12).map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
                      <p className="font-semibold text-[#2A2520]">{entry.field}</p>
                      <p className="text-xs text-[#6B5A47]">
                        {entry.fromValue} → {entry.toValue}
                      </p>
                      <p className="text-[11px] text-[#8C7860]">
                        {entry.actor} · {formatDateTime(entry.timestamp)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}

        {mode === "action" && selectedSchedule && selectedItem && selectedActionTask && (
          <section className="space-y-4">
            <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4">
              <h2 className="text-lg font-bold text-[#2A2520]">{selectedActionTask.title}</h2>
              <p className="mt-1 text-sm text-[#766B60]">
                Enskild åtgärdstidslinje med överlappande steg. Uppdateringar sparas lokalt.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#6B5A47]">
                <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-1">
                  Planerad period: {selectedActionTask.startDate} till {selectedActionTask.endDate}
                </span>
                <button
                  type="button"
                  onClick={() => openProjectView(selectedItem.context.projectId)}
                  className="rounded-full border border-[#D9D1C6] bg-white px-2 py-1 font-semibold"
                >
                  Tillbaka till hela projektet
                </button>
              </div>
            </article>

            <GanttToolbar
              zoom={selectedSchedule.viewSettings.zoom}
              showWeekends={Boolean(selectedSchedule.viewSettings.showWeekends)}
              groupBy={selectedSchedule.viewSettings.groupBy || "phase"}
              onZoomChange={(zoom) =>
                updateSchedule(selectedItem.context.projectId, (schedule) => ({
                  ...schedule,
                  viewSettings: { ...schedule.viewSettings, zoom },
                }))
              }
              onShowWeekendsChange={(enabled) =>
                updateSchedule(selectedItem.context.projectId, (schedule) => ({
                  ...schedule,
                  viewSettings: { ...schedule.viewSettings, showWeekends: enabled },
                }))
              }
              onGroupByChange={(groupBy) =>
                updateSchedule(selectedItem.context.projectId, (schedule) => ({
                  ...schedule,
                  viewSettings: { ...schedule.viewSettings, groupBy },
                }))
              }
              onToday={() => setActionTodayToken((token) => token + 1)}
              onZoomIn={() =>
                setActionZoomFactor((current) => adjustZoomFactor(current, "in"))
              }
              onZoomOut={() =>
                setActionZoomFactor((current) => adjustZoomFactor(current, "out"))
              }
              onAddTask={onAddTask}
            />

            {dependencyWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-semibold">Beroendevarningar</p>
                <ul className="mt-1 list-inside list-disc">
                  {dependencyWarnings.slice(0, 4).map((warning) => (
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

            <GanttView
              tasks={actionStepTasks}
              zoom={selectedSchedule.viewSettings.zoom}
              showWeekends={Boolean(selectedSchedule.viewSettings.showWeekends)}
              groupBy={selectedSchedule.viewSettings.groupBy || "phase"}
              zoomFactor={actionZoomFactor}
              scrollToTodayToken={actionTodayToken}
              scheduleStartDate={actionStartDate || selectedActionTask.startDate}
              scheduleEndDate={actionEndDate || selectedActionTask.endDate}
              editable
              onTaskClick={(task) => setSelectedTaskId(task.id)}
              onTaskDatesChange={onTaskDatesChange}
            />

            {actionStepTasks.length === 0 && (
              <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 text-sm text-[#766B60]">
                Inga steg hittades ännu för den här åtgärden. Lägg till steg med <strong>+ Task</strong>.
              </article>
            )}
          </section>
        )}
      </div>

      {selectedTask && selectedSchedule && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/30"
            onClick={() => setSelectedTaskId(null)}
          />
          <TaskDrawer
            key={selectedTask.id}
            task={selectedTask}
            allTasks={
              mode === "action" && selectedActionTask
                ? selectedSchedule.tasks.filter(
                    (task) =>
                      task.id === selectedActionTask.id ||
                      task.parentActionId === selectedActionTask.id
                  )
                : selectedSchedule.tasks
            }
            onClose={() => setSelectedTaskId(null)}
            onSave={onTaskSave}
            onDelete={onTaskDelete}
          />
        </>
      )}
    </DashboardShell>
  );
}
