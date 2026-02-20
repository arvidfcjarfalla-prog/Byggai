import type { ProjectFileContentRef } from "./types";

const IDB_DB_NAME = "byggplattformen-project-files-content";
const IDB_STORE_NAME = "content";
const LOCAL_FALLBACK_KEY = "byggplattformen-project-files-content-local";

/**
 * Notes:
 * localStorage har liten kvot och base64 växer filstorleken.
 * Därför används IndexedDB först och localStorage endast som fallback
 * med hård gräns för att undvika att hela appens lagring blockeras.
 */
export const LOCAL_STORAGE_CONTENT_MAX_BYTES = 2_500_000;

interface LocalContentEntry {
  contentId: string;
  mimeType: string;
  size: number;
  base64: string;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const part = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...part);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function readLocalFallbackMap(): Record<string, LocalContentEntry> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, LocalContentEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalFallbackMap(map: Record<string, LocalContentEntry>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(map));
}

function openContentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB är inte tillgängligt."));
      return;
    }

    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Kunde inte öppna IndexedDB."));
  });
}

async function putInIndexedDb(contentId: string, bytes: Uint8Array): Promise<void> {
  const db = await openContentDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.put(bytes.buffer, contentId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Kunde inte skriva filinnehåll till IndexedDB."));
  });
  db.close();
}

async function readFromIndexedDb(contentId: string): Promise<Uint8Array | null> {
  const db = await openContentDb();
  try {
    const value = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(contentId);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Kunde inte läsa filinnehåll från IndexedDB."));
    });
    return value ? new Uint8Array(value) : null;
  } finally {
    db.close();
  }
}

async function deleteFromIndexedDb(contentId: string): Promise<void> {
  const db = await openContentDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.delete(contentId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Kunde inte radera filinnehåll från IndexedDB."));
  });
  db.close();
}

export async function storeContent(
  bytes: Uint8Array,
  mimeType: string
): Promise<ProjectFileContentRef> {
  const contentId = nextId("file-content");

  try {
    await putInIndexedDb(contentId, bytes);
    return {
      storage: "idb",
      contentId,
      mimeType,
      size: bytes.byteLength,
    };
  } catch {
    if (bytes.byteLength > LOCAL_STORAGE_CONTENT_MAX_BYTES) {
      throw new Error(
        `Filen är för stor för lokal fallback-lagring (${bytes.byteLength} bytes).`
      );
    }

    const map = readLocalFallbackMap();
    map[contentId] = {
      contentId,
      mimeType,
      size: bytes.byteLength,
      base64: bytesToBase64(bytes),
    };
    writeLocalFallbackMap(map);

    return {
      storage: "localStorage",
      contentId,
      mimeType,
      size: bytes.byteLength,
    };
  }
}

export async function readContent(ref: ProjectFileContentRef): Promise<Uint8Array | null> {
  if (ref.storage === "idb") {
    try {
      return await readFromIndexedDb(ref.contentId);
    } catch {
      return null;
    }
  }

  const map = readLocalFallbackMap();
  const entry = map[ref.contentId];
  if (!entry?.base64) return null;
  return base64ToBytes(entry.base64);
}

export async function deleteContent(ref: ProjectFileContentRef): Promise<void> {
  if (ref.storage === "idb") {
    try {
      await deleteFromIndexedDb(ref.contentId);
    } catch {
      return;
    }
    return;
  }

  const map = readLocalFallbackMap();
  if (!map[ref.contentId]) return;
  delete map[ref.contentId];
  writeLocalFallbackMap(map);
}
