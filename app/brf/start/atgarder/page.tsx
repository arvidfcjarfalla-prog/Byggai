"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../../components/ui/shell";
import {
  readBrfActionsDraft,
  writeBrfActionsDraft,
  writeBrfRequestMeta,
  type BrfActionDraft,
} from "../../../lib/brf-start";

const STATUS_OPTIONS: Array<BrfActionDraft["status"]> = [
  "Planerad",
  "Eftersatt",
  "Genomförd",
];

const CATEGORY_OPTIONS = [
  "El och belysning",
  "Ventilation",
  "Byggnadsskal",
  "Invändigt",
  "VVS och värme",
  "Mark",
  "Tak",
  "Fasad",
  "Övrigt",
];

function createEmptyAction(index: number): BrfActionDraft {
  return {
    id: `manual-${Date.now()}-${index}`,
    title: "",
    category: "Övrigt",
    status: "Planerad",
    plannedYear: new Date().getFullYear(),
    estimatedPriceSek: undefined,
    selected: true,
  };
}

function formatSek(value?: number): string {
  if (!value || value <= 0) return "-";
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}

export default function BrfStartAtgarderPage() {
  const [rows, setRows] = useState<BrfActionDraft[]>(() => {
    const stored = readBrfActionsDraft();
    if (stored.length > 0) return stored;
    return [createEmptyAction(0), createEmptyAction(1), createEmptyAction(2)];
  });

  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => rows.filter((row) => row.selected !== false && row.title.trim().length > 0).length,
    [rows]
  );

  const updateRow = <K extends keyof BrfActionDraft>(
    id: string,
    key: K,
    value: BrfActionDraft[K]
  ) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyAction(prev.length)]);
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const saveDraft = () => {
    const normalized = rows
      .map((row) => ({
        ...row,
        title: row.title.trim(),
        category: row.category.trim() || "Övrigt",
        plannedYear:
          Number.isFinite(row.plannedYear) && row.plannedYear > 1990
            ? row.plannedYear
            : new Date().getFullYear(),
        estimatedPriceSek:
          row.estimatedPriceSek && Number.isFinite(row.estimatedPriceSek)
            ? Math.max(0, Math.round(row.estimatedPriceSek))
            : undefined,
      }))
      .filter((row) => row.title.length > 0);

    writeBrfActionsDraft(normalized);
    writeBrfRequestMeta({
      startMode: "manuell",
      title: `BRF förfrågan (${selectedCount || normalized.length} åtgärder)`,
      description:
        normalized.length > 0
          ? `${normalized.length} manuellt registrerade åtgärder.`
          : "Inga åtgärder registrerade ännu.",
    });
    setSavedNotice("Åtgärder sparade lokalt. Gå vidare till sammanfattning när du vill.");
  };

  return (
    <Shell backHref="/brf/start" backLabel="Tillbaka till startval">
      <main id="content" className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
              BRF-start · Manuella åtgärder
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
              Lägg in åtgärder utan underhållsplan
            </h1>
            <p className="mt-3 max-w-3xl text-[#766B60]">
              Definiera vad som ska upphandlas nu. Varje rad blir en möjlig offertpost i
              sammanfattningen.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E6DFD6] bg-white px-4 py-3 text-sm text-[#6B5A47]">
            {selectedCount} valda åtgärder
          </div>
        </header>

        {savedNotice && (
          <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {savedNotice}
          </p>
        )}

        <section className="overflow-x-auto rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm md:p-6">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#EFE8DD] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                <th className="px-3 py-3">Val</th>
                <th className="px-3 py-3">Åtgärd</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Planerat år</th>
                <th className="px-3 py-3">Pris (SEK)</th>
                <th className="px-3 py-3">Åtgärd</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#F1ECE5] align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={row.selected !== false}
                      onChange={(event) => updateRow(row.id, "selected", event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      value={row.title}
                      onChange={(event) => updateRow(row.id, "title", event.target.value)}
                      placeholder="t.ex. Byta stammar i hus A"
                      className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.category}
                      onChange={(event) => updateRow(row.id, "category", event.target.value)}
                      className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.status}
                      onChange={(event) =>
                        updateRow(row.id, "status", event.target.value as BrfActionDraft["status"])
                      }
                      className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={row.plannedYear}
                      onChange={(event) =>
                        updateRow(row.id, "plannedYear", Number(event.target.value) || new Date().getFullYear())
                      }
                      className="w-28 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={0}
                      value={row.estimatedPriceSek ?? ""}
                      onChange={(event) => {
                        const next = event.target.value ? Number(event.target.value) : undefined;
                        updateRow(row.id, "estimatedPriceSek", next);
                      }}
                      placeholder="valfritt"
                      className="w-36 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-[#766B60]">{formatSek(row.estimatedPriceSek)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Ta bort
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={addRow}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              + Ny rad
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveDraft}
                className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
              >
                Spara utkast
              </button>
              <Link
                href="/brf/start/sammanfattning"
                onClick={saveDraft}
                className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Till BRF-sammanfattning
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
