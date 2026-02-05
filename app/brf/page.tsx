"use client";

import Link from "next/link";
import { Shell } from "../components/ui/shell";
import { Card } from "../components/ui/card";

const BRF_OPTIONS = [
  { id: "underhall", label: "Underhåll", desc: "Planera underhållsåtgärder" },
  { id: "renovering", label: "Renovering gemensamma ytor", desc: "Trapphus, tak, fasad" },
  { id: "fasad-tak", label: "Fasad / Tak", desc: "Utvändig renovering eller byte" },
  { id: "stambyte", label: "Stambyte / Utredning", desc: "Vatten, avlopp, el" },
  { id: "upphandling", label: "Upphandling", desc: "Förbered eller genomför upphandling" },
];

export default function BrfPage() {
  return (
    <Shell backHref="/" backLabel="Tillbaka till startsidan">
      <div id="content" className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
          Planera åtgärder & upphandling
        </h1>
        <p className="mt-3 text-lg text-[#766B60]">
          Vad vill ni göra i år?
        </p>
        <div className="mt-8 space-y-3">
          {BRF_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex w-full flex-col items-start rounded-2xl border-2 border-[#E8E3DC] bg-white p-5 text-left transition-all hover:border-[#CDB49B] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              <span className="font-bold text-[#2A2520]">{opt.label}</span>
              <span className="mt-0.5 text-sm text-[#766B60]">{opt.desc}</span>
            </button>
          ))}
        </div>
        <Card className="mt-8">
          <h2 className="mb-2 text-base font-bold text-[#2A2520]">
            Nästa steg (kort)
          </h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-[#766B60]">
            <li>Välj typ av åtgärd</li>
            <li>Samla underlag och beslut</li>
            <li>Skapa åtgärdsplan</li>
            <li>Upphandla eller boka leverantör</li>
          </ol>
          <p className="mt-4 text-xs text-[#766B60]">
            Detta flöde byggs ut. Auth krävs senare för att spara åtgärdsplan.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-2xl bg-[#8C7860] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6B5A47]"
          >
            Tillbaka till startsidan
          </Link>
        </Card>
      </div>
    </Shell>
  );
}
