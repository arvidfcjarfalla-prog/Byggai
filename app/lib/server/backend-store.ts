import "server-only";

import { promises as fs } from "fs";
import path from "path";

import type {
  ProjectFile,
  ProjectFolder,
  WorkspaceId,
} from "../project-files/types";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "backend-store.json");

const MAX_AUDIT_EVENTS = 5000;
const MAX_NOTIFICATIONS = 5000;

type NotificationWorkspaceId = Extract<WorkspaceId, "brf" | "privat">;
type FileActorRole = "entreprenor" | "brf" | "privatperson" | "system";

export interface FileAuditEvent {
  id: string;
  projectId: string;
  fileId: string;
  fileRefId?: string;
  action: "deleted" | "metadata_updated";
  actorRole: FileActorRole;
  actorLabel: string;
  createdAt: string;
  filename?: string;
  previousFilename?: string;
  nextFilename?: string;
  previousFolder?: ProjectFolder;
  nextFolder?: ProjectFolder;
  notificationsCreated: number;
}

export interface FileDeletionNotification {
  id: string;
  projectId: string;
  workspaceId: NotificationWorkspaceId;
  type: "document_deleted";
  title: string;
  message: string;
  fileId: string;
  fileRefId?: string;
  createdAt: string;
  readAt: string | null;
}

interface BackendStore {
  version: 1;
  files: ProjectFile[];
  fileAuditEvents: FileAuditEvent[];
  notifications: FileDeletionNotification[];
}

export interface PersistFileDeletionInput {
  projectId: string;
  fileId: string;
  fileRefId?: string;
  filename: string;
  actorRole: FileActorRole;
  actorLabel: string;
  notifyWorkspaces: NotificationWorkspaceId[];
}

export interface PersistFileMetadataUpdateInput {
  projectId: string;
  fileId: string;
  fileRefId?: string;
  actorRole: FileActorRole;
  actorLabel: string;
  previousFilename: string;
  nextFilename: string;
  previousFolder: ProjectFolder;
  nextFolder: ProjectFolder;
}

