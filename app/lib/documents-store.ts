/**
 * Implementation notes:
 * - Test lokalt genom att skapa dokument från /dashboard/entreprenor/dokument.
 * - Dokument lagras i localStorage under BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY.
 * - Öppna BRF/privat dokumentinkorg för att verifiera att skickade dokument syns utan reload.
 * - Skapa ny version i editorn och verifiera att version +1 skapas och föregående markeras som superseded.
 */

import type { PlatformRequest } from "./requests-store";
import {
  suggestDocumentSections,
  suggestReservations,
  summarizeScopeToOfferText,
} from "./document-ai";

export type DocumentType = "quote" | "contract" | "ate";
export type DocumentStatus = "draft" | "sent" | "accepted" | "rejected" | "superseded";
export type DocumentFieldType = "text" | "number" | "date" | "select" | "checkbox" | "textarea";

export interface DocumentFieldOption {
  label: string;
  value: string;
}

export interface DocumentField {
  id: string;
  label: string;
  type: DocumentFieldType;
  value: string | number | boolean;
  placeholder?: string;
  options?: DocumentFieldOption[];
}

export interface DocumentSectionItem {
  id: string;
  label: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  value?: string;
}

export interface DocumentSection {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  fields: DocumentField[];
  items?: DocumentSectionItem[];
}

export interface PlatformDocument {
  id: string;
  requestId: string;
  audience: "brf" | "privat";
  type: DocumentType;
  status: DocumentStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdByRole: "entreprenor" | "brf" | "privatperson";
  createdByLabel: string;
  title: string;
  linkedFileIds: string[];
  sections: DocumentSection[];
  renderedHtml?: string;
  pdfDataUrl?: string;
}

export const BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY = "byggplattformen-documents";
export const BYGGPLATTFORMEN_DOCUMENTS_UPDATED_EVENT = "byggplattformen-documents-updated";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFieldType(value: unknown): value is DocumentFieldType {
  return (
    value === "text" ||
    value === "number" ||
    value === "date" ||
    value === "select" ||
    value === "checkbox" ||
    value === "textarea"
  );
}

function isDocumentType(value: unknown): value is DocumentType {
  return value === "quote" || value === "contract" || value === "ate";
}

function isDocumentStatus(value: unknown): value is DocumentStatus {
  return (
    value === "draft" ||
    value === "sent" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "superseded"
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeField(raw: unknown, index: number): DocumentField | null {
  if (!isObject(raw)) return null;
  const type = isFieldType(raw.type) ? raw.type : "text";
  const label = typeof raw.label === "string" && raw.label.trim().length > 0 ? raw.label : `Fält ${index + 1}`;
  let value: string | number | boolean = "";

  if (type === "checkbox") {
    value = Boolean(raw.value);
  } else if (type === "number") {
    value = typeof raw.value === "number" && Number.isFinite(raw.value) ? raw.value : 0;
  } else if (typeof raw.value === "string") {
    value = raw.value;
  }

  return {
    id: typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : `field-${index}`,
    label,
    type,
    value,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
    options: Array.isArray(raw.options)
      ? raw.options
          .map((option) => {
            if (!isObject(option)) return null;
            const optionLabel = typeof option.label === "string" ? option.label : "Val";
            const optionValue = typeof option.value === "string" ? option.value : optionLabel;
            return { label: optionLabel, value: optionValue };
          })
          .filter((option): option is DocumentFieldOption => option !== null)
      : undefined,
  };
}

function normalizeSection(raw: unknown, index: number): DocumentSection | null {
  if (!isObject(raw)) return null;
  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title
      : `Sektion ${index + 1}`;
  const fields = Array.isArray(raw.fields)
    ? raw.fields
        .map((field, fieldIndex) => normalizeField(field, fieldIndex))
        .filter((field): field is DocumentField => field !== null)
    : [];

  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item, itemIndex) => {
          if (!isObject(item)) return null;
          return {
            id: typeof item.id === "string" ? item.id : `item-${itemIndex}`,
            label: typeof item.label === "string" ? item.label : `Rad ${itemIndex + 1}`,
            description: typeof item.description === "string" ? item.description : undefined,
            quantity:
              typeof item.quantity === "number" && Number.isFinite(item.quantity)
                ? item.quantity
                : undefined,
            unitPrice:
              typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
                ? item.unitPrice
                : undefined,
            total:
              typeof item.total === "number" && Number.isFinite(item.total)
                ? item.total
                : undefined,
            value: typeof item.value === "string" ? item.value : undefined,
          } satisfies DocumentSectionItem;
        })
        .filter((item): item is DocumentSectionItem => item !== null)
    : undefined;

  return {
    id: typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : `section-${index}`,
    title,
    description: typeof raw.description === "string" ? raw.description : undefined,
    enabled: raw.enabled !== false,
    fields,
    items,
  };
}

