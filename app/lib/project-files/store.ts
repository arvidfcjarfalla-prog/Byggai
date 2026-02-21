import { deleteContent, readContent, storeContent } from "./content";
import type {
  AddProjectFileInput,
  ProjectFile,
  ProjectFolder,
  WorkspaceId,
} from "./types";
import { ensureRegisteredRefId, findEntityByRefId as findRefEntity } from "../refid/registry";
import { validateRefId } from "../refid/validate";

export const PROJECT_FILES_STORAGE_KEY = "byggplattformen-project-files-v1";
export const PROJECT_FILES_UPDATED_EVENT = "byggplattformen-project-files-updated";
export const PROJECT_FILE_TREES_KEY = "byggplattformen-project-file-trees-v1";

const DEFAULT_FOLDERS: ProjectFolder[] = [
  "avtal",
  "offert",
  "ata",
  "bilder",
  "ritningar",
  "ovrigt",
];
const BACKEND_SYNC_TTL_MS = 5_000;
const projectSyncState = new Map<string, { syncedAt: number; inFlight: Promise<void> | null }>();

function shouldBypassBackendSync(): boolean {
  return process.env.NODE_ENV === "test";
}

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProjectFile(entry: ProjectFile): { file: ProjectFile; changed: boolean } {
  const nextRefId = ensureRegisteredRefId({
    existingRefId: validateRefId(entry.refId) ? entry.refId : undefined,
    kind: "FIL",
    id: entry.id,
    projectId: entry.projectId,
  });

  const normalized: ProjectFile = {
    ...entry,
    refId: nextRefId,
  };

  return {
    file: normalized,
    changed: normalized.refId !== entry.refId,
  };
}

function readAllFiles(): ProjectFile[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROJECT_FILES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let changed = false;
    const normalized = parsed
      .filter((entry): entry is ProjectFile => Boolean(entry && typeof entry.id === "string"))
      .map((entry) => {
        const withFallback = {
          ...entry,
          refId: typeof entry.refId === "string" ? entry.refId : "",
        } as ProjectFile;
        const result = normalizeProjectFile(withFallback);
        if (result.changed) changed = true;
        return result.file;
      });

    if (changed) {
      localStorage.setItem(PROJECT_FILES_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

function writeAllFiles(files: ProjectFile[]) {
  if (typeof window === "undefined") return;
  const nextRaw = JSON.stringify(files);
  const previousRaw = localStorage.getItem(PROJECT_FILES_STORAGE_KEY);
  if (previousRaw === nextRaw) return;
  localStorage.setItem(PROJECT_FILES_STORAGE_KEY, nextRaw);
  window.dispatchEvent(new Event(PROJECT_FILES_UPDATED_EVENT));
}

function readProjectTrees(): Record<string, ProjectFolder[]> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(PROJECT_FILE_TREES_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ProjectFolder[]>) : {};
  } catch {
    return {};
  }
}

function writeProjectTrees(trees: Record<string, ProjectFolder[]>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECT_FILE_TREES_KEY, JSON.stringify(trees));
}

function normalizeFolder(raw?: ProjectFolder): ProjectFolder | undefined {
  if (!raw) return undefined;
  const valid: ProjectFolder[] = [
    "avtal",
    "offert",
    "ata",
    "bilder",
    "ritningar",
    "ovrigt",
  ];
  return valid.includes(raw) ? raw : undefined;
}

export function ensureProjectFileTree(projectId: string): ProjectFolder[] {
  const trees = readProjectTrees();
  const existing = trees[projectId];
  if (existing && existing.length > 0) {
    return existing;
  }

  trees[projectId] = [...DEFAULT_FOLDERS];
  writeProjectTrees(trees);
  return trees[projectId];
}

