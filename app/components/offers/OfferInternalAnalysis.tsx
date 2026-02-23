"use client";

import { analyzeOfferStructure } from "../../lib/offers/analysis";
import {
  calculateInternalCostBreakdown,
  calculateOfferProfitabilitySummary,
  recomputeOffer,
} from "../../lib/offers/calculations";
import type { Offer, OfferInternalCostCategory } from "../../lib/offers/types";
import { formatPercent, formatSek } from "./format";
import { OfferDonutChart } from "./OfferDonutChart";

interface InternalAiResult {
  explanation: string;
  risks: string[];
  suggestions: string[];
}

function typeLabel(type: string): string {
  if (type === "arbete") return "Arbete";
  if (type === "material") return "Material";
  if (type === "ue") return "UE";
  return "Övrigt";
}

function internalCostCategoryLabel(category: OfferInternalCostCategory): string {
  if (category === "personal") return "Personal";
  if (category === "material") return "Material";
  if (category === "ue") return "UE";
  if (category === "planering") return "Planering";
  if (category === "maskin") return "Maskin";
  if (category === "logistik") return "Logistik";
  if (category === "riskreserv") return "Riskreserv";
  return "Övrigt";
}

export function OfferInternalAnalysis({
  offer,
  aiResult,
}: {
  offer: Offer;
  aiResult?: InternalAiResult;
}) {
  const normalized = recomputeOffer(offer);
  const summary = analyzeOfferStructure(normalized);
  const profitability = calculateOfferProfitabilitySummary(normalized);
  const internalCostLines = normalized.internalEstimate?.costLines ?? [];
  const costBreakdown = calculateInternalCostBreakdown(
    internalCostLines,
    profitability.internalCostExVat
  );
  const filledCostLines = internalCostLines.filter((line) => line.total > 0).length;
  const missingCoreCostCategories = ["personal", "material", "planering"].filter(
    (category) => !costBreakdown.some((entry) => entry.category === category)
  );
  const hasInternalCostData = profitability.internalCostExVat > 0;
  const profitTone =
    profitability.grossProfitExVat < 0
      ? "text-[#8A2E2E]"
      : profitability.grossProfitExVat === 0
        ? "text-[#6B5A47]"
        : "text-[#355C38]";

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Intern analys</p>
        <h2 className="text-2xl font-bold text-[#2A2520]">Lönsamhet & offertkvalitet före skick</h2>
        <p className="mt-1 text-sm text-[#6B5A47]">
          Visas endast från faktisk intern kalkyldata som är sparad på offerten. Ingen AI-gissning används för vinstberäkning.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#8C7860]">Intäkt</p>
            <p className="mt-1 text-lg font-bold text-[#2A2520]">{formatSek(profitability.revenueExVat)}</p>
            <p className="text-xs text-[#6B5A47]">Ex moms</p>
          </div>
          <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#8C7860]">Intern kostnad</p>
            <p className="mt-1 text-lg font-bold text-[#2A2520]">{formatSek(profitability.internalCostExVat)}</p>
            <p className="text-xs text-[#6B5A47]">{filledCostLines} kostnadsrader med värde</p>
          </div>
          <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#8C7860]">Bruttovinst</p>
            <p className={`mt-1 text-lg font-bold ${profitTone}`}>{formatSek(profitability.grossProfitExVat)}</p>
            <p className="text-xs text-[#6B5A47]">Intäkt - intern kostnad</p>
          </div>
          <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#8C7860]">Marginal</p>
            <p className={`mt-1 text-lg font-bold ${profitTone}`}>
              {profitability.grossMarginPercent !== null
                ? formatPercent(profitability.grossMarginPercent)
                : "—"}
            </p>
            <p className="text-xs text-[#6B5A47]">Bruttomarginal ex moms</p>
          </div>
          <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#8C7860]">Riskflaggor</p>
            <p className="mt-1 text-lg font-bold text-[#2A2520]">{summary.riskFlags.length}</p>
            <p className="text-xs text-[#6B5A47]">LineItems + struktur</p>
          </div>
        </div>

        {!hasInternalCostData && (
          <p className="mt-3 rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
            Fyll i intern kalkyl (personalkostnad, material, UE, planering m.m.) för att få faktisk vinst/marginal.
          </p>
        )}
        {missingCoreCostCategories.length > 0 && (
          <p className="mt-3 rounded-xl border border-[#F0D8D0] bg-[#FFF5F2] px-3 py-2 text-sm text-[#7A3F2F]">
            Kärnkostnader saknas i kalkylen:{" "}
            {missingCoreCostCategories
              .map((category) => internalCostCategoryLabel(category as OfferInternalCostCategory))
              .join(", ")}
            .
          </p>
        )}
      </article>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <OfferDonutChart
          title="Intern kostnadsmix"
          totalLabel="Faktiska sparade kostnadsposter"
          totalValue={profitability.internalCostExVat}
          entries={costBreakdown.map((entry) => ({
            key: entry.category,
            label: internalCostCategoryLabel(entry.category),
            amount: entry.amount,
            share: entry.share,
          }))}
        />

        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Resultatbild</p>
          <h3 className="text-xl font-bold text-[#2A2520]">Intäkt vs kostnad vs vinst</h3>
          <p className="mt-1 text-sm text-[#6B5A47]">
            Visualisering av vad projektet beräknas ge utifrån nuvarande offert + intern kalkyl.
          </p>

          {[
            { label: "Intäkt ex moms", amount: profitability.revenueExVat, color: "bg-[#2F2F31]" },
            { label: "Intern kostnad", amount: profitability.internalCostExVat, color: "bg-[#F8B62A]" },
            {
              label: "Bruttovinst",
              amount: Math.max(0, profitability.grossProfitExVat),
              color: "bg-[#22C55E]",
            },
          ].map((entry) => {
            const max = Math.max(
              profitability.revenueExVat,
              profitability.internalCostExVat,
              Math.max(0, profitability.grossProfitExVat),
              1
            );
            const width = Math.max(4, (entry.amount / max) * 100);
            return (
              <div key={entry.label} className="mt-4 space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-[#2A2520]">{entry.label}</span>
                  <span className="font-semibold text-[#2A2520]">{formatSek(entry.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EFE8DD]">
                  <div className={`h-full rounded-full ${entry.color}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Kostnadstäckning</p>
              <p className="mt-1 text-base font-bold text-[#2A2520]">
                {profitability.costCoveragePercent !== null
                  ? formatPercent(profitability.costCoveragePercent)
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Intäkt inkl moms</p>
              <p className="mt-1 text-base font-bold text-[#2A2520]">{formatSek(profitability.revenueIncVat)}</p>
            </div>
          </div>
        </article>
      </section>

      <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-[#2A2520]">Kostnadsstruktur</h3>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {summary.typeBreakdown.map((entry) => (
            <li key={entry.type} className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <p className="text-sm font-semibold text-[#2A2520]">{typeLabel(entry.type)}</p>
              <p className="text-xs text-[#6B5A47]">
                {formatSek(entry.amount)} ({formatPercent(entry.share)})
              </p>
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-[#2A2520]">Riskflaggor</h3>
        {summary.riskFlags.length === 0 ? (
          <p className="mt-2 rounded-xl border border-[#D7E7D2] bg-[#F2FBF0] px-3 py-2 text-sm text-[#3D5C35]">
            Inga uppenbara riskflaggor hittades.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.riskFlags.map((flag, index) => (
              <li
                key={`${flag.kind}-${flag.lineItemId ?? index}`}
                className="rounded-xl border border-[#F0D8D0] bg-[#FFF5F2] px-3 py-2 text-sm text-[#7A3F2F]"
              >
                {flag.message}
              </li>
            ))}
          </ul>
        )}
      </article>

      {aiResult && (
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">AI-granskning (intern)</h3>
          <p className="mt-2 text-sm text-[#6B5A47]">{aiResult.explanation}</p>
          {aiResult.risks.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-[#7A3F2F]">
              {aiResult.risks.map((risk) => (
                <li key={risk}>• {risk}</li>
              ))}
            </ul>
          )}
          {aiResult.suggestions.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-[#2A2520]">
              {aiResult.suggestions.map((suggestion) => (
                <li key={suggestion}>• {suggestion}</li>
              ))}
            </ul>
          )}
        </article>
      )}
    </section>
  );
}
