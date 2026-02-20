import type { BrfActionDraft } from "./brf-start";
import { readBrfActionsDraft, readBrfRequestMeta } from "./brf-start";
import type { SnapshotAudience, ProjectSnapshot } from "./project-snapshot";
import { readProjectSnapshotFromStorage } from "./project-snapshot";
import type { PlatformRequest, RequestAudience } from "./requests-store";
import { listRequests } from "./requests-store";

export type ScheduleZoom = "week" | "month" | "quarter" | "year";
export type ScheduleGroupBy = "phase" | "category" | "project";
export type ScheduleTaskCategory = "pre" | "build" | "post" | "maintenance";
export type ScheduleTaskStatus = "planned" | "in_progress" | "blocked" | "done";
export type ScheduleOwnerRole = "brf" | "privatperson" | "entreprenor" | "consultant";

export interface ScheduleTask {
  id: string;
  projectId: string;
  title: string;
  category: ScheduleTaskCategory;
  phase: string;
  startDate: string;
  endDate: string;
  status: ScheduleTaskStatus;
  dependencies: string[];
  parentActionId?: string;
  kind?: "pipeline" | "maintenance_action" | "action_step";
  ownerRole?: ScheduleOwnerRole;
  notes?: string;
  tags?: string[];
  source: "auto" | "manual";
  updatedAt: string;
}

export interface ProjectSchedule {
  id: string;
  projectId: string;
  title: string;
  audience: SnapshotAudience;
  startDate: string;
  endDate: string;
  tasks: ScheduleTask[];
  viewSettings: {
    zoom: ScheduleZoom;
    showWeekends?: boolean;
    groupBy?: ScheduleGroupBy;
  };
  changeLog: ScheduleChangeLogEntry[];
}

export interface ScheduleChangeLogEntry {
  id: string;
  taskId: string;
  field: string;
  fromValue: string;
  toValue: string;
  timestamp: string;
  actor: string;
}

export interface ScheduleProjectContext {
  projectId: string;
  title: string;
  audience: SnapshotAudience;
  snapshot?: ProjectSnapshot;
  request?: PlatformRequest;
  maintenanceActions?: BrfActionDraft[];
}

export const SCHEDULE_STORAGE_PREFIX = "schedule:";
export const SCHEDULE_UPDATED_EVENT = "byggplattformen-schedule-updated";

