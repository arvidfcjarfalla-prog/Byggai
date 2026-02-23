"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { RequestConversationsSidebar } from "./request-conversations-sidebar";
import { RequestMessagesPanel } from "./request-messages-panel";
import {
  listRequests,
  setRequestPropertySharingApproval,
  subscribeRequests,
  type PlatformRequest,
  type RequestAudience,
} from "../lib/requests-store";
import { listLatestOffersByProject, subscribeOffers } from "../lib/offers/store";
import type { Offer } from "../lib/offers/types";

function statusLabel(status: PlatformRequest["status"]): string {
  if (status === "received") return "Svar inkommen";
  if (status === "draft") return "Utkast";
  return "Skickad";
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSek(value: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(Math.round(value))} kr`;
}

function offerStatusLabel(status: Offer["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslagen";
  return "Utkast";
}

export function RequestsOutboxPanel({
  audience,
  mode = "messages",
}: {
  audience: RequestAudience;
  mode?: "messages" | "documents" | "overview";
}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [, setOffersRefreshKey] = useState(0);

  useEffect(() => {
    const sync = () => {
      const filtered = listRequests().filter((request) => request.audience === audience);
      setRequests(filtered);
    };
    sync();
    return subscribeRequests(sync);
  }, [audience]);

  useEffect(() => {
    return subscribeOffers(() => {
      setOffersRefreshKey((current) => current + 1);
    });
  }, []);

  const selectedRequestId =
    activeRequestId && requests.some((request) => request.id === activeRequestId)
      ? activeRequestId
      : requests[0]?.id || null;

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) || requests[0] || null;
  const selectedRequestOffers = selectedRequest ? listLatestOffersByProject(selectedRequest.id) : [];

  if (requests.length === 0) {
    const emptyTitle =
      mode === "documents"
        ? "Dokument"
        : mode === "overview"
          ? "Förfrågningar"
          : "Meddelanden";
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2520]">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-[#766B60]">
          Inga förfrågningar ännu. När du skickar en förfrågan öppnas inkorgen här.
        </p>
      </section>
    );
  }

  const actorRole = audience === "brf" ? "brf" : "privatperson";
  const actorLabel =
    user?.name?.trim() ||
    user?.email ||
    (audience === "brf" ? "BRF-kontakt" : "Privat beställare");
  const roleSegment = audience === "brf" ? "brf" : "privat";

  const handlePropertySharingToggle = (nextValue: boolean) => {
    if (!selectedRequest) return;
    setRequestPropertySharingApproval(selectedRequest.id, nextValue);
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <RequestConversationsSidebar
        requests={requests}
        selectedRequestId={selectedRequestId}
        actorRole={actorRole}
        onSelectRequest={setActiveRequestId}
        title={
          mode === "documents"
            ? "Dokument · Inkorg"
            : mode === "overview"
              ? "Förfrågningar"
              : "Meddelanden"
        }
      />

      {selectedRequest && (
        <main className="space-y-4">
          {mode === "overview" && (
            <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#2A2520]">{selectedRequest.title}</h3>
              <p className="mt-1 text-sm text-[#6B5A47]">
                {selectedRequest.location} · {statusLabel(selectedRequest.status)} · Förfrågan-ID:{" "}
                <span className="font-mono">{selectedRequest.id}</span>
              </p>
              <p className="mt-2 text-sm text-[#766B60]">
                Välj nästa steg i projektflödet. Du kan fortsätta dialogen, granska dokument eller följa tidslinjen.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/${roleSegment}/meddelanden`}
                  className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Öppna meddelanden
                </Link>
                <Link
                  href={`/dashboard/${roleSegment}/dokument`}
                  className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Öppna dokument
                </Link>
                <Link
                  href={`/dashboard/${roleSegment}/tidslinje?projectId=${encodeURIComponent(selectedRequest.id)}`}
                  className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Öppna tidslinje
                </Link>
              </div>

              {audience === "privat" && (
                <div className="mt-4 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                        Offerter
                      </p>
                      <p className="text-sm text-[#6B5A47]">
                        Kundvy med kostnadsanalys, kategorier, kostnadsdrivare och jämförelse.
                      </p>
                    </div>
                    <span className="rounded-full border border-[#D9D1C6] bg-white px-2.5 py-1 text-xs font-semibold text-[#6B5A47]">
                      {selectedRequestOffers.length} offert{selectedRequestOffers.length === 1 ? "" : "er"}
                    </span>
                  </div>

                  {selectedRequestOffers.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#6B5A47]">
                      Ingen offert registrerad ännu för denna förfrågan.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedRequestOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="grid gap-2 rounded-xl border border-[#E8E3DC] bg-white p-3 md:grid-cols-[1fr_auto_auto]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#2A2520]">
                              {offer.contractorId}
                            </p>
                            <p className="mt-0.5 text-xs text-[#6B5A47]">
                              {offerStatusLabel(offer.status)} · v{offer.version} · {offer.lineItems.length} poster
                            </p>
                          </div>
                          <div className="self-center text-right">
                            <p className="text-xs uppercase tracking-wide text-[#8C7860]">Ex moms</p>
                            <p className="text-sm font-bold text-[#2A2520]">{formatSek(offer.totals.exVat)}</p>
                          </div>
                          <div className="self-center">
                            <Link
                              href={`/dashboard/privat/forfragningar/${offer.id}`}
                              className="inline-flex rounded-lg border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            >
                              Öppna kundvy
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRequestOffers.length > 1 && (
                    <p className="mt-2 text-xs text-[#6B5A47]">
                      Jämförelse aktiveras automatiskt i kundvyn eftersom flera offerter finns.
                    </p>
                  )}
                </div>
              )}
            </article>
          )}

          <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#2A2520]">Delning av fastighetsinformation</h3>
            <p className="mt-1 text-sm text-[#766B60]">
              Bestämmer om entreprenörer får se fastighetsdata i &quot;Se förfrågningar&quot;.
            </p>

            <label className="mt-4 flex items-start gap-3 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3 text-sm text-[#2A2520]">
              <input
                type="checkbox"
                checked={selectedRequest.sharingApproved}
                onChange={(event) => handlePropertySharingToggle(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#CDB49B] text-[#8C7860] focus:ring-[#8C7860]"
              />
              <span>
                Jag godkänner att entreprenörer får se information om fastigheten i denna förfrågan.
              </span>
            </label>

            <p className="mt-2 text-xs text-[#6B5A47]">
              Status: {selectedRequest.sharingApproved ? "Godkänd" : "Ej godkänd"}
              {selectedRequest.sharingApprovedAt
                ? ` · Godkänd ${formatDate(selectedRequest.sharingApprovedAt)}`
                : ""}
            </p>
          </article>

          <RequestMessagesPanel
            key={`request-messages-${selectedRequest.id}-${mode}`}
            requestId={selectedRequest.id}
            actorRole={actorRole}
            actorLabel={actorLabel}
            headline={mode === "documents" ? `${selectedRequest.title} · Dokument` : selectedRequest.title}
            description={`${selectedRequest.location} · ${statusLabel(selectedRequest.status)} · Förfrågan-ID: ${selectedRequest.id}`}
            allowedMessageTypes={mode === "documents" ? ["document"] : undefined}
            hideComposer={mode === "documents" || mode === "overview"}
          />
        </main>
      )}
    </section>
  );
}
