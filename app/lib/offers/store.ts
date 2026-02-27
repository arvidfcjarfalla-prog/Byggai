import {
  markRequestOfferAccepted,
  markRequestOfferRejected,
  markRequestRecipientRespondedByContractor,
  type PlatformRequest,
} from "../requests-store";
import {
  calculateInternalCostLineTotal,
  calculateLineItemTotal,
  recomputeOffer,
} from "./calculations";
import type {
  LineItem,
  Offer,
  OfferInternalCostCategory,
  OfferInternalCostLine,
  OfferStatus,
  OfferTimelineEntry,
} from "./types";

export const OFFERS_STORAGE_KEY = "byggplattformen-offers-v1";
export const OFFERS_UPDATED_EVENT = "byggplattformen-offers-updated";

interface RawOffer {
  id: string;
  projectId: string;
  contractorId: string;
  version: number;
  status: OfferStatus;
  lineItems: LineItem[];
  assumptions?: string[];
  timeline?: Offer["timeline"];
  internalEstimate?: Offer["internalEstimate"];
  totals: Offer["totals"];
  createdAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLineItem(raw: unknown, index: number): LineItem | null {
  if (!isObject(raw)) return null;
  if (typeof raw.title !== "string") return null;

  const quantity =
    typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
      ? Math.max(0, raw.quantity)
      : 0;
  const unitPrice =
    typeof raw.unitPrice === "number" && Number.isFinite(raw.unitPrice)
      ? Math.max(0, raw.unitPrice)
      : 0;
  const total = calculateLineItemTotal(quantity, unitPrice);
  const type =
    raw.type === "arbete" ||
    raw.type === "material" ||
    raw.type === "ue" ||
    raw.type === "ovrigt"
      ? raw.type
      : "ovrigt";

  return {
    id: typeof raw.id === "string" ? raw.id : `line-item-${index + 1}`,
    title: raw.title.trim(),
    category: typeof raw.category === "string" && raw.category.trim().length > 0 ? raw.category : "Övrigt",
    type,
    quantity,
    unit: typeof raw.unit === "string" && raw.unit.trim().length > 0 ? raw.unit : "st",
    unitPrice,
    total,
  };
}

function normalizeInternalCostCategory(raw: unknown): OfferInternalCostCategory {
  if (
    raw === "personal" ||
    raw === "material" ||
    raw === "ue" ||
    raw === "planering" ||
    raw === "maskin" ||
    raw === "logistik" ||
    raw === "ovrigt" ||
    raw === "riskreserv"
  ) {
    return raw;
  }
  return "ovrigt";
}

function normalizeInternalCostLine(raw: unknown, index: number): OfferInternalCostLine | null {
  if (!isObject(raw)) return null;
  if (typeof raw.label !== "string") return null;

  const quantity =
    typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
      ? Math.max(0, raw.quantity)
      : 0;
  const unitCost =
    typeof raw.unitCost === "number" && Number.isFinite(raw.unitCost)
      ? Math.max(0, raw.unitCost)
      : 0;

  return {
    id: typeof raw.id === "string" ? raw.id : `cost-line-${index + 1}`,
    label: raw.label.trim(),
    category: normalizeInternalCostCategory(raw.category),
    quantity,
    unit: typeof raw.unit === "string" && raw.unit.trim().length > 0 ? raw.unit : "st",
    unitCost,
    total: calculateInternalCostLineTotal(quantity, unitCost),
    notes: typeof raw.notes === "string" && raw.notes.trim().length > 0 ? raw.notes : undefined,
  };
}

export function createDefaultInternalCostLines(): OfferInternalCostLine[] {
  const rows: Array<{
    category: OfferInternalCostCategory;
    label: string;
    unit: string;
  }> = [
    { category: "personal", label: "Personalkostnad (produktion)", unit: "tim" },
    { category: "planering", label: "Planering / projektledning", unit: "tim" },
    { category: "material", label: "Materialkostnad", unit: "st" },
    { category: "ue", label: "Underentreprenör", unit: "st" },
    { category: "maskin", label: "Maskiner / hjälpmedel", unit: "dag" },
    { category: "logistik", label: "Logistik / etablering / resor", unit: "st" },
    { category: "ovrigt", label: "Övriga direkta kostnader", unit: "st" },
    { category: "riskreserv", label: "Riskreserv", unit: "st" },
  ];

  return rows.map((row, index) => ({
    id: `cost-template-${index + 1}`,
    label: row.label,
    category: row.category,
    quantity: 0,
    unit: row.unit,
    unitCost: 0,
    total: 0,
  }));
}

function normalizeOffer(raw: unknown): Offer | null {
  if (!isObject(raw)) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.projectId !== "string" ||
    typeof raw.contractorId !== "string"
  ) {
    return null;
  }

  const lineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems
        .map((lineItem, index) => normalizeLineItem(lineItem, index))
        .filter((lineItem): lineItem is LineItem => lineItem !== null)
    : [];
  const createdAt =
    typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
      ? new Date(raw.createdAt)
      : new Date();