function normalizeDocument(raw: unknown): PlatformDocument | null {
  if (!isObject(raw)) return null;
  if (typeof raw.requestId !== "string" || raw.requestId.trim().length === 0) return null;

  const createdAt = typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : nowIso();
  const updatedAt = typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : createdAt;

  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section, index) => normalizeSection(section, index))
        .filter((section): section is DocumentSection => section !== null)
    : [];

  return {
    id: typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : nextId("doc"),
    requestId: raw.requestId,
    audience: raw.audience === "privat" ? "privat" : "brf",
    type: isDocumentType(raw.type) ? raw.type : "quote",
    status: isDocumentStatus(raw.status) ? raw.status : "draft",
    version: typeof raw.version === "number" && Number.isFinite(raw.version) ? Math.max(1, Math.round(raw.version)) : 1,
    createdAt,
    updatedAt,
    createdByRole:
      raw.createdByRole === "entreprenor" || raw.createdByRole === "brf" || raw.createdByRole === "privatperson"
        ? raw.createdByRole
        : "entreprenor",
    createdByLabel:
      typeof raw.createdByLabel === "string" && raw.createdByLabel.trim().length > 0
        ? raw.createdByLabel
        : "Användare",
    title: typeof raw.title === "string" && raw.title.trim().length > 0 ? raw.title : "Dokument",
    linkedFileIds: Array.isArray(raw.linkedFileIds)
      ? raw.linkedFileIds.filter((id): id is string => typeof id === "string")
      : [],
    sections,
    renderedHtml: typeof raw.renderedHtml === "string" ? raw.renderedHtml : undefined,
    pdfDataUrl: typeof raw.pdfDataUrl === "string" ? raw.pdfDataUrl : undefined,
  };
}

function readStore(): PlatformDocument[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeDocument(entry))
      .filter((entry): entry is PlatformDocument => entry !== null)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } catch {
    return [];
  }
}

function writeStore(documents: PlatformDocument[]): PlatformDocument[] {
  if (typeof window === "undefined") return documents;
  const normalized = documents
    .map((entry) => normalizeDocument(entry))
    .filter((entry): entry is PlatformDocument => entry !== null)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  window.localStorage.setItem(BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(BYGGPLATTFORMEN_DOCUMENTS_UPDATED_EVENT));
  return normalized;
}

function buildScopeItems(request: PlatformRequest): DocumentSectionItem[] {
  const fromScope = request.scope.scopeItems?.map((item, index) => ({
    id: `scope-${index}`,
    label: item.title,
    description: item.details,
  })) ?? [];
  const fromActions = request.scope.actions?.map((action, index) => ({
    id: `action-${index}`,
    label: action.title,
    description: action.details,
    value: `${Math.round(action.estimatedPriceSek)} SEK`,
  })) ?? [];

  const merged = [...fromScope, ...fromActions];
  if (merged.length > 0) return merged;

  return [{ id: "scope-empty", label: "Omfattning fastställs i dialog" }];
}

