import {
  formatSnapshotBudget,
  formatSnapshotTimeline,
  toSwedishRiskLabel,
  type ProjectSnapshot,
  type ProjectSnapshotFile,
} from "./project-snapshot";
import { ensureRegisteredRefId } from "./refid/registry";
import { validateRefId } from "./refid/validate";

export type RequestAudience = "brf" | "privat";
export type RequestStatus = "draft" | "sent" | "received";
export type RequestRecipientStatus = "sent" | "opened" | "responded" | "declined";

export interface ProcurementActionDetail {
  label: string;
  value: string;
}

export interface ProcurementAction {
  id: string;
  title: string;
  category: string;
  status: "Planerad" | "Eftersatt" | "Genomförd";
  plannedYear: number;
  estimatedPriceSek: number;
  emissionsKgCo2e: number;
  source?: "ai" | "local";
  details?: string;
  rawRow?: string;
  sourceSheet?: string;
  sourceRow?: number;
  extraDetails?: ProcurementActionDetail[];
}

export interface RequestPropertySnapshot {
  audience: RequestAudience;
  title: string;
  address: string;
  buildingYear?: string;
  apartmentsCount?: string;
  buildingsCount?: string;
  areaSummary?: string;
  occupancy?: string;
  accessAndLogistics?: string;
  knownConstraints?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface RequestDocumentSummaryItem {
  typeLabel: string;
  count: number;
}

export interface RequestDocumentSummary {
  totalFiles: number;
  byType: RequestDocumentSummaryItem[];
  highlights: string[];
}

export interface RequestFileRecord {
  id?: string;
  name: string;
  fileTypeLabel: string;
  extension: string;
  sizeKb: number;
  uploadedAt: string;
  sourceLabel: string;
  tags?: string[];
  linkedActionTitle?: string;
}

export interface RequestScopeItem {
  title: string;
  details?: string;
}

export interface RequestRecipient {
  id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  status: RequestRecipientStatus;
  sentAt: string;
}

export interface PlatformRequest {
  id: string;
  refId: string;
  createdAt: string;
  audience: RequestAudience;
  status: RequestStatus;
  requestType?: "offer_request_v1";
  title: string;
  location: string;
  desiredStart: string;
  budgetRange: string;
  scope: {
    actions?: ProcurementAction[];
    scopeItems?: RequestScopeItem[];
  };
  snapshot?: ProjectSnapshot;
  propertySnapshot?: RequestPropertySnapshot;
  documentSummary?: RequestDocumentSummary;
  files?: RequestFileRecord[];
  completeness: number;
  missingInfo: string[];
  replyDeadline?: string;
  distribution?: string[];
  recipients?: RequestRecipient[];
  sharingApproved: boolean;
  sharingApprovedAt?: string;

