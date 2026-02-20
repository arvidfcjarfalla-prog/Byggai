/**
 * Implementation notes:
 * - Test lokalt genom att skapa dokument från /dashboard/entreprenor/dokument.
 * - Dokument lagras i localStorage under BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY.
 * - Öppna BRF/privat dokumentvyn för att verifiera att skickade dokument syns utan reload.
 * - Skapa ny version i editorn och verifiera att version +1 skapas och föregående markeras som superseded.
 */

import type { PlatformRequest } from "./requests-store";
import type { ProjectFolder } from "./project-files/types";
import {
  suggestDocumentSections,
  suggestReservations,
  summarizeScopeToOfferText,
} from "./document-ai";
import { ensureRegisteredRefId } from "./refid/registry";
import { validateRefId } from "./refid/validate";

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

export interface DocumentAttachmentRef {
  fileId: string;
  fileRefId: string;
  filename: string;
  folder: ProjectFolder;
  mimeType: string;
}

export interface PlatformDocument {
  id: string;
  refId: string;
  requestId: string;
  audience: "brf" | "privat";
  type: DocumentType;
  status: DocumentStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  createdByRole: "entreprenor" | "brf" | "privatperson";
  createdByLabel: string;
  title: string;
  linkedFileIds: string[];
  attachments: DocumentAttachmentRef[];
  sections: DocumentSection[];
  renderedHtml?: string;
  pdfDataUrl?: string;
}

export const BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY = "byggplattformen-documents";
export const BYGGPLATTFORMEN_DOCUMENTS_UPDATED_EVENT = "byggplattformen-documents-updated";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
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

function normalizeOptionalIso(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
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
        .filter(isDefined)
    : [];

  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item, itemIndex) => {
          if (!isObject(item)) return null;
          const normalizedItem: DocumentSectionItem = {
            id: typeof item.id === "string" ? item.id : `item-${itemIndex}`,
            label: typeof item.label === "string" ? item.label : `Rad ${itemIndex + 1}`,
            ...(typeof item.description === "string" ? { description: item.description } : {}),
            ...(typeof item.quantity === "number" && Number.isFinite(item.quantity)
              ? { quantity: item.quantity }
              : {}),
            ...(typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
              ? { unitPrice: item.unitPrice }
              : {}),
            ...(typeof item.total === "number" && Number.isFinite(item.total) ? { total: item.total } : {}),
            ...(typeof item.value === "string" ? { value: item.value } : {}),
          };
          return normalizedItem;
        })
        .filter(isDefined)
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

function ensureOrgFieldForSections(
  type: DocumentType,
  sections: DocumentSection[]
): { sections: DocumentSection[]; changed: boolean } {
  const targetSectionId =
    type === "quote"
      ? "project-overview"
      : type === "contract"
        ? "parties"
        : "kov-reference";

  let changed = false;
  const nextSections: DocumentSection[] = sections.map((section) => {
    if (section.id !== targetSectionId) return section;
    if (section.fields.some((field) => field.id === "contractor-orgnr")) return section;
    changed = true;
    const contractorOrgField: DocumentField = {
      id: "contractor-orgnr",
      label: "Org.nr entreprenad",
      type: "text",
      value: "",
    };
    return {
      ...section,
      fields: [
        ...section.fields,
        contractorOrgField,
      ],
    };
  });

  return { sections: nextSections, changed };
}

function normalizeAttachment(raw: unknown): DocumentAttachmentRef | null {
  if (!isObject(raw)) return null;
  if (typeof raw.fileId !== "string" || raw.fileId.trim().length === 0) return null;

  const folder =
    raw.folder === "avtal" ||
    raw.folder === "offert" ||
    raw.folder === "ata" ||
    raw.folder === "bilder" ||
    raw.folder === "ritningar" ||
    raw.folder === "ovrigt"
      ? raw.folder
      : "ovrigt";

  return {
    fileId: raw.fileId,
    fileRefId: typeof raw.fileRefId === "string" ? raw.fileRefId : "",
    filename:
      typeof raw.filename === "string" && raw.filename.trim().length > 0
        ? raw.filename
        : raw.fileId,
    folder,
    mimeType:
      typeof raw.mimeType === "string" && raw.mimeType.trim().length > 0
        ? raw.mimeType
        : "application/octet-stream",
  };
}