function toDateOnly(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateOnly(isoDate: string): Date {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function addDays(isoDate: string, days: number): string {
  const base = parseDateOnly(isoDate);
  base.setDate(base.getDate() + days);
  return toDateOnly(base);
}

function minDate(a: string, b: string): string {
  return parseDateOnly(a).getTime() <= parseDateOnly(b).getTime() ? a : b;
}

function maxDate(a: string, b: string): string {
  return parseDateOnly(a).getTime() >= parseDateOnly(b).getTime() ? a : b;
}

function toStorageKey(projectId: string): string {
  return `${SCHEDULE_STORAGE_PREFIX}${projectId}`;
}

function requestAudienceToSnapshotAudience(audience: RequestAudience): SnapshotAudience {
  return audience === "brf" ? "brf" : "privat";
}

function toOwnerRole(audience: SnapshotAudience): ScheduleOwnerRole {
  return audience === "brf" ? "brf" : "privatperson";
}

function normalizeTask(task: ScheduleTask, projectId: string, fallbackDate: string): ScheduleTask {
  const startDate = /\d{4}-\d{2}-\d{2}/.test(task.startDate) ? task.startDate : fallbackDate;
  const endDate = /\d{4}-\d{2}-\d{2}/.test(task.endDate)
    ? task.endDate
    : addDays(startDate, 7);
  return {
    ...task,
    projectId,
    startDate,
    endDate: parseDateOnly(endDate).getTime() >= parseDateOnly(startDate).getTime()
      ? endDate
      : startDate,
    status:
      task.status === "in_progress" || task.status === "blocked" || task.status === "done"
        ? task.status
        : "planned",
    category:
      task.category === "build" || task.category === "post" || task.category === "maintenance"
        ? task.category
        : "pre",
    dependencies: Array.isArray(task.dependencies)
      ? task.dependencies.filter((value): value is string => typeof value === "string")
      : [],
    parentActionId:
      typeof task.parentActionId === "string" ? task.parentActionId : undefined,
    kind:
      task.kind === "maintenance_action" || task.kind === "action_step"
        ? task.kind
        : "pipeline",
    source: task.source === "manual" ? "manual" : "auto",
    updatedAt: task.updatedAt || new Date().toISOString(),
  };
}

function normalizeSchedule(
  input: Partial<ProjectSchedule> | null,
  projectId: string,
  fallbackTitle: string,
  fallbackAudience: SnapshotAudience
): ProjectSchedule | null {
  if (!input || !Array.isArray(input.tasks)) return null;

  const today = toDateOnly(new Date());
  const tasks = input.tasks
    .filter((task): task is ScheduleTask => Boolean(task && typeof task.id === "string"))
    .map((task) => normalizeTask(task, projectId, today));

  if (tasks.length === 0) return null;

  const startDate = tasks.reduce(
    (acc, task) => minDate(acc, task.startDate),
    tasks[0].startDate
  );
  const endDate = tasks.reduce(
    (acc, task) => maxDate(acc, task.endDate),
    tasks[0].endDate
  );

  return {
    id: input.id || `schedule-${projectId}`,
    projectId,
    title: input.title || fallbackTitle,
    audience: input.audience === "brf" ? "brf" : fallbackAudience,
    startDate,
    endDate,
    tasks,
    viewSettings: {
      zoom:
        input.viewSettings?.zoom === "week" ||
        input.viewSettings?.zoom === "month" ||
        input.viewSettings?.zoom === "year"
          ? input.viewSettings.zoom
          : input.viewSettings?.zoom === "quarter"
            ? "month"
            : "month",
      showWeekends: Boolean(input.viewSettings?.showWeekends),
      groupBy:
        input.viewSettings?.groupBy === "category" ||
        input.viewSettings?.groupBy === "project"
          ? input.viewSettings.groupBy
          : "phase",
    },
    changeLog: Array.isArray(input.changeLog)
      ? input.changeLog.filter(
          (entry): entry is ScheduleChangeLogEntry =>
            Boolean(
              entry &&
                typeof entry.id === "string" &&
                typeof entry.taskId === "string" &&
                typeof entry.field === "string"
            )
        )
      : [],
  };
}

function buildBasePipelineTasks(projectId: string, audience: SnapshotAudience, baseStart: string): ScheduleTask[] {
  const now = new Date().toISOString();
  const ownerRole = toOwnerRole(audience);
  const defs: Array<{
    title: string;
    category: ScheduleTaskCategory;
    phase: string;
    durationDays: number;
  }> = [
    { title: "Behovsanalys och scope", category: "pre", phase: "Behovsanalys", durationDays: 14 },
    { title: "Budget och finansiering", category: "pre", phase: "Budget", durationDays: 14 },
    { title: "Upphandling och anbudsunderlag", category: "pre", phase: "Procurement", durationDays: 21 },
    { title: "Kontraktering", category: "pre", phase: "Avtal", durationDays: 14 },
    { title: "Planering och tillstånd", category: "pre", phase: "Planering", durationDays: 21 },
    { title: "Etablering och startmöte", category: "build", phase: "Etablering", durationDays: 7 },
    { title: "Genomförande etapp 1", category: "build", phase: "Execution", durationDays: 28 },
    { title: "Genomförande etapp 2", category: "build", phase: "Execution", durationDays: 28 },
    { title: "Färdigställande", category: "build", phase: "Execution", durationDays: 14 },
    { title: "Slutbesiktning", category: "post", phase: "Inspection", durationDays: 5 },
    { title: "Dokumentationsöverlämning", category: "post", phase: "Handover", durationDays: 7 },
    { title: "Garantikontroll 12 månader", category: "post", phase: "Warranty", durationDays: 3 },
  ];

  const tasks: ScheduleTask[] = [];
  let cursor = baseStart;

  defs.forEach((def, index) => {
    const id = `${projectId}-base-${index + 1}`;
    const startDate =
      def.phase === "Warranty" && tasks.length > 0
        ? addDays(tasks[tasks.length - 2]?.endDate || cursor, 365)
        : cursor;
    const endDate = addDays(startDate, Math.max(1, def.durationDays) - 1);
    const dependencies =
      index === 0
        ? []
        : [tasks[tasks.length - 1]?.id || `${projectId}-base-${index}`];

    tasks.push({
      id,
      projectId,
      title: def.title,
      category: def.category,
      phase: def.phase,
      startDate,
      endDate,
      status: "planned",
      dependencies,
      ownerRole,
      source: "auto",
      updatedAt: now,
    });

    if (def.phase !== "Warranty") {
      cursor = addDays(endDate, 1);
    }
  });

  return tasks;
}

function buildMaintenanceTasks(
  projectId: string,
  actions: BrfActionDraft[],
  ownerRole: ScheduleOwnerRole
): ScheduleTask[] {
  if (actions.length === 0) return [];

  const now = new Date().toISOString();
  const byYear = new Map<number, number>();
  return actions
    .slice()
    .sort((a, b) => a.plannedYear - b.plannedYear || a.title.localeCompare(b.title, "sv"))
    .map((action, index) => {
      const year = action.plannedYear || new Date().getFullYear();
      const offset = byYear.get(year) || 0;
      byYear.set(year, offset + 1);
      // Make maintenance bars long enough to be readable in overview timeline.
      const startDate = addDays(`${year}-03-15`, offset * 21);
      const endDate = addDays(startDate, 44);
      return {
        id: `${projectId}-maint-${index + 1}`,
        projectId,
        title: action.title,
        category: "maintenance",
        phase: `Underhåll ${year}`,
        startDate,
        endDate,
        status:
          action.status === "Genomförd"
            ? "done"
            : action.status === "Eftersatt"
              ? "blocked"
              : "planned",
        dependencies: [],
        kind: "maintenance_action",
        ownerRole,
        notes: action.details,
        tags: action.category ? [action.category] : undefined,
        source: "auto",
        updatedAt: now,
      };
    });
}

function getFallbackStartDate(context: ScheduleProjectContext): string {
  const fromSnapshot = context.snapshot?.timeline.desiredStartFrom;
  if (fromSnapshot && /\d{4}-\d{2}-\d{2}/.test(fromSnapshot)) return fromSnapshot;

  const fromRequest = context.request?.snapshot?.timeline.desiredStartFrom;
  if (fromRequest && /\d{4}-\d{2}-\d{2}/.test(fromRequest)) return fromRequest;

  return addDays(toDateOnly(new Date()), 30);
}

export function generateDefaultSchedule(context: ScheduleProjectContext): ProjectSchedule {
  const baseStart = getFallbackStartDate(context);
  const ownerRole = toOwnerRole(context.audience);
  const baseTasks = buildBasePipelineTasks(context.projectId, context.audience, baseStart);
  const maintenanceActions =
    context.maintenanceActions && context.maintenanceActions.length > 0
      ? context.maintenanceActions
      : context.request?.scope.actions?.map((action) => ({
          id: action.id,
          title: action.title,
          category: action.category,
          status: action.status,
          plannedYear: action.plannedYear,
          details: action.details,
        })) || [];

  const maintenanceTasks = buildMaintenanceTasks(
    context.projectId,
    maintenanceActions,
    ownerRole
  );
  const useMaintenanceOnly =
    context.projectId === "brf-maintenance-plan" && maintenanceTasks.length > 0;
  const allTasks = useMaintenanceOnly
    ? maintenanceTasks
    : [...baseTasks, ...maintenanceTasks];

  const startDate = allTasks.reduce(
    (acc, task) => minDate(acc, task.startDate),
    allTasks[0]?.startDate || baseStart
  );
  const endDate = allTasks.reduce(
    (acc, task) => maxDate(acc, task.endDate),
    allTasks[0]?.endDate || addDays(baseStart, 90)
  );

  return {
    id: `schedule-${context.projectId}`,
    projectId: context.projectId,
    title: context.title,
    audience: context.audience,
    startDate,
    endDate,
    tasks: allTasks,
    viewSettings: {
      zoom: "month",
      showWeekends: false,
      groupBy: "phase",
    },
    changeLog: [],
  };
}

export function readSchedule(projectId: string): ProjectSchedule | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(toStorageKey(projectId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ProjectSchedule>;
    return normalizeSchedule(parsed, projectId, "Projekt", "privat");
  } catch {
    return null;
  }
}

export function writeSchedule(projectId: string, schedule: ProjectSchedule): ProjectSchedule {
  const normalized = normalizeSchedule(schedule, projectId, schedule.title, schedule.audience);
  const next = normalized || {
    ...schedule,
    projectId,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(toStorageKey(projectId), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(SCHEDULE_UPDATED_EVENT, {
        detail: { projectId },
      })
    );
  }
  return next;
}

export function appendScheduleLog(
  schedule: ProjectSchedule,
  entries: Omit<ScheduleChangeLogEntry, "id" | "timestamp">[]
): ProjectSchedule {
  if (entries.length === 0) return schedule;
  const now = new Date().toISOString();
  const mapped: ScheduleChangeLogEntry[] = entries.map((entry, index) => ({
    id: `${entry.taskId}-${entry.field}-${Date.now()}-${index}`,
    taskId: entry.taskId,
    field: entry.field,
    fromValue: entry.fromValue,
    toValue: entry.toValue,
    actor: entry.actor,
    timestamp: now,
  }));
  return {
    ...schedule,
    changeLog: [...mapped, ...schedule.changeLog].slice(0, 300),
  };
}

function actionHasKeyword(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function buildActionStepBlueprints(actionTitle: string): Array<{
  title: string;
  category: ScheduleTaskCategory;
  phase: string;
  durationDays: number;
  startOffsetDays: number;
}> {
  if (actionHasKeyword(actionTitle, ["lamp", "belys", "armatur"])) {
    return [
      { title: "Inventera armaturer och placering", category: "pre", phase: "Inventering", durationDays: 4, startOffsetDays: -14 },
      { title: "Speca armaturtyp och styrning", category: "pre", phase: "Projektering", durationDays: 5, startOffsetDays: -10 },
      { title: "Beställning och leveransplan", category: "pre", phase: "Inköp", durationDays: 6, startOffsetDays: -8 },
      { title: "Demontering och förberedande elarbete", category: "build", phase: "Utförande", durationDays: 5, startOffsetDays: 0 },
      { title: "Montering etapp 1", category: "build", phase: "Utförande", durationDays: 7, startOffsetDays: 4 },
      { title: "Montering etapp 2", category: "build", phase: "Utförande", durationDays: 7, startOffsetDays: 8 },
      { title: "Funktionsprov och injustering", category: "post", phase: "Kontroll", durationDays: 3, startOffsetDays: 14 },
      { title: "Slutkontroll och dokumentation", category: "post", phase: "Överlämning", durationDays: 3, startOffsetDays: 16 },
    ];
  }

  if (actionHasKeyword(actionTitle, ["måla", "vägg", "tak", "färg"])) {
    return [
      { title: "Inventera ytor och underlag", category: "pre", phase: "Inventering", durationDays: 4, startOffsetDays: -12 },
      { title: "Material- och färgsystemval", category: "pre", phase: "Projektering", durationDays: 5, startOffsetDays: -9 },
      { title: "Etablering och skyddstäckning", category: "build", phase: "Utförande", durationDays: 3, startOffsetDays: 0 },
      { title: "Spackling och förarbete", category: "build", phase: "Utförande", durationDays: 5, startOffsetDays: 2 },
      { title: "Målning etapp 1", category: "build", phase: "Utförande", durationDays: 6, startOffsetDays: 5 },
      { title: "Målning etapp 2", category: "build", phase: "Utförande", durationDays: 6, startOffsetDays: 9 },
      { title: "Efterkontroll och bättring", category: "post", phase: "Kontroll", durationDays: 3, startOffsetDays: 14 },
      { title: "Besiktning och överlämning", category: "post", phase: "Överlämning", durationDays: 3, startOffsetDays: 16 },
    ];
  }

  return [
    { title: "Inventering och omfattningskontroll", category: "pre", phase: "Inventering", durationDays: 4, startOffsetDays: -14 },
    { title: "Teknisk planering och specifikation", category: "pre", phase: "Projektering", durationDays: 6, startOffsetDays: -11 },
    { title: "Inköp och leveransplanering", category: "pre", phase: "Inköp", durationDays: 7, startOffsetDays: -9 },
    { title: "Utförande etapp 1", category: "build", phase: "Utförande", durationDays: 7, startOffsetDays: 0 },
    { title: "Utförande etapp 2", category: "build", phase: "Utförande", durationDays: 8, startOffsetDays: 5 },
    { title: "Kvalitetskontroll", category: "post", phase: "Kontroll", durationDays: 3, startOffsetDays: 14 },
    { title: "Dokumentation och överlämning", category: "post", phase: "Överlämning", durationDays: 4, startOffsetDays: 16 },
  ];
}

export function ensureActionScheduleSteps(
  schedule: ProjectSchedule,
  actionTaskId: string,
  actor = "local-user"
): ProjectSchedule {
  const actionTask = schedule.tasks.find((task) => task.id === actionTaskId);
  if (!actionTask) return schedule;

  const existing = schedule.tasks.filter((task) => task.parentActionId === actionTaskId);
  if (existing.length > 0) return schedule;

  const blueprints = buildActionStepBlueprints(actionTask.title);
  const now = new Date().toISOString();
  const generatedTasks: ScheduleTask[] = [];

  blueprints.forEach((blueprint, index) => {
    const startDate = addDays(actionTask.startDate, blueprint.startOffsetDays);
    const endDate = addDays(startDate, Math.max(1, blueprint.durationDays) - 1);
    generatedTasks.push({
      id: `${schedule.projectId}-${actionTaskId}-step-${index + 1}`,
      projectId: schedule.projectId,
      title: blueprint.title,
      category: blueprint.category,
      phase: blueprint.phase,
      startDate,
      endDate,
      status: "planned",
      dependencies: index === 0 ? [] : [generatedTasks[index - 1].id],
      parentActionId: actionTaskId,
      kind: "action_step",
      ownerRole: actionTask.ownerRole,
      source: "auto",
      updatedAt: now,
    });
  });

  if (generatedTasks.length === 0) return schedule;

  const mergedTasks = [...schedule.tasks, ...generatedTasks];
  const next: ProjectSchedule = {
    ...schedule,
    tasks: mergedTasks,
    startDate: mergedTasks.reduce(
      (acc, task) => minDate(acc, task.startDate),
      mergedTasks[0].startDate
    ),
    endDate: mergedTasks.reduce(
      (acc, task) => maxDate(acc, task.endDate),
      mergedTasks[0].endDate
    ),
  };

  return appendScheduleLog(next, [
    {
      taskId: actionTaskId,
      field: "action_step_plan_created",
      fromValue: "saknas",
      toValue: `${generatedTasks.length} steg`,
      actor,
    },
  ]);
}

export function listStoredScheduleIds(): string[] {
  if (typeof window === "undefined") return [];
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SCHEDULE_STORAGE_PREFIX)) {
      ids.push(key.slice(SCHEDULE_STORAGE_PREFIX.length));
    }
  }
  return ids;
}

