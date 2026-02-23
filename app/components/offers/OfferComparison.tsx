"use client";

import { toComparisonRows } from "../../lib/offers/calculations";
import type { Offer } from "../../lib/offers/types";
import { formatSek } from "./format";

function statusLabel(status: Offer["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslagen";
  return "Utkast";
}

export function OfferComparison({
  offers,
  selectedOfferId,
}: {
  offers: Offer[];
  selectedOfferId?: string;
}) {
  if (offers.length <= 1) {
    return (
      <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Jämförelse</p>
        <h3 className="text-xl font-bold text-[#2A2520]">Offertbenchmark</h3>
        <p className="mt-2 text-sm text-[#6B5A47]">
          Minst två offerter krävs för jämförelse på projektnivå.
        </p>
      </article>
    );
  }

  const rows = toComparisonRows(offers);
  const maxExVat = rows.reduce((max, row) => Math.max(max, row.totals.exVat), 0);

  return (
    <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Jämförelse</p>
        <h3 className="text-xl font-bold text-[#2A2520]">Offerter sida vid sida</h3>
      </header>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E8E3DC] text-left text-xs uppercase tracking-wider text-[#8C7860]">
              <th className="px-2 py-2">Entreprenör</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Version</th>
              <th className="px-2 py-2">Ex moms</th>
              <th className="px-2 py-2">Inkl moms</th>
              <th className="px-2 py-2">Poster</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = row.offerId === selectedOfferId;
              return (
                <tr
                  key={row.offerId}
                  className={`border-b border-[#EFE8DD] ${active ? "bg-[#FFF9F1]" : "bg-transparent"}`}
                >
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">{row.contractorId}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{statusLabel(row.status)}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">v{row.version}</td>
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">{formatSek(row.totals.exVat)}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{formatSek(row.totals.incVat)}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{row.itemCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => {
          const width = maxExVat > 0 ? (row.totals.exVat / maxExVat) * 100 : 0;
          return (
            <div key={`bar-${row.offerId}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs text-[#6B5A47]">
                <span className="truncate">{row.contractorId}</span>
                <span>{formatSek(row.totals.exVat)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#EFE8DD]">
                <div
                  className={`h-full rounded-full ${row.offerId === selectedOfferId ? "bg-[#2F2F31]" : "bg-[#F8B62A]"}`}
                  style={{ width: `${Math.max(width, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
