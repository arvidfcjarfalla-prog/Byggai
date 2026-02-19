export type ConversationActorRole = "brf" | "privatperson" | "entreprenor" | "system";
export type RequestMessageType =
  | "general"
  | "question"
  | "clarification"
  | "timeline"
  | "budget"
  | "document";

export interface RequestMessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeKb: number;
  dataUrl: string;
  kind: "image" | "file";
  uploadedAt: string;
}

export interface RequestMessage {
  id: string;
  requestId: string;
  authorRole: ConversationActorRole;
  authorLabel: string;
  body: string;
  messageType: RequestMessageType;
  createdAt: string;
  attachments: RequestMessageAttachment[];
}

export interface RequestConversation {
  requestId: string;
  createdAt: string;
  updatedAt: string;
  messages: RequestMessage[];
  unreadByRole: Partial<Record<ConversationActorRole, number>>;
}

export interface SendRequestMessageInput {
  requestId: string;
  authorRole: ConversationActorRole;
  authorLabel: string;
  body: string;
  messageType: RequestMessageType;
  attachments?: RequestMessageAttachment[];
  targetRoles?: ConversationActorRole[];
}

export interface AttachmentConversionResult {
  attachments: RequestMessageAttachment[];
  errors: string[];
}

const MESSAGE_STORAGE_KEY = "byggplattformen-request-messages-v1";
export const REQUEST_MESSAGES_UPDATED_EVENT = "byggplattformen-request-messages-updated";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 12 * 1024 * 1024;

function nowIso(): string {
  return new Date().toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toMessageType(raw: unknown): RequestMessageType {
  if (
    raw === "question" ||
    raw === "clarification" ||
    raw === "timeline" ||
    raw === "budget" ||
    raw === "document"
  ) {
    return raw;
  }
  return "general";
}

function toRole(raw: unknown): ConversationActorRole {
  if (raw === "brf" || raw === "privatperson" || raw === "entreprenor" || raw === "system") {
    return raw;
  }
  return "system";
}

function normalizeAttachment(raw: unknown): RequestMessageAttachment | null {
  if (!isObject(raw)) return null;
  const name = typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name.trim() : "Bilaga";
  const dataUrl = typeof raw.dataUrl === "string" ? raw.dataUrl : "";
  if (!dataUrl) return null;
  return {
    id: typeof raw.id === "string" ? raw.id : `attachment-${Date.now()}`,
    name,
    mimeType: typeof raw.mimeType === "string" ? raw.mimeType : "application/octet-stream",
    sizeKb:
      typeof raw.sizeKb === "number" && Number.isFinite(raw.sizeKb) ? Math.max(0, raw.sizeKb) : 0,
    dataUrl,
    kind: raw.kind === "image" ? "image" : "file",
    uploadedAt: typeof raw.uploadedAt === "string" ? raw.uploadedAt : nowIso(),
  };
}

function normalizeMessage(raw: unknown, requestId: string): RequestMessage | null {
  if (!isObject(raw)) return null;
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .map((item) => normalizeAttachment(item))
        .filter((item): item is RequestMessageAttachment => item !== null)
    : [];

  if (body.length === 0 && attachments.length === 0) return null;

  return {
    id: typeof raw.id === "string" ? raw.id : `message-${Date.now()}`,
    requestId,
    authorRole: toRole(raw.authorRole),
    authorLabel:
      typeof raw.authorLabel === "string" && raw.authorLabel.trim().length > 0
        ? raw.authorLabel.trim()
        : "Användare",
    body,
    messageType: toMessageType(raw.messageType),
    createdAt:
      typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
        ? raw.createdAt
        : nowIso(),
    attachments,
  };
}

function normalizeConversation(raw: unknown, requestId: string): RequestConversation {
  if (!isObject(raw)) {
    const now = nowIso();
    return {
      requestId,
      createdAt: now,
      updatedAt: now,
      messages: [],
      unreadByRole: {},
    };
  }

  const messages = Array.isArray(raw.messages)
    ? raw.messages
        .map((item) => normalizeMessage(item, requestId))
        .filter((item): item is RequestMessage => item !== null)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    : [];

  const unreadByRole: Partial<Record<ConversationActorRole, number>> = {};
  if (isObject(raw.unreadByRole)) {
    const unreadRaw = raw.unreadByRole as Record<string, unknown>;
    (["brf", "privatperson", "entreprenor", "system"] as ConversationActorRole[]).forEach(
      (role) => {
        const value = unreadRaw[role];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          unreadByRole[role] = Math.max(0, Math.round(value));
        }
      }
    );
  }

  const createdAt =
    typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : messages[0]?.createdAt || nowIso();
  const updatedAt =
    typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : messages[messages.length - 1]?.createdAt || createdAt;

  return {
    requestId,
    createdAt,
    updatedAt,
    messages,
    unreadByRole,
  };
}

