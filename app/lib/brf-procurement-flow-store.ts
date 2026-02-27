"use client";

import { useSyncExternalStore } from "react";
import type { ProcurementAdjustedScopeItem } from "./procurement/template-engine";

export interface BrfProcurementFlowState {
  selectedActionIds: string[];
  adjustedScopeByActionId: Record<string, ProcurementAdjustedScopeItem>;
  currentRequestId: string | null;
  currentProcurementId: string | null;
  updatedAt: string;
}

const STORAGE_KEY = "byggplattformen-brf-procurement-flow-v1";
const UPDATED_EVENT = "byggplattformen-brf-procurement-flow-updated";

const DEFAULT_STATE: BrfProcurementFlowState = {
  selectedActionIds: [],
  adjustedScopeByActionId: {},
  currentRequestId: null,
  currentProcurementId: null,
  updatedAt: "",
};

const SERVER_SNAPSHOT = DEFAULT_STATE;

let cachedClientSnapshot: BrfProcurementFlowState | null = null;
let cachedClientRaw: string | null = null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeAdjustedScopeMap(raw: unknown): Record<string, ProcurementAdjustedScopeItem> {
  if (!isObject(raw)) return {};
  const next: Record<string, ProcurementAdjustedScopeItem> = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!isObject(value)) return;
    if (typeof value.actionId !== "string" || typeof value.title !== "string") return;
    const standardLevel =
      value.standardLevel === "Bas" || value.standardLevel === "Standard" || value.standardLevel === "Premium"
        ? value.standardLevel
        : "Standard";
    next[key] = {
      actionId: value.actionId,
      title: value.title,
      category: typeof value.category === "string" ? value.category : "",
      quantity:
        value.quantity === null
          ? null
          : typeof value.quantity === "number" && Number.isFinite(value.quantity)
            ? value.quantity
            : null,
      unit:
        value.unit === "st" || value.unit === "m2" || value.unit === "lm" || value.unit === "lopm"
          ? value.unit
          : "st",
      standardLevel,
      additionalRequirements:
        typeof value.additionalRequirements === "string" ? value.additionalRequirements : "",
      isOption: value.isOption === true,
      templateId: typeof value.templateId === "string" ? value.templateId : "general-maintenance",
      templateVersionId:
        typeof value.templateVersionId === "string" ? value.templateVersionId : "byggprocess-v1-general",
    };
  });
  return next;
}

function normalizeState(raw: unknown): BrfProcurementFlowState {
  if (!isObject(raw)) return { ...DEFAULT_STATE };
  return {
    selectedActionIds: Array.isArray(raw.selectedActionIds)
      ? raw.selectedActionIds.filter((id): id is string => typeof id === "string")
      : [],
    adjustedScopeByActionId: normalizeAdjustedScopeMap(raw.adjustedScopeByActionId),
    currentRequestId: typeof raw.currentRequestId === "string" ? raw.currentRequestId : null,
    currentProcurementId: typeof raw.currentProcurementId === "string" ? raw.currentProcurementId : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

export function readBrfProcurementFlowState(): BrfProcurementFlowState {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (cachedClientSnapshot && cachedClientRaw === raw) return cachedClientSnapshot;
  if (!raw) {
    cachedClientRaw = null;
    cachedClientSnapshot = DEFAULT_STATE;
    return cachedClientSnapshot;
  }
  try {
    const normalized = normalizeState(JSON.parse(raw));
    cachedClientRaw = raw;
    cachedClientSnapshot = normalized;
    return normalized;
  } catch {
    cachedClientRaw = raw;
    cachedClientSnapshot = DEFAULT_STATE;
    return cachedClientSnapshot;
  }
}

export function writeBrfProcurementFlowState(nextState: BrfProcurementFlowState): BrfProcurementFlowState {
  const normalized = normalizeState({
    ...nextState,
    updatedAt: nowIso(),
  });
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(normalized);
    cachedClientRaw = serialized;
    cachedClientSnapshot = normalized;
    localStorage.setItem(STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(UPDATED_EVENT));
  }
  return normalized;
}

export function updateBrfProcurementFlowState(
  updater: (current: BrfProcurementFlowState) => BrfProcurementFlowState
): BrfProcurementFlowState {
  const current = readBrfProcurementFlowState();
  const next = updater(current);
  return writeBrfProcurementFlowState(next);
}

export function clearBrfProcurementFlowState(): BrfProcurementFlowState {
  return writeBrfProcurementFlowState({ ...DEFAULT_STATE });
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(UPDATED_EVENT, callback);
  };
}

export function useBrfProcurementFlowStore(): BrfProcurementFlowState {
  return useSyncExternalStore(subscribe, readBrfProcurementFlowState, () => SERVER_SNAPSHOT);
}