function quoteSections(request: PlatformRequest): DocumentSection[] {
  const reservations = suggestReservations(request).join("\n- ");
  const scopeSummary = summarizeScopeToOfferText(request);
  const timelineValue = request.desiredStart;

  return [
    {
      id: "project-overview",
      title: "Projektöversikt",
      enabled: true,
      fields: [
        { id: "project-title", label: "Titel", type: "text", value: request.title },
        { id: "project-location", label: "Plats", type: "text", value: request.location },
        {
          id: "project-contact",
          label: "Kontakt",
          type: "text",
          value: request.propertySnapshot?.contactName ?? "Beställare",
        },
        { id: "project-start", label: "Startfönster", type: "text", value: request.desiredStart },
      ],
    },
    {
      id: "scope",
      title: "Omfattning och ingående moment",
      enabled: true,
      fields: [
        { id: "scope-summary", label: "Sammanfattning", type: "textarea", value: scopeSummary },
      ],
      items: buildScopeItems(request),
    },
    {
      id: "materials",
      title: "Material och ansvar",
      enabled: true,
      fields: [
        {
          id: "material-responsibility",
          label: "Ansvar för material",
          type: "select",
          value: "entreprenor",
          options: [
            { label: "Entreprenör", value: "entreprenor" },
            { label: "Beställare", value: "bestallare" },
            { label: "Delat", value: "delat" },
          ],
        },
        {
          id: "quality-level",
          label: "Kvalitetsnivå",
          type: "textarea",
          value: "Standard enligt överenskommelse och valda produktblad.",
        },
      ],
    },
    {
      id: "timeline",
      title: "Tidplan",
      enabled: true,
      fields: [
        { id: "prelim-start", label: "Preliminär start", type: "text", value: timelineValue },
        { id: "prelim-end", label: "Preliminär slut", type: "text", value: "Fastställs efter platsbesök" },
      ],
      items: [
        { id: "milestone-1", label: "Startmöte", value: "Vecka 1" },
        { id: "milestone-2", label: "Delavstämning", value: "Mitten av projekt" },
        { id: "milestone-3", label: "Slutkontroll", value: "Innan överlämning" },
      ],
    },
    {
      id: "pricing",
      title: "Pris och betalningsplan",
      enabled: true,
      fields: [
        { id: "total-price", label: "Totalpris", type: "text", value: request.budgetRange },
        { id: "labor-cost", label: "Arbetskostnad", type: "text", value: "Specificeras" },
        { id: "material-cost", label: "Materialkostnad", type: "text", value: "Specificeras" },
        {
          id: "rot",
          label: "ROT-avdrag",
          type: "checkbox",
          value: request.audience === "privat",
        },
      ],
      items: [
        { id: "pay-1", label: "30%", value: "Vid avtalssignering" },
        { id: "pay-2", label: "40%", value: "Efter halvtid" },
        { id: "pay-3", label: "30%", value: "Efter godkänd slutkontroll" },
      ],
    },
    {
      id: "reservations",
      title: "Förutsättningar och reservationer",
      enabled: true,
      fields: [
        { id: "reservation-text", label: "Reservationer", type: "textarea", value: `- ${reservations}` },
        { id: "site-visit", label: "Förutsatter platsbesök", type: "checkbox", value: true },
        { id: "hidden-errors", label: "Dolda fel", type: "checkbox", value: true },
        { id: "ata-changes", label: "ÄTA vid ändring", type: "checkbox", value: true },
      ],
    },
    {
      id: "guarantees",
      title: "Garantier och försäkringar",
      enabled: true,
      fields: [
        { id: "guarantee-work", label: "Garanti arbete", type: "checkbox", value: true },
        { id: "liability-insurance", label: "Ansvarsförsäkring", type: "checkbox", value: true },
        {
          id: "guarantee-text",
          label: "Kommentar",
          type: "textarea",
          value: "Garantier enligt avtal och gällande branschpraxis.",
        },
      ],
    },
    {
      id: "attachments",
      title: "Bilagor",
      enabled: true,
      fields: [],
    },
    {
      id: "acceptance",
      title: "Signering och accept",
      enabled: false,
      fields: [
        { id: "validity", label: "Giltighetstid", type: "text", value: "30 dagar" },
        {
          id: "accept-method",
          label: "Acceptmetod",
          type: "select",
          value: "digital",
          options: [
            { label: "Digital signering", value: "digital" },
            { label: "E-postbekräftelse", value: "email" },
            { label: "Fysisk signering", value: "physical" },
          ],
        },
      ],
    },
    ...suggestDocumentSections(request, "quote"),
  ];
}