function readStore(): Record<string, RequestConversation> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(MESSAGE_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return {};

    const entries = Object.entries(parsed).map(([requestId, conversation]) => [
      requestId,
      normalizeConversation(conversation, requestId),
    ]);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, RequestConversation>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(REQUEST_MESSAGES_UPDATED_EVENT));
}

function ensureConversation(store: Record<string, RequestConversation>, requestId: string): RequestConversation {
  const existing = store[requestId];
  if (existing) return existing;
  const now = nowIso();
  const created: RequestConversation = {
    requestId,
    createdAt: now,
    updatedAt: now,
    messages: [],
    unreadByRole: {},
  };
  store[requestId] = created;
  return created;
}

function nextMessageId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `message-${Date.now()}-${random}`;
}

function nextAttachmentId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `attachment-${Date.now()}-${random}`;
}

function unreadTargetRoles(authorRole: ConversationActorRole): ConversationActorRole[] {
  if (authorRole === "entreprenor") {
    return ["brf", "privatperson"];
  }
  if (authorRole === "brf") {
    return ["entreprenor"];
  }
  if (authorRole === "privatperson") {
    return ["entreprenor"];
  }
  return ["brf", "privatperson", "entreprenor"];
}

export function getRequestConversation(requestId: string): RequestConversation {
  const store = readStore();
  return normalizeConversation(store[requestId], requestId);
}

export function listRequestMessages(requestId: string): RequestMessage[] {
  return getRequestConversation(requestId).messages;
}

export function sendRequestMessage(input: SendRequestMessageInput): RequestMessage {
  const store = readStore();
  const conversation = ensureConversation(store, input.requestId);

  const body = input.body.trim();
  const attachments = (input.attachments ?? []).filter((item) => item.dataUrl.length > 0);
  if (body.length === 0 && attachments.length === 0) {
    throw new Error("Meddelandet måste innehålla text eller minst en bilaga.");
  }

  const createdAt = nowIso();
  const message: RequestMessage = {
    id: nextMessageId(),
    requestId: input.requestId,
    authorRole: input.authorRole,
    authorLabel: input.authorLabel.trim() || "Användare",
    body,
    messageType: input.messageType,
    createdAt,
    attachments,
  };

  const nextMessages = [...conversation.messages, message].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
  const nextUnread: Partial<Record<ConversationActorRole, number>> = {
    ...conversation.unreadByRole,
    [input.authorRole]: 0,
  };

  const targetRoles =
    input.targetRoles && input.targetRoles.length > 0
      ? input.targetRoles
      : unreadTargetRoles(input.authorRole);

  targetRoles.forEach((role) => {
    nextUnread[role] = (nextUnread[role] || 0) + 1;
  });

  store[input.requestId] = {
    ...conversation,
    updatedAt: createdAt,
    messages: nextMessages,
    unreadByRole: nextUnread,
  };

  writeStore(store);
  return message;
}

export function markRequestConversationRead(requestId: string, role: ConversationActorRole) {
  const store = readStore();
  const conversation = ensureConversation(store, requestId);
  if ((conversation.unreadByRole[role] || 0) === 0) return;

  store[requestId] = {
    ...conversation,
    unreadByRole: {
      ...conversation.unreadByRole,
      [role]: 0,
    },
  };
  writeStore(store);
}

export function getUnreadCountForRole(requestId: string, role: ConversationActorRole): number {
  const conversation = getRequestConversation(requestId);
  return conversation.unreadByRole[role] || 0;
}

export function subscribeRequestMessages(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === MESSAGE_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(REQUEST_MESSAGES_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(REQUEST_MESSAGES_UPDATED_EVENT, callback);
  };
}

function toAttachmentKind(file: File): "image" | "file" {
  if (file.type.startsWith("image/")) return "image";
  const lowered = file.name.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)$/.test(lowered)) return "image";
  return "file";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Kunde inte läsa filen."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Kunde inte läsa filen."));
    reader.readAsDataURL(file);
  });
}

export async function filesToMessageAttachments(files: File[]): Promise<AttachmentConversionResult> {
  const errors: string[] = [];
  const attachments: RequestMessageAttachment[] = [];
  let totalBytes = 0;

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      errors.push(`${file.name}: för stor fil (max 4 MB per fil).`);
      continue;
    }
    if (totalBytes + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
      errors.push("Total bilagestorlek överskrider 12 MB.");
      break;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      attachments.push({
        id: nextAttachmentId(),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeKb: Number((file.size / 1024).toFixed(1)),
        dataUrl,
        kind: toAttachmentKind(file),
        uploadedAt: nowIso(),
      });
      totalBytes += file.size;
    } catch {
      errors.push(`${file.name}: kunde inte läsas.`);
    }
  }

  return { attachments, errors };
}
