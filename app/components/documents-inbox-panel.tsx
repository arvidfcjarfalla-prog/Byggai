"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useActiveProject } from "./active-project-context";
import {
  listDocuments,
  subscribeDocuments,
  type PlatformDocument,
} from "../lib/documents-store";
import {
  listRequests,
  subscribeRequests,
  type PlatformRequest,
} from "../lib/requests-store";
import { routes } from "../lib/routes";

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

function signerLabel(document: PlatformDocument): string {
  if (document.acceptedByLabel && document.acceptedByLabel.trim().length > 0) {
    return document.acceptedByLabel.trim();
  }
  return document.audience === "brf" ? "BRF" : "Privatperson";
}

async function copyRefId(refId: string) {
  await navigator.clipboard.writeText(refId);
}

export function DocumentsInboxPanel({ audience }: { audience: "brf" | "privat" }) {
  const searchParams = useSearchParams();
  const { activeProject } = useActiveProject();
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [documents, setDocuments] = useState<PlatformDocument[]>([]);
  const scopedProjectId = activeProject?.audience === audience ? activeProject.id : null;
  const typeFilter = searchParams.get("type");
  const normalizedTypeFilter =
    typeFilter === "quote" || typeFilter === "contract" || typeFilter === "ate" ? typeFilter : null;

  useEffect(() => {
    const sync = () => {
      let nextRequests = listRequests().filter((request) => request.audience === audience);
      let nextDocuments = listDocuments().filter(
        (doc) => doc.audience === audience && doc.status !== "draft"
      );
      if (scopedProjectId) {
        nextRequests = nextRequests.filter((request) => request.id === scopedProjectId);
        nextDocuments = nextDocuments.filter((doc) => doc.requestId === scopedProjectId);
      }
      if (normalizedTypeFilter) {
        nextDocuments = nextDocuments.filter((doc) => doc.type === normalizedTypeFilter);
      }
      setRequests(nextRequests);
      setDocuments(nextDocuments);
    };

    sync();
    const unsubRequests = subscribeRequests(sync);
    const unsubDocuments = subscribeDocuments(sync);
    return () => {
      unsubRequests();
      unsubDocuments();
    };
  }, [audience, normalizedTypeFilter, scopedProjectId]);

  const requestById = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, PlatformDocument[]>();
    documents.forEach((document) => {
      const existing = groups.get(document.requestId) ?? [];
      existing.push(document);
      groups.set(document.requestId, existing);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      const aTime = Math.max(...a[1].map((doc) => Date.parse(doc.updatedAt)));
      const bTime = Math.max(...b[1].map((doc) => Date.parse(doc.updatedAt)));
      return bTime - aTime;
    });
  }, [documents]);

  if (grouped.length === 0) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2520]">Dokumentinkorg</h2>
        <p className="mt-2 text-sm text-[#766B60]">
          Inga skickade dokument än så länge.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {normalizedTypeFilter && (
        <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Dokumentfilter</p>
          <p className="text-sm font-semibold text-[#2A2520]">
            Visar endast {typeLabel(normalizedTypeFilter).toLowerCase()}-dokument.
          </p>
        </div>
      )}
      {scopedProjectId && (
        <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Aktivt projekt</p>
          <p className="text-sm font-semibold text-[#2A2520]">
            Visar endast dokument för valt projekt i dashboarden.
          </p>
        </div>
      )}
      {grouped.map(([requestId, docs]) => {
        const request = requestById.get(requestId);
        return (
          <article key={requestId} className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#2A2520]">{request?.title ?? "Projektförfrågan"}</h3>
            <p className="mt-1 text-xs text-[#766B60]">
              {request?.location ?? "Okand plats"} · Request ID: {requestId}
            </p>
            <p className="text-xs text-[#8C7860]">
              Skapad:{" "}
              {request?.createdAt
                ? new Date(request.createdAt).toLocaleDateString("sv-SE")
                : "okänt datum"}{" "}
              · Dokument: {docs.length}
            </p>
            {(() => {
              const sortedDocs = docs
                .slice()
                .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
              const signedDocs = sortedDocs.filter((document) => document.status === "accepted");
              const otherDocs = sortedDocs.filter((document) => document.status !== "accepted");

              const renderDocList = (items: PlatformDocument[]) => (
                <ul className="mt-2 space-y-2">
                  {items.map((document) => {
                    const acceptedAtLabel = formatDateTimeLabel(document.acceptedAt);
                    return (
                      <li
                        key={document.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#2A2520]">{document.title}</p>
                          <p className="text-xs text-[#6B5A47]">
                            {typeLabel(document.type)} · v{document.version} · {statusLabel(document.status)}
                          </p>
                          {document.status === "accepted" && acceptedAtLabel && (
                            <p className="text-xs font-semibold text-[#3F6B3F]">
                              Signerat av {signerLabel(document)} {acceptedAtLabel}
                            </p>
                          )}
                          <p className="font-mono text-[11px] text-[#6B5A47]">{document.refId}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyRefId(document.refId)}
                            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Kopiera RefID
                          </button>
                          <Link
                            href={
                              audience === "brf"
                                ? routes.brf.documentDetail({ documentId: document.id, requestId })
                                : routes.privatperson.documentDetail({ documentId: document.id, requestId })
                            }
                            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Öppna
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );

              return (
                <div className="mt-3 space-y-3">
                  {signedDocs.length > 0 && (
                    <section className="rounded-2xl border border-[#D8E8CF] bg-[#F7FCF3] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#5F7A4D]">
                          Signerade dokument
                        </p>
                        <span className="rounded-full border border-[#D7E7CD] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#5F7A4D]">
                          {signedDocs.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#5F7A4D]">
                        Dokument som har signerats/godkänts. Visar signerare och tidpunkt.
                      </p>
                      {renderDocList(signedDocs)}
                    </section>
                  )}

                  {otherDocs.length > 0 && (
                    <section className="rounded-2xl border border-[#E8E3DC] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                          {signedDocs.length > 0 ? "Övriga inskickade dokument" : "Inskickade dokument"}
                        </p>
                        <span className="rounded-full border border-[#E8E3DC] bg-[#FAF8F5] px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]">
                          {otherDocs.length}
                        </span>
                      </div>
                      {renderDocList(otherDocs)}
                    </section>
                  )}
                </div>
              );
            })()}
          </article>
        );
      })}
    </section>
  );
}