let mutationQueue: Promise<void> = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStore(): BackendStore {
  return {
    version: 1,
    files: [],
    fileAuditEvents: [],
    notifications: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNotificationWorkspace(
  value: unknown
): NotificationWorkspaceId | null {
  if (value === "brf" || value === "privat") return value;
  return null;
}

function toProjectFolder(value: unknown): ProjectFolder | null {
  if (
    value === "avtal" ||
    value === "offert" ||
    value === "ata" ||
    value === "bilder" ||
    value === "ritningar" ||
    value === "ovrigt"
  ) {
    return value;
  }
  return null;
}

function toActorRole(value: unknown): FileActorRole {
  if (
    value === "entreprenor" ||
    value === "brf" ||
    value === "privatperson" ||
    value === "system"
  ) {
    return value;
  }
  return "system";
}

function normalizeContentRef(
  raw: unknown
): ProjectFile["contentRef"] | null {
  if (!isObject(raw)) return null;

  const storage = raw.storage === "idb" || raw.storage === "localStorage" ? raw.storage : null;
  const contentId = typeof raw.contentId === "string" ? raw.contentId : "";
  const mimeType = typeof raw.mimeType === "string" ? raw.mimeType : "";
  const size =
    typeof raw.size === "number" && Number.isFinite(raw.size) ? Math.max(0, Math.round(raw.size)) : 0;

  if (!storage || !contentId || !mimeType) return null;

  return {
    storage,
    contentId,
    mimeType,
    size,
  };
}

function normalizeProjectFile(raw: unknown): ProjectFile | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.projectId !== "string") return null;

  const folder = toProjectFolder(raw.folder);
  if (!folder) return null;

  const sourceType =
    raw.sourceType === "offert" ||
    raw.sourceType === "ata" ||
    raw.sourceType === "avtal" ||
    raw.sourceType === "manual"
      ? raw.sourceType
      : null;
  if (!sourceType) return null;

  const contentRef = normalizeContentRef(raw.contentRef);
  if (!contentRef) return null;

  const recipientWorkspaceId =
    raw.recipientWorkspaceId === "entreprenor" ||
    raw.recipientWorkspaceId === "brf" ||
    raw.recipientWorkspaceId === "privat"
      ? raw.recipientWorkspaceId
      : undefined;
  const senderWorkspaceId =
    raw.senderWorkspaceId === "entreprenor" ||
    raw.senderWorkspaceId === "brf" ||
    raw.senderWorkspaceId === "privat"
      ? raw.senderWorkspaceId
      : undefined;
  const senderRole =
    raw.senderRole === "entreprenor" ||
    raw.senderRole === "brf" ||
    raw.senderRole === "privatperson"
      ? raw.senderRole
      : undefined;

  return {
    id: raw.id,
    refId: typeof raw.refId === "string" ? raw.refId : "",
    projectId: raw.projectId,
    folder,
    filename: typeof raw.filename === "string" ? raw.filename : "Fil",
    mimeType: typeof raw.mimeType === "string" ? raw.mimeType : "application/octet-stream",
    size:
      typeof raw.size === "number" && Number.isFinite(raw.size) ? Math.max(0, Math.round(raw.size)) : 0,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    createdBy: typeof raw.createdBy === "string" ? raw.createdBy : "Användare",
    sourceType,
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : raw.id,
    senderRole,
    senderWorkspaceId,
    recipientWorkspaceId,
    deliveredAt: typeof raw.deliveredAt === "string" ? raw.deliveredAt : undefined,
    version:
      typeof raw.version === "number" && Number.isFinite(raw.version)
        ? Math.max(0, Math.round(raw.version))
        : undefined,
    contentRef,
  };
}

function normalizeAuditEvent(raw: unknown): FileAuditEvent | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.projectId !== "string" || typeof raw.fileId !== "string") {
    return null;
  }

  const action = raw.action === "metadata_updated" ? "metadata_updated" : raw.action === "deleted" ? "deleted" : null;
  if (!action) return null;

  const previousFolder = toProjectFolder(raw.previousFolder);
  const nextFolder = toProjectFolder(raw.nextFolder);

  return {
    id: raw.id,
    projectId: raw.projectId,
    fileId: raw.fileId,
    fileRefId: typeof raw.fileRefId === "string" ? raw.fileRefId : undefined,
    action,
    actorRole: toActorRole(raw.actorRole),
    actorLabel: typeof raw.actorLabel === "string" ? raw.actorLabel : "Användare",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    filename: typeof raw.filename === "string" ? raw.filename : undefined,
    previousFilename:
      typeof raw.previousFilename === "string" ? raw.previousFilename : undefined,
    nextFilename: typeof raw.nextFilename === "string" ? raw.nextFilename : undefined,
    previousFolder: previousFolder ?? undefined,
    nextFolder: nextFolder ?? undefined,
    notificationsCreated:
      typeof raw.notificationsCreated === "number" && Number.isFinite(raw.notificationsCreated)
        ? Math.max(0, Math.round(raw.notificationsCreated))
        : 0,
  };
}

function normalizeNotification(raw: unknown): FileDeletionNotification | null {
  if (!isObject(raw)) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.projectId !== "string" ||
    typeof raw.fileId !== "string"
  ) {
    return null;
  }

  const workspaceId = toNotificationWorkspace(raw.workspaceId);
  if (!workspaceId) return null;

  return {
    id: raw.id,
    projectId: raw.projectId,
    workspaceId,
    type: "document_deleted",
    title: typeof raw.title === "string" ? raw.title : "Dokument borttaget",
    message: typeof raw.message === "string" ? raw.message : "Ett dokument togs bort.",
    fileId: raw.fileId,
    fileRefId: typeof raw.fileRefId === "string" ? raw.fileRefId : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    readAt: typeof raw.readAt === "string" ? raw.readAt : null,
  };
}