function contractSections(request: PlatformRequest): DocumentSection[] {
  return [
    {
      id: "parties",
      title: "Parter och projektidentitet",
      enabled: true,
      fields: [
        { id: "buyer", label: "Beställare", type: "text", value: request.title },
        { id: "supplier", label: "Entreprenör", type: "text", value: "Specificeras" },
        { id: "request-id", label: "Request ID", type: "text", value: request.id },
      ],
    },
    {
      id: "included-docs",
      title: "Handlingar som ingår",
      enabled: true,
      fields: [
        {
          id: "included-reference",
          label: "Referens",
          type: "textarea",
          value: "Detta avtal baseras på förfrågan, offert och överenskomna bilagor.",
        },
      ],
    },
    {
      id: "scope-boundary",
      title: "Omfattning och gränsdragning",
      enabled: true,
      fields: [
        { id: "scope-text", label: "Omfattning", type: "textarea", value: summarizeScopeToOfferText(request) },
      ],
      items: buildScopeItems(request),
    },
    {
      id: "delay-plan",
      title: "Tidsplan och försening",
      enabled: true,
      fields: [
        { id: "start-window", label: "Start", type: "text", value: request.desiredStart },
        { id: "delay-rule", label: "förseningsregel", type: "textarea", value: "försening hanteras enligt avtalad process." },
      ],
    },
    {
      id: "payment",
      title: "Ersättning och betalningsvillkor",
      enabled: true,
      fields: [
        { id: "compensation", label: "Ersättning", type: "text", value: request.budgetRange },
        { id: "terms", label: "Betalningsvillkor", type: "text", value: "30 dagar netto" },
      ],
    },
    {
      id: "ata-process",
      title: "ÄTA-hantering",
      enabled: true,
      fields: [
        { id: "ata-init", label: "Initiering", type: "textarea", value: "ÄTA initieras skriftligt." },
        { id: "ata-approval", label: "Godkännande", type: "textarea", value: "Skriftligt godkännande krävs innan utförande." },
        { id: "ata-pricing", label: "Prissättning", type: "textarea", value: "Pris och tidspåverkan dokumenteras före start." },
      ],
    },
    {
      id: "insurance",
      title: "försäkring, ansvar, garanti",
      enabled: true,
      fields: [
        { id: "insurance-check", label: "Ansvarsförsäkring finns", type: "checkbox", value: true },
        { id: "guarantee-period", label: "Garantitid", type: "text", value: "Enligt avtal" },
      ],
    },
    {
      id: "inspection",
      title: "Besiktning och avhjälpande",
      enabled: true,
      fields: [
        { id: "inspection", label: "Besiktningsprocess", type: "textarea", value: "Slutbesiktning genomförs innan överlämning." },
      ],
    },
    {
      id: "legal",
      title: "Tvist och regelverk",
      enabled: false,
      fields: [
        {
          id: "framework",
          label: "Regelverk",
          type: "select",
          value: "ktjl",
          options: [
            { label: "KtjL", value: "ktjl" },
            { label: "AB", value: "ab" },
            { label: "ABT", value: "abt" },
          ],
        },
        { id: "dispute", label: "Tvistlösning", type: "textarea", value: "Parterna ska i första hand försöka nå överenskommelse." },
      ],
    },
    {
      id: "signatures",
      title: "Signaturer",
      enabled: true,
      fields: [
        { id: "sign-buyer", label: "Beställare", type: "text", value: "" },
        { id: "sign-supplier", label: "Entreprenör", type: "text", value: "" },
        { id: "sign-date", label: "Datum", type: "date", value: "" },
      ],
    },
    ...suggestDocumentSections(request, "contract"),
  ];
}