function applyFileFilters(
  files: ProjectFile[],
  projectId: string,
  folder?: ProjectFolder,
  query?: string,
  workspaceId?: WorkspaceId
): ProjectFile[] {
  const normalizedFolder = normalizeFolder(folder);
  const normalizedQuery = query?.trim().toLowerCase() ?? "";

  return files
    .filter((file) => file.projectId === projectId)
    .filter((file) => (normalizedFolder ? file.folder === normalizedFolder : true))
    .filter((file) =>
      normalizedQuery.length > 0
        ? file.filename.toLowerCase().includes(normalizedQuery) ||
          file.refId.toLowerCase().includes(normalizedQuery) ||
          file.folder.toLowerCase().includes(normalizedQuery) ||
          file.sourceType.toLowerCase().includes(normalizedQuery)
        : true
    )
    .filter((file) => {
      if (!workspaceId) return true;
      if (workspaceId === "entreprenor") {
        return !file.recipientWorkspaceId;
      }
      return file.recipientWorkspaceId === workspaceId || file.senderWorkspaceId === workspaceId;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function updateProjectSyncState(projectId: string, updates: Partial<{ syncedAt: number; inFlight: Promise<void> | null }>) {
  const current = projectSyncState.get(projectId) ?? { syncedAt: 0, inFlight: null };
  projectSyncState.set(projectId, {
    syncedAt: updates.syncedAt ?? current.syncedAt,
    inFlight: updates.inFlight !== undefined ? updates.inFlight : current.inFlight,
  });
}

async function parseFilesResponse(response: Response): Promise<ProjectFile[]> {
  const payload = (await response.json()) as { files?: unknown };
  if (!Array.isArray(payload.files)) return [];
  return payload.files
    .filter((entry): entry is ProjectFile => Boolean(entry && typeof entry === "object"))
    .map((entry) => normalizeProjectFile(entry).file);
}

function replaceProjectFilesInCache(projectId: string, incoming: ProjectFile[]) {
  const current = readAllFiles();
  const withoutProject = current.filter((file) => file.projectId !== projectId);
  writeAllFiles([...incoming, ...withoutProject]);
}

async function fetchProjectFilesFromBackend(projectId: string): Promise<ProjectFile[]> {
  if (typeof window === "undefined") return [];
  const response = await fetch(`/api/files?projectId=${encodeURIComponent(projectId)}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(await parseBackendError(response));
  }
  return parseFilesResponse(response);
}

export async function syncProjectFilesFromBackend(
  projectId: string,
  options?: { force?: boolean }
): Promise<ProjectFile[]> {
  ensureProjectFileTree(projectId);
  if (typeof window === "undefined") return [];
  if (shouldBypassBackendSync()) {
    return applyFileFilters(readAllFiles(), projectId);
  }

  const force = options?.force === true;
  const state = projectSyncState.get(projectId) ?? { syncedAt: 0, inFlight: null };
  const now = Date.now();

  if (!force && state.inFlight) {
    await state.inFlight;
    return applyFileFilters(readAllFiles(), projectId);
  }

  if (!force && state.syncedAt > 0 && now - state.syncedAt < BACKEND_SYNC_TTL_MS) {
    return applyFileFilters(readAllFiles(), projectId);
  }

  const syncPromise = (async () => {
    try {
      const backendFiles = await fetchProjectFilesFromBackend(projectId);
      const localProjectFiles = applyFileFilters(readAllFiles(), projectId);

      if (backendFiles.length === 0 && localProjectFiles.length > 0) {
        await upsertFilesInBackend(localProjectFiles);
        updateProjectSyncState(projectId, { syncedAt: Date.now() });
        return;
      }

      replaceProjectFilesInCache(projectId, backendFiles);
      updateProjectSyncState(projectId, { syncedAt: Date.now() });
    } catch {
      // Keep local cache when backend cannot be reached temporarily.
    } finally {
      updateProjectSyncState(projectId, { inFlight: null });
    }
  })();

  updateProjectSyncState(projectId, { inFlight: syncPromise });
  await syncPromise;
  return applyFileFilters(readAllFiles(), projectId);
}

export async function listFiles(
  projectId: string,
  folder?: ProjectFolder,
  query?: string,
  workspaceId?: WorkspaceId
): Promise<ProjectFile[]> {
  ensureProjectFileTree(projectId);
  await syncProjectFilesFromBackend(projectId);
  return applyFileFilters(readAllFiles(), projectId, folder, query, workspaceId);
}

async function upsertFileInBackend(file: ProjectFile): Promise<void> {
  if (typeof window === "undefined") return;
  const response = await fetch("/api/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file }),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response));
  }
}

async function upsertFilesInBackend(files: ProjectFile[]): Promise<void> {
  if (typeof window === "undefined" || files.length === 0) return;
  const response = await fetch("/api/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });
  if (!response.ok) {
    throw new Error(await parseBackendError(response));
  }
}

export async function addFile(input: AddProjectFileInput): Promise<ProjectFile> {
  ensureProjectFileTree(input.projectId);
  const contentRef = await storeContent(input.bytes, input.mimeType);
  const id = nextId("pfile");
  const refId = ensureRegisteredRefId({
    kind: "FIL",
    id,
    projectId: input.projectId,
  });

  const file: ProjectFile = {
    id,
    refId,
    projectId: input.projectId,
    folder: input.folder,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.bytes.byteLength,
    createdAt: nowIso(),
    createdBy: input.createdBy,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    senderRole: input.senderRole,
    senderWorkspaceId: input.senderWorkspaceId,
    recipientWorkspaceId: input.recipientWorkspaceId,
    deliveredAt: input.deliveredAt,
    version: input.version,
    contentRef,
  };

  const previous = readAllFiles();
  const next = [file, ...previous];
  writeAllFiles(next);

  if (!shouldBypassBackendSync()) {
    try {
      await upsertFileInBackend(file);
      updateProjectSyncState(input.projectId, { syncedAt: Date.now() });
    } catch (error) {
      writeAllFiles(previous);
      await deleteContent(file.contentRef);
      throw error instanceof Error ? error : new Error("Kunde inte spara fil i backend.");
    }
  }

  return file;
}

export async function getFile(
  projectId: string,
  fileId: string
): Promise<{ file: ProjectFile; bytes: Uint8Array | null } | null> {
  ensureProjectFileTree(projectId);
  await syncProjectFilesFromBackend(projectId);
  const file = readAllFiles().find((entry) => entry.projectId === projectId && entry.id === fileId);
  if (!file) return null;

  const bytes = await readContent(file.contentRef);
  return { file, bytes };
}

export async function deleteFile(
  projectId: string,
  fileId: string,
  options?: {
    skipBackend?: boolean;
    actorRole?: FileActorRole;
    actorLabel?: string;
    notifyWorkspaces?: NotificationWorkspaceId[];
  }
): Promise<boolean> {
  ensureProjectFileTree(projectId);
  await syncProjectFilesFromBackend(projectId);
  const files = readAllFiles();
  const file = files.find((entry) => entry.projectId === projectId && entry.id === fileId);
  if (!file) return false;

  if (!options?.skipBackend && !shouldBypassBackendSync()) {
    await persistFileDeletionInBackend({
      projectId,
      fileId,
      fileRefId: file.refId,
      filename: file.filename,
      actorRole: options?.actorRole ?? "system",
      actorLabel: options?.actorLabel ?? "Byggplattformen",
      notifyWorkspaces: options?.notifyWorkspaces ?? [],
    });
    updateProjectSyncState(projectId, { syncedAt: Date.now() });
  }

  const next = files.filter((entry) => entry.id !== fileId);
  writeAllFiles(next);
  await deleteContent(file.contentRef);
  return true;
}

export function updateFileMetadata(input: {
  projectId: string;
  fileId: string;
  filename: string;
  folder: ProjectFolder;
}): ProjectFile | null {
  ensureProjectFileTree(input.projectId);
  const nextFilename = input.filename.trim();
  if (!nextFilename) {
    throw new Error("Filnamn måste anges.");
  }

  const nextFolder = normalizeFolder(input.folder);
  if (!nextFolder) {
    throw new Error("Ogiltig mapp.");
  }

  let updated: ProjectFile | null = null;
  const next = readAllFiles().map((file) => {
    if (file.projectId !== input.projectId || file.id !== input.fileId) return file;
    updated = {
      ...file,
      filename: nextFilename,
      folder: nextFolder,
    };
    return updated;
  });

  if (!updated) return null;
  writeAllFiles(next);
  return updated;
}

export interface ShareFileInput {
  fileId: string;
  fromProjectId: string;
  toWorkspaceId: WorkspaceId;
  toProjectId?: string;
  senderRole: "entreprenor" | "brf" | "privatperson";
  senderWorkspaceId: WorkspaceId;
  senderLabel: string;
}

type FileActorRole = "entreprenor" | "brf" | "privatperson" | "system";
type NotificationWorkspaceId = "brf" | "privat";

async function parseBackendError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // ignore parse error
  }
  return "Backend-anrop misslyckades.";
}

export async function persistFileDeletionInBackend(input: {
  projectId: string;
  fileId: string;
  fileRefId?: string;
  filename: string;
  actorRole: FileActorRole;
  actorLabel: string;
  notifyWorkspaces: NotificationWorkspaceId[];
}): Promise<{ notificationsCreated: number }> {
  if (typeof window === "undefined") return { notificationsCreated: 0 };

  const response = await fetch(`/api/files/${encodeURIComponent(input.fileId)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: input.projectId,
      fileRefId: input.fileRefId,
      filename: input.filename,
      actorRole: input.actorRole,
      actorLabel: input.actorLabel,
      notifyWorkspaces: input.notifyWorkspaces,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response));
  }

  const payload = (await response.json()) as { notificationsCreated?: unknown };
  return {
    notificationsCreated:
      typeof payload.notificationsCreated === "number" && Number.isFinite(payload.notificationsCreated)
        ? Math.max(0, Math.round(payload.notificationsCreated))
        : 0,
  };
}

export async function persistFileMetadataUpdateInBackend(input: {
  projectId: string;
  fileId: string;
  fileRefId?: string;
  actorRole: FileActorRole;
  actorLabel: string;
  previousFilename: string;
  nextFilename: string;
  previousFolder: ProjectFolder;
  nextFolder: ProjectFolder;
}): Promise<void> {
  if (typeof window === "undefined") return;

  const response = await fetch(`/api/files/${encodeURIComponent(input.fileId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: input.projectId,
      fileRefId: input.fileRefId,
      actorRole: input.actorRole,
      actorLabel: input.actorLabel,
      previousFilename: input.previousFilename,
      nextFilename: input.nextFilename,
      previousFolder: input.previousFolder,
      nextFolder: input.nextFolder,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response));
  }
}

export async function shareFileToWorkspace(input: ShareFileInput): Promise<ProjectFile> {
  const source = await getFile(input.fromProjectId, input.fileId);
  if (!source || !source.bytes) {
    throw new Error("Filen kunde inte delas eftersom innehållet saknas.");
  }

  const deliveredAt = nowIso();
  return addFile({
    projectId: input.toProjectId ?? input.fromProjectId,
    folder: source.file.folder,
    filename: source.file.filename,
    mimeType: source.file.mimeType,
    createdBy: input.senderLabel,
    sourceType: source.file.sourceType,
    sourceId: source.file.sourceId,
    bytes: source.bytes,
    senderRole: input.senderRole,
    senderWorkspaceId: input.senderWorkspaceId,
    recipientWorkspaceId: input.toWorkspaceId,
    deliveredAt,
    version: source.file.version,
  });
}

export function findEntityByRefId(
  projectId: string,
  refId: string
): { kind: "DOC" | "FIL"; id: string; projectId?: string } | null {
  return findRefEntity(projectId, refId);
}

export function subscribeProjectFiles(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === PROJECT_FILES_STORAGE_KEY) callback();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(PROJECT_FILES_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PROJECT_FILES_UPDATED_EVENT, callback);
  };
}
