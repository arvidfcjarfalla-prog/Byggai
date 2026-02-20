"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createDocumentFromTemplate,
  saveDocument,
  type DocumentAttachmentRef,
  type DocumentType,
} from "../lib/documents-store";
import { generateAndStoreDocumentPdf } from "../lib/project-files/document-integration";
import { listFiles } from "../lib/project-files/store";
import type { PlatformRequest } from "../lib/requests-store";
import { AttachmentPicker } from "./attachments/attachment-picker";

interface RequestDocumentGeneratorPanelProps {
  request: PlatformRequest;
  actorLabel: string;
  onDocumentSent?: () => void;
}

const DOCUMENT_OPTIONS: Array<{ kind: DocumentType; label: string }> = [
  { kind: "quote", label: "Offert" },
  { kind: "contract", label: "Avtal" },
  { kind: "ate", label: "ÄTA" },
];

function typeLabel(type: DocumentType): string {
  return DOCUMENT_OPTIONS.find((option) => option.kind === type)?.label ?? "Dokument";
}

export function RequestDocumentGeneratorPanel({
  request,
  actorLabel,
  onDocumentSent,
}: RequestDocumentGeneratorPanelProps) {
  const router = useRouter();
  const [kind, setKind] = useState<DocumentType>("quote");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const draftTemplate = useMemo(
    () => createDocumentFromTemplate(request, kind, "entreprenor", actorLabel),
    [actorLabel, kind, request]
  );

  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    const projectFiles = listFiles(request.id, undefined, undefined, "entreprenor");
    const byId = new Map(projectFiles.map((file) => [file.id, file]));
    const attachments: DocumentAttachmentRef[] = selectedFileIds
      .map((fileId) => byId.get(fileId))
      .filter((file): file is (typeof projectFiles)[number] => Boolean(file))
      .map((file) => ({
        fileId: file.id,
        fileRefId: file.refId,
        filename: file.filename,
        folder: file.folder,
        mimeType: file.mimeType,
      }));

    const next = {
      ...draftTemplate,
      linkedFileIds: selectedFileIds,
      attachments,
    };
    try {
      const saved = saveDocument(next).find((entry) => entry.id === next.id) ?? next;
      await generateAndStoreDocumentPdf({
        document: saved,
        request,
        createdBy: actorLabel,
        senderRole: "entreprenor",
        senderWorkspaceId: "entreprenor",
      });
      setNotice(`${typeLabel(kind)} skapad och PDF lagd i Filer. Öppnar editor...`);
      onDocumentSent?.();
      router.push(`/dashboard/entreprenor/dokument/${saved.id}`);
    } catch (error) {
      const fallback = "Kunde inte skapa PDF-filen just nu.";
      setNotice(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-[#2A2520]">Skapa projektbundet dokument</h3>
      <p className="mt-1 text-sm text-[#766B60]">
        Dokument sparas som objekt kopplat till förfrågan och redigeras i dokument-editor.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
          <label className="block text-xs font-semibold text-[#6B5A47]">
            Dokumenttyp
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as DocumentType)}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            >
              {DOCUMENT_OPTIONS.map((option) => (
                <option key={option.kind} value={option.kind}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <AttachmentPicker
            projectId={request.id}
            selectedFileIds={selectedFileIds}
            onChange={setSelectedFileIds}
            workspaceId="entreprenor"
          />

          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47]"
          >
            {isCreating ? "Skapar..." : "Skapa dokument"}
          </button>
        </div>

        <article className="rounded-2xl border border-[#E8E3DC] bg-[#FCFBF8] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">Preview av utkast</p>
          <div className="mt-2 rounded-xl border border-[#EFE8DD] bg-white p-3 text-xs text-[#2A2520]">
            <p className="font-semibold">{draftTemplate.title}</p>
            <p className="mt-1 text-[#6B5A47]">Typ: {typeLabel(kind)}</p>
            <p className="text-[#6B5A47]">Sektioner: {draftTemplate.sections.length} st</p>
            <p className="text-[#6B5A47]">Bilagor valda: {selectedFileIds.length} st</p>
            <p className="mt-2 text-[#766B60]">
              Öppna editorn för att toggla sektioner, redigera fält och skicka dokumentet.
            </p>
          </div>
        </article>
      </div>

      {notice && (
        <p className="mt-3 rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
          {notice}
        </p>
      )}
    </section>
  );
}