function normalizeDocument(raw: unknown): PlatformDocument | null {
  if (!isObject(raw)) return null;
  if (typeof raw.requestId !== "string" || raw.requestId.trim().length === 0) return null;

  const createdAt = typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : nowIso();
  const updatedAt = typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : createdAt;
  const status = isDocumentStatus(raw.status) ? raw.status : "draft";

  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section, index) => normalizeSection(section, index))
        .filter((section): section is DocumentSection => section !== null)
    : [];
  const type = isDocumentType(raw.type) ? raw.type : "quote";
  const withOrg = ensureOrgFieldForSections(type, sections);

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .map((attachment) => normalizeAttachment(attachment))
        .filter((attachment): attachment is DocumentAttachmentRef => attachment !== null)
    : [];

  const linkedFileIds = Array.isArray(raw.linkedFileIds)
    ? raw.linkedFileIds.filter((id): id is string => typeof id === "string")
    : attachments.map((attachment) => attachment.fileId);

  // Migration note: äldre dokument saknar status-tidsfält.
  // Vi fyller minimalt från updatedAt/createdAt för att behålla historik i tidslinjen.
  let sentAt = normalizeOptionalIso(raw.sentAt);
  let acceptedAt = normalizeOptionalIso(raw.acceptedAt);
  let rejectedAt = normalizeOptionalIso(raw.rejectedAt);

  if (status === "sent" && !sentAt) {
    sentAt = updatedAt;
  } else if (status === "accepted") {
    if (!sentAt) sentAt = createdAt;
    if (!acceptedAt) acceptedAt = updatedAt;
  } else if (status === "rejected") {
    if (!sentAt) sentAt = createdAt;
    if (!rejectedAt) rejectedAt = updatedAt;
  }

  return {
    id: typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : nextId("doc"),
    refId: typeof raw.refId === "string" ? raw.refId : "",
    requestId: raw.requestId,
    audience: raw.audience === "privat" ? "privat" : "brf",
    type,
    status,
    version: typeof raw.version === "number" && Number.isFinite(raw.version) ? Math.max(1, Math.round(raw.version)) : 1,
    createdAt,
    updatedAt,
    sentAt,
    acceptedAt,
    rejectedAt,
    createdByRole:
      raw.createdByRole === "entreprenor" || raw.createdByRole === "brf" || raw.createdByRole === "privatperson"
        ? raw.createdByRole
        : "entreprenor",
    createdByLabel:
      typeof raw.createdByLabel === "string" && raw.createdByLabel.trim().length > 0
        ? raw.createdByLabel
        : "Användare",
    title: typeof raw.title === "string" && raw.title.trim().length > 0 ? raw.title : "Dokument",
    linkedFileIds,
    attachments,
    sections: withOrg.sections,
    renderedHtml: typeof raw.renderedHtml === "string" ? raw.renderedHtml : undefined,
    pdfDataUrl: typeof raw.pdfDataUrl === "string" ? raw.pdfDataUrl : undefined,
  };
}

function ensureDocumentRefId(document: PlatformDocument): PlatformDocument {
  const refId = ensureRegisteredRefId({
    existingRefId: validateRefId(document.refId) ? document.refId : undefined,
    kind: "DOC",
    id: document.id,
    projectId: document.requestId,
  });

  return {
    ...document,
    refId,
  };
}

function applyStatusTimestamps(
  document: PlatformDocument,
  previous: PlatformDocument | null
): PlatformDocument {
  let sentAt = document.sentAt ?? previous?.sentAt;
  let acceptedAt = document.acceptedAt ?? previous?.acceptedAt;
  let rejectedAt = document.rejectedAt ?? previous?.rejectedAt;

  if (document.status === "draft") {
    acceptedAt = undefined;
    rejectedAt = undefined;
  }

  if (document.status === "sent") {
    if (!sentAt) sentAt = document.updatedAt;
    acceptedAt = undefined;
    rejectedAt = undefined;
  }

  if (document.status === "accepted") {
    if (!sentAt) sentAt = previous?.sentAt ?? document.createdAt;
    if (!acceptedAt) acceptedAt = document.updatedAt;
    rejectedAt = undefined;
  }

  if (document.status === "rejected") {
    if (!sentAt) sentAt = previous?.sentAt ?? document.createdAt;
    if (!rejectedAt) rejectedAt = document.updatedAt;
    acceptedAt = undefined;
  }

  return {
    ...document,
    sentAt,
    acceptedAt,
    rejectedAt,
  };
}