export function getKnownScheduleProjects(
  audienceFilter: SnapshotAudience | "all" = "all"
): ScheduleProjectContext[] {
  if (typeof window === "undefined") return [];

  const contexts = new Map<string, ScheduleProjectContext>();
  const requests = listRequests().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestByAudience = new Map<SnapshotAudience, PlatformRequest>();
  requests.forEach((request) => {
    const audience = requestAudienceToSnapshotAudience(request.audience);
    if (!latestByAudience.has(audience)) {
      latestByAudience.set(audience, request);
    }
  });

  const brfActions = readBrfActionsDraft();
  if (audienceFilter === "all" || audienceFilter === "brf") {
    if (brfActions.length > 0) {
      const meta = readBrfRequestMeta();
      contexts.set("brf-maintenance-plan", {
        projectId: "brf-maintenance-plan",
        title: meta.title?.trim() || "BRF underhållsplan",
        audience: "brf",
        maintenanceActions: brfActions,
      });
    } else {
      const latestBrfRequest = latestByAudience.get("brf");
      if (latestBrfRequest) {
        contexts.set(latestBrfRequest.id, {
          projectId: latestBrfRequest.id,
          title: latestBrfRequest.title,
          audience: "brf",
          snapshot: latestBrfRequest.snapshot,
          request: latestBrfRequest,
          maintenanceActions:
            latestBrfRequest.scope.actions?.map((action) => ({
              id: action.id,
              title: action.title,
              category: action.category,
              status: action.status,
              plannedYear: action.plannedYear,
              details: action.details,
            })) || [],
        });
      }
    }
  }

  if (audienceFilter === "all" || audienceFilter === "privat") {
    const latestPrivateRequest = latestByAudience.get("privat");
    if (latestPrivateRequest) {
      contexts.set(latestPrivateRequest.id, {
        projectId: latestPrivateRequest.id,
        title: latestPrivateRequest.title,
        audience: "privat",
        snapshot: latestPrivateRequest.snapshot,
        request: latestPrivateRequest,
      });
    } else {
      const snapshot = readProjectSnapshotFromStorage();
      if (snapshot && snapshot.audience === "privat") {
        contexts.set(snapshot.id, {
          projectId: snapshot.id,
          title: snapshot.overview.title,
          audience: "privat",
          snapshot,
        });
      }
    }
  }

  return Array.from(contexts.values()).sort((a, b) =>
    a.title.localeCompare(b.title, "sv")
  );
}