function ateSections(request: PlatformRequest): DocumentSection[] {
  return [
    {
      id: "reference",
      title: "Referens",
      enabled: true,
      fields: [
        { id: "ref-request", label: "Request ID", type: "text", value: request.id },
        { id: "ref-contract", label: "Avtal/Offert", type: "text", value: "Specificera referens" },
      ],
    },
    {
      id: "change-description",
      title: "Ändringsbeskrivning",
      enabled: true,
      fields: [
        { id: "what", label: "Vad ändras", type: "textarea", value: "" },
        { id: "why", label: "Varför", type: "textarea", value: "" },
        {
          id: "initiator",
          label: "Initierad av",
          type: "select",
          value: "bestallare",
          options: [
            { label: "Beställare", value: "bestallare" },
            { label: "Entreprenör", value: "entreprenor" },
            { label: "Gemensamt", value: "gemensamt" },
          ],
        },
      ],
    },
    {
      id: "price-impact",
      title: "Påverkan på pris",
      enabled: true,
      fields: [
        { id: "price-comment", label: "Kommentar", type: "textarea", value: "" },
      ],
      items: [
        { id: "row-1", label: "Åtgärd", quantity: 1, unitPrice: 0, total: 0 },
      ],
    },
    {
      id: "time-impact",
      title: "Påverkan på tidplan",
      enabled: true,
      fields: [
        { id: "days", label: "Dagar", type: "number", value: 0 },
        { id: "weeks", label: "Veckor", type: "number", value: 0 },
        { id: "schedule-comment", label: "Kommentar", type: "textarea", value: "" },
      ],
    },
    {
      id: "risk",
      title: "Förutsättningar och risk",
      enabled: true,
      fields: [
        { id: "risk-text", label: "Risk och Förutsättningar", type: "textarea", value: "" },
      ],
    },
    {
      id: "approval",
      title: "Godkännande",
      enabled: true,
      fields: [
        { id: "approved", label: "Godkänd", type: "checkbox", value: false },
        { id: "approval-date", label: "Datum", type: "date", value: "" },
        { id: "approval-note", label: "Kommentar", type: "textarea", value: "" },
      ],
    },
    ...suggestDocumentSections(request, "ate"),
  ];
}

export function listDocuments(): PlatformDocument[] {
  return readStore();
}

export function listDocumentsByRequest(requestId: string): PlatformDocument[] {
  return readStore().filter((doc) => doc.requestId === requestId);
}

export function getDocumentById(documentId: string): PlatformDocument | null {
  return readStore().find((doc) => doc.id === documentId) ?? null;
}

export function saveDocument(document: PlatformDocument): PlatformDocument[] {
  const normalized = normalizeDocument(document);
  if (!normalized) return readStore();

  const next = readStore().filter((doc) => doc.id !== normalized.id);
  const updated = {
    ...normalized,
    updatedAt: nowIso(),
  };
  next.unshift(updated);
  return writeStore(next);
}

export function createDocumentFromTemplate(
  request: PlatformRequest,
  type: DocumentType,
  createdByRole: "entreprenor" | "brf" | "privatperson",
  createdByLabel: string
): PlatformDocument {
  const timestamp = nowIso();
  const requestFiles = request.files ?? [];
  const linkedFileIds = requestFiles
    .map((file) => file.id)
    .filter((fileId): fileId is string => typeof fileId === "string");

  const sectionByType =
    type === "contract" ? contractSections(request) : type === "ate" ? ateSections(request) : quoteSections(request);

  const titlePrefix = type === "quote" ? "Offert" : type === "contract" ? "Avtal" : "ÄTA";

  return {
    id: nextId("doc"),
    requestId: request.id,
    audience: request.audience,
    type,
    status: "draft",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByRole,
    createdByLabel: createdByLabel.trim().length > 0 ? createdByLabel : "Entreprenör",
    title: `${titlePrefix} - ${request.title}`,
    linkedFileIds,
    sections: sectionByType,
  };
}

export function createNextVersion(documentId: string): PlatformDocument | null {
  const current = getDocumentById(documentId);
  if (!current) return null;

  const now = nowIso();
  const nextVersion: PlatformDocument = {
    ...current,
    id: nextId("doc"),
    status: "draft",
    version: current.version + 1,
    createdAt: now,
    updatedAt: now,
    title: `${current.title.split("(v")[0].trim()} (v${current.version + 1})`,
  };

  const store = readStore().map((document) =>
    document.id === current.id
      ? {
          ...document,
          status: "superseded" as DocumentStatus,
          updatedAt: now,
        }
      : document
  );
  store.unshift(nextVersion);
  writeStore(store);
  return nextVersion;
}

export function subscribeDocuments(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(BYGGPLATTFORMEN_DOCUMENTS_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BYGGPLATTFORMEN_DOCUMENTS_UPDATED_EVENT, callback);
  };
}
