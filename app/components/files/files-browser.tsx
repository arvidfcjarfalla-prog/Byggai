"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteFile,
  findEntityByRefId,
  getFile,
  listFiles,
  persistFileDeletionInBackend,
  persistFileMetadataUpdateInBackend,
  shareFileToWorkspace,
  subscribeProjectFiles,
  updateFileMetadata,
  type ShareFileInput,
} from "../../lib/project-files/store";
import type { ProjectFile, ProjectFolder, WorkspaceId } from "../../lib/project-files/types";
import { sendRequestMessage } from "../../lib/request-messages";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../lib/requests-store";

const FOLDERS: Array<{ id: ProjectFolder; label: string }> = [
  { id: "offert", label: "Offert" },
  { id: "avtal", label: "Avtal" },
  { id: "ata", label: "ÄTA" },
  { id: "bilder", label: "Bilder" },
  { id: "ritningar", label: "Ritningar" },
  { id: "ovrigt", label: "Övrigt" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sourceLabel(sourceType: ProjectFile["sourceType"]): string {
  if (sourceType === "offert") return "Offert";
  if (sourceType === "avtal") return "Avtal";
  if (sourceType === "ata") return "ÄTA";
  return "Manuell";
}

function folderLabel(folder: ProjectFolder): string {
  const match = FOLDERS.find((entry) => entry.id === folder);
  return match?.label ?? folder;
}

function blobPartFromBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function isDocumentFile(file: ProjectFile): boolean {
  return file.sourceType === "offert" || file.sourceType === "avtal" || file.sourceType === "ata";
}

function canManageFile(file: ProjectFile, workspaceId: WorkspaceId): boolean {
  if (workspaceId === "entreprenor") return !file.recipientWorkspaceId;
  return file.recipientWorkspaceId === workspaceId || file.senderWorkspaceId === workspaceId;
}

export function FilesBrowser({
  workspaceId,
  actorRole,
  actorLabel,
  allowShare,
}: {
  workspaceId: WorkspaceId;
  actorRole: "entreprenor" | "brf" | "privatperson";
  actorLabel: string;
  allowShare?: boolean;
}) {
  const router = useRouter();
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [folder, setFolder] = useState<ProjectFolder | "all">("all");
  const [query, setQuery] = useState("");
  const [jumpRefId, setJumpRefId] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editFolder, setEditFolder] = useState<ProjectFolder>("ovrigt");

  useEffect(() => {
    const syncRequests = () => {
      const filtered =
        workspaceId === "entreprenor"
          ? listRequests()
          : listRequests().filter((request) =>
              workspaceId === "brf" ? request.audience === "brf" : request.audience === "privat"
            );
      setRequests(filtered);
      if (!projectId && filtered[0]?.id) {
        setProjectId(filtered[0].id);
      }
      if (projectId && !filtered.some((request) => request.id === projectId)) {
        setProjectId(filtered[0]?.id ?? "");
      }
    };

    syncRequests();
    return subscribeRequests(syncRequests);
  }, [projectId, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if (!projectId) {
        if (!cancelled) setFiles([]);
        return;
      }
      try {
        const listed = await listFiles(
          projectId,
          folder === "all" ? undefined : folder,
          query,
          workspaceId
        );
        if (!cancelled) setFiles(listed);
      } catch {
        if (!cancelled) setNotice("Kunde inte läsa filer från backend just nu.");
      }
    };

    void sync();
    const unsubscribe = subscribeProjectFiles(() => {
      void sync();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [folder, projectId, query, workspaceId]);

  const activeProject = useMemo(
    () => requests.find((request) => request.id === projectId) ?? null,
    [projectId, requests]
  );

  const openFile = async (file: ProjectFile) => {
    setBusyFileId(file.id);
    try {
      const loaded = await getFile(file.projectId, file.id);
      if (!loaded || !loaded.bytes) {
        setNotice("Filen kunde inte öppnas eftersom innehållet saknas.");
        return;
      }

      const blob = new Blob([blobPartFromBytes(loaded.bytes)], { type: loaded.file.mimeType });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
      setNotice(null);
    } catch {
      setNotice("Kunde inte öppna filen just nu.");
    } finally {
      setBusyFileId(null);
    }
  };

  const handleShare = async (file: ProjectFile, target: WorkspaceId) => {
    if (!projectId) return;
    setBusyFileId(file.id);
    try {
      const payload: ShareFileInput = {
        fileId: file.id,
        fromProjectId: projectId,
        toProjectId: projectId,
        toWorkspaceId: target,
        senderRole: actorRole,
        senderWorkspaceId: workspaceId,
        senderLabel: actorLabel,
      };
      await shareFileToWorkspace(payload);
      setNotice(`Filen skickades till ${target === "brf" ? "BRF" : "Privatperson"}.`);
    } catch (error) {
      const fallback = "Kunde inte dela filen.";
      setNotice(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setBusyFileId(null);
    }
  };

  const beginEdit = (file: ProjectFile) => {
    setEditingFileId(file.id);
    setEditFilename(file.filename);
    setEditFolder(file.folder);
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingFileId(null);
    setEditFilename("");
    setEditFolder("ovrigt");
  };

  const handleSaveEdit = async (file: ProjectFile) => {
    if (!projectId) return;
    setBusyFileId(file.id);
    try {
      const previousFilename = file.filename;
      const previousFolder = file.folder;
      const updated = updateFileMetadata({
        projectId,
        fileId: file.id,
        filename: editFilename,
        folder: editFolder,
      });
      if (!updated) {
        setNotice("Kunde inte uppdatera filen.");
        return;
      }

      try {
        await persistFileMetadataUpdateInBackend({
          projectId,
          fileId: file.id,
          fileRefId: file.refId,
          actorRole,
          actorLabel,
          previousFilename,
          nextFilename: updated.filename,
          previousFolder,
          nextFolder: updated.folder,
        });
        setNotice("Filen uppdaterades.");
      } catch (error) {
        const fallback = "Filen uppdaterades lokalt men kunde inte sparas i backend.";
        setNotice(error instanceof Error && error.message ? error.message : fallback);
      }

      cancelEdit();
    } catch (error) {
      const fallback = "Kunde inte uppdatera filen.";
      setNotice(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setBusyFileId(null);
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    if (!projectId) return;

    const confirmed = window.confirm(`Ta bort filen "${file.filename}"?`);
    if (!confirmed) return;

    setBusyFileId(file.id);
    try {
      const idsToDelete = new Set<string>([file.id]);
      const shouldNotify = workspaceId === "entreprenor" && isDocumentFile(file) && !file.recipientWorkspaceId;
      const notifyWorkspaces = shouldNotify ? (["brf", "privat"] as const) : [];

      if (shouldNotify) {
        const relatedCopies = (await listFiles(projectId)).filter(
          (entry) =>
            entry.id !== file.id &&
            entry.sourceId === file.sourceId &&
            entry.sourceType === file.sourceType &&
            entry.recipientWorkspaceId !== undefined
        );
        relatedCopies.forEach((entry) => idsToDelete.add(entry.id));
      }

      const persisted = await persistFileDeletionInBackend({
        projectId,
        fileId: file.id,
        fileRefId: file.refId,
        filename: file.filename,
        actorRole,
        actorLabel,
        notifyWorkspaces: [...notifyWorkspaces],
      });

      let deletedCount = 0;
      for (const id of idsToDelete) {
        const deleted = await deleteFile(
          projectId,
          id,
          id === file.id ? { skipBackend: true } : undefined
        );
        if (deleted) deletedCount += 1;
      }

      if (deletedCount === 0) {
        setNotice("Filen kunde inte tas bort.");
        return;
      }

      if (shouldNotify) {
        sendRequestMessage({
          requestId: projectId,
          authorRole: "system",
          authorLabel: "Byggplattformen",
          messageType: "document",
          body: `Dokumentet "${file.filename}" (${file.refId}) har tagits bort av ${actorLabel}.`,
          targetRoles: ["brf", "privatperson"],
        });
      }

      if (editingFileId === file.id) {
        cancelEdit();
      }

      setNotice(
        shouldNotify
          ? persisted.notificationsCreated > 0
            ? "Dokumentet togs bort. BRF och privatperson har fått en notis."
            : "Dokumentet togs bort."
          : "Filen togs bort."
      );
    } catch (error) {
      const fallback = "Kunde inte ta bort filen.";
      setNotice(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setBusyFileId(null);
    }
  };

  const handleJumpByRefId = () => {
    if (!projectId || !jumpRefId.trim()) return;
    const found = findEntityByRefId(projectId, jumpRefId);
    if (!found) {
      setNotice("Ingen träff på RefID i detta projekt.");
      return;
    }

    if (found.kind === "FIL") {
      setQuery(jumpRefId.trim());
      setNotice("Fil hittad. Listan är filtrerad på RefID.");
      return;
    }

    if (workspaceId === "entreprenor") {
      router.push(`/dashboard/entreprenor/dokument/${found.id}`);
      return;
    }

    if (workspaceId === "brf") {
      router.push(`/dashboard/brf/dokument/${found.id}`);
      return;
    }

    router.push(`/dashboard/privat/dokument/${found.id}`);
  };

  return (
    <section className="space-y-5 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <header className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="text-xs font-semibold text-[#6B5A47]">
            Projekt
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            >
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.title}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-[#6B5A47]">
            Sök fil
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filnamn eller RefID..."
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={jumpRefId}
            onChange={(event) => setJumpRefId(event.target.value)}
            placeholder="Snabbhopp via RefID (DOC-/FIL-...)"
            className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
          />
          <button
            type="button"
            onClick={handleJumpByRefId}
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Hitta RefID
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFolder("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              folder === "all" ? "bg-[#8C7860] text-white" : "bg-[#EFE9DE] text-[#6B5A47]"
            }`}
          >
            Alla
          </button>
          {FOLDERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFolder(entry.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                folder === entry.id ? "bg-[#8C7860] text-white" : "bg-[#EFE9DE] text-[#6B5A47]"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#766B60]">
          {activeProject ? `${activeProject.title} · ${activeProject.location}` : "Inget projekt valt"}
        </p>
      </header>

      {files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-4 text-sm text-[#6B5A47]">
          Inga filer hittades i denna vy.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#2A2520]">{file.filename}</p>
                <p className="text-xs text-[#6B5A47]">
                  {new Date(file.createdAt).toLocaleString("sv-SE")} · {formatSize(file.size)} · {sourceLabel(file.sourceType)}
                </p>
                <p className="font-mono text-[11px] text-[#6B5A47]">RefID: {file.refId}</p>
                <p className="text-[11px] text-[#766B60]">
                  Mapp: {folderLabel(file.folder)} · Skapad av: {file.createdBy}
                  {file.deliveredAt ? ` · Levererad: ${new Date(file.deliveredAt).toLocaleDateString("sv-SE")}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(file.refId)}
                  className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Kopiera RefID
                </button>
                <button
                  type="button"
                  onClick={() => void openFile(file)}
                  disabled={busyFileId === file.id}
                  className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Öppna fil
                </button>
                {canManageFile(file, workspaceId) && (
                  <>
                    {editingFileId === file.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(file)}
                          disabled={busyFileId === file.id}
                          className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                        >
                          Spara
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={busyFileId === file.id}
                          className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                        >
                          Avbryt
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => beginEdit(file)}
                        disabled={busyFileId === file.id}
                        className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                      >
                        Ändra
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(file)}
                      disabled={busyFileId === file.id}
                      className="rounded-lg border border-[#E3C9C1] bg-white px-2 py-1 text-xs font-semibold text-[#8A4F3B] hover:bg-[#FFF4F1]"
                    >
                      Ta bort
                    </button>
                  </>
                )}
                {allowShare && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleShare(file, "brf")}
                      disabled={busyFileId === file.id}
                      className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Skicka BRF
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare(file, "privat")}
                      disabled={busyFileId === file.id}
                      className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Skicka Privat
                    </button>
                  </>
                )}
              </div>
              {editingFileId === file.id && (
                <div className="mt-3 grid w-full gap-2 rounded-xl border border-[#E8E3DC] bg-white p-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={editFilename}
                    onChange={(event) => setEditFilename(event.target.value)}
                    placeholder="Filnamn"
                    className="w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1 text-xs text-[#2A2520]"
                  />
                  <select
                    value={editFolder}
                    onChange={(event) => setEditFolder(event.target.value as ProjectFolder)}
                    className="rounded-lg border border-[#D9D1C6] bg-white px-2 py-1 text-xs text-[#2A2520]"
                  >
                    {FOLDERS.map((entry) => (
                      <option key={`edit-folder-${entry.id}`} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleSaveEdit(file)}
                    disabled={busyFileId === file.id}
                    className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                  >
                    Spara ändring
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p className="rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
          {notice}
        </p>
      )}
    </section>
  );
}