function readStore(): PlatformDocument[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    let changed = false;
    const normalized = parsed
      .map((entry) => normalizeDocument(entry))
      .filter((entry): entry is PlatformDocument => entry !== null)
      .map((entry) => {
        const withRef = ensureDocumentRefId(entry);
        if (withRef.refId !== entry.refId) changed = true;
        return withRef;
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    if (changed) {
      window.localStorage.setItem(
        BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    }
    return normalized;
  } catch {
    return [];
  }
}

function writeStore(documents: PlatformDocument[]): PlatformDocument[] {
  if (typeof window === "undefined") return documents;
  const normalized = documents
    .map((entry) => normalizeDocument(entry))
    .filter((entry): entry is PlatformDocument => entry !== null)
    .map((entry) => ensureDocumentRefId(entry))
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
        {
          id: "contractor-orgnr",
          label: "Org.nr entreprenad",
          type: "text",
          value: "",
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
        { id: "contractor-orgnr", label: "Org.nr entreprenad", type: "text", value: "" },
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
      id: "attachments",
      title: "Bilagor",
      enabled: true,
      fields: [],
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
  const today = new Date().toISOString().slice(0, 10);
  const customerName =
    request.propertySnapshot?.contactName?.trim().length
      ? request.propertySnapshot.contactName
      : request.title;

  return [
    {
      id: "kov-reference",
      title: "Referens och parter",
      description: "Grundmall enligt KOV: Ändringar och tilläggsarbeten.",
      enabled: true,
      fields: [
        { id: "date", label: "Datum", type: "date", value: today },
        { id: "request-id", label: "Request-ID", type: "text", value: request.id },
        { id: "reference-contract", label: "Referens till avtal/offert", type: "text", value: "" },
        { id: "customer-1", label: "Namn beställare (konsument)", type: "text", value: customerName },
        { id: "customer-2", label: "Namn 2 beställare (konsument)", type: "text", value: "" },
        { id: "contractor", label: "Namn eller firma hantverkare (näringsidkare)", type: "text", value: "Specificeras" },
        { id: "contractor-orgnr", label: "Org.nr entreprenad", type: "text", value: "" },
      ],
    },
    {
      id: "kov-changes",
      title: "Ändringar och tilläggsarbeten",
      enabled: true,
      fields: [
        {
          id: "change-description",
          label: "Beskriv tydligt de ändringar och/eller tilläggsarbeten som ska utföras",
          type: "textarea",
          value: summarizeScopeToOfferText(request),
        },
        { id: "change-reason", label: "Orsak till ändringen", type: "textarea", value: "" },
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
      items: buildScopeItems(request),
    },
    {
      id: "kov-pricing",
      title: "Prisuppgift och ROT",
      enabled: true,
      fields: [
        {
          id: "price-model",
          label: "Prissättning",
          type: "select",
          value: "specificeras-nedan",
          options: [
            { label: "Det pris som avtalats tidigare", value: "tidigare-avtalat" },
            { label: "Det pris som anges nedan", value: "specificeras-nedan" },
            { label: "Löpande enligt överenskomna timpriser", value: "lopande" },
          ],
        },
        { id: "price-total", label: "Arbete + material + resor (kr inkl. moms)", type: "text", value: "" },
        { id: "price-work", label: "Arbete (kr inkl. moms)", type: "text", value: "" },
        { id: "price-material", label: "Material (kr inkl. moms)", type: "text", value: "" },
        {
          id: "rot",
          label: "ROT-avdrag",
          type: "select",
          value: request.audience === "privat" ? "ja" : "nej",
          options: [
            { label: "Ja, arbete ska utföras med ROT-avdrag", value: "ja" },
            { label: "Nej, inget ROT-avdrag", value: "nej" },
          ],
        },
        { id: "price-comment", label: "Pris-kommentar", type: "textarea", value: "" },
      ],
      items: [
        { id: "price-row-1", label: "Åtgärd", quantity: 1, unitPrice: 0, total: 0 },
      ],
    },
    {
      id: "kov-timeline",
      title: "Tidpåverkan",
      enabled: true,
      fields: [
        { id: "start-date", label: "Arbete ska påbörjas datum", type: "date", value: "" },
        { id: "finish-date", label: "Arbete ska senast vara klart datum", type: "date", value: "" },
        { id: "duration", label: "Tidsförlängning antal", type: "number", value: 0 },
        {
          id: "duration-unit",
          label: "Enhet",
          type: "select",
          value: "dag",
          options: [
            { label: "Dag/dagar", value: "dag" },
            { label: "Vecka/veckor", value: "vecka" },
          ],
        },
        { id: "timeline-comment", label: "Kommentar om tidplan", type: "textarea", value: "" },
      ],
    },
    {
      id: "kov-avradan",
      title: "Arbete trots avrådan",
      enabled: false,
      fields: [
        { id: "against-advice", label: "Arbete utförs trots avrådan", type: "checkbox", value: false },
        {
          id: "against-advice-work",
          label: "Arbete som beställaren vill ha utfört trots att hantverkaren har avrått",
          type: "textarea",
          value: "",
        },
        { id: "against-advice-reason", label: "Orsak till avrådande", type: "textarea", value: "" },
        { id: "against-advice-appendix", label: "Fortsättning bilaga nummer", type: "text", value: "" },
      ],
    },
    {
      id: "kov-terms",
      title: "Övriga överenskommelser och förutsättningar",
      enabled: true,
      fields: [
        { id: "extra-agreements", label: "Övriga överenskommelser", type: "textarea", value: "" },
        { id: "site-visit", label: "Förutsätter platsbesök innan utförande", type: "checkbox", value: true },
        { id: "ata-by-change", label: "Ytterligare ändringar hanteras som ny ÄTA", type: "checkbox", value: true },
      ],
    },
    {
      id: "attachments",
      title: "Bilagor",
      enabled: true,
      fields: [],
    },
    {
      id: "kov-signatures",
      title: "Godkännande och signaturer",
      enabled: true,
      fields: [
        { id: "approved", label: "Godkänd av beställare", type: "checkbox", value: false },
        { id: "place-date-contractor", label: "Ort och datum näringsidkare", type: "text", value: "" },
        { id: "company", label: "Firma", type: "text", value: "" },
        { id: "place-date-customer", label: "Ort och datum beställare", type: "text", value: "" },
        { id: "customer-sign-1", label: "Namnförtydligande beställare 1", type: "text", value: customerName },
        { id: "customer-sign-2", label: "Namnförtydligande beställare 2", type: "text", value: "" },
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

  const existing = readStore();
  const previous = existing.find((doc) => doc.id === normalized.id) ?? null;
  const next = existing.filter((doc) => doc.id !== normalized.id);
  const withUpdatedAt = {
    ...normalized,
    updatedAt: nowIso(),
  };
  const withStatusTimestamps = applyStatusTimestamps(withUpdatedAt, previous);
  const updated = ensureDocumentRefId(withStatusTimestamps);
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
  const id = nextId("doc");

  const sectionByType =
    type === "contract" ? contractSections(request) : type === "ate" ? ateSections(request) : quoteSections(request);

  const titlePrefix = type === "quote" ? "Offert" : type === "contract" ? "Avtal" : "ÄTA";

  return {
    id,
    refId: "",
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
    linkedFileIds: [],
    attachments: [],
    sections: sectionByType,
  };
}

export function createNextVersion(documentId: string): PlatformDocument | null {
  const current = getDocumentById(documentId);
  if (!current) return null;

  const now = nowIso();
  const nextVersion: PlatformDocument = ensureDocumentRefId({
    ...current,
    id: nextId("doc"),
    refId: "",
    status: "draft",
    version: current.version + 1,
    createdAt: now,
    updatedAt: now,
    sentAt: undefined,
    acceptedAt: undefined,
    rejectedAt: undefined,
    title: `${current.title.split("(v")[0].trim()} (v${current.version + 1})`,
  });

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