  const status: OfferStatus =
    raw.status === "sent" ||
    raw.status === "accepted" ||
    raw.status === "rejected" ||
    raw.status === "draft"
      ? raw.status
      : "draft";

  const timeline: OfferTimelineEntry[] | undefined = Array.isArray(raw.timeline)
    ? raw.timeline.reduce<OfferTimelineEntry[]>((acc, entry) => {
        if (!isObject(entry) || typeof entry.label !== "string") return acc;
        const normalizedEntry: OfferTimelineEntry = {
          label: entry.label,
          amount:
            typeof entry.amount === "number" && Number.isFinite(entry.amount)
              ? Math.max(0, entry.amount)
              : 0,
        };
        if (typeof entry.date === "string") {
          normalizedEntry.date = entry.date;
        }
        acc.push(normalizedEntry);
        return acc;
      }, [])
    : undefined;

  const normalized: Offer = {
    id: raw.id,
    projectId: raw.projectId,
    contractorId: raw.contractorId,
    version:
      typeof raw.version === "number" && Number.isFinite(raw.version) && raw.version >= 1
        ? Math.round(raw.version)
        : 1,
    status,
    lineItems,
    assumptions: Array.isArray(raw.assumptions)
      ? raw.assumptions.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    timeline,
    internalEstimate:
      isObject(raw.internalEstimate) && Array.isArray(raw.internalEstimate.costLines)
        ? {
            costLines: raw.internalEstimate.costLines
              .map((line, index) => normalizeInternalCostLine(line, index))
              .filter((line): line is OfferInternalCostLine => line !== null),
            updatedAt:
              typeof raw.internalEstimate.updatedAt === "string" ? raw.internalEstimate.updatedAt : undefined,
          }
        : undefined,
    totals: {
      exVat: 0,
      vat: 0,
      incVat: 0,
    },
    createdAt,
  };

  return recomputeOffer(normalized);
}

function toRawOffer(offer: Offer): RawOffer {
  return {
    ...offer,
    createdAt: offer.createdAt.toISOString(),
  };
}