  // Backwards compatibility for already-built views.
  actions?: ProcurementAction[];
  documentationLevel?: string;
  riskProfile?: "Låg" | "Medel" | "Hög";
}

export const REQUESTS_STORAGE_KEY = "byggplattformen-procurement-requests";
export const REQUESTS_UPDATED_EVENT = "byggplattformen-procurement-updated";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(raw: unknown): RequestStatus {
  if (raw === "draft" || raw === "received") return raw;
  return "sent";
}

function normalizeSharingApproved(raw: unknown): boolean {
  return raw === true;
}

function normalizeSharingApprovedAt(raw: unknown, sharingApproved: boolean): string | undefined {
  if (!sharingApproved) return undefined;
  if (typeof raw !== "string") return undefined;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function normalizeCreatedAt(raw: unknown): string {
  if (typeof raw !== "string") return new Date().toISOString();
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function inferAudience(raw: Record<string, unknown>): RequestAudience {
  if (raw.audience === "privat" || raw.audience === "brf") {
    return raw.audience;
  }

  if (isObject(raw.snapshot) && raw.snapshot.audience === "privat") return "privat";
  if (isObject(raw.propertySnapshot) && raw.propertySnapshot.audience === "privat") {
    return "privat";
  }

  return "brf";
}

function mapLegacySnapshotFile(file: ProjectSnapshotFile): RequestFileRecord {
  const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  return {
    id: file.id,
    name: file.name,
    fileTypeLabel: file.type || "Okänd",
    extension,
    sizeKb: Number((file.size / 1024).toFixed(1)),
    uploadedAt: new Date().toISOString(),
    sourceLabel: "ProjectSnapshot",
    tags: [...file.tags],
  };
}

function normalizeRecipientStatus(raw: unknown): RequestRecipientStatus {
  if (raw === "opened" || raw === "responded" || raw === "declined") return raw;
  return "sent";
}

function toRecipientId(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : `recipient-${Date.now()}`;
}

function parseDistributionLabel(label: string): {
  companyName: string;
  email?: string;
} {
  const trimmed = label.trim();
  const angleEmailMatch = trimmed.match(/^(.*)<([^>]+)>$/);
  if (angleEmailMatch) {
    return {
      companyName: angleEmailMatch[1].trim() || "Entreprenör",
      email: angleEmailMatch[2].trim(),
    };
  }

  const pipeSplit = trimmed.split("|");
  if (pipeSplit.length >= 2) {
    return {
      companyName: pipeSplit[0]?.trim() || "Entreprenör",
      email: pipeSplit.slice(1).join("|").trim() || undefined,
    };
  }

  return { companyName: trimmed || "Entreprenör" };
}

function normalizeRecipients(
  rawRecipients: unknown,
  distribution: string[],
  createdAt: string
): RequestRecipient[] {
  const fromRecipients = Array.isArray(rawRecipients)
    ? rawRecipients
        .map((entry, index) => {
          if (!isObject(entry)) return undefined;
          const companyName =
            typeof entry.companyName === "string" && entry.companyName.trim().length > 0
              ? entry.companyName.trim()
              : "Entreprenör";
          const email =
            typeof entry.email === "string" && entry.email.trim().length > 0
              ? entry.email.trim()
              : undefined;
          const contactName =
            typeof entry.contactName === "string" && entry.contactName.trim().length > 0
              ? entry.contactName.trim()
              : undefined;
          const id =
            typeof entry.id === "string" && entry.id.trim().length > 0
              ? entry.id
              : toRecipientId(`${companyName}-${email ?? index}`);
          const recipient: RequestRecipient = {
            id,
            companyName,
            status: normalizeRecipientStatus(entry.status),
            sentAt:
              typeof entry.sentAt === "string" && entry.sentAt.length > 0
                ? entry.sentAt
                : createdAt,
          };
          if (contactName) recipient.contactName = contactName;
          if (email) recipient.email = email;
          return recipient;
        })
        .filter((entry): entry is RequestRecipient => entry !== undefined)
    : [];

  if (fromRecipients.length > 0) return fromRecipients;

  if (distribution.length > 0) {
    return distribution.map((label, index) => {
      const parsed = parseDistributionLabel(label);
      return {
        id: toRecipientId(`${parsed.companyName}-${parsed.email ?? index}`),
        companyName: parsed.companyName,
        email: parsed.email,
        status: "sent",
        sentAt: createdAt,
      };
    });
  }

  return [];
}

export function toRecipientLabel(recipient: RequestRecipient): string {
  if (recipient.email) {
    return `${recipient.companyName} <${recipient.email}>`;
  }
  return recipient.companyName;
}

export function defaultRecipientsForAudience(audience: RequestAudience): RequestRecipient[] {
  const now = new Date().toISOString();
  if (audience === "brf") {
    return [
      {
        id: "rec-brf-1",
        companyName: "Nord Bygg & Renovering AB",
        email: "anbud@nordbygg.se",
        status: "sent",
        sentAt: now,
      },
      {
        id: "rec-brf-2",
        companyName: "Trygg Fastighetsentreprenad",
        email: "offert@tryggfastighet.se",
        status: "sent",
        sentAt: now,
      },
      {
        id: "rec-brf-3",
        companyName: "Stad & Stomme Projekt AB",
        email: "upphandling@stadstomme.se",
        status: "sent",
        sentAt: now,
      },
    ];
  }

  return [
    {
      id: "rec-pri-1",
      companyName: "HemmaBygg Entreprenad",
      email: "offert@hemmabygg.se",
      status: "sent",
      sentAt: now,
    },
    {
      id: "rec-pri-2",
      companyName: "Trygg Renovering i Sverige",
      email: "projekt@tryggrenovering.se",
      status: "sent",
      sentAt: now,
    },
    {
      id: "rec-pri-3",
      companyName: "Nordic Kök & Bad AB",
      email: "anbud@nordickokbad.se",
      status: "sent",
      sentAt: now,
    },
  ];
}

function normalizeFiles(
  rawFiles: unknown,
  snapshot: ProjectSnapshot | undefined,
  createdAt: string
): RequestFileRecord[] {
  const normalizedFromRaw = Array.isArray(rawFiles)
    ? rawFiles
        .map((item) => {
          if (!isObject(item)) return undefined;
          const name = typeof item.name === "string" ? item.name : "Dokument";
          const extension =
            typeof item.extension === "string"
              ? item.extension
              : name.includes(".")
                ? name.split(".").pop() ?? ""
                : "";
          const sizeKb =
            typeof item.sizeKb === "number" && Number.isFinite(item.sizeKb)
              ? item.sizeKb
              : 0;
          const uploadedAt =
            typeof item.uploadedAt === "string" && item.uploadedAt.length > 0
              ? item.uploadedAt
              : createdAt;

          const record: RequestFileRecord = {
            id: typeof item.id === "string" ? item.id : undefined,
            name,
            fileTypeLabel:
              typeof item.fileTypeLabel === "string" && item.fileTypeLabel.length > 0
                ? item.fileTypeLabel
                : "Okänd",
            extension,
            sizeKb,
            uploadedAt,
            sourceLabel:
              typeof item.sourceLabel === "string" && item.sourceLabel.length > 0
                ? item.sourceLabel
                : "Manuell uppladdning",
            tags: Array.isArray(item.tags)
              ? item.tags.filter((tag): tag is string => typeof tag === "string")
              : undefined,
            linkedActionTitle:
              typeof item.linkedActionTitle === "string" ? item.linkedActionTitle : undefined,
          };
          return record;
        })
        .filter((item): item is RequestFileRecord => item !== undefined)
    : ([] as RequestFileRecord[]);

  if (normalizedFromRaw.length > 0) {
    return normalizedFromRaw;
  }

  if (snapshot && Array.isArray(snapshot.files) && snapshot.files.length > 0) {
    return snapshot.files.map(mapLegacySnapshotFile).map((file) => ({
      ...file,
      uploadedAt: createdAt,
    }));
  }

  return [];
}

function normalizeActions(rawActions: unknown): ProcurementAction[] {
  if (!Array.isArray(rawActions)) return [];

  const normalized = rawActions
    .map((item, index) => {
      if (!isObject(item)) return undefined;

      const rawStatus = item.status;
      const normalizedStatus: ProcurementAction["status"] =
        rawStatus === "Eftersatt" || rawStatus === "Genomförd"
          ? rawStatus
          : "Planerad";

      const title = typeof item.title === "string" && item.title.trim().length > 0
        ? item.title.trim()
        : `Åtgärd ${index + 1}`;

      const action: ProcurementAction = {
        id: typeof item.id === "string" ? item.id : `action-${Date.now()}-${index}`,
        title,
        category:
          typeof item.category === "string" && item.category.trim().length > 0
            ? item.category
            : "Övrigt",
        status: normalizedStatus,
        plannedYear:
          typeof item.plannedYear === "number" && Number.isFinite(item.plannedYear)
            ? item.plannedYear
            : new Date().getFullYear(),
        estimatedPriceSek:
          typeof item.estimatedPriceSek === "number" && Number.isFinite(item.estimatedPriceSek)
            ? item.estimatedPriceSek
            : 0,
        emissionsKgCo2e:
          typeof item.emissionsKgCo2e === "number" && Number.isFinite(item.emissionsKgCo2e)
            ? item.emissionsKgCo2e
            : 0,
        source: item.source === "ai" ? "ai" : "local",
        details: typeof item.details === "string" ? item.details : undefined,
        rawRow: typeof item.rawRow === "string" ? item.rawRow : undefined,
        sourceSheet: typeof item.sourceSheet === "string" ? item.sourceSheet : undefined,
        sourceRow:
          typeof item.sourceRow === "number" && Number.isFinite(item.sourceRow)
            ? item.sourceRow
            : undefined,
        extraDetails: Array.isArray(item.extraDetails)
          ? item.extraDetails
              .map((detail) => {
                if (!isObject(detail)) return null;
                const label = typeof detail.label === "string" ? detail.label : "Fält";
                const value = typeof detail.value === "string" ? detail.value : "";
                return { label, value };
              })
              .filter((detail): detail is ProcurementActionDetail => detail !== null)
          : undefined,
      };
      return action;
    })
    .filter((item): item is ProcurementAction => item !== undefined);

  return normalized;
}

function normalizeScope(
  raw: Record<string, unknown>,
  snapshot: ProjectSnapshot | undefined
): PlatformRequest["scope"] {
  const rawScope: Record<string, unknown> | undefined = isObject(raw.scope) ? raw.scope : undefined;
  const legacyActions = normalizeActions(raw.actions);

  const actions = normalizeActions(rawScope?.actions ?? legacyActions);
  const scopeItemsFromRaw: Array<RequestScopeItem | undefined> = Array.isArray(rawScope?.scopeItems)
    ? rawScope?.scopeItems
        .map((item) => {
          if (!isObject(item)) return undefined;
          const title = typeof item.title === "string" ? item.title.trim() : "";
          if (!title) return undefined;
          const scopeItem: RequestScopeItem = {
            title,
            details: typeof item.details === "string" ? item.details : undefined,
          };
          return scopeItem;
        })
        .filter((item): item is RequestScopeItem => item !== undefined)
    : [];

  const scopeItemsFromSnapshot = snapshot
    ? snapshot.scope.selectedItems.map((item) => ({ title: item }))
    : [];
  const cleanedScopeItems = scopeItemsFromRaw.filter(
    (item): item is RequestScopeItem => item !== undefined
  );

  const scopeItems =
    cleanedScopeItems.length > 0
      ? cleanedScopeItems
      : scopeItemsFromSnapshot.length > 0
        ? scopeItemsFromSnapshot
        : actions.map((action) => ({ title: action.title }));

  return {
    actions,
    scopeItems,
  };
}

function normalizePropertySnapshot(
  raw: unknown,
  audience: RequestAudience,
  locationFallback: string
): RequestPropertySnapshot | undefined {
  if (!isObject(raw)) return undefined;

  const title = typeof raw.title === "string" && raw.title.trim().length > 0
    ? raw.title
    : "Projektunderlag";

  const address =
    typeof raw.address === "string" && raw.address.trim().length > 0
      ? raw.address
      : locationFallback;

  return {
    audience,
    title,
    address,
    buildingYear: typeof raw.buildingYear === "string" ? raw.buildingYear : undefined,
    apartmentsCount:
      typeof raw.apartmentsCount === "string" ? raw.apartmentsCount : undefined,
    buildingsCount:
      typeof raw.buildingsCount === "string" ? raw.buildingsCount : undefined,
    areaSummary: typeof raw.areaSummary === "string" ? raw.areaSummary : undefined,
    occupancy: typeof raw.occupancy === "string" ? raw.occupancy : undefined,
    accessAndLogistics:
      typeof raw.accessAndLogistics === "string" ? raw.accessAndLogistics : undefined,
    knownConstraints:
      typeof raw.knownConstraints === "string" ? raw.knownConstraints : undefined,
    contactName: typeof raw.contactName === "string" ? raw.contactName : undefined,
    contactEmail: typeof raw.contactEmail === "string" ? raw.contactEmail : undefined,
    contactPhone: typeof raw.contactPhone === "string" ? raw.contactPhone : undefined,
  };
}

function normalizeDocumentSummary(
  rawSummary: unknown,
  files: RequestFileRecord[]
): RequestDocumentSummary {
  if (isObject(rawSummary)) {
    const byType = Array.isArray(rawSummary.byType)
      ? rawSummary.byType
          .map((item) => {
            if (!isObject(item)) return null;
            const typeLabel =
              typeof item.typeLabel === "string" && item.typeLabel.length > 0
                ? item.typeLabel
                : "Okänd";
            const count =
              typeof item.count === "number" && Number.isFinite(item.count)
                ? item.count
                : 0;
            return { typeLabel, count };
          })
          .filter((item): item is RequestDocumentSummaryItem => item !== null)
      : [];

    const totalFiles =
      typeof rawSummary.totalFiles === "number" && Number.isFinite(rawSummary.totalFiles)
        ? rawSummary.totalFiles
        : files.length;

    const highlights = Array.isArray(rawSummary.highlights)
      ? rawSummary.highlights.filter((item): item is string => typeof item === "string")
      : [];

    if (byType.length > 0 || highlights.length > 0) {
      return { totalFiles, byType, highlights };
    }
  }

  const byTypeMap = files.reduce<Record<string, number>>((acc, file) => {
    const key = file.fileTypeLabel || "Okänd";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byType = Object.entries(byTypeMap)
    .map(([typeLabel, count]) => ({ typeLabel, count }))
    .sort((a, b) => b.count - a.count || a.typeLabel.localeCompare(b.typeLabel, "sv"));

  return {
    totalFiles: files.length,
    byType,
    highlights: byType.slice(0, 3).map((entry) => `${entry.typeLabel}: ${entry.count} st`),
  };
}

function deriveCompleteness(
  raw: Record<string, unknown>,
  snapshot: ProjectSnapshot | undefined,
  scope: PlatformRequest["scope"],
  files: RequestFileRecord[]
): number {
  if (typeof raw.completeness === "number" && Number.isFinite(raw.completeness)) {
    return Math.max(0, Math.min(100, Math.round(raw.completeness)));
  }
  if (snapshot && Number.isFinite(snapshot.completenessScore)) {
    return Math.max(0, Math.min(100, Math.round(snapshot.completenessScore)));
  }

  const checks = [
    typeof raw.title === "string" && raw.title.trim().length >= 3,
    typeof raw.location === "string" && raw.location.trim().length >= 3,
    (scope.actions?.length ?? 0) > 0 || (scope.scopeItems?.length ?? 0) > 0,
    typeof raw.budgetRange === "string" && raw.budgetRange.trim().length > 0,
    typeof raw.desiredStart === "string" && raw.desiredStart.trim().length > 0,
    files.length > 0,
  ];

  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function deriveMissingInfo(
  raw: Record<string, unknown>,
  scope: PlatformRequest["scope"],
  files: RequestFileRecord[]
): string[] {
  if (Array.isArray(raw.missingInfo)) {
    const fromRaw = raw.missingInfo.filter((item): item is string => typeof item === "string");
    if (fromRaw.length > 0) return fromRaw;
  }

  const missing: string[] = [];

  if (!(typeof raw.title === "string" && raw.title.trim().length >= 3)) {
    missing.push("Projektets titel eller beskrivning behöver förtydligas.");
  }

  if (!(typeof raw.location === "string" && raw.location.trim().length > 0)) {
    missing.push("Adress/område saknas.");
  }

  if ((scope.actions?.length ?? 0) === 0 && (scope.scopeItems?.length ?? 0) === 0) {
    missing.push("Ingen tydlig åtgärd eller omfattning vald.");
  }

  if (!(typeof raw.budgetRange === "string" && raw.budgetRange.trim().length > 0)) {
    missing.push("Budgetspann saknas eller är oklart.");
  }

  if (!(typeof raw.desiredStart === "string" && raw.desiredStart.trim().length > 0)) {
    missing.push("Startfönster saknas.");
  }

  if (files.length === 0) {
    missing.push("Inga underlagsfiler uppladdade.");
  }

  return missing;
}

function normalizeSnapshot(raw: unknown): ProjectSnapshot | undefined {
  if (!isObject(raw)) return undefined;
  if (typeof raw.id !== "string") return undefined;
  if (!isObject(raw.overview) || !isObject(raw.scope) || !isObject(raw.timeline)) {
    return undefined;
  }
  return raw as unknown as ProjectSnapshot;
}

function normalizeRequest(rawInput: unknown): PlatformRequest | null {
  if (!isObject(rawInput)) return null;

  const audience = inferAudience(rawInput);
  const snapshot = normalizeSnapshot(rawInput.snapshot);
  const createdAt = normalizeCreatedAt(rawInput.createdAt);
  const scope = normalizeScope(rawInput, snapshot);

  const title =
    typeof rawInput.title === "string" && rawInput.title.trim().length > 0
      ? rawInput.title
      : snapshot?.overview.title || "Projektförfrågan";

  const location =
    typeof rawInput.location === "string" && rawInput.location.trim().length > 0
      ? rawInput.location
      : snapshot?.overview.location || "Ej angiven plats";

  const budgetRange =
    typeof rawInput.budgetRange === "string" && rawInput.budgetRange.trim().length > 0
      ? rawInput.budgetRange
      : snapshot
        ? formatSnapshotBudget(snapshot)
        : "Budget ej angiven";

  const desiredStart =
    typeof rawInput.desiredStart === "string" && rawInput.desiredStart.trim().length > 0
      ? rawInput.desiredStart
      : snapshot
        ? formatSnapshotTimeline(snapshot)
        : "Startfönster ej angivet";

  const distribution = Array.isArray(rawInput.distribution)
    ? rawInput.distribution.filter((item): item is string => typeof item === "string")
    : [];
  const recipients = normalizeRecipients(rawInput.recipients, distribution, createdAt);
  const normalizedDistribution =
    distribution.length > 0 ? distribution : recipients.map((recipient) => toRecipientLabel(recipient));

  const files = normalizeFiles(rawInput.files, snapshot, createdAt);
  const completeness = deriveCompleteness(rawInput, snapshot, scope, files);
  const missingInfo = deriveMissingInfo(rawInput, scope, files);

  const id =
    typeof rawInput.id === "string" && rawInput.id.trim().length > 0
      ? rawInput.id
      : `req-${Date.now()}`;
  const refId = ensureRegisteredRefId({
    existingRefId:
      typeof rawInput.refId === "string" && validateRefId(rawInput.refId)
        ? rawInput.refId
        : undefined,
    kind: "DOC",
    id,
    projectId: id,
  });

  const status = normalizeStatus(rawInput.status);
  const sharingApproved = normalizeSharingApproved(rawInput.sharingApproved);
  const sharingApprovedAt = normalizeSharingApprovedAt(rawInput.sharingApprovedAt, sharingApproved);

  const documentationLevel =
    typeof rawInput.documentationLevel === "string" && rawInput.documentationLevel.trim().length > 0
      ? rawInput.documentationLevel
      : `${files.length} filer i underlag`;

  const riskProfile = snapshot
    ? toSwedishRiskLabel(snapshot.riskProfile.level)
    : rawInput.riskProfile === "Hög" || rawInput.riskProfile === "Medel"
      ? rawInput.riskProfile
      : "Låg";

  const actions = scope.actions ?? [];

  const request: PlatformRequest = {
    id,
    refId,
    createdAt,
    audience,
    status,
    requestType: rawInput.requestType === "offer_request_v1" ? "offer_request_v1" : "offer_request_v1",
    title,
    location,
    desiredStart,
    budgetRange,
    scope,
    snapshot,
    propertySnapshot: normalizePropertySnapshot(rawInput.propertySnapshot, audience, location),
    documentSummary: normalizeDocumentSummary(rawInput.documentSummary, files),
    files,
    completeness,
    missingInfo,
    replyDeadline:
      typeof rawInput.replyDeadline === "string" ? rawInput.replyDeadline : undefined,
    distribution: normalizedDistribution.length > 0 ? normalizedDistribution : undefined,
    recipients: recipients.length > 0 ? recipients : undefined,
    sharingApproved,
    sharingApprovedAt,
    actions,
    documentationLevel,
    riskProfile,
  };

  return request;
}

function writeAllRequests(requests: PlatformRequest[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
}

function requestDateValue(request: PlatformRequest): number {
  const parsed = Date.parse(request.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function listRequests(): PlatformRequest[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeRequest(item))
      .filter((item): item is PlatformRequest => item !== null)
      .sort((a, b) => requestDateValue(b) - requestDateValue(a));
  } catch {
    return [];
  }
}

export function replaceRequests(requests: PlatformRequest[]): PlatformRequest[] {
  const normalized = requests
    .map((request) => normalizeRequest(request))
    .filter((request): request is PlatformRequest => request !== null)
    .sort((a, b) => requestDateValue(b) - requestDateValue(a));

  writeAllRequests(normalized);
  return normalized;
}

export function saveRequest(request: PlatformRequest): PlatformRequest[] {
  const normalized = normalizeRequest(request);
  if (!normalized) return listRequests();

  const existing = listRequests().filter((item) => item.id !== normalized.id);
  const next = [normalized, ...existing];
  writeAllRequests(next);
  return next;
}

export function subscribeRequests(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === REQUESTS_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(REQUESTS_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(REQUESTS_UPDATED_EVENT, callback);
  };
}

export function setRequestPropertySharingApproval(
  requestId: string,
  sharingApproved: boolean
): PlatformRequest | null {
  const existing = listRequests();
  if (existing.length === 0) return null;

  const now = new Date().toISOString();
  const next = existing.map((request) => {
    if (request.id !== requestId) return request;
    return {
      ...request,
      sharingApproved,
      sharingApprovedAt: sharingApproved ? now : undefined,
    };
  });

  const updated = replaceRequests(next);
  return updated.find((request) => request.id === requestId) || null;
}
