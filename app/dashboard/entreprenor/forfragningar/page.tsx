"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/auth-context";
import { DashboardShell } from "../../../components/dashboard-shell";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../lib/requests-store";
import {
  formatSnapshotBudget,
  formatSnapshotTimeline,
  toSwedishRiskLabel,
} from "../../../lib/project-snapshot";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSek(value: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}

export default function EntreprenorForfragningarPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(
    () => listRequests()
  );

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

  const latestRequest = incomingRequests[0] ?? null;
  const latestSnapshot = latestRequest?.snapshot ?? null;
  const latestFiles = latestRequest?.files ?? [];
  const latestActions = latestRequest?.actions ?? latestRequest?.scope.actions ?? [];
  const audienceLabel =
    latestRequest?.audience === "privat" ? "Privatperson" : "BRF";
  const riskLabel =
    latestSnapshot ? toSwedishRiskLabel(latestSnapshot.riskProfile.level) : latestRequest?.riskProfile;

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Inkomna projektförfrågningar"
      subheading="Här hanterar du snapshot-baserade förfrågningar från BRF och privatpersoner med samma underlagsstruktur."
      startProjectHref="/dashboard/entreprenor/forfragningar"
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
      ]}
      cards={[]}
    >
      {!latestRequest && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#766B60]">
            Inga förfrågningar ännu. När BRF eller privatperson skickar dyker de upp här.
          </p>
        </section>
      )}

      {latestRequest && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#8C7860] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Ny förfrågan från {audienceLabel}
            </span>
            <span className="rounded-full border border-[#CDB49B] bg-[#CDB49B]/10 px-3 py-1 text-xs font-semibold text-[#6B5A47]">
              Matchscore: 93%
            </span>
            <span className="text-xs font-semibold text-[#766B60]">
              Inläst från RequestSnapshot · {formatDate(latestRequest.createdAt)}
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-[#2A2520]">
            {latestRequest.title} ({latestRequest.location})
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[#766B60]">
            Beställaren har skickat {latestActions.length} åtgärder i ett låst snapshot-underlag.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Budgetspann",
                value: latestSnapshot
                  ? formatSnapshotBudget(latestSnapshot)
                  : latestRequest.budgetRange,
              },
              {
                label: "Önskad start",
                value: latestSnapshot
                  ? formatSnapshotTimeline(latestSnapshot)
                  : latestRequest.desiredStart,
              },
              {
                label: "Underlagsnivå",
                value: `${latestRequest.completeness}% komplett`,
              },
              { label: "Riskprofil", value: riskLabel || latestRequest.riskProfile },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{item.value}</p>
              </div>
            ))}
          </div>

          {latestSnapshot && (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <article className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Riskorsaker
                </p>
                <ul className="mt-2 space-y-1 text-sm text-[#2A2520]">
                  {latestSnapshot.riskProfile.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Rekommenderade nästa steg
                </p>
                <ul className="mt-2 space-y-1 text-sm text-[#2A2520]">
                  {latestSnapshot.riskProfile.recommendedNextSteps.map((step) => (
                    <li key={step}>• {step}</li>
                  ))}
                </ul>
              </article>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
              Saknas i underlaget
            </p>
            {latestRequest.missingInfo.length === 0 && (
              <p className="mt-2 text-sm text-[#2A2520]">Inga kritiska luckor identifierade.</p>
            )}
            {latestRequest.missingInfo.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-[#2A2520]">
                {latestRequest.missingInfo.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            )}
          </div>

          {latestRequest.propertySnapshot && (
            <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
              <article className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Fastighets- och projektunderlag
                </p>
                <h3 className="mt-2 text-lg font-bold text-[#2A2520]">
                  {latestRequest.propertySnapshot.title}
                </h3>
                <p className="mt-1 text-sm text-[#6B5A47]">{latestRequest.propertySnapshot.address}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      label: "Byggår",
                      value: latestRequest.propertySnapshot.buildingYear,
                    },
                    {
                      label: "Lägenheter",
                      value: latestRequest.propertySnapshot.apartmentsCount,
                    },
                    {
                      label: "Byggnader",
                      value: latestRequest.propertySnapshot.buildingsCount,
                    },
                    {
                      label: "Ytor",
                      value: latestRequest.propertySnapshot.areaSummary,
                    },
                  ]
                    .filter((item) => item.value && item.value.trim().length > 0)
                    .map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-[#E8E3DC] bg-white px-3 py-2 text-xs"
                      >
                        <p className="font-semibold uppercase tracking-wider text-[#8C7860]">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#2A2520]">{item.value}</p>
                      </div>
                    ))}
                </div>
                {(latestRequest.propertySnapshot.accessAndLogistics ||
                  latestRequest.propertySnapshot.knownConstraints) && (
                  <div className="mt-3 space-y-2 text-xs text-[#2A2520]">
                    {latestRequest.propertySnapshot.accessAndLogistics && (
                      <p className="rounded-lg border border-[#E8E3DC] bg-white px-3 py-2">
                        <span className="font-semibold">Logistik:</span>{" "}
                        {latestRequest.propertySnapshot.accessAndLogistics}
                      </p>
                    )}
                    {latestRequest.propertySnapshot.knownConstraints && (
                      <p className="rounded-lg border border-[#E8E3DC] bg-white px-3 py-2">
                        <span className="font-semibold">Begränsningar:</span>{" "}
                        {latestRequest.propertySnapshot.knownConstraints}
                      </p>
                    )}
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Dokumentunderlag
                </p>
                <p className="mt-2 text-2xl font-bold text-[#2A2520]">
                  {latestSnapshot?.files.length ?? latestRequest.documentSummary?.totalFiles ?? latestFiles.length} filer
                </p>
                {latestRequest.documentSummary?.highlights &&
                  latestRequest.documentSummary.highlights.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-[#6B5A47]">
                      {latestRequest.documentSummary.highlights.map((highlight) => (
                        <li key={highlight} className="rounded-lg border border-[#E8E3DC] bg-white px-3 py-2">
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}
                {latestSnapshot && latestSnapshot.files.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[#E8E3DC] bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                      Filtyper och taggar (snapshot)
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-[#2A2520]">
                      {latestSnapshot.files.slice(0, 8).map((file) => (
                        <li key={file.id}>
                          <span className="font-semibold">{file.type}:</span> {file.name}
                          {file.tags.length > 0 ? ` [${file.tags.join(", ")}]` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!latestSnapshot && latestFiles.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[#E8E3DC] bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                      Senaste filer
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-[#2A2520]">
                      {latestFiles.slice(0, 6).map((file) => (
                        <li key={`${file.name}-${file.uploadedAt}`}>
                          <span className="font-semibold">{file.fileTypeLabel}:</span>{" "}
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
              Åtgärder i förfrågan
            </p>
            <div className="mt-3 space-y-3">
              {latestActions.map((action) => {
                const isOpen = expandedActionId === action.id;
                return (
                  <article
                    key={action.id}
                    className="rounded-xl border border-[#E8E3DC] bg-white p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[240px] flex-1">
                        <p className="text-sm font-semibold text-[#2A2520]">{action.title}</p>
                        <p className="mt-1 text-xs text-[#766B60]">
                          {action.category} · {action.plannedYear} · {formatSek(action.estimatedPriceSek)} ·{" "}
                          {action.emissionsKgCo2e.toFixed(1)} kg CO₂e
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedActionId((prev) =>
                            prev === action.id ? null : action.id
                          )
                        }
                        className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                      >
                        {isOpen ? "Dölj detaljer" : "Visa detaljer"}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-2 rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] p-3 text-xs text-[#2A2520]">
                        {action.details && <p>{action.details}</p>}
                        {action.extraDetails && action.extraDetails.length > 0 && (
                          <ul className="space-y-1">
                            {action.extraDetails.slice(0, 12).map((detail, idx) => (
                              <li key={`${action.id}-detail-${idx}`}>
                                <span className="font-semibold">{detail.label}:</span>{" "}
                                {detail.value}
                              </li>
                            ))}
                          </ul>
                        )}
                        {action.rawRow && (
                          <p className="break-words text-[#766B60]">
                            <span className="font-semibold text-[#6B5A47]">Rå rad:</span>{" "}
                            {action.rawRow}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