function normalizeStore(raw: unknown): BackendStore {
  if (!isObject(raw)) return emptyStore();

  const files = Array.isArray(raw.files)
    ? raw.files
        .map((entry) => normalizeProjectFile(entry))
        .filter((entry): entry is ProjectFile => entry !== null)
    : [];

  const fileAuditEvents = Array.isArray(raw.fileAuditEvents)
    ? raw.fileAuditEvents
        .map((entry) => normalizeAuditEvent(entry))
        .filter((entry): entry is FileAuditEvent => entry !== null)
        .slice(0, MAX_AUDIT_EVENTS)
    : [];

  const notifications = Array.isArray(raw.notifications)
    ? raw.notifications
        .map((entry) => normalizeNotification(entry))
        .filter((entry): entry is FileDeletionNotification => entry !== null)
        .slice(0, MAX_NOTIFICATIONS)
    : [];

  return {
    version: 1,
    files,
    fileAuditEvents,
    notifications,
  };
}

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify(emptyStore(), null, 2), "utf-8");
  }
}

async function readStore(): Promise<BackendStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_FILE, "utf-8");
  try {
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: BackendStore): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

async function mutateStore<T>(mutator: (store: BackendStore) => Promise<T> | T): Promise<T> {
  let releaseCurrent: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const previous = mutationQueue;
  mutationQueue = previous.then(
    () => current,
    () => current
  );

  await previous;

  try {
    const store = await readStore();
    const result = await mutator(store);
    store.fileAuditEvents = store.fileAuditEvents.slice(0, MAX_AUDIT_EVENTS);
    store.notifications = store.notifications.slice(0, MAX_NOTIFICATIONS);
    await writeStore(store);
    return result;
  } finally {
    releaseCurrent?.();
  }
}

function workspaceMatches(file: ProjectFile, workspaceId?: WorkspaceId): boolean {
  if (!workspaceId) return true;
  if (workspaceId === "entreprenor") {
    return !file.recipientWorkspaceId;
  }
  return file.recipientWorkspaceId === workspaceId || file.senderWorkspaceId === workspaceId;
}

