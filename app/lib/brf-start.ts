import type { ProcurementAction, ProcurementActionDetail } from "./requests-store";

export const BRF_ACTIONS_DRAFT_KEY = "byggplattformen-brf-actions-draft";
export const BRF_ACTIONS_DRAFT_UPDATED_EVENT = "byggplattformen-brf-actions-draft-updated";

export const BRF_REQUEST_META_KEY = "byggplattformen-brf-request-meta";
export const BRF_REQUEST_META_UPDATED_EVENT = "byggplattformen-brf-request-meta-updated";

export type BrfStartMode = "underhallsplan" | "manuell" | "guidad";

export interface BrfActionDraft {
  id: string;
  title: string;
  category: string;
  status: "Planerad" | "Eftersatt" | "Genomförd";
  plannedYear: number;
  estimatedPriceSek?: number;
  emissionsKgCo2e?: number;
  details?: string;
  rawRow?: string;
  sourceSheet?: string;
  sourceRow?: number;
  extraDetails?: ProcurementActionDetail[];
  selected?: boolean;
}

export interface BrfRequestMetaDraft {
  title: string;
  description: string;
  location?: string;
  desiredStartFrom?: string;
  desiredStartTo?: string;
  flexibleStart?: boolean;
  budgetMinSek?: number;
  budgetMaxSek?: number;
  budgetUnknown?: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  startMode?: BrfStartMode;
  updatedAt: string;
}

export const DEFAULT_BRF_REQUEST_META: BrfRequestMetaDraft = {
  title: "BRF underhållsprojekt",
  description: "",
  location: "",
  desiredStartFrom: "",
  desiredStartTo: "",
  flexibleStart: false,
  budgetMinSek: undefined,
  budgetMaxSek: undefined,
  budgetUnknown: false,
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  startMode: undefined,
  updatedAt: new Date(0).toISOString(),
};

function safeParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function readBrfActionsDraft(): BrfActionDraft[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BRF_ACTIONS_DRAFT_KEY);
  if (!raw) return [];
  const parsed = safeParse<BrfActionDraft[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => typeof item?.title === "string" && item.title.trim().length > 0)
    .map((item, index) => ({
      id: item.id || `draft-action-${index}`,
      title: item.title,
      category: item.category || "Övrigt",
      status:
        item.status === "Eftersatt" || item.status === "Genomförd"
          ? item.status
          : "Planerad",
      plannedYear:
        Number.isFinite(item.plannedYear) && item.plannedYear > 1990
          ? item.plannedYear
          : new Date().getFullYear(),
      estimatedPriceSek:
        Number.isFinite(item.estimatedPriceSek ?? NaN) && (item.estimatedPriceSek ?? 0) >= 0
          ? item.estimatedPriceSek
          : undefined,
      emissionsKgCo2e:
        Number.isFinite(item.emissionsKgCo2e ?? NaN) && (item.emissionsKgCo2e ?? 0) >= 0
          ? item.emissionsKgCo2e
          : undefined,
      details: item.details,
      rawRow: typeof item.rawRow === "string" ? item.rawRow : undefined,
      sourceSheet: typeof item.sourceSheet === "string" ? item.sourceSheet : undefined,
      sourceRow:
        Number.isFinite(item.sourceRow ?? NaN) && (item.sourceRow ?? 0) > 0
          ? item.sourceRow
          : undefined,
      extraDetails: Array.isArray(item.extraDetails)
        ? item.extraDetails
            .map((detail) => {
              if (!detail || typeof detail.label !== "string") return null;
              return {
                label: detail.label,
                value: typeof detail.value === "string" ? detail.value : "",
              };
            })
            .filter((detail): detail is ProcurementActionDetail => detail !== null)
        : undefined,
      selected: item.selected ?? true,
    }));
}

export function writeBrfActionsDraft(actions: BrfActionDraft[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRF_ACTIONS_DRAFT_KEY, JSON.stringify(actions));
  window.dispatchEvent(new Event(BRF_ACTIONS_DRAFT_UPDATED_EVENT));
}

export function readBrfRequestMeta(): BrfRequestMetaDraft {
  if (typeof window === "undefined") return { ...DEFAULT_BRF_REQUEST_META };
  const raw = localStorage.getItem(BRF_REQUEST_META_KEY);
  if (!raw) return { ...DEFAULT_BRF_REQUEST_META };
  const parsed = safeParse<BrfRequestMetaDraft>(raw);
  if (!parsed || typeof parsed !== "object") return { ...DEFAULT_BRF_REQUEST_META };

  return {
    ...DEFAULT_BRF_REQUEST_META,
    ...parsed,
    title:
      typeof parsed.title === "string" && parsed.title.trim().length > 0
        ? parsed.title
        : DEFAULT_BRF_REQUEST_META.title,
    description: typeof parsed.description === "string" ? parsed.description : "",
    contactName: typeof parsed.contactName === "string" ? parsed.contactName : "",
    contactEmail: typeof parsed.contactEmail === "string" ? parsed.contactEmail : "",
    contactPhone: typeof parsed.contactPhone === "string" ? parsed.contactPhone : "",
    updatedAt:
      typeof parsed.updatedAt === "string" && parsed.updatedAt.length > 0
        ? parsed.updatedAt
        : DEFAULT_BRF_REQUEST_META.updatedAt,
  };
}

export function writeBrfRequestMeta(meta: Partial<BrfRequestMetaDraft>) {
  const next: BrfRequestMetaDraft = {
    ...readBrfRequestMeta(),
    ...meta,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return;
  localStorage.setItem(BRF_REQUEST_META_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(BRF_REQUEST_META_UPDATED_EVENT));
}

export function toProcurementAction(action: BrfActionDraft): ProcurementAction {
  return {
    id: action.id,
    title: action.title,
    category: action.category,
    status: action.status,
    plannedYear: action.plannedYear,
    estimatedPriceSek: action.estimatedPriceSek ?? 0,
    emissionsKgCo2e: action.emissionsKgCo2e ?? 0,
    source: "local",
    details: action.details,
    rawRow: action.rawRow,
    sourceSheet: action.sourceSheet,
    sourceRow: action.sourceRow,
    extraDetails: action.extraDetails,
  };
}

export function fromProcurementAction(action: ProcurementAction): BrfActionDraft {
  return {
    id: action.id,
    title: action.title,
    category: action.category,
    status: action.status,
    plannedYear: action.plannedYear,
    estimatedPriceSek: action.estimatedPriceSek,
    emissionsKgCo2e: action.emissionsKgCo2e,
    details: action.details,
    rawRow: action.rawRow,
    sourceSheet: action.sourceSheet,
    sourceRow: action.sourceRow,
    extraDetails: action.extraDetails,
    selected: true,
  };
}
