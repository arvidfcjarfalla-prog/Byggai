"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveProject } from "../../../components/active-project-context";
import { useAuth } from "../../../components/auth-context";
import { DashboardShell } from "../../../components/dashboard-shell";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../lib/requests-store";
import {
  ensureDraftOfferForRequest,
  listLatestOffersByProject,
  subscribeOffers,
} from "../../../lib/offers/store";
import type { Offer } from "../../../lib/offers/types";
import {
  formatSnapshotBudget,
  formatSnapshotTimeline,
  toSwedishRiskLabel,
} from "../../../lib/project-snapshot";
import { routes } from "../../../lib/routes";
import type { ProcurementAction } from "../../../lib/requests-store";

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function requestStatusLabel(status: PlatformRequest["status"]): string {
  if (status === "received") return "Svar inkommen";
  if (status === "draft") return "Utkast";
  return "Skickad";
}

function formatSek(value: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}

function formatOptional(value: string | undefined): string {
  return value && value.trim().length > 0 ? value : "Ej angivet";
}

function recipientStatusLabel(status: string): string {
  if (status === "responded") return "Svarat";
  if (status === "opened") return "Öppnad";
  if (status === "declined") return "Avböjd";
  return "Skickad";
}

function offerStatusLabel(status: Offer["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslagen";
  return "Utkast";
}

function actionStatusBadgeClass(status: ProcurementAction["status"]): string {
  if (status === "Genomförd") return "border-[#CFE6CC] bg-[#F2FAF0] text-[#355C38]";
  if (status === "Eftersatt") return "border-[#F2D6B0] bg-[#FFF8EE] text-[#8A5B20]";
  return "border-[#D7C3A8] bg-[#FFF4DE] text-[#6B5A47]";
}

function summarizeActionSource(action: ProcurementAction): string {
  const parts: string[] = [];

  if (action.sourceSheet) {
    parts.push(`Källa: ${action.sourceSheet}${action.sourceRow ? `, rad ${action.sourceRow}` : ""}`);
  } else if (action.source === "ai") {
    parts.push("Källa: AI-genererat underlag");
  }

  const priorityLabels = [/fastighet/i, /märk/i, /projekt/i, /tagg/i];
  const matched = (action.extraDetails ?? []).filter((detail) =>
    priorityLabels.some((pattern) => pattern.test(detail.label))
  );
  const fallback = (action.extraDetails ?? []).slice(0, 2);
  const summaryDetails = (matched.length > 0 ? matched : fallback).slice(0, 2);

  summaryDetails.forEach((detail) => {
    if (!detail.value?.trim()) return;
    parts.push(`${detail.label}: ${detail.value}`);
  });

  if (parts.length === 0) {
    parts.push("Källa: Underlag för förfrågan");
  }

  return parts.join(" · ");
}

function getCurrentContractorOffer(offers: Offer[], userId?: string, userEmail?: string): Offer | null {
  const normalizedUserId = userId?.trim();
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  return (
    offers.find((offer) => {
      if (normalizedUserId && offer.contractorId === normalizedUserId) return true;
      if (normalizedUserEmail && offer.contractorId.toLowerCase() === normalizedUserEmail) return true;
      return false;
    }) ?? null
  );
}

function EntreprenorForfragningarContent({
  incomingRequests,
  selectedRequestId,
  onSelectRequest,
  userId,
  userEmail,
}: {
  incomingRequests: PlatformRequest[];
  selectedRequestId: string | null;
  onSelectRequest: (id: string) => void;
  userId?: string;
  userEmail?: string;
}) {
  const router = useRouter();
  const { activeProject } = useActiveProject();
  const scopedProjectId = activeProject?.id ?? null;
  const isProjectScoped = Boolean(scopedProjectId);
  const visibleRequests = scopedProjectId
    ? incomingRequests.filter((request) => request.id === scopedProjectId)
    : incomingRequests;

  if (visibleRequests.length === 0) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#766B60]">
          Inga förfrågningar ännu. När BRF eller privatperson skickar dyker de upp här.
        </p>
      </section>
    );
  }

  const resolvedSelectedRequestId =
    scopedProjectId && visibleRequests.some((request) => request.id === scopedProjectId)
      ? scopedProjectId
      : selectedRequestId && visibleRequests.some((request) => request.id === selectedRequestId)
        ? selectedRequestId
        : visibleRequests[0]?.id || null;

  const selectedRequest =
    visibleRequests.find((request) => request.id === resolvedSelectedRequestId) || visibleRequests[0] || null;
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  useEffect(() => {
    setExpandedActionId(null);
  }, [selectedRequest?.id]);

  if (!selectedRequest) return null;

  const projectOffers = listLatestOffersByProject(selectedRequest.id);
  const currentContractorOffer = getCurrentContractorOffer(projectOffers, userId, userEmail);

  return (
    <section className={isProjectScoped ? "space-y-4" : "grid gap-6 xl:grid-cols-[360px_1fr]"}>
      {!isProjectScoped && (
        <aside className="rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-[#2A2520]">Inkorg</h2>
          <p className="mb-3 text-xs text-[#6B5A47]">
            Klicka på en förfrågan för att öppna analyssidan och generera offertunderlag.
          </p>
          <div className="space-y-2">
            {visibleRequests.map((request) => {
              const active = request.id === resolvedSelectedRequestId;
              const audienceLabel = request.audience === "privat" ? "Privatperson" : "BRF";
              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => {
                    onSelectRequest(request.id);
                    router.push(routes.entreprenor.requestDetail({ requestId: request.id }));
                  }}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-[#8C7860] bg-[#F6F0E8]"
                      : "border-[#E8E3DC] bg-white hover:bg-[#FAF8F5]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#2A2520]">{request.title}</p>
                  <p className="mt-1 text-xs text-[#6B5A47]">{request.location}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#766B60]">
                    <span>{audienceLabel}</span>
                    <span>•</span>
                    <span>{requestStatusLabel(request.status)}</span>
                    <span>•</span>
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      <main className="space-y-4">
        {isProjectScoped && (
          <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Aktiv förfrågan</p>
            <p className="text-sm font-semibold text-[#2A2520]">
              Visar endast innehåll för {selectedRequest.title}
            </p>
          </div>
        )}

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-[#2A2520]">{selectedRequest.title}</h2>
          <p className="mt-1 text-sm text-[#6B5A47]">{selectedRequest.location}</p>
          <p className="mt-2 text-xs text-[#766B60]">
            {requestStatusLabel(selectedRequest.status)} · Förfrågan-ID: {selectedRequest.id}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Budget",
                value: selectedRequest.snapshot
                  ? formatSnapshotBudget(selectedRequest.snapshot)
                  : selectedRequest.budgetRange,
              },
              {
                label: "Startfönster",
                value: selectedRequest.snapshot
                  ? formatSnapshotTimeline(selectedRequest.snapshot)
                  : selectedRequest.desiredStart,
              },
              {
                label: "Underlagsnivå",
                value: `${selectedRequest.completeness}% komplett`,
              },
              {
                label: "Riskprofil",
                value: selectedRequest.snapshot
                  ? toSwedishRiskLabel(selectedRequest.snapshot.riskProfile.level)
                  : selectedRequest.riskProfile || "—",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{item.value}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#2A2520]">Offertarbete & intern analys</h3>
              <p className="mt-1 text-sm text-[#6B5A47]">
                Skapa eller öppna ditt offertutkast för strukturerad analys, export och kvalitetssäkring före skick.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const contractorId = userId || userEmail;
                if (!contractorId) return;
                const offer = ensureDraftOfferForRequest({
                  request: selectedRequest,
                  contractorId,
                });
                router.push(routes.entreprenor.offerAnalysis({ offerId: offer.id }));
              }}
              className="rounded-xl bg-[#2F2F31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#19191A]"
            >
              {currentContractorOffer ? "Öppna min offertanalys" : "Skapa offertutkast"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Projektets offerter</p>
              <p className="mt-1 text-2xl font-bold text-[#2A2520]">{projectOffers.length}</p>
              <p className="text-xs text-[#6B5A47]">Senaste version per entreprenör</p>
            </div>
            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Min offertstatus</p>
              <p className="mt-1 text-base font-bold text-[#2A2520]">
                {currentContractorOffer
                  ? `${offerStatusLabel(currentContractorOffer.status)} · v${currentContractorOffer.version}`
                  : "Ingen offert ännu"}
              </p>
              {currentContractorOffer && (
                <p className="mt-1 text-xs text-[#6B5A47]">
                  {formatSek(currentContractorOffer.totals.exVat)} ex moms
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Benchmark</p>
              <p className="mt-1 text-base font-bold text-[#2A2520]">
                {projectOffers.length > 1 ? "Jämförelse tillgänglig" : "Väntar på fler offerter"}
              </p>
              <p className="mt-1 text-xs text-[#6B5A47]">
                Kundvyn visar jämförelse automatiskt när minst två finns.
              </p>
            </div>
          </div>

          {projectOffers.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E8E3DC] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                    <th className="px-2 py-2">Entreprenör</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Version</th>
                    <th className="px-2 py-2">Ex moms</th>
                    <th className="px-2 py-2">Åtgärd</th>
                  </tr>
                </thead>
                <tbody>
                  {projectOffers.map((offer) => {
                    const isCurrent =
                      (userId && offer.contractorId === userId) ||
                      (userEmail && offer.contractorId.toLowerCase() === userEmail.toLowerCase());
                    return (
                      <tr
                        key={offer.id}
                        className={`border-b border-[#EFE8DD] ${isCurrent ? "bg-[#FFF9F1]" : ""}`}
                      >
                        <td className="px-2 py-2 font-semibold text-[#2A2520]">
                          {offer.contractorId}
                          {isCurrent && (
                            <span className="ml-2 rounded-full border border-[#D7C3A8] bg-[#FFF4DE] px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]">
                              Min
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[#6B5A47]">{offerStatusLabel(offer.status)}</td>
                        <td className="px-2 py-2 text-[#6B5A47]">v{offer.version}</td>
                        <td className="px-2 py-2 font-semibold text-[#2A2520]">{formatSek(offer.totals.exVat)}</td>
                        <td className="px-2 py-2">
                          <Link
                            href={routes.entreprenor.offerAnalysis({ offerId: offer.id })}
                            className="inline-flex rounded-lg border border-[#D2C5B5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Öppna analys
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Omfattning och inskickad information</h3>
          <p className="mt-1 text-sm text-[#6B5A47]">
            Klicka på en åtgärd för att se mer information, källdata och detaljer från underlaget.
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                Åtgärder från underlag
              </p>
              <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2.5 py-1 text-xs font-semibold text-[#6B5A47]">
                {(selectedRequest.scope.actions ?? selectedRequest.actions ?? []).length} st
              </span>
            </div>

            {(selectedRequest.scope.actions ?? selectedRequest.actions ?? []).map((action) => {
              const isExpanded = expandedActionId === action.id;
              return (
                <article
                  key={action.id}
                  className={`rounded-2xl border transition ${
                    isExpanded
                      ? "border-[#D7C3A8] bg-[#FFFDF8]"
                      : "border-[#E8E3DC] bg-[#FAF8F5] hover:bg-[#F7F4EE]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedActionId((current) => (current === action.id ? null : action.id))
                    }
                    className="w-full px-4 py-3 text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#2A2520]">{action.title}</p>
                        <p className="mt-1 text-xs text-[#766B60]">{summarizeActionSource(action)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${actionStatusBadgeClass(action.status)}`}
                          >
                            {action.status}
                          </span>
                          <span className="rounded-full border border-[#D9D1C6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]">
                            {action.category || "Övrigt"}
                          </span>
                          <span className="rounded-full border border-[#D9D1C6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]">
                            År {action.plannedYear}
                          </span>
                          <span className="rounded-full border border-[#D9D1C6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#2A2520]">
                            {formatSek(action.estimatedPriceSek)}
                          </span>
                        </div>
                      </div>

                      <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                        {isExpanded ? "Dölj" : "Visa mer"} {isExpanded ? "▴" : "▾"}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#E8E3DC] px-4 py-3">
                      {action.details && (
                        <div className="rounded-xl border border-[#E8E3DC] bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                            Beskrivning
                          </p>
                          <p className="mt-1 text-sm text-[#6B5A47]">{action.details}</p>
                        </div>
                      )}

                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C7860]">
                            Estimerat värde
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#2A2520]">
                            {formatSek(action.estimatedPriceSek)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C7860]">
                            CO2e
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#2A2520]">
                            {new Intl.NumberFormat("sv-SE").format(Math.round(action.emissionsKgCo2e || 0))} kg
                          </p>
                        </div>
                        <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C7860]">
                            Källa
                          </p>
                          <p className="mt-1 text-sm text-[#2A2520]">
                            {action.sourceSheet || (action.source === "ai" ? "AI" : "Underlag")}
                            {action.sourceRow ? `, rad ${action.sourceRow}` : ""}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C7860]">
                            Källdata-rad
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-[#2A2520]">
                            {action.rawRow || "Ej tillgänglig"}
                          </p>
                        </div>
                      </div>

                      {action.extraDetails && action.extraDetails.length > 0 && (
                        <div className="mt-3 rounded-xl border border-[#E8E3DC] bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                            Detaljer från underlag
                          </p>
                          <dl className="mt-2 grid gap-2 text-xs text-[#6B5A47] md:grid-cols-2">
                            {action.extraDetails.map((detail) => (
                              <div
                                key={`${action.id}-${detail.label}`}
                                className="rounded-lg border border-[#EFE8DD] bg-[#FCFBF8] px-2 py-1.5"
                              >
                                <dt className="font-semibold text-[#2A2520]">{detail.label}</dt>
                                <dd>{detail.value || "Ej ifyllt"}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {(selectedRequest.scope.actions ?? selectedRequest.actions ?? []).length === 0 && (
                <p className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
                  Ingen omfattning registrerad i detta underlag.
                </p>
              )}
          </div>
        </article>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Dokument och underlag</h3>
          <p className="mt-2 text-sm text-[#6B5A47]">
            {selectedRequest.documentSummary?.totalFiles ?? selectedRequest.files?.length ?? 0} filer inskickade
          </p>
          {selectedRequest.documentSummary?.highlights && selectedRequest.documentSummary.highlights.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[#766B60]">
              {selectedRequest.documentSummary.highlights.map((highlight) => (
                <li key={highlight}>• {highlight}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-2">
            {(selectedRequest.files ?? []).map((file) => (
              <div
                key={file.id ?? `${file.name}-${file.uploadedAt}`}
                className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2"
              >
                <p className="text-sm font-semibold text-[#2A2520]">{file.name}</p>
                <p className="mt-1 text-xs text-[#766B60]">
                  {file.fileTypeLabel} · {file.sizeKb.toFixed(1)} KB · {formatDate(file.uploadedAt)}
                </p>
                {file.tags && file.tags.length > 0 && (
                  <p className="mt-1 text-xs text-[#6B5A47]">Taggar: {file.tags.join(", ")}</p>
                )}
              </div>
            ))}
            {(selectedRequest.files ?? []).length === 0 && (
              <p className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
                Inga filer registrerade för förfrågan.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Fastighetsinformation</h3>
          {!selectedRequest.sharingApproved && (
            <p className="mt-3 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
              Beställaren har inte godkänt delning av fastighetsinformation ännu.
            </p>
          )}

          {selectedRequest.sharingApproved && selectedRequest.propertySnapshot && (
            <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Objekt</dt>
                <dd className="mt-1 font-semibold text-[#2A2520]">
                  {formatOptional(selectedRequest.propertySnapshot.title)}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Adress</dt>
                <dd className="mt-1 font-semibold text-[#2A2520]">
                  {formatOptional(selectedRequest.propertySnapshot.address)}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Byggår</dt>
                <dd className="mt-1 text-[#2A2520]">
                  {formatOptional(selectedRequest.propertySnapshot.buildingYear)}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Omfattning</dt>
                <dd className="mt-1 text-[#2A2520]">
                  {formatOptional(selectedRequest.propertySnapshot.areaSummary)}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Tillträde/logistik</dt>
                <dd className="mt-1 text-[#2A2520]">
                  {formatOptional(selectedRequest.propertySnapshot.accessAndLogistics)}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Kända begränsningar</dt>
                <dd className="mt-1 text-[#2A2520]">
                  {formatOptional(selectedRequest.propertySnapshot.knownConstraints)}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Kontakt</dt>
                <dd className="mt-1 text-[#2A2520]">
                  {formatOptional(selectedRequest.propertySnapshot.contactName)}
                </dd>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Kontaktuppgifter</dt>
                <dd className="mt-1 text-[#2A2520]">
                  {[
                    selectedRequest.propertySnapshot.contactEmail,
                    selectedRequest.propertySnapshot.contactPhone,
                  ]
                    .filter((value): value is string => Boolean(value && value.trim().length > 0))
                    .join(" · ") || "Ej angivet"}
                </dd>
              </div>
            </dl>
          )}

          {selectedRequest.sharingApproved && !selectedRequest.propertySnapshot && (
            <p className="mt-3 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
              Ingen fastighetsinformation är registrerad i denna förfrågan.
            </p>
          )}
        </article>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Mottagare och kompletteringar</h3>
          <div className="mt-3 space-y-2">
            {(selectedRequest.recipients ?? []).map((recipient) => (
              <div
                key={recipient.id}
                className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2"
              >
                <p className="text-sm font-semibold text-[#2A2520]">{recipient.companyName}</p>
                <p className="mt-1 text-xs text-[#766B60]">
                  {recipient.email || "E-post saknas"} · {recipientStatusLabel(recipient.status)}
                </p>
              </div>
            ))}
            {(selectedRequest.recipients ?? []).length === 0 && (
              <p className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
                Inga mottagare registrerade i förfrågan.
              </p>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {selectedRequest.missingInfo.map((item) => (
              <p key={item} className="rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
                {item}
              </p>
            ))}
            {selectedRequest.missingInfo.length === 0 && (
              <p className="rounded-xl border border-[#D7E8D2] bg-[#F3FAF0] px-3 py-2 text-sm text-[#355C38]">
                Inga uppenbara kompletteringar markerade.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={routes.entreprenor.requestDetail({ requestId: selectedRequest.id })}
              className="inline-flex rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Öppna analyssida
            </Link>
            <Link
              href={routes.entreprenor.messagesIndex({ requestId: selectedRequest.id })}
              className="inline-flex rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
            >
              Öppna meddelanden
            </Link>
          </div>
        </article>
      </main>
    </section>
  );
}

export default function EntreprenorForfragningarPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(
    () => listRequests()
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [, setOffersRefreshKey] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") {
      router.replace(routes.brf.overview());
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace(routes.privatperson.overview());
    }
  }, [ready, router, user]);

  useEffect(() => {
    return subscribeRequests(() => {
      setIncomingRequests(listRequests());
    });
  }, []);

  useEffect(() => {
    return subscribeOffers(() => {
      setOffersRefreshKey((current) => current + 1);
    });
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#F6F3EE] text-[#2A2520] antialiased">
        <div className="mx-auto flex min-h-screen max-w-[1400px] items-center justify-center px-6">
          <p className="rounded-xl border border-[#E6DFD6] bg-white px-4 py-2 text-sm text-[#6B5A47]">
            Laddar konto...
          </p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Se förfrågningar"
      subheading="Översikt över inkomna förfrågningar. All kommunikation finns i fliken Meddelanden."
      startProjectHref={routes.entreprenor.requestsIndex()}
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: routes.entreprenor.overview(), label: "Översikt" },
        { href: routes.entreprenor.requestsIndex(), label: "Se förfrågningar" },
        { href: routes.entreprenor.messagesIndex(), label: "Meddelanden" },
        { href: routes.entreprenor.documentsIndex(), label: "Dokumentgenerator" },
      ]}
      cards={[]}
    >
      <EntreprenorForfragningarContent
        incomingRequests={incomingRequests}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        userId={user.id}
        userEmail={user.email}
      />
    </DashboardShell>
  );
}
