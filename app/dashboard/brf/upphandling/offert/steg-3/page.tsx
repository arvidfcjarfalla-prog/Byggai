"use client";

import { BrfProcurementDashboardShell, BrfProcurementOfferStepWorkspace } from "../../page-shell";

export default function BrfProcurementOfferStep3Page() {
  return (
    <BrfProcurementDashboardShell
      heading="Upphandling · Offertflöde"
      subheading="Steg 3 av 3: jämför offerter, granska underlag och välj entreprenör."
    >
      <BrfProcurementOfferStepWorkspace step={3} />
    </BrfProcurementDashboardShell>
  );
}