export function ensureScheduleForProject(context: ScheduleProjectContext): ProjectSchedule {
  const existing = readSchedule(context.projectId);
  if (
    existing &&
    !(context.projectId === "brf-maintenance-plan" && context.maintenanceActions)
  ) {
    return existing;
  }
  if (existing && context.projectId === "brf-maintenance-plan" && context.maintenanceActions) {
    const currentMaintenanceTasks = existing.tasks.filter(
      (task) => task.category === "maintenance" && !task.parentActionId
    );
    const expected = context.maintenanceActions.map(
      (action) => `${action.title.toLowerCase()}-${action.plannedYear}`
    );
    const actual = currentMaintenanceTasks.map(
      (task) => `${task.title.toLowerCase()}-${Number(task.startDate.slice(0, 4))}`
    );
    const sameLength = expected.length === actual.length;
    const sameSet =
      sameLength && expected.every((entry) => actual.includes(entry));
    const hasLegacyShortDurations = currentMaintenanceTasks.some((task) => {
      const dayMs = 24 * 60 * 60 * 1000;
      const days =
        Math.round(
          (parseDateOnly(task.endDate).getTime() - parseDateOnly(task.startDate).getTime()) /
            dayMs
        ) + 1;
      return days < 30;
    });
    if (sameSet && !hasLegacyShortDurations) return existing;
  }
  const generated = generateDefaultSchedule(context);
  return writeSchedule(context.projectId, generated);
}

