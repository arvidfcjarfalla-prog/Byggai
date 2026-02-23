"use client";

import { calculateCostPerSquareMeter, calculateTypeBreakdown, recomputeOffer } from "../../lib/offers/calculations";
import type { Offer } from "../../lib/offers/types";
import { formatNumber, formatSek } from "./format";

function typeAmount(type: "arbete" | "material" | "ue", offer: Offer): number {
  return offer.lineItems
    .filter((lineItem) => lineItem.type === type)
    .reduce((sum, lineItem) => sum + lineItem.total, 0);
}

export function OfferSummaryCards({
  offer,
  areaM2,
}: {
  offer: Offer;
  areaM2?: number;
}) {
  const normalized = recomputeOffer(offer);
  const typeBreakdown = calculateTypeBreakdown(normalized.lineItems, normalized.totals.exVat);
  const arbeteAmount = typeAmount("arbete", normalized);
  const materialAmount = typeAmount("material", normalized);
  const ueAmount = typeAmount("ue", normalized);
  const costPerSquareMeter = calculateCostPerSquareMeter(normalized.totals.exVat, areaM2);

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Total ex moms</p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-[#2A2520]">{formatSek(normalized.totals.exVat)}</p>
        <div className="mt-3 space-y-2">
          {typeBreakdown.map((entry) => (
            <div key={entry.type} className="rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] px-2 py-1.5 text-xs text-[#6B5A47]">
              <span className="font-semibold uppercase">{entry.type}</span>: {formatSek(entry.amount)} ({entry.share.toFixed(1)}%)
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Moms</p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-[#2A2520]">{formatSek(normalized.totals.vat)}</p>
        <p className="mt-3 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
          25% enligt standardmomssats.
        </p>
      </article>

      <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Total inkl moms</p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-[#2A2520]">{formatSek(normalized.totals.incVat)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] px-2 py-1.5 text-[#6B5A47]">
            <p className="font-semibold text-[#2A2520]">Arbete</p>
            <p>{formatSek(arbeteAmount)}</p>
          </div>
          <div className="rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] px-2 py-1.5 text-[#6B5A47]">
            <p className="font-semibold text-[#2A2520]">Material</p>
            <p>{formatSek(materialAmount)}</p>
          </div>
          <div className="rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] px-2 py-1.5 text-[#6B5A47]">
            <p className="font-semibold text-[#2A2520]">UE</p>
            <p>{formatSek(ueAmount)}</p>
          </div>
        </div>
        {costPerSquareMeter !== null && (
          <p className="mt-3 rounded-lg border border-[#D7C3A8] bg-[#FFF9F1] px-3 py-2 text-sm text-[#5D5245]">
            Kostnad per m²: <span className="font-semibold">{formatNumber(costPerSquareMeter)} kr/m²</span>
          </p>
        )}
      </article>
    </section>
  );
}
