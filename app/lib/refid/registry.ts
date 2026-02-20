import { generateRefId } from "./generator";
import { normalizeRefId } from "./normalize";
import type { RefIdKind, RefRegistryEntry } from "./types";
import { validateRefId } from "./validate";

export const REFID_REGISTRY_STORAGE_KEY = "byggplattformen-refid-registry-v1";

type RefRegistryMap = Record<string, RefRegistryEntry>;

function readRegistry(): RefRegistryMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(REFID_REGISTRY_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as RefRegistryMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRegistry(registry: RefRegistryMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REFID_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
}

export function getRefIdEntry(refId: string): RefRegistryEntry | null {
  const normalized = normalizeRefId(refId);
  return readRegistry()[normalized] ?? null;
}

export function registerRefId(input: {
  refId: string;
  kind: RefIdKind;
  id: string;
  projectId?: string;
  workspaceId?: string;
}): { ok: boolean; refId: string; existing?: RefRegistryEntry } {
  const normalized = normalizeRefId(input.refId);
  if (!validateRefId(normalized)) {
    return { ok: false, refId: normalized };
  }

  const registry = readRegistry();
  const existing = registry[normalized];

  if (!existing) {
    registry[normalized] = {
      kind: input.kind,
      id: input.id,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      createdAt: new Date().toISOString(),
    };
    writeRegistry(registry);
    return { ok: true, refId: normalized };
  }

  if (existing.kind === input.kind && existing.id === input.id) {
    return { ok: true, refId: normalized, existing };
  }

  return { ok: false, refId: normalized, existing };
}

export function allocateRefId(input: {
  kind: RefIdKind;
  id: string;
  projectId?: string;
  workspaceId?: string;
  date?: Date;
  maxAttempts?: number;
  candidateFactory?: () => string;
}): string {
  const maxAttempts = input.maxAttempts ?? 24;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = input.candidateFactory
      ? input.candidateFactory()
      : generateRefId({
          kind: input.kind,
          workspaceId: input.workspaceId,
          date: input.date,
        });

    const reservation = registerRefId({
      refId: candidate,
      kind: input.kind,
      id: input.id,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
    });

    if (reservation.ok) {
      return reservation.refId;
    }
  }

  throw new Error(`Kunde inte skapa unikt RefID för ${input.kind}.`);
}

export function ensureRegisteredRefId(input: {
  existingRefId?: string;
  kind: RefIdKind;
  id: string;
  projectId?: string;
  workspaceId?: string;
}): string {
  if (input.existingRefId) {
    const normalized = normalizeRefId(input.existingRefId);
    const reservation = registerRefId({
      refId: normalized,
      kind: input.kind,
      id: input.id,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
    });
    if (reservation.ok) return reservation.refId;
  }

  return allocateRefId({
    kind: input.kind,
    id: input.id,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
  });
}

export function findEntityByRefId(
  projectId: string,
  refId: string
): { kind: RefIdKind; id: string; projectId?: string } | null {
  const normalized = normalizeRefId(refId);
  if (!validateRefId(normalized)) return null;

  const entry = getRefIdEntry(normalized);
  if (!entry) return null;
  if (entry.projectId && entry.projectId !== projectId) return null;

  return {
    kind: entry.kind,
    id: entry.id,
    projectId: entry.projectId,
  };
}