function readStore(): Offer[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(OFFERS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeOffer(entry))
      .filter((entry): entry is Offer => entry !== null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

function writeStore(offers: Offer[]) {
  if (typeof window === "undefined") return;
  const rawOffers = offers.map((offer) => toRawOffer(offer));
  localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(rawOffers));
  window.dispatchEvent(new Event(OFFERS_UPDATED_EVENT));
}

function stableOfferFingerprint(offer: Offer): string {
  return JSON.stringify({
    projectId: offer.projectId,
    contractorId: offer.contractorId,
    lineItems: offer.lineItems.map((lineItem) => ({
      id: lineItem.id,
      title: lineItem.title,
      category: lineItem.category,
      type: lineItem.type,
      quantity: lineItem.quantity,
      unit: lineItem.unit,
      unitPrice: lineItem.unitPrice,
    })),
    assumptions: offer.assumptions ?? [],
    timeline: offer.timeline ?? [],
    internalEstimate: offer.internalEstimate
      ? {
          costLines: offer.internalEstimate.costLines.map((line) => ({
            id: line.id,
            label: line.label,
            category: line.category,
            quantity: line.quantity,
            unit: line.unit,
            unitCost: line.unitCost,
            notes: line.notes ?? "",
          })),
        }
      : null,
    totals: offer.totals,
  });
}

function latestVersionForSeries(offers: Offer[], projectId: string, contractorId: string): number {
  const versions = offers
    .filter((offer) => offer.projectId === projectId && offer.contractorId === contractorId)
    .map((offer) => offer.version);
  return versions.length > 0 ? Math.max(...versions) : 0;
}

function buildRequestActionTimeline(request: PlatformRequest): NonNullable<Offer["timeline"]> | undefined {
  const actions = request.scope.actions ?? request.actions ?? [];
  if (actions.length === 0) return undefined;

  const byYear = actions.reduce<Record<string, number>>((acc, action) => {
    const yearKey =
      typeof action.plannedYear === "number" && Number.isFinite(action.plannedYear)
        ? String(Math.round(action.plannedYear))
        : "Ej planerat";
    const amount =
      typeof action.estimatedPriceSek === "number" && Number.isFinite(action.estimatedPriceSek)
        ? Math.max(0, action.estimatedPriceSek)
        : 0;
    acc[yearKey] = (acc[yearKey] ?? 0) + amount;
    return acc;
  }, {});

  const entries = Object.entries(byYear)
    .map(([label, amount]) => ({
      label: `År ${label}`,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "sv"));

  return entries.length > 0 ? entries : undefined;
}

export function mapRequestActionsToLineItems(request: PlatformRequest): LineItem[] {
  const actions = request.scope.actions ?? request.actions ?? [];
  return actions.map((action, index) => {
    const quantity = 1;
    const unitPrice =
      Number.isFinite(action.estimatedPriceSek) && action.estimatedPriceSek > 0
        ? action.estimatedPriceSek
        : 0;
    return {
      id: `line-${action.id || index + 1}`,
      title: action.title,
      category: action.category || "Övrigt",
      type: "arbete",
      quantity,
      unit: "st",
      unitPrice,
      total: calculateLineItemTotal(quantity, unitPrice),
    };
  });
}

export function buildOfferPreviewFromRequest(input: {
  request: PlatformRequest;
  contractorId: string;
}): Offer {
  return recomputeOffer({
    id: `offer-preview-${input.request.id}`,
    projectId: input.request.id,
    contractorId: input.contractorId,
    version: 1,
    status: "draft",
    lineItems: mapRequestActionsToLineItems(input.request),
    assumptions: [],
    timeline: buildRequestActionTimeline(input.request),
    internalEstimate: undefined,
    totals: { exVat: 0, vat: 0, incVat: 0 },
    createdAt: new Date(),
  });
}

export function listOffers(): Offer[] {
  return readStore();
}

export function getOfferById(offerId: string): Offer | null {
  return readStore().find((offer) => offer.id === offerId) ?? null;
}

export function listOffersByProject(projectId: string): Offer[] {
  return readStore().filter((offer) => offer.projectId === projectId);
}

export function listLatestOffersByProject(projectId: string): Offer[] {
  const offers = listOffersByProject(projectId);
  const latestByContractor = new Map<string, Offer>();
  offers.forEach((offer) => {
    const existing = latestByContractor.get(offer.contractorId);
    if (!existing || offer.version > existing.version) {
      latestByContractor.set(offer.contractorId, offer);
    }
  });
  return [...latestByContractor.values()].sort((a, b) => a.totals.exVat - b.totals.exVat);
}

export function createOffer(input: {
  projectId: string;
  contractorId: string;
  status?: OfferStatus;
  lineItems: LineItem[];
  assumptions?: string[];
  timeline?: Offer["timeline"];
  internalEstimate?: Offer["internalEstimate"];
}): Offer {
  const all = readStore();
  const version = latestVersionForSeries(all, input.projectId, input.contractorId) + 1;
  const base: Offer = {
    id: nextId("offer"),
    projectId: input.projectId,
    contractorId: input.contractorId,
    version,
    status: input.status ?? "draft",
    lineItems: input.lineItems,
    assumptions: input.assumptions,
    timeline: input.timeline,
    internalEstimate: input.internalEstimate,
    totals: { exVat: 0, vat: 0, incVat: 0 },
    createdAt: new Date(nowIso()),
  };
  const normalized = recomputeOffer(base);
  writeStore([normalized, ...all]);
  return normalized;
}

export function ensureDraftOfferForRequest(input: {
  request: PlatformRequest;
  contractorId: string;
}): Offer {
  const latest = listLatestOffersByProject(input.request.id).find(
    (offer) => offer.contractorId === input.contractorId
  );
  if (latest) return latest;

  const seededLineItems = mapRequestActionsToLineItems(input.request);
  return createOffer({
    projectId: input.request.id,
    contractorId: input.contractorId,
    status: "draft",
    lineItems: seededLineItems,
    assumptions: [],
    timeline: buildRequestActionTimeline(input.request),
    internalEstimate: {
      costLines: createDefaultInternalCostLines(),
      updatedAt: undefined,
    },
  });
}

export function saveOffer(input: Offer): {
  offer: Offer;
  createdNewVersion: boolean;
} {
  const all = readStore();
  const normalized = recomputeOffer(input);
  const existing = all.find((offer) => offer.id === normalized.id);

  if (!existing) {
    writeStore([normalized, ...all]);
    return { offer: normalized, createdNewVersion: false };
  }

  const changed = stableOfferFingerprint(existing) !== stableOfferFingerprint(normalized);
  if (existing.status === "sent" && changed) {
    const nextVersion = latestVersionForSeries(all, existing.projectId, existing.contractorId) + 1;
    const nextOffer: Offer = {
      ...normalized,
      id: nextId("offer"),
      version: nextVersion,
      status: "draft",
      createdAt: new Date(nowIso()),
    };
    writeStore([nextOffer, ...all]);
    return { offer: nextOffer, createdNewVersion: true };
  }

  const next = all.map((offer) => (offer.id === normalized.id ? normalized : offer));
  writeStore(next);
  return { offer: normalized, createdNewVersion: false };
}

export function setOfferStatus(offerId: string, status: OfferStatus): Offer | null {
  const all = readStore();
  const existing = all.find((offer) => offer.id === offerId);
  if (!existing) return null;
  const updated: Offer = {
    ...existing,
    status,
  };
  const next = all.map((offer) => (offer.id === offerId ? updated : offer));
  writeStore(next);

  if (status === "sent") {
    const projectOffers = next.filter((offer) => offer.projectId === updated.projectId);
    void markRequestRecipientRespondedByContractor(updated.projectId, updated.contractorId, {
      actorLabel: updated.contractorId,
      offerCount: projectOffers.length,
    });
  } else if (status === "accepted") {
    void markRequestOfferAccepted(updated.projectId, updated.id);
  } else if (status === "rejected") {
    void markRequestOfferRejected(updated.projectId);
  }

  return updated;
}

export function subscribeOffers(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === OFFERS_STORAGE_KEY) callback();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(OFFERS_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(OFFERS_UPDATED_EVENT, callback);
  };
}
