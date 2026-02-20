"use client";

import { useEffect, useMemo, useState } from "react";
import { listFiles, subscribeProjectFiles } from "../../lib/project-files/store";
import type { ProjectFile, ProjectFolder, WorkspaceId } from "../../lib/project-files/types";

const FOLDERS: Array<{ id: ProjectFolder | "all"; label: string }> = [
  { id: "all", label: "Alla" },
  { id: "offert", label: "Offert" },
  { id: "avtal", label: "Avtal" },
  { id: "ata", label: "ÄTA" },
  { id: "bilder", label: "Bilder" },
  { id: "ritningar", label: "Ritningar" },
  { id: "ovrigt", label: "Övrigt" },
];

function sourceLabel(sourceType: ProjectFile["sourceType"]): string {
  if (sourceType === "offert") return "Offert";
  if (sourceType === "avtal") return "Avtal";
  if (sourceType === "ata") return "ÄTA";
  return "Manuell";
}

export function AttachmentPicker({
  projectId,
  selectedFileIds,
  onChange,
  workspaceId,
}: {
  projectId: string;
  selectedFileIds: string[];
  onChange: (ids: string[]) => void;
  workspaceId?: WorkspaceId;
}) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<ProjectFolder | "all">("all");
  const [sourceType, setSourceType] = useState<ProjectFile["sourceType"] | "all">("all");

  useEffect(() => {
    const sync = () => {
      const listed = listFiles(
        projectId,
        folder === "all" ? undefined : folder,
        query,
        workspaceId
      );
      setFiles(listed);
    };

    sync();
    return subscribeProjectFiles(sync);
  }, [folder, projectId, query, workspaceId]);

  const filtered = useMemo(
    () =>
      files.filter((file) =>
        sourceType === "all" ? true : file.sourceType === sourceType
      ),
    [files, sourceType]
  );

  return (
    <div>
      <p className="text-xs font-semibold text-[#6B5A47]">Välj bilagor</p>
      <div className="mt-2 space-y-2 rounded-xl border border-[#E8E3DC] bg-white p-2">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök filnamn, RefID eller mapp..."
            className="w-full rounded-lg border border-[#D9D1C6] px-2 py-1.5 text-xs"
          />
          <select
            value={folder}
            onChange={(event) => setFolder(event.target.value as ProjectFolder | "all")}
            className="rounded-lg border border-[#D9D1C6] px-2 py-1.5 text-xs"
          >
            {FOLDERS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            value={sourceType}
            onChange={(event) =>
              setSourceType(event.target.value as ProjectFile["sourceType"] | "all")
            }
            className="rounded-lg border border-[#D9D1C6] px-2 py-1.5 text-xs"
          >
            <option value="all">Alla typer</option>
            <option value="offert">Offert</option>
            <option value="avtal">Avtal</option>
            <option value="ata">ÄTA</option>
            <option value="manual">Manuell</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-[#766B60]">Inga filer hittades i projektets Filer.</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-auto">
            {filtered.map((file) => {
              const checked = selectedFileIds.includes(file.id);
              return (
                <li key={file.id}>
                  <label className="flex items-start gap-2 rounded-lg border border-[#E8E3DC] bg-[#FAF8F5] px-2 py-1.5 text-xs text-[#2A2520]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        onChange(
                          checked
                            ? selectedFileIds.filter((id) => id !== file.id)
                            : [...selectedFileIds, file.id]
                        );
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{file.filename}</span>
                      <span className="block text-[11px] text-[#6B5A47]">
                        {file.refId} · {sourceLabel(file.sourceType)} · {file.folder}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
