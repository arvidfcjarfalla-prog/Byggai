import {
  listDocumentsByRequest,
  type PlatformDocument,
} from "../documents-store";
import type { ProjectFile } from "../project-files/types";
import {
  listRequestMessages,
  type RequestMessage,
  type RequestMessageType,
} from "../request-messages";
import { listRequests, type PlatformRequest } from "../requests-store";
import type {
  TimelineAction,
  TimelineEvent,
  TimelineEventFilter,
  TimelineMilestone,
  TimelineModel,
  TimelineRole,
} from "./types";

export interface TimelineBuilderSources {
  request?: PlatformRequest | null;
  documents?: PlatformDocument[];
  files?: ProjectFile[];
  messages?: RequestMessage[];
}

export function buildProjectTimeline(input: {
  projectId: string;
  role: TimelineRole;
  sources?: TimelineBuilderSources;
}): TimelineModel {
  const { projectId, role, sources } = input;

  const request =
    sources?.request !== undefined
      ? sources.request
      : listRequests().find((entry) => entry.id === projectId) ?? null;
  const documents = sources?.documents ?? listDocumentsByRequest(projectId);
  const files = sources?.files ?? [];
  const messages = sources?.messages ?? listRequestMessages(projectId);

  const requestHref = requestLink(role, projectId);
  const documentHref = (documentId: string) => documentLink(role, documentId);
  const filesHref = filesLink(role);
  const messagesHref = messagesLink(role, projectId);

  const quoteDocs = documents.filter((doc) => doc.type === "quote");
  const contractDocs = documents.filter((doc) => doc.type === "contract");
  const ataDocs = documents.filter((doc) => doc.type === "ate");

  const requestSentAt = resolveRequestSentAt(request);
  const quoteCreatedAt = firstValidTimestamp(quoteDocs.map((doc) => doc.createdAt));
  const quoteDecisionAt = firstValidTimestamp(
    quoteDocs.flatMap((doc) => [
      doc.acceptedAt,
      doc.rejectedAt,
      doc.status === "accepted" || doc.status === "rejected" ? doc.updatedAt : null,
    ])
  );
  const contractCreatedAt = firstValidTimestamp(contractDocs.map((doc) => doc.createdAt));
  const contractConfirmedAt = firstValidTimestamp(
    contractDocs.flatMap((doc) => [
      doc.acceptedAt,
      doc.sentAt,
      doc.status === "accepted" || doc.status === "sent" ? doc.updatedAt : null,
    ])
  );
  const planningReady = hasPlanningData(request);
  const planningAt = planningReady
    ? normalizeIso(request?.desiredStart) ?? normalizeIso(request?.createdAt)
    : null;
  const ataCreatedAt = firstValidTimestamp(ataDocs.map((doc) => doc.createdAt));
  const ataApprovedAt = firstValidTimestamp(
    ataDocs.flatMap((doc) => [doc.acceptedAt, doc.status === "accepted" ? doc.updatedAt : null])
  );
  const workInProgressAt = firstValidTimestamp([
    contractConfirmedAt,
    ataCreatedAt,
    firstValidTimestamp(
      files
        .filter((file) => file.sourceType === "manual" || Boolean(file.recipientWorkspaceId))
        .map((file) => file.createdAt)
    ),
  ]);
  const completedAt =
    request?.status === "received"
      ? firstValidTimestamp([ataApprovedAt, contractConfirmedAt])
      : null;

  const seeds: Array<{
    id: string;
    label: string;
    done: boolean;
    completedAt: string | null;
    optional?: boolean;
  }> = [
    {
      id: "project-created",
      label: "Projekt skapat",
      done: Boolean(request),
      completedAt: normalizeIso(request?.createdAt),
    },
    {
      id: "request-created",
      label: "Anbudsförfrågan skapad",
      done: Boolean(request),
      completedAt: normalizeIso(request?.createdAt),
    },
    {
      id: "request-sent",
      label: "Anbudsförfrågan skickad",
      done: Boolean(requestSentAt),
      completedAt: requestSentAt,
    },
    {
      id: "qa",
      label: "Frågor/svar (valfritt)",
      done: messages.length > 0,
      completedAt: firstValidTimestamp(messages.map((message) => message.createdAt)),
      optional: true,
    },
    {
      id: "quote-shared",
      label: role === "entreprenor" ? "Offert skickad" : "Offert mottagen",
      done: quoteDocs.length > 0,
      completedAt: quoteCreatedAt,
    },
    {
      id: "quote-decision",
      label: "Offert accepterad / avvisad",
      done: Boolean(quoteDecisionAt),
      completedAt: quoteDecisionAt,
    },
    {
      id: "contract-created",
      label: "Avtal skapat",
      done: contractDocs.length > 0,
      completedAt: contractCreatedAt,
    },
    {
      id: "contract-confirmed",
      label: "Avtal signerat / bekräftat",
      done: Boolean(contractConfirmedAt),
      completedAt: contractConfirmedAt,
    },
    {
      id: "planning",
      label: "Planering (startdatum satt)",
      done: planningReady,
      completedAt: planningAt,
    },
    {
      id: "work-in-progress",
      label: "Pågående arbete",
      done: Boolean(workInProgressAt),
      completedAt: workInProgressAt,
    },
    {
      id: "ata",
      label: "ÄTA skapad / godkänd",
      done: ataDocs.length > 0,
      completedAt: firstValidTimestamp([ataApprovedAt, ataCreatedAt]),
      optional: true,
    },
    {
      id: "completed",
      label: "Slutfört / avslutat",
      done: Boolean(completedAt),
      completedAt,
    },
  ];

  const progressDone = seeds.map((seed, index) => {
    if (seed.done) return true;
    if (!seed.optional) return false;
    return seeds.slice(index + 1).some((later) => later.done);
  });

  const firstTodoIndex = progressDone.findIndex((done) => !done);
  const allDone = firstTodoIndex === -1;

  const milestones: TimelineMilestone[] = seeds.map((seed, index) => {
    const state = allDone
      ? "done"
      : progressDone[index]
        ? "done"
        : index === firstTodoIndex
          ? "current"
          : "todo";

    return {
      id: seed.id,
      order: index + 1,
      label: seed.label,
      optional: seed.optional,
      state,
      ...(seed.completedAt ? { completedAt: seed.completedAt } : {}),
    };
  });

  const events: TimelineEvent[] = [];
  const addEvent = (event: Omit<TimelineEvent, "timestamp"> & { timestamp?: string | null }) => {
    events.push({
      ...event,
      timestamp: normalizeIso(event.timestamp),
    });
  };

  if (request) {
    addEvent({
      id: `request-created-${request.id}`,
      source: "request",
      timestamp: request.createdAt,
      label: `Anbudsförfrågan ${request.refId} skapad`,
      refId: request.refId,
      filters: [],
      link: { href: requestHref, label: "Öppna förfrågan" },
    });

    if (requestSentAt) {
      addEvent({
        id: `request-sent-${request.id}`,
        source: "request",
        timestamp: requestSentAt,
        label: `Anbudsförfrågan ${request.refId} skickad`,
        refId: request.refId,
        filters: [],
        link: { href: requestHref, label: "Öppna förfrågan" },
      });
    }
  }

  (request?.recipients ?? []).forEach((recipient) => {
    addEvent({
      id: `recipient-${request?.id ?? projectId}-${recipient.id}`,
      source: "request",
      timestamp: recipient.sentAt,
      label: `Förfrågan skickad till ${recipient.companyName}`,
      filters: [],
      link: { href: requestHref, label: "Öppna förfrågan" },
    });
  });

  documents.forEach((document) => {
    const typeLabel = documentTypeLabel(document.type);
    const refLabel = document.refId || document.id;
    const baseFilters = documentFilters(document.type);

    addEvent({
      id: `document-created-${document.id}`,
      source: "document",
      timestamp: document.createdAt,
      label: `${typeLabel} ${refLabel} skapad`,
      refId: document.refId || undefined,
      filters: baseFilters,
      link: { href: documentHref(document.id), label: "Öppna dokument" },
    });

    if (document.sentAt) {
      addEvent({
        id: `document-sent-${document.id}`,
        source: "document",
        timestamp: document.sentAt,
        label: `${typeLabel} ${refLabel} skickad`,
        refId: document.refId || undefined,
        filters: baseFilters,
        link: { href: documentHref(document.id), label: "Öppna dokument" },
      });
    }

    if (document.acceptedAt) {
      addEvent({
        id: `document-accepted-${document.id}`,
        source: "document",
        timestamp: document.acceptedAt,
        label: `${typeLabel} ${refLabel} godkänd`,
        refId: document.refId || undefined,
        filters: baseFilters,
        link: { href: documentHref(document.id), label: "Öppna dokument" },
      });
    }

    if (document.rejectedAt) {
      addEvent({
        id: `document-rejected-${document.id}`,
        source: "document",
        timestamp: document.rejectedAt,
        label: `${typeLabel} ${refLabel} avvisad`,
        refId: document.refId || undefined,
        filters: baseFilters,
        link: { href: documentHref(document.id), label: "Öppna dokument" },
      });
    }
  });

  files.forEach((file) => {
    const refLabel = file.refId || file.id;
    const folder = folderLabel(file.folder);
    const fromDocument = file.sourceType !== "manual";

    const filters: TimelineEventFilter[] = fromDocument
      ? ["filer", "dokument"]
      : ["filer"];
    if (file.sourceType === "ata" || file.folder === "ata") {
      filters.push("ata");
    }

    const fileLabel = fromDocument
      ? `${sourceTypeLabel(file.sourceType)} PDF ${refLabel} skapad i ${folder}`
      : `Bilaga ${refLabel} uppladdad i ${folder}`;

    addEvent({
      id: `file-${file.id}`,
      source: "file",
      timestamp: file.createdAt,
      label: fileLabel,
      refId: file.refId || undefined,
      filters: Array.from(new Set(filters)),
      link: { href: filesHref, label: "Öppna filer" },
    });
  });

  messages.forEach((message) => {
    addEvent({
      id: `message-${message.id}`,
      source: "message",
      timestamp: message.createdAt,
      label: `${messagePrefix(message.messageType)} skickat av ${message.authorLabel}`,
      filters: ["meddelanden"],
      link: { href: messagesHref, label: "Öppna meddelanden" },
    });
  });

  const sortedEvents = events
    .slice()
    .sort((a, b) => compareTimestampDesc(a.timestamp, b.timestamp) || a.label.localeCompare(b.label, "sv"));

  return {
    projectId,
    projectTitle: request?.title || "Projekt",
    role,
    milestones,
    currentMilestoneId: allDone ? null : milestones[firstTodoIndex]?.id || null,
    events: sortedEvents,
    actions: roleActions(role, projectId),
    generatedAt: new Date().toISOString(),
  };
}