export async function listProjectFiles(input: {
  projectId: string;
  folder?: ProjectFolder;
  query?: string;
  workspaceId?: WorkspaceId;
}): Promise<ProjectFile[]> {
  const store = await readStore();
  const normalizedQuery = input.query?.trim().toLowerCase() ?? "";

  return store.files
    .filter((file) => file.projectId === input.projectId)
    .filter((file) => (input.folder ? file.folder === input.folder : true))
    .filter((file) =>
      normalizedQuery.length > 0
        ? file.filename.toLowerCase().includes(normalizedQuery) ||
          file.refId.toLowerCase().includes(normalizedQuery) ||
          file.folder.toLowerCase().includes(normalizedQuery) ||
          file.sourceType.toLowerCase().includes(normalizedQuery)
        : true
    )
    .filter((file) => workspaceMatches(file, input.workspaceId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function upsertProjectFile(file: ProjectFile): Promise<ProjectFile> {
  return mutateStore((store) => {
    const existingIndex = store.files.findIndex(
      (entry) => entry.projectId === file.projectId && entry.id === file.id
    );
    if (existingIndex >= 0) {
      store.files[existingIndex] = file;
    } else {
      store.files.unshift(file);
    }
    return file;
  });
}

export async function upsertProjectFiles(files: ProjectFile[]): Promise<ProjectFile[]> {
  return mutateStore((store) => {
    files.forEach((file) => {
      const existingIndex = store.files.findIndex(
        (entry) => entry.projectId === file.projectId && entry.id === file.id
      );
      if (existingIndex >= 0) {
        store.files[existingIndex] = file;
      } else {
        store.files.unshift(file);
      }
    });
    return files;
  });
}

export async function getProjectFile(
  projectId: string,
  fileId: string
): Promise<ProjectFile | null> {
  const store = await readStore();
  return store.files.find((entry) => entry.projectId === projectId && entry.id === fileId) ?? null;
}

export async function persistFileDeletion(
  input: PersistFileDeletionInput
): Promise<{ event: FileAuditEvent; notifications: FileDeletionNotification[] }> {
  return mutateStore((store) => {
    store.files = store.files.filter(
      (file) => !(file.projectId === input.projectId && file.id === input.fileId)
    );

    const createdAt = nowIso();
    const notificationTargets = Array.from(new Set(input.notifyWorkspaces));
    const notifications = notificationTargets.map((workspaceId) => ({
      id: nextId("notification"),
      projectId: input.projectId,
      workspaceId,
      type: "document_deleted" as const,
      title: "Dokument borttaget",
      message: `Dokumentet "${input.filename}"${input.fileRefId ? ` (${input.fileRefId})` : ""} togs bort av ${input.actorLabel}.`,
      fileId: input.fileId,
      fileRefId: input.fileRefId,
      createdAt,
      readAt: null,
    }));

    const event: FileAuditEvent = {
      id: nextId("audit"),
      projectId: input.projectId,
      fileId: input.fileId,
      fileRefId: input.fileRefId,
      action: "deleted",
      actorRole: input.actorRole,
      actorLabel: input.actorLabel,
      createdAt,
      filename: input.filename,
      notificationsCreated: notifications.length,
    };

    store.fileAuditEvents.unshift(event);
    if (notifications.length > 0) {
      store.notifications.unshift(...notifications);
    }

    return { event, notifications };
  });
}

export async function persistFileMetadataUpdate(
  input: PersistFileMetadataUpdateInput
): Promise<FileAuditEvent> {
  return mutateStore((store) => {
    const targetIndex = store.files.findIndex(
      (file) => file.projectId === input.projectId && file.id === input.fileId
    );
    if (targetIndex >= 0) {
      const current = store.files[targetIndex];
      store.files[targetIndex] = {
        ...current,
        filename: input.nextFilename,
        folder: input.nextFolder,
      };
    }

    const event: FileAuditEvent = {
      id: nextId("audit"),
      projectId: input.projectId,
      fileId: input.fileId,
      fileRefId: input.fileRefId,
      action: "metadata_updated",
      actorRole: input.actorRole,
      actorLabel: input.actorLabel,
      createdAt: nowIso(),
      previousFilename: input.previousFilename,
      nextFilename: input.nextFilename,
      previousFolder: input.previousFolder,
      nextFolder: input.nextFolder,
      notificationsCreated: 0,
    };
    store.fileAuditEvents.unshift(event);
    return event;
  });
}

export async function listFileDeletionNotifications(input: {
  projectId?: string;
  workspaceId?: NotificationWorkspaceId;
  onlyUnread?: boolean;
  limit?: number;
}): Promise<FileDeletionNotification[]> {
  const store = await readStore();
  const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

  return store.notifications
    .filter((notification) => (input.projectId ? notification.projectId === input.projectId : true))
    .filter((notification) => (input.workspaceId ? notification.workspaceId === input.workspaceId : true))
    .filter((notification) => (input.onlyUnread ? notification.readAt === null : true))
    .slice(0, limit);
}

export async function markNotificationRead(
  notificationId: string
): Promise<FileDeletionNotification | null> {
  return mutateStore((store) => {
    const index = store.notifications.findIndex((item) => item.id === notificationId);
    if (index === -1) return null;

    const current = store.notifications[index];
    if (current.readAt) return current;

    const updated: FileDeletionNotification = {
      ...current,
      readAt: nowIso(),
    };
    store.notifications[index] = updated;
    return updated;
  });
}
