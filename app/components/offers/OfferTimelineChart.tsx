"use client";

import { calculateTimelineTotal } from "../../lib/offers/calculations";
import type { Offer } from "../../lib/offers/types";
import { formatSek } from "./format";

function sortTimeline(offer: Offer): NonNullable<Offer["timeline"]> {
  const timeline = offer.timeline ?? [];
  return [...timeline].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.label.localeCompare(b.label, "sv");
  });
}

export function OfferTimelineChart({ offer }: { offer: Offer }) {
  const timeline = sortTimeline(offer);
  const total = calculateTimelineTotal(timeline);
  const maxAmount = timeline.reduce((max, entry) => Math.max(max, entry.amount), 0);

  return (
    <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Tidsprofil</p>
        <h3 className="text-xl font-bold text-[#2A2520]">Likviditetsplan</h3>
        <p className="text-sm text-[#6B5A47]">Summa i tidsplan: {formatSek(total)}</p>
      </header>

      {timeline.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
          Ingen tidsplan registrerad för offerten.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {timeline.map((entry) => {
            const width = maxAmount > 0 ? Math.max(6, (entry.amount / maxAmount) * 100) : 0;
            return (
              <div key={`${entry.label}-${entry.date ?? "no-date"}`} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#2A2520]">{entry.label}</p>
                    {entry.date && <p className="text-xs text-[#6B5A47]">{entry.date}</p>}
                  </div>
                  <p className="font-semibold text-[#2A2520]">{formatSek(entry.amount)}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EFE8DD]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F8B62A] to-[#2F2F31]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
