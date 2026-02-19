"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlatformDocument } from "../lib/documents-store";
import type { PlatformRequest } from "../lib/requests-store";
import { openWorkspaceFile } from "../lib/brf-workspace";
import { renderDocumentToHtml } from "../lib/document-renderer";

function typeLabel(type: PlatformDocument["type"]): string {
  if (type === "quote") return "Offert";
  if (type === "contract") return "Avtal";
  return "ÄTA";
}

function statusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslog";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

export function DocumentViewer({
  document,
  request,
  backHref,
  backLabel,
}: {
  document: PlatformDocument;
  request: PlatformRequest | null;
  backHref: string;
  backLabel: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const previewHtml = useMemo(() => renderDocumentToHtml(document, request), [document, request]);

  const fileMap = new Map(
    (request?.files ?? [])
      .filter((file) => Boolean(file.id))
      .map((file) => [file.id as string, file])
  );

  const linkedFiles = document.linkedFileIds
    .map((fileId) => ({ fileId, file: fileMap.get(fileId) }))
    .filter((entry) => entry.file);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#2A2520]">{document.title}</h2>
            <p className="mt-1 text-sm text-[#766B60]">
              {typeLabel(document.type)} · {statusLabel(document.status)} · Version {document.version}
            </p>
            <p className="text-xs text-[#766B60]">Request: {document.requestId}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={backHref}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              {backLabel}
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-[#8C7860] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6B5A47]"
            >
              Skriv ut / Spara som PDF
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-[#2A2520]">Bilagor</h3>
        {linkedFiles.length === 0 ? (
          <p className="mt-2 text-sm text-[#766B60]">Inga bilagor kopplade.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {linkedFiles.map((entry) => (
              <li key={entry.fileId} className="flex items-center justify-between gap-2 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <span className="truncate text-sm text-[#2A2520]">{entry.file?.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    const opened = openWorkspaceFile(document.audience === "brf" ? "brf" : "privat", entry.fileId);
                    setNotice(opened ? null : "Kunde inte öppna bilaga från payload-lager. Filen listas fortfarande i dokumentet.");
                  }}
                  className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Öppna
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <article className="rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-[#2A2520]">Dokument</h3>
        <div className="mt-3 h-[78vh] overflow-hidden rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5]">
          <iframe title="Dokument" srcDoc={previewHtml} className="h-full w-full" />
        </div>
      </article>

      {notice && (
        <p className="rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
          {notice}
        </p>
      )}
    </section>
  );
}