export function listSchedulesForAudience(
  audienceFilter: SnapshotAudience | "all" = "all"
): Array<{ context: ScheduleProjectContext; schedule: ProjectSchedule }> {
  const known = getKnownScheduleProjects(audienceFilter);
  const paired = known.map((context) => ({
    context,
    schedule: ensureScheduleForProject(context),
  }));

  if (audienceFilter !== "all") {
    return paired.sort((a, b) => a.context.title.localeCompare(b.context.title, "sv"));
  }

  const knownIds = new Set(paired.map((item) => item.context.projectId));
  const storedOnly = listStoredScheduleIds()
    .filter((id) => !knownIds.has(id))
    .map((id) => {
      const schedule = readSchedule(id);
      if (!schedule) return null;
      const context: ScheduleProjectContext = {
        projectId: id,
        title: schedule.title || `Projekt ${id}`,
        audience: schedule.audience || "privat",
      };
      return { context, schedule };
    })
    .filter(
      (item): item is { context: ScheduleProjectContext; schedule: ProjectSchedule } =>
        item !== null
    );

  return [...paired, ...storedOnly].sort((a, b) =>
    a.context.title.localeCompare(b.context.title, "sv")
  );
}

export function subscribeSchedules(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(SCHEDULE_STORAGE_PREFIX)) {
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SCHEDULE_UPDATED_EVENT, callback as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SCHEDULE_UPDATED_EVENT, callback as EventListener);
  };
}
