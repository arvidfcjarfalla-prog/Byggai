"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BrfProcurementDashboardShell } from "./page-shell";
import { useBrfProcurementFlowStore } from "../../../lib/brf-procurement-flow-store";
import { listRequests } from "../../../lib/requests-store";
import { routes } from "../../../lib/routes";

export default function BrfProcurementOverviewPage() {
  const procurementFlow = useBrfProcurementFlowStore();

  const currentRequest = useMemo(() => {
    if (!procurementFlow.currentRequestId) return null;
    return listRequests().find((request) => request.id === procurementFlow.currentRequestId) ?? null;
  }, [procurementFlow.currentRequestId, procurementFlow.updatedAt]);

  const selectedCount = procurementFlow.selectedActionIds.length;
  const adjustedCount = Object.keys(procurementFlow.adjustedScopeByActionId).length;

  return (
    <BrfProcurementDashboardShell
      heading="Upphandling"
      subheading="Processledd upphandling för BRF: välj åtgärder, granska scope och jämför offerter."
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Upphandlingsöversikt</p>
          <h2 className="mt-1 text-xl font-bold text-[#2A2520]">Nästa steg i offertflödet</h2>
          <p className="mt-2 text-sm text-[#6B5A47]">
            Underhållsplan används för analys och urval. Själva offertprocessen hanteras här under Upphandling.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Valda åtgärder</p>
              <p className="mt-1 text-2xl font-bold text-[#2A2520]">{selectedCount}</p>
              <p className="mt-1 text-xs text-[#6B5A47]">Delat urval från underhållsplan</p>
            </div>
            <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Granskade scope-rader</p>
              <p className="mt-1 text-2xl font-bold text-[#2A2520]">{adjustedCount}</p>
              <p className="mt-1 text-xs text-[#6B5A47]">Sparat i offertflödets store</p>
            </div>
            <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Aktuell förfrågan</p>
              <p className="mt-1 text-sm font-semibold text-[#2A2520]">
                {currentRequest ? currentRequest.title : "Ingen skickad ännu"}
              </p>
              <p className="mt-1 text-xs text-[#6B5A47]">
                {currentRequest ? `Status: ${currentRequest.status}` : "Skickas från steg 2"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={selectedCount > 0 ? routes.brf.procurementOfferStep2() : routes.brf.procurementOfferStep1()}
              className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
            >
              {selectedCount > 0 ? "Fortsätt upphandling (steg 2)" : "Starta offertflöde"}
            </Link>
            <Link
              href={routes.brf.procurementOfferStep1()}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Steg 1 · Välj åtgärder
            </Link>
            <Link
              href={routes.brf.maintenanceIndex()}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Till underhållsplan (analys)
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Steg</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {[
              {
                href: routes.brf.procurementOfferStep1(),
                title: "Steg 1 · Välj åtgärder",
                body: "Återanvänder urval, filter och sammanfattning från underhållsplanen.",
              },
              {
                href: routes.brf.procurementOfferStep2(),
                title: "Steg 2 · Granska & komplettera",
                body: "Justerad scope, mallversion och utskick av offertförfrågan.",
              },
              {
                href: routes.brf.procurementOfferStep3(),
                title: "Steg 3 · Jämför offerter",
                body: "Beslutsvy med jämförelse, inline underlag och beslutslogg.",
              },
            ].map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4 transition hover:border-[#D2C5B5] hover:bg-white"
              >
                <p className="text-sm font-semibold text-[#2A2520]">{step.title}</p>
                <p className="mt-1 text-xs text-[#6B5A47]">{step.body}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </BrfProcurementDashboardShell>
  );
}

