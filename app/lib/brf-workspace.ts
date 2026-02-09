export type BrfFileType =
  | "Underhallsplan"
  | "Ritning"
  | "Detaljplan"
  | "Avtal"
  | "Offert"
  | "Myndighet"
  | "Kalkyl"
  | "Bild"
  | "Dokument"
  | "Annat";

export interface BrfFileRecord {
  id: string;
  name: string;
  fileType: BrfFileType;
  extension: string;
  sizeKb: number;
  uploadedAt: string;
  sourceLabel: string;
  linkedActionTitle?: string;
  mimeType?: string;
  contentGroup?: string;
  tags?: string[];
}

export const BRF_FILES_KEY = "byggplattformen-brf-files";
export const BRF_FILES_UPDATED_EVENT = "byggplattformen-brf-files-updated";
export const PRIVATE_FILES_KEY = "byggplattformen-private-files";
export const PRIVATE_FILES_UPDATED_EVENT = "byggplattformen-private-files-updated";
export const BRF_FILE_PAYLOADS_KEY = "byggplattformen-brf-file-payloads";
export const PRIVATE_FILE_PAYLOADS_KEY = "byggplattformen-private-file-payloads";
export const FILE_PAYLOAD_MAX_BYTES = 2_500_000;

export type WorkspaceFileScope = "brf" | "privat";

interface FilePayload {
  id: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
  sizeKb: number;
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function inferBrfFileType(fileName: string): BrfFileType {
  const lower = fileName.toLowerCase();
  const ext = getFileExtension(fileName);

  if (
    lower.includes("underhållsplan") ||
    lower.includes("underhallsplan") ||
    lower.includes("maintenance") ||
    ["xls", "xlsx", "xlsm"].includes(ext)
  ) {
    return "Underhallsplan";
  }

  if (
    lower.includes("ritning") ||
    lower.includes("dwg") ||
    lower.includes("ifc") ||
    ext === "dwg" ||
    ext === "ifc"
  ) {
    return "Ritning";
  }

  if (lower.includes("detaljplan") || lower.includes("planbeskrivning")) {
    return "Detaljplan";
  }

  if (
    lower.includes("avtal") ||
    lower.includes("kontrakt") ||
    lower.includes("upphandling")
  ) {
    return "Avtal";
  }

  if (lower.includes("offert") || lower.includes("anbud")) {
    return "Offert";
  }

  if (
    lower.includes("bygglov") ||
    lower.includes("tillstånd") ||
    lower.includes("myndighet")
  ) {
    return "Myndighet";
  }

  if (lower.includes("kalkyl") || lower.includes("budget")) {
    return "Kalkyl";
  }

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return "Bild";
  }

