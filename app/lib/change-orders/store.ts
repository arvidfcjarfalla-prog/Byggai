import {
  approveChangeOrder,
  createChangeOrder,
  escalateChangeOrderIfExpired,
  rejectChangeOrder,
  type ChangeOrderRecord,
  type CreateChangeOrderInput,
} from "../state-machine";

export const CHANGE_ORDERS_STORAGE_KEY = "byggplattformen-change-orders-v1";
export const CHANGE_ORDERS_UPDATED_EVENT = "byggplattformen-change-orders-updated";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeIso(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeChangeOrder(raw: unknown): ChangeOrderRecord | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.projectId !== "string") return null;
  const createdAt = normalizeIso(raw.createdAt);
  const deadlineAt = normalizeIso(raw.deadlineAt);
  if (!createdAt || !deadlineAt) return null;

  const status =
    raw.status === "PENDING" || raw.status === "APPROVED" || raw.status === "REJECTED" || raw.status === "ESCALATED"
      ? raw.status
      : "PENDING";

  return {
    id: raw.id,
    projectId: raw.projectId,
    status,
    description: typeof raw.description === "string" ? raw.description : "",
    costEstimateSek:
      typeof raw.costEstimateSek === "number" && Number.isFinite(raw.costEstimateSek)
        ? Math.max(0, Math.round(raw.costEstimateSek))
        : 0,
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.filter((item): item is string => typeof item === "string")
      : [],
    createdAt,
    deadlineAt,
    decidedAt: normalizeIso(raw.decidedAt) ?? undefined,
    escalatedAt: normalizeIso(raw.escalatedAt) ?? undefined,
  };
}

function readRaw(): ChangeOrderRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CHANGE_ORDERS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeChangeOrder(entry))
      .filter((entry): entry is ChangeOrderRecord => entry !== null);
  } catch {
    return [];
  }
}

function writeRaw(entries: ChangeOrderRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHANGE_ORDERS_STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CHANGE_ORDERS_UPDATED_EVENT));
}

function sortByNewest(entries: ChangeOrderRecord[]): ChangeOrderRecord[] {
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function escalateExpired(entries: ChangeOrderRecord[], now?: string): {
  entries: ChangeOrderRecord[];
  changed: boolean;
} {
  let changed = false;
  const next = entries.map((entry) => {
    const escalated = escalateChangeOrderIfExpired(entry, now);
    if (escalated !== entry) changed = true;
    return escalated;
  });
  return { entries: next, changed };
}

export function listChangeOrders(): ChangeOrderRecord[] {
  const current = readRaw();
  const { entries, changed } = escalateExpired(current);
  if (changed) {
    writeRaw(entries);
  }
  return sortByNewest(entries);
}

export function listChangeOrdersByProject(projectId: string): ChangeOrderRecord[] {
  return listChangeOrders().filter((entry) => entry.projectId === projectId);
}

export function createProjectChangeOrder(input: CreateChangeOrderInput): ChangeOrderRecord {
  const entry = createChangeOrder(input);
  const next = [entry, ...readRaw()];
  writeRaw(sortByNewest(next));
  return entry;
}

function updateOne(
  id: string,
  updater: (entry: ChangeOrderRecord) => ChangeOrderRecord
): ChangeOrderRecord | null {
  const all = readRaw();
  let found: ChangeOrderRecord | null = null;
  const next = all.map((entry) => {
    if (entry.id !== id) return entry;
    found = updater(entry);
    return found;
  });
  if (!found) return null;
  writeRaw(sortByNewest(next));
  return found;
}

export function approveProjectChangeOrder(id: string, decidedAt?: string): ChangeOrderRecord | null {
  return updateOne(id, (entry) => approveChangeOrder(entry, decidedAt));
}

export function rejectProjectChangeOrder(id: string, decidedAt?: string): ChangeOrderRecord | null {
  return updateOne(id, (entry) => rejectChangeOrder(entry, decidedAt));
}

export function subscribeChangeOrders(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === CHANGE_ORDERS_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_ORDERS_UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_ORDERS_UPDATED_EVENT, callback);
  };
}

