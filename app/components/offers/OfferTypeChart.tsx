"use client";

import { calculateTypeBreakdown, recomputeOffer } from "../../lib/offers/calculations";
import type { Offer } from "../../lib/offers/types";
import { OfferDonutChart } from "./OfferDonutChart";

function typeLabel(type: string): string {
  if (type === "arbete") return "Arbete";
  if (type === "material") return "Material";
  if (type === "ue") return "UE";
  return "Övrigt";
}

export function OfferTypeChart({ offer }: { offer: Offer }) {
  const normalized = recomputeOffer(offer);
  const entries = calculateTypeBreakdown(normalized.lineItems, normalized.totals.exVat).map(
    (entry) => ({
      key: entry.type,
      label: typeLabel(entry.type),
      amount: entry.amount,
      share: entry.share,
    })
  );

  return (
    <OfferDonutChart
      title="Kostnad per typ"
      totalLabel="Arbete / Material / UE / Övrigt"
      totalValue={normalized.totals.exVat}
      entries={entries}
    />
  );
}
