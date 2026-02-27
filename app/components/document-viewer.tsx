"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PlatformDocument } from "../lib/documents-store";
import type { PlatformRequest } from "../lib/requests-store";
import { renderDocumentToHtml } from "../lib/document-renderer";
import { getFile, listFiles, subscribeProjectFiles } from "../lib/project-files/store";
import type { ProjectFile } from "../lib/project-files/types";
import { Breadcrumbs, type Crumb } from "./ui/breadcrumbs";

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

function blobPartFromBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function formatDateTimeLabel(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentViewer({
  document,
  request,
  backHref,
  backLabel,
  breadcrumbs,
  approvalAction,
}: {
  document: PlatformDocument;
  request: PlatformRequest | null;
  backHref: string;
  backLabel: string;
  breadcrumbs?: Crumb[];
  approvalAction?: {
    onApprove: () => void | Promise<void>;
    disabled?: boolean;
    pending?: boolean;
    label?: string;
  };
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const previewHtml = useMemo(() => renderDocumentToHtml(document, request), [document, request]);
  const [pdfFile, setPdfFile] = useState<ProjectFile | null>(null);
  const acceptedAtLabel = formatDateTimeLabel(document.acceptedAt);
  const recipientLabel = document.audience === "brf" ? "BRF" : "privatperson";
  const acceptedByLabel = document.acceptedByLabel ?? recipientLabel;

  useEffect(() => {
    let cancelled = false;
    const loadPdfCandidate = async () => {
      try {
        const candidates = (await listFiles(document.requestId)).filter(
          (file) =>
            file.sourceId === document.id &&
            file.version === document.version &&
            file.mimeType === "application/pdf"
        );
        const preferredRecipient = document.audience === "brf" ? "brf" : "privat";
        const next =
          candidates.find((file) => file.recipientWorkspaceId === preferredRecipient) ??
          candidates.find((file) => !file.recipientWorkspaceId) ??
          candidates[0] ??
          null;
        if (!cancelled) {
          setPdfFile(next);
        }
      } catch {
        if (!cancelled) {
          setPdfFile(null);
        }
      }
    };

    void loadPdfCandidate();
    const unsubscribe = subscribeProjectFiles(() => {
      void loadPdfCandidate();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [document.audience, document.id, document.requestId, document.version]);

  const linkedFiles =
    document.attachments.length > 0
      ? document.attachments
      : document.linkedFileIds.map((fileId) => ({
          fileId,
          fileRefId: "",
          filename: fileId,
          folder: "ovrigt",
          mimeType: "application/octet-stream",
        }));

  return (
    <section className="space-y-6">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

      <div className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#2A2520]">{document.title}</h2>
            <p className="mt-1 text-sm text-[#766B60]">
              {typeLabel(document.type)} · {statusLabel(document.status)} · Version {document.version}
            </p>
            <p className="text-xs text-[#766B60]">Request: {document.requestId} · RefID: {document.refId}</p>
            {document.status === "accepted" && acceptedAtLabel && (
              <p className="mt-1 text-xs font-semibold text-[#3F6B3F]">
                Signerat/godkänt av {acceptedByLabel} {acceptedAtLabel}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(document.refId)}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Kopiera RefID
            </button>
            <Link
              href={backHref}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              {backLabel}
            </Link>
            {approvalAction && (
              <button
                type="button"
                onClick={() => void approvalAction.onApprove()}
                disabled={approvalAction.disabled || approvalAction.pending}
                className="rounded-xl border border-[#A9C19F] bg-[#EDF7E8] px-3 py-2 text-xs font-semibold text-[#355B35] hover:bg-[#E2F0DB] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approvalAction.pending ? "Signerar..." : approvalAction.label ?? "Signera"}
              </button>
            )}
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
        <h3 className="text-base font-bold text-[#2A2520]">Relaterade filer</h3>
        {pdfFile && (
          <div className="mt-2 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">
              Dokument-PDF
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-[#2A2520]">{pdfFile.filename}</p>
                <p className="font-mono text-[11px] text-[#6B5A47]">{pdfFile.refId}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const loaded = await getFile(document.requestId, pdfFile.id);
                  if (!loaded || !loaded.bytes) {
                    setNotice("Kunde inte öppna PDF. Filens innehåll saknas.");
                    return;
                  }
                  const blob = new Blob([blobPartFromBytes(loaded.bytes)], {
                    type: "application/pdf",
                  });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank", "noopener,noreferrer");
                  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
                  setNotice(null);
                }}
                className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Öppna PDF
              </button>
            </div>
          </div>
        )}

        {linkedFiles.length === 0 ? (
          <p className="mt-2 text-sm text-[#766B60]">Inga bilagor kopplade.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {linkedFiles.map((entry) => (
              <li key={entry.fileId} className="flex items-center justify-between gap-2 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <div className="min-w-0">
                  <span className="block truncate text-sm text-[#2A2520]">{entry.filename}</span>
                  <span className="font-mono text-[11px] text-[#6B5A47]">{entry.fileRefId || "Saknar RefID"}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const loaded = await getFile(document.requestId, entry.fileId);
                    if (!loaded || !loaded.bytes) {
                      setNotice("Kunde inte öppna bilaga. Filens innehåll saknas.");
                      return;
                    }
                    const blob = new Blob([blobPartFromBytes(loaded.bytes)], { type: loaded.file.mimeType });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank", "noopener,noreferrer");
                    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
                    setNotice(null);
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
