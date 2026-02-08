"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../../components/ui/shell";
import {
  writeBrfActionsDraft,
  writeBrfRequestMeta,
  type BrfActionDraft,
} from "../../../lib/brf-start";

type GuidedArea = {
  id: string;
  label: string;
  hint: string;
  suggestions: Array<{ title: string; category: string }>;
};

const GUIDED_AREAS: GuidedArea[] = [
  {
    id: "tak-fasad",
    label: "Tak och fasad",
    hint: "Yttre klimatskal, tätning, målning och livslängd.",
    suggestions: [
      { title: "Taköversyn och partiell omläggning", category: "Byggnadsskal" },
      { title: "Fasadrenovering och omfogning", category: "Byggnadsskal" },
    ],
  },
  {
    id: "stammar-vvs",
    label: "Stammar och VVS",
    hint: "Rör, undercentral, värme och vatten.",
    suggestions: [
      { title: "Förstudie stambyte och etappindelning", category: "VVS och värme" },
      { title: "Byte av undercentral för värme", category: "VVS och värme" },
    ],
  },
  {
    id: "el-energi",
    label: "El och energi",
    hint: "Belysning, styrning, energibesparing.",
    suggestions: [
      { title: "Byta belysningsarmatur LED i trapphus", category: "El och belysning" },
      { title: "Effektanalys för gemensamma el-system", category: "El och belysning" },
    ],
  },
  {
    id: "inne-trapphus",
    label: "Invändigt och trapphus",
    hint: "Ytskikt, tillgänglighet och boendepåverkan.",
    suggestions: [
      { title: "Måla trapphus och entréplan", category: "Invändigt" },
      { title: "Åtgärdsplan för entré och tillgänglighet", category: "Invändigt" },
    ],
  },
  {
    id: "ventilation",
    label: "Ventilation och inomhusklimat",
    hint: "FTX/F-system, komfort och drift.",
    suggestions: [
      { title: "Byta ventilationsaggregat (FTX)", category: "Ventilation" },
      { title: "OVK-åtgärder och injustering", category: "Ventilation" },
    ],
  },
];

function buildActionsFromSelection(selectedAreaIds: string[]): BrfActionDraft[] {
  const baseYear = new Date().getFullYear();
  const selectedAreas = GUIDED_AREAS.filter((area) => selectedAreaIds.includes(area.id));

  return selectedAreas.flatMap((area, areaIndex) =>
    area.suggestions.map((suggestion, suggestionIndex) => ({
      id: `guided-${area.id}-${suggestionIndex}-${Date.now()}`,
      title: suggestion.title,
      category: suggestion.category,
      status: areaIndex % 2 === 0 ? "Planerad" : "Eftersatt",
      plannedYear: baseYear + Math.floor(areaIndex / 2),
      estimatedPriceSek: undefined,
      selected: true,
      details: `Genererad från guidat spår: ${area.label}.`,
    }))
  );
}

export default function BrfStartGuidadPage() {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const suggestedActionCount = useMemo(
    () => buildActionsFromSelection(selectedAreas).length,
    [selectedAreas]
  );

  const toggleArea = (id: string) => {
    setSelectedAreas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const saveGuidedDraft = () => {
    const actions = buildActionsFromSelection(selectedAreas);
    writeBrfActionsDraft(actions);
    writeBrfRequestMeta({
      startMode: "guidad",
      title: "BRF förfrågan (guidad)",
      description:
        actions.length > 0
          ? `${actions.length} föreslagna åtgärder från guidad initiering.`
          : "Inga åtgärder valda ännu.",
      budgetUnknown: true,
      flexibleStart: true,
    });
    setNotice("Guidat utkast sparat. Justera detaljer i sammanfattningen innan utskick.");
  };

  return (
    <Shell backHref="/brf/start" backLabel="Tillbaka till startval">
      <main id="content" className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            BRF-start · Guidat läge
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Vi är osäkra – hjälp oss prioritera
          </h1>
          <p className="mt-3 max-w-3xl text-[#766B60]">
            Välj de områden ni tror är aktuella. Plattformen skapar ett första
            åtgärdsutkast som ni kan justera före utskick.
          </p>
        </header>

        {notice && (
          <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          {GUIDED_AREAS.map((area) => {
            const selected = selectedAreas.includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => toggleArea(area.id)}
                className={`rounded-3xl border p-5 text-left transition-all ${
                  selected
                    ? "border-[#8C7860] bg-[#F6F0E8]"
                    : "border-[#E6DFD6] bg-white hover:border-[#D2C5B5]"
                }`}
              >
                <p className="text-sm font-semibold text-[#2A2520]">{area.label}</p>
                <p className="mt-1 text-xs text-[#6B5A47]">{area.hint}</p>
                <ul className="mt-3 space-y-1 text-xs text-[#6B5A47]">
                  {area.suggestions.map((suggestion) => (
                    <li key={suggestion.title}>• {suggestion.title}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </section>

        <section className="mt-6 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <p className="text-sm text-[#6B5A47]">
            Valda områden: <span className="font-semibold text-[#2A2520]">{selectedAreas.length}</span>
          </p>
          <p className="mt-1 text-sm text-[#6B5A47]">
            Föreslagna åtgärder: <span className="font-semibold text-[#2A2520]">{suggestedActionCount}</span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveGuidedDraft}
              className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
            >
              Spara guidat utkast
            </button>
            <Link
              href="/brf/start/sammanfattning"
              onClick={saveGuidedDraft}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Gå till sammanfattning
            </Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}
