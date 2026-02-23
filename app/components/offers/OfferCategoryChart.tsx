"use client";

import { calculateCategoryBreakdown, recomputeOffer } from "../../lib/offers/calculations";
import type { Offer } from "../../lib/offers/types";
import { OfferDonutChart } from "./OfferDonutChart";

export function OfferCategoryChart({ offer }: { offer: Offer }) {
  const normalized = recomputeOffer(offer);
  const entries = calculateCategoryBreakdown(normalized.lineItems, normalized.totals.exVat).map(
    (entry) => ({
      key: entry.category,
      label: entry.category,
      amount: entry.amount,
      share: entry.share,
    })
  );

  return (
    <OfferDonutChart
      title="Kostnad per kategori"
      totalLabel="Fördelning av offertrader"
      totalValue={normalized.totals.exVat}
      entries={entries}
    />
  );
}
