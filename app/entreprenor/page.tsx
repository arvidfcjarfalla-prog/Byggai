"use client";

import { useState } from "react";
import Link from "next/link";
import { Shell } from "../components/ui/shell";
import { Card } from "../components/ui/card";

const DUMMY_PACKET = {
  projectType: "Renovering",
  nulage: "Skiss",
  beskrivning: "Köksrenovering med flytt av vatten/avlopp. Badrum behöver nytt tätskikt.",
  budget: "300–500 tkr",
  start: "2026-04 – 2026-06",
  risk: "Våtrum inkluderat – kräver fuktsäker stomme.",
};

export default function EntreprenorPage() {
  const [showExample, setShowExample] = useState(false);
  return (
    <Shell backHref="/" backLabel="Tillbaka till startsidan">
      <div id="content" className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
          Ta emot strukturerade förfrågningar
        </h1>
        <p className="mt-3 text-lg text-[#766B60]">
          Projekt och förfrågningar från privatpersoner och BRF:er som matchar din profil.
        </p>
        <p className="mt-2 text-sm text-[#766B60]">
          Transparens: tydlig poäng och varför du matchar – så du kan prioritera rätt.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-2xl bg-[#8C7860] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6B5A47]"
          >
            Logga in
          </Link>
          <button
            type="button"
            onClick={() => setShowExample(true)}
            className="rounded-2xl border-2 border-[#E8E3DC] bg-white px-6 py-3 text-sm font-semibold text-[#766B60] transition-colors hover:border-[#CDB49B] hover:bg-[#FAF8F5]"
          >
            Se exempel-paket
          </button>
        </div>
        {showExample && (
          <Card className="mt-8 border-2 border-[#8C7860]/30">
            <h2 className="mb-4 text-base font-bold text-[#2A2520]">
              Exempel: så här ser en förfrågan ut
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-semibold text-[#8C7860]">Projekttyp · Nuläge</dt>
                <dd className="text-[#2A2520]">{DUMMY_PACKET.projectType} · {DUMMY_PACKET.nulage}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#8C7860]">Beskrivning</dt>
                <dd className="text-[#2A2520]">{DUMMY_PACKET.beskrivning}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#8C7860]">Budget · Start</dt>
                <dd className="text-[#2A2520]">{DUMMY_PACKET.budget} · {DUMMY_PACKET.start}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#8C7860]">Riskflagga</dt>
                <dd className="text-[#2A2520]">{DUMMY_PACKET.risk}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-[#766B60]">
              Detta är exempeldata. Inloggning krävs för att se riktiga förfrågningar.
            </p>
          </Card>
        )}
      </div>
    </Shell>
  );
}
