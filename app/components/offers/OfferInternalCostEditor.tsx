"use client";

import type { OfferInternalCostCategory, OfferInternalCostLine } from "../../lib/offers/types";
import { formatSek } from "./format";

const CATEGORY_OPTIONS: Array<{ value: OfferInternalCostCategory; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "planering", label: "Planering" },
  { value: "material", label: "Material" },
  { value: "ue", label: "UE" },
  { value: "maskin", label: "Maskin" },
  { value: "logistik", label: "Logistik" },
  { value: "ovrigt", label: "Övrigt" },
  { value: "riskreserv", label: "Riskreserv" },
];

function parseNumericInput(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function OfferInternalCostEditor({
  lines,
  dirty,
  isSaving,
  onChangeLine,
  onAddLine,
  onRemoveLine,
  onSave,
  onReset,
}: {
  lines: OfferInternalCostLine[];
  dirty: boolean;
  isSaving: boolean;
  onChangeLine: (lineId: string, patch: Partial<OfferInternalCostLine>) => void;
  onAddLine: () => void;
  onRemoveLine: (lineId: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const filledLines = lines.filter((line) => line.total > 0).length;

  return (
    <section className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Intern kalkyl</p>
          <h3 className="text-xl font-bold text-[#2A2520]">Kostnadsunderlag för exakt vinstvy</h3>
          <p className="mt-1 text-sm text-[#6B5A47]">
            Fyll i verkliga kostnader (timmar, inköpspriser, UE, planering, logistik). Visualisering och vinst baseras endast på dessa värden.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Återställ
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-xl bg-[#2F2F31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#19191A] disabled:opacity-60"
          >
            {isSaving ? "Sparar..." : "Spara kalkyl"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-[#8C7860]">Kalkylrader</p>
          <p className="mt-1 text-lg font-bold text-[#2A2520]">{lines.length}</p>
        </div>
        <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-[#8C7860]">Fyllda rader</p>
          <p className="mt-1 text-lg font-bold text-[#2A2520]">{filledLines}</p>
        </div>
        <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-[#8C7860]">Ändringar</p>
          <p className="mt-1 text-lg font-bold text-[#2A2520]">{dirty ? "Ej sparade" : "Sparade"}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E8E3DC] text-left text-xs uppercase tracking-wider text-[#8C7860]">
              <th className="px-2 py-2">Benämning</th>
              <th className="px-2 py-2">Kategori</th>
              <th className="px-2 py-2">Mängd</th>
              <th className="px-2 py-2">Enhet</th>
              <th className="px-2 py-2">Kostnad/enhet</th>
              <th className="px-2 py-2">Summa</th>
              <th className="px-2 py-2">Notering</th>
              <th className="px-2 py-2">Åtgärd</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-[#EFE8DD] align-top">
                <td className="px-2 py-2">
                  <input
                    value={line.label}
                    onChange={(event) => onChangeLine(line.id, { label: event.target.value })}
                    className="w-56 rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5"
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={line.category}
                    onChange={(event) =>
                      onChangeLine(line.id, {
                        category: event.target.value as OfferInternalCostCategory,
                      })
                    }
                    className="w-40 rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    value={String(line.quantity)}
                    onChange={(event) =>
                      onChangeLine(line.id, { quantity: Math.max(0, parseNumericInput(event.target.value)) })
                    }
                    className="w-24 rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-right"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={line.unit}
                    onChange={(event) => onChangeLine(line.id, { unit: event.target.value })}
                    className="w-20 rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    value={String(line.unitCost)}
                    onChange={(event) =>
                      onChangeLine(line.id, { unitCost: Math.max(0, parseNumericInput(event.target.value)) })
                    }
                    className="w-32 rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-right"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-2">
                  <p className="whitespace-nowrap rounded-lg border border-[#EFE8DD] bg-[#FAF8F5] px-2 py-1.5 font-semibold text-[#2A2520]">
                    {formatSek(line.total)}
                  </p>
                </td>
                <td className="px-2 py-2">
                  <input
                    value={line.notes ?? ""}
                    onChange={(event) => onChangeLine(line.id, { notes: event.target.value })}
                    placeholder="Valfritt"
                    className="w-48 rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.id)}
                    className="rounded-lg border border-[#E5CFC7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#8A4D3C] hover:bg-[#FFF5F2]"
                  >
                    Ta bort
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={onAddLine}
          className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
        >
          Lägg till kostnadsrad
        </button>
      </div>
    </section>
  );
}
