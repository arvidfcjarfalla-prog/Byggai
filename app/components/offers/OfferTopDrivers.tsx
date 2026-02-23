"use client";

import { calculateTopDrivers, recomputeOffer } from "../../lib/offers/calculations";
import type { Offer } from "../../lib/offers/types";
import { formatPercent, formatSek } from "./format";

export function OfferTopDrivers({
  offer,
  limit = 5,
}: {
  offer: Offer;
  limit?: number;
}) {
  const normalized = recomputeOffer(offer);
  const drivers = calculateTopDrivers(normalized.lineItems, normalized.totals.exVat, limit);

  return (
    <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Kostnadsdrivare</p>
        <h3 className="text-xl font-bold text-[#2A2520]">Top {limit} poster</h3>
        <p className="text-sm text-[#6B5A47]">Störst påverkan på totalpriset ex moms.</p>
      </header>

      {drivers.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
          Inga lineItems i offerten ännu.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {drivers.map((driver, index) => (
            <li
              key={driver.lineItemId}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2F2F31] text-xs font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2A2520]">{driver.title}</p>
                <p className="truncate text-xs text-[#6B5A47]">{driver.category}</p>
              </div>
              <span className="text-xs font-semibold text-[#6B5A47]">{formatPercent(driver.share)}</span>
              <span className="text-sm font-semibold text-[#2A2520]">{formatSek(driver.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
