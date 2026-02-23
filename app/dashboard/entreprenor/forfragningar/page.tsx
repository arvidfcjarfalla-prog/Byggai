"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
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

  const resolvedSelectedRequestId =
    selectedRequestId && incomingRequests.some((request) => request.id === selectedRequestId)
      ? selectedRequestId
      : incomingRequests[0]?.id || null;

  const selectedRequest =
    incomingRequests.find((request) => request.id === resolvedSelectedRequestId) ||
    incomingRequests[0] ||
    null;
  const projectOffers = selectedRequest ? listLatestOffersByProject(selectedRequest.id) : [];
  const currentContractorOffer = selectedRequest
    ? getCurrentContractorOffer(projectOffers, user.id, user.email)
    : null;

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Se förfrågningar"
      subheading="Översikt över inkomna förfrågningar. All kommunikation finns i fliken Meddelanden."
      startProjectHref="/dashboard/entreprenor/forfragningar"
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
        { href: "/dashboard/entreprenor/meddelanden", label: "Meddelanden" },
        { href: "/dashboard/entreprenor/dokument", label: "Dokumentgenerator" },
      ]}
      cards={[]}
    >
      {incomingRequests.length === 0 && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#766B60]">
            Inga förfrågningar ännu. När BRF eller privatperson skickar dyker de upp här.
          </p>
        </section>
      )}

      {selectedRequest && (
        <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <aside className="rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-[#2A2520]">Inkorg</h2>
            <p className="mb-3 text-xs text-[#6B5A47]">
              Klicka på en förfrågan för att öppna analyssidan och generera offertunderlag.
            </p>
            <div className="space-y-2">
              {incomingRequests.map((request) => {
                const active = request.id === resolvedSelectedRequestId;
                const audienceLabel = request.audience === "privat" ? "Privatperson" : "BRF";
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(request.id);
                      router.push(`/dashboard/entreprenor/forfragningar/request/${request.id}`);
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

          <main className="space-y-4">
            <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-bold tracking-tight text-[#2A2520]">
                {selectedRequest.title}
              </h2>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                      {item.label}
                    </p>
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
                    if (!selectedRequest) return;
                    const contractorId = user.id || user.email;
                    if (!contractorId) return;
                    const offer = ensureDraftOfferForRequest({
                      request: selectedRequest,
                      contractorId,
                    });
                    router.push(`/dashboard/entreprenor/forfragningar/${offer.id}/analysis`);
                  }}
                  className="rounded-xl bg-[#2F2F31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#19191A]"
                >
                  {currentContractorOffer ? "Öppna min offertanalys" : "Skapa offertutkast"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                    Projektets offerter
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[#2A2520]">{projectOffers.length}</p>
                  <p className="text-xs text-[#6B5A47]">Senaste version per entreprenör</p>
                </div>
                <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                    Min offertstatus
                  </p>
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                    Benchmark
                  </p>
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
                          (user.id && offer.contractorId === user.id) ||
                          (user.email && offer.contractorId.toLowerCase() === user.email.toLowerCase());
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
                            <td className="px-2 py-2 font-semibold text-[#2A2520]">
                              {formatSek(offer.totals.exVat)}
                            </td>
                            <td className="px-2 py-2">
                              <Link
                                href={`/dashboard/entreprenor/forfragningar/${offer.id}/analysis`}
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
              {(selectedRequest.scope.scopeItems ?? []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(selectedRequest.scope.scopeItems ?? []).map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-[#2A2520]">{item.title}</p>
                      {item.details && (
                        <p className="mt-1 text-xs text-[#6B5A47]">{item.details}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                {(selectedRequest.scope.actions ?? selectedRequest.actions ?? []).map((action) => (
                  <article
                    key={action.id}
                    className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-[#2A2520]">{action.title}</p>
                    <p className="mt-1 text-xs text-[#766B60]">
                      {action.category} · {action.plannedYear} · {formatSek(action.estimatedPriceSek)}
                    </p>
                    {action.details && (
                      <p className="mt-2 text-xs text-[#6B5A47]">{action.details}</p>
                    )}
                    {action.extraDetails && action.extraDetails.length > 0 && (
                      <dl className="mt-2 grid gap-1 text-xs text-[#6B5A47] md:grid-cols-2">
                        {action.extraDetails.map((detail) => (
                          <div key={`${action.id}-${detail.label}`}>
                            <dt className="font-semibold text-[#2A2520]">{detail.label}</dt>
                            <dd>{detail.value || "Ej ifyllt"}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </article>
                ))}
                {(selectedRequest.scope.actions ?? selectedRequest.actions ?? []).length === 0 &&
                  (selectedRequest.scope.scopeItems ?? []).length === 0 && (
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
              {selectedRequest.documentSummary?.highlights &&
                selectedRequest.documentSummary.highlights.length > 0 && (
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
                  href={`/dashboard/entreprenor/forfragningar/request/${selectedRequest.id}`}
                  className="inline-flex rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Öppna analyssida
                </Link>
                <Link
                  href={`/dashboard/entreprenor/meddelanden?requestId=${selectedRequest.id}`}
                  className="inline-flex rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
                >
                  Öppna meddelanden
                </Link>
              </div>
            </article>
          </main>
        </section>
      )}
    </DashboardShell>
  );
}
