export interface OfferDecisionLogEntry {
  id: string;
  projectId: string;
  offerId: string;
  contractorId: string;
  offerLabel: string;
  createdAt: string;
  userLabel: string;
  motivation?: string;
  isMock?: boolean;
}

const STORAGE_KEY = "byggplattformen-offer-decision-log-v1";
const UPDATED_EVENT = "byggplattformen-offer-decision-log-updated";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEntry(raw: unknown): OfferDecisionLogEntry | null {
  if (!isObject(raw)) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.projectId !== "string" ||
    typeof raw.offerId !== "string" ||
    typeof raw.contractorId !== "string" ||
    typeof raw.offerLabel !== "string" ||
    typeof raw.createdAt !== "string" ||
    typeof raw.userLabel !== "string"
  ) {
    return null;
  }
  return {
    id: raw.id,
    projectId: raw.projectId,
    offerId: raw.offerId,
    contractorId: raw.contractorId,
    offerLabel: raw.offerLabel,
    createdAt: raw.createdAt,
    userLabel: raw.userLabel,
    motivation: typeof raw.motivation === "string" && raw.motivation.trim().length > 0 ? raw.motivation : undefined,
    isMock: raw.isMock === true,
  };
}

function readRaw(): OfferDecisionLogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter((e): e is OfferDecisionLogEntry => e !== null);
  } catch {
    return [];
  }
}

function writeRaw(entries: OfferDecisionLogEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function listOfferDecisionLogs(): OfferDecisionLogEntry[] {
  return readRaw().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function listOfferDecisionLogsByProject(projectId: string): OfferDecisionLogEntry[] {
  return listOfferDecisionLogs().filter((entry) => entry.projectId === projectId);
}

export function createOfferDecisionLogEntry(input: Omit<OfferDecisionLogEntry, "id" | "createdAt">): OfferDecisionLogEntry {
  const entry: OfferDecisionLogEntry = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    ...input,
  };
  const next = [entry, ...readRaw()].slice(0, 500);
  writeRaw(next);
  return entry;
}

export function subscribeOfferDecisionLogs(callback: () => void): () => void {
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

