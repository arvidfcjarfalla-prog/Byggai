"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EntrepreneurRequest } from "../../../lib/procurement";
import { useAuth } from "../../../components/auth-context";
import { DashboardShell } from "../../../components/dashboard-shell";
import {
  PROCUREMENT_REQUESTS_KEY,
  PROCUREMENT_UPDATED_EVENT,
} from "../../../lib/procurement";

function readProcurementRequests(): EntrepreneurRequest[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROCUREMENT_REQUESTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EntrepreneurRequest[]) : [];
  } catch {
    return [];
  }
}

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
  const [incomingRequests, setIncomingRequests] = useState<EntrepreneurRequest[]>(
    () => readProcurementRequests()
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
    const updateFromStorage = () => {
      setIncomingRequests(readProcurementRequests());
    };
    window.addEventListener("storage", updateFromStorage);
    window.addEventListener(PROCUREMENT_UPDATED_EVENT, updateFromStorage);
    return () => {
      window.removeEventListener("storage", updateFromStorage);
      window.removeEventListener(PROCUREMENT_UPDATED_EVENT, updateFromStorage);
    };
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
  const latestFiles = latestRequest?.files ?? [];

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Inkomna projektförfrågningar"
      subheading="Här hanterar du förfrågningar från BRF med komplett underlag för offertarbete."
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
            Inga förfrågningar ännu. När BRF skickar förfrågan dyker den upp här.
          </p>
        </section>
      )}

      {latestRequest && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#8C7860] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Ny förfrågan från BRF
            </span>
            <span className="rounded-full border border-[#CDB49B] bg-[#CDB49B]/10 px-3 py-1 text-xs font-semibold text-[#6B5A47]">
              Matchscore: 93%
            </span>
            <span className="text-xs font-semibold text-[#766B60]">
              Inläst från BRF-upload · {formatDate(latestRequest.createdAt)}
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-[#2A2520]">
            {latestRequest.title} ({latestRequest.location})
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[#766B60]">
            Beställaren har skickat {latestRequest.actions.length} åtgärder från underhållsplanen för offertförfrågan.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Budgetspann", value: latestRequest.budgetRange },
              { label: "Önskad start", value: latestRequest.desiredStart },
              { label: "Underlagsnivå", value: latestRequest.documentationLevel },
              { label: "Riskprofil", value: latestRequest.riskProfile },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{item.value}</p>
              </div>
            ))}
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
                  {latestRequest.documentSummary?.totalFiles ?? latestFiles.length} filer
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
                {latestFiles.length > 0 && (
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
              {latestRequest.actions.map((action) => {
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
