"use client";

import { BrfProcurementDashboardShell, BrfProcurementOfferStepWorkspace } from "../../page-shell";

export default function BrfProcurementOfferStep2Page() {
  return (
    <BrfProcurementDashboardShell
      heading="Upphandling · Offertflöde"
      subheading="Steg 2 av 3: granska scope, komplettera krav och skicka offertförfrågan."
    >
      <BrfProcurementOfferStepWorkspace step={2} />
    </BrfProcurementDashboardShell>
  );
}
