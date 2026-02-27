import type { ChangeOrderRecord, CreateChangeOrderInput } from "./types";

const CHANGE_ORDER_RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000;

function toIso(input: string | undefined, fallback: Date = new Date()): string {
  if (!input) return fallback.toISOString();
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) return fallback.toISOString();
  return new Date(parsed).toISOString();
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export function createChangeOrder(input: CreateChangeOrderInput): ChangeOrderRecord {
  const createdAt = toIso(input.createdAt);
  return {
    id: input.id,
    projectId: input.projectId,
    status: "PENDING",
    description: input.description.trim(),
    costEstimateSek: Math.max(0, Math.round(input.costEstimateSek)),
    attachments: input.attachments ? [...input.attachments] : [],
    createdAt,
    deadlineAt: addMs(createdAt, CHANGE_ORDER_RESPONSE_WINDOW_MS),
  };
}

export function approveChangeOrder(order: ChangeOrderRecord, decidedAt?: string): ChangeOrderRecord {
  if (order.status !== "PENDING" && order.status !== "ESCALATED") return order;
  const at = toIso(decidedAt);
  return {
    ...order,
    status: "APPROVED",
    decidedAt: at,
  };
}

export function rejectChangeOrder(order: ChangeOrderRecord, decidedAt?: string): ChangeOrderRecord {
  if (order.status !== "PENDING" && order.status !== "ESCALATED") return order;
  const at = toIso(decidedAt);
  return {
    ...order,
    status: "REJECTED",
    decidedAt: at,
  };
}

export function escalateChangeOrderIfExpired(
  order: ChangeOrderRecord,
  now?: string
): ChangeOrderRecord {
  if (order.status !== "PENDING") return order;
  const nowIso = toIso(now);
  if (Date.parse(nowIso) <= Date.parse(order.deadlineAt)) return order;
  return {
    ...order,
    status: "ESCALATED",
    escalatedAt: nowIso,
  };
}

export function getChangeOrderTimeRemainingMs(order: ChangeOrderRecord, now?: string): number {
  const nowIso = toIso(now);
  return Date.parse(order.deadlineAt) - Date.parse(nowIso);
}

export function isChangeOrderOverdue(order: ChangeOrderRecord, now?: string): boolean {
  return getChangeOrderTimeRemainingMs(order, now) < 0;
}

