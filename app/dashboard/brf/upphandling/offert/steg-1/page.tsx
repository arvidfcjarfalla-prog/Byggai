"use client";

import { BrfProcurementDashboardShell, BrfProcurementOfferStepWorkspace } from "../../page-shell";

export default function BrfProcurementOfferStep1Page() {
  return (
    <BrfProcurementDashboardShell
      heading="Upphandling · Offertflöde"
      subheading="Steg 1 av 3: välj åtgärder för offertförfrågan. Urval och filter delas med underhållsplanen."
    >
      <BrfProcurementOfferStepWorkspace step={1} />
    </BrfProcurementDashboardShell>
  );
}
