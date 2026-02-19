"use client";

import Link from "next/link";
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

export default function EntreprenorForfragningarPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(
    () => listRequests()
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

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

  const resolvedSelectedRequestId =
    selectedRequestId && incomingRequests.some((request) => request.id === selectedRequestId)
      ? selectedRequestId
      : incomingRequests[0]?.id || null;

  const selectedRequest =
    incomingRequests.find((request) => request.id === resolvedSelectedRequestId) ||
    incomingRequests[0] ||
    null;

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
            <div className="space-y-2">
              {incomingRequests.map((request) => {
                const active = request.id === resolvedSelectedRequestId;
                const audienceLabel = request.audience === "privat" ? "Privatperson" : "BRF";
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
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
              <h3 className="text-lg font-bold text-[#2A2520]">Åtgärder i förfrågan</h3>
              <div className="mt-3 space-y-2">
                {(selectedRequest.scope.actions ?? selectedRequest.actions ?? []).slice(0, 10).map((action) => (
                  <div
                    key={action.id}
                    className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-[#2A2520]">{action.title}</p>
                    <p className="mt-1 text-xs text-[#766B60]">
                      {action.category} · {action.plannedYear} · {formatSek(action.estimatedPriceSek)}
                    </p>
                  </div>
                ))}
                {(selectedRequest.scope.actions ?? selectedRequest.actions ?? []).length === 0 && (
                  <p className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
                    Inga åtgärder registrerade i detta underlag.
                  </p>
                )}
              </div>

              <div className="mt-4">
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