function resolveRequestSentAt(request: PlatformRequest | null): string | null {
  if (!request) return null;
  const recipientSentAt = firstValidTimestamp((request.recipients ?? []).map((recipient) => recipient.sentAt));
  if (recipientSentAt) return recipientSentAt;
  if (request.status === "sent" || request.status === "received") {
    return normalizeIso(request.createdAt);
  }
  return null;
}

function hasPlanningData(request: PlatformRequest | null): boolean {
  if (!request) return false;
  const value = request.desiredStart?.trim().toLowerCase() ?? "";
  if (!value) return false;
  if (value.includes("ej angiv") || value.includes("saknas")) return false;
  return true;
}

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function firstValidTimestamp(values: Array<unknown>): string | null {
  const normalized = values
    .map((value) => normalizeIso(value))
    .filter((value): value is string => value !== null)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return normalized[0] ?? null;
}

function compareTimestampDesc(a: string | null, b: string | null): number {
  const aValue = a ? Date.parse(a) : Number.NEGATIVE_INFINITY;
  const bValue = b ? Date.parse(b) : Number.NEGATIVE_INFINITY;
  return bValue - aValue;
}

function roleDashboardSegment(role: TimelineRole): "entreprenor" | "brf" | "privat" {
  if (role === "entreprenor") return "entreprenor";
  if (role === "brf") return "brf";
  return "privat";
}

