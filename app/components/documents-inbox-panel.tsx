"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export function DocumentsInboxPanel({ audience }: { audience: "brf" | "privat" }) {
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [documents, setDocuments] = useState<PlatformDocument[]>([]);

  useEffect(() => {
    const sync = () => {
      setRequests(listRequests().filter((request) => request.audience === audience));
      setDocuments(
        listDocuments().filter(
          (doc) => doc.audience === audience && doc.status !== "draft"
        )
      );
    };

    sync();
    const unsubRequests = subscribeRequests(sync);
    const unsubDocuments = subscribeDocuments(sync);
    return () => {
      unsubRequests();
      unsubDocuments();
    };
  }, [audience]);

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
      {grouped.map(([requestId, docs]) => {
        const request = requestById.get(requestId);
        const viewerPrefix = audience === "brf" ? "/dashboard/brf/dokument" : "/dashboard/privat/dokument";
        return (
          <article key={requestId} className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[#2A2520]">{request?.title ?? "Projektförfrågan"}</h3>
            <p className="mt-1 text-xs text-[#766B60]">
              {request?.location ?? "Okand plats"} · Request ID: {requestId}
            </p>
            <ul className="mt-3 space-y-2">
              {docs
                .slice()
                .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
                .map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                    <div>
                      <p className="text-sm font-semibold text-[#2A2520]">{document.title}</p>
                      <p className="text-xs text-[#6B5A47]">
                        {typeLabel(document.type)} · v{document.version} · {statusLabel(document.status)}
                      </p>
                    </div>
                    <Link
                      href={`${viewerPrefix}/${document.id}`}
                      className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Öppna
                    </Link>
                  </li>
                ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