  if (["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)) {
    return "Dokument";
  }

  return "Annat";
}

export function getFileTypeLabel(fileType: BrfFileType): string {
  if (fileType === "Underhallsplan") return "Underhållsplan";
  if (fileType === "Ritning") return "Ritning";
  if (fileType === "Detaljplan") return "Detaljplan";
  if (fileType === "Avtal") return "Avtal";
  if (fileType === "Offert") return "Offert";
  if (fileType === "Myndighet") return "Myndighet";
  if (fileType === "Kalkyl") return "Kalkyl";
  if (fileType === "Bild") return "Bild";
  if (fileType === "Dokument") return "Dokument";
  return "Annat";
}

export function inferContentGroup(fileType: BrfFileType): string {
  if (fileType === "Underhallsplan") return "Planering och underhåll";
  if (fileType === "Kalkyl") return "Ekonomi och kalkyl";
  if (fileType === "Ritning" || fileType === "Detaljplan") return "Tekniskt underlag";
  if (fileType === "Avtal" || fileType === "Offert") return "Upphandling och avtal";
  if (fileType === "Myndighet") return "Myndighetsunderlag";
  if (fileType === "Bild") return "Foto och media";
  if (fileType === "Dokument") return "Övriga dokument";
  return "Övrigt";
}

export function inferFileTags(fileName: string, fileType: BrfFileType): string[] {
  const lower = fileName.toLowerCase();
  const tags = new Set<string>([getFileTypeLabel(fileType)]);

  const mappings: Array<{ token: string; tag: string }> = [
    { token: "underhåll", tag: "Underhåll" },
    { token: "underhalls", tag: "Underhåll" },
    { token: "ritning", tag: "Ritning" },
    { token: "dwg", tag: "CAD" },
    { token: "ifc", tag: "BIM" },
    { token: "fasad", tag: "Fasad" },
    { token: "tak", tag: "Tak" },
    { token: "el", tag: "El" },
    { token: "belys", tag: "Belysning" },
    { token: "vent", tag: "Ventilation" },
    { token: "värme", tag: "Värme" },
    { token: "varme", tag: "Värme" },
    { token: "avtal", tag: "Avtal" },
    { token: "offert", tag: "Offert" },
    { token: "bygglov", tag: "Bygglov" },
    { token: "kalkyl", tag: "Kalkyl" },
    { token: "budget", tag: "Budget" },
    { token: "bild", tag: "Foto" },
  ];

  mappings.forEach((mapping) => {
    if (lower.includes(mapping.token)) tags.add(mapping.tag);
  });

  return Array.from(tags).slice(0, 8);
}

export function normalizeWorkspaceFileRecord(record: BrfFileRecord): BrfFileRecord {
  const fileType = record.fileType || inferBrfFileType(record.name);
  return {
    ...record,
    fileType,
    extension: record.extension || getFileExtension(record.name),
    contentGroup: record.contentGroup || inferContentGroup(fileType),
    tags: record.tags && record.tags.length > 0 ? record.tags : inferFileTags(record.name, fileType),
  };
}

function fileStorageKey(scope: WorkspaceFileScope): string {
  return scope === "brf" ? BRF_FILES_KEY : PRIVATE_FILES_KEY;
}

function fileUpdatedEvent(scope: WorkspaceFileScope): string {
  return scope === "brf" ? BRF_FILES_UPDATED_EVENT : PRIVATE_FILES_UPDATED_EVENT;
}

function payloadStorageKey(scope: WorkspaceFileScope): string {
  return scope === "brf" ? BRF_FILE_PAYLOADS_KEY : PRIVATE_FILE_PAYLOADS_KEY;
}

export function readWorkspaceFiles(scope: WorkspaceFileScope): BrfFileRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(fileStorageKey(scope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((entry): entry is BrfFileRecord => Boolean(entry && typeof entry.name === "string"))
          .map(normalizeWorkspaceFileRecord)
      : [];
  } catch {
    return [];
  }
}

export function writeWorkspaceFiles(scope: WorkspaceFileScope, files: BrfFileRecord[]) {
  if (typeof window === "undefined") return;
  const normalized = files.map(normalizeWorkspaceFileRecord);
  localStorage.setItem(fileStorageKey(scope), JSON.stringify(normalized));
  window.dispatchEvent(new Event(fileUpdatedEvent(scope)));
}

export function removeWorkspaceFile(scope: WorkspaceFileScope, fileId: string) {
  const current = readWorkspaceFiles(scope);
  const next = current.filter((file) => file.id !== fileId);
  writeWorkspaceFiles(scope, next);
  removeWorkspaceFilePayload(scope, fileId);
}

export function clearWorkspaceFiles(scope: WorkspaceFileScope) {
  writeWorkspaceFiles(scope, []);
  if (typeof window !== "undefined") {
    localStorage.removeItem(payloadStorageKey(scope));
  }
}

export function structureWorkspaceFiles(scope: WorkspaceFileScope): BrfFileRecord[] {
  const normalized = readWorkspaceFiles(scope).map(normalizeWorkspaceFileRecord);
  writeWorkspaceFiles(scope, normalized);
  return normalized;
}

function readFilePayloadMap(scope: WorkspaceFileScope): Record<string, FilePayload> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(payloadStorageKey(scope));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, FilePayload>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFilePayloadMap(scope: WorkspaceFileScope, map: Record<string, FilePayload>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(payloadStorageKey(scope), JSON.stringify(map));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Fil kunde inte läsas som data URL."));
      }
    };
    reader.onerror = () => reject(new Error("Filinläsning misslyckades."));
    reader.readAsDataURL(file);
  });
}

export async function storeWorkspaceFilePayload(
  scope: WorkspaceFileScope,
  fileId: string,
  file: File
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (file.size > FILE_PAYLOAD_MAX_BYTES) return false;

  try {
    const dataUrl = await fileToDataUrl(file);
    const map = readFilePayloadMap(scope);
    map[fileId] = {
      id: fileId,
      mimeType: file.type || "application/octet-stream",
      dataUrl,
      uploadedAt: new Date().toISOString(),
      sizeKb: Number((file.size / 1024).toFixed(1)),
    };
    writeFilePayloadMap(scope, map);
    return true;
  } catch {
    return false;
  }
}

export function removeWorkspaceFilePayload(scope: WorkspaceFileScope, fileId: string) {
  const map = readFilePayloadMap(scope);
  if (!map[fileId]) return;
  delete map[fileId];
  writeFilePayloadMap(scope, map);
}

export function hasWorkspaceFilePayload(scope: WorkspaceFileScope, fileId: string): boolean {
  const map = readFilePayloadMap(scope);
  return Boolean(map[fileId]?.dataUrl);
}

export function openWorkspaceFile(scope: WorkspaceFileScope, fileId: string): boolean {
  if (typeof window === "undefined") return false;
  const map = readFilePayloadMap(scope);
  const payload = map[fileId];
  if (!payload?.dataUrl) return false;
  window.open(payload.dataUrl, "_blank", "noopener,noreferrer");
  return true;
}