function requestLink(role: TimelineRole, projectId: string): string {
  const segment = roleDashboardSegment(role);
  if (segment === "entreprenor") {
    return `/dashboard/entreprenor/forfragningar?requestId=${encodeURIComponent(projectId)}`;
  }
  return `/dashboard/${segment}/forfragningar`;
}

function documentLink(role: TimelineRole, documentId: string): string {
  if (role === "entreprenor") {
    return `/dashboard/entreprenor/dokument/${encodeURIComponent(documentId)}`;
  }
  const segment = roleDashboardSegment(role);
  return `/dashboard/${segment}/dokument/${encodeURIComponent(documentId)}`;
}

function filesLink(role: TimelineRole): string {
  const segment = roleDashboardSegment(role);
  return `/dashboard/${segment}/filer`;
}

function messagesLink(role: TimelineRole, projectId: string): string {
  if (role === "entreprenor") {
    return `/dashboard/entreprenor/meddelanden?requestId=${encodeURIComponent(projectId)}`;
  }
  const segment = roleDashboardSegment(role);
  return `/dashboard/${segment}/meddelanden`;
}

function roleActions(role: TimelineRole, projectId: string): TimelineAction[] {
  if (role === "entreprenor") {
    const documentRoute = `/dashboard/entreprenor/dokument?requestId=${encodeURIComponent(projectId)}`;
    return [
      { id: "create-quote", label: "Skapa offert", href: documentRoute },
      { id: "send-quote", label: "Skicka offert", href: documentRoute },
      { id: "create-contract", label: "Skapa avtal", href: documentRoute },
      { id: "create-ata", label: "Skapa ÄTA", href: documentRoute },
      { id: "upload-attachment", label: "Ladda upp bilaga", href: "/dashboard/entreprenor/filer" },
    ];
  }

  const segment = roleDashboardSegment(role);
  const startRoute = role === "brf" ? "/brf/start" : "/start";
  const inboxRoute = `/dashboard/${segment}/dokument`;

  return [
    { id: "create-request", label: "Skapa anbudsförfrågan", href: startRoute },
    { id: "compare-quotes", label: "Jämför offerter", href: inboxRoute },
    { id: "accept-quote", label: "Acceptera offert", href: inboxRoute },
    { id: "sign-contract", label: "Läs/Signera avtal", href: inboxRoute },
    { id: "approve-ata", label: "Godkänn ÄTA", href: inboxRoute },
  ];
}

function documentTypeLabel(type: PlatformDocument["type"]): string {
  if (type === "quote") return "Offert";
  if (type === "contract") return "Avtal";
  return "ÄTA";
}

function documentFilters(type: PlatformDocument["type"]): TimelineEventFilter[] {
  if (type === "ate") return ["ata", "dokument"];
  return ["dokument"];
}

function sourceTypeLabel(type: ProjectFile["sourceType"]): string {
  if (type === "offert") return "Offert";
  if (type === "avtal") return "Avtal";
  if (type === "ata") return "ÄTA";
  return "Bilaga";
}

function folderLabel(folder: ProjectFile["folder"]): string {
  if (folder === "avtal") return "Avtal";
  if (folder === "offert") return "Offert";
  if (folder === "ata") return "ÄTA";
  if (folder === "bilder") return "Bilder";
  if (folder === "ritningar") return "Ritningar";
  return "Övrigt";
}

function messagePrefix(type: RequestMessageType): string {
  if (type === "question") return "Fråga";
  if (type === "clarification") return "Svar";
  if (type === "timeline") return "Tidplansmeddelande";
  if (type === "budget") return "Budgetmeddelande";
  if (type === "document") return "Dokumentmeddelande";
  return "Meddelande";
}
