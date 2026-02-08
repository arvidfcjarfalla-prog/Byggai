"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Shell } from "../../components/ui/shell";
import {
  BRF_REQUEST_META_UPDATED_EVENT,
  writeBrfRequestMeta,
  type BrfStartMode,
} from "../../lib/brf-start";

function StartTypeCard({
  title,
  body,
  href,
  onClick,
  accent,
}: {
  title: string;
  body: string;
  href: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group block rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D2C5B5] hover:shadow-md"
    >
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${accent}`}
      >
        Starttyp
      </span>
      <h2 className="mt-4 text-xl font-bold tracking-tight text-[#2A2520]">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6B5A47]">{body}</p>
      <span className="mt-5 inline-flex items-center text-sm font-semibold text-[#8C7860]">
        Fortsätt
        <svg
          className="ml-1 transition-transform group-hover:translate-x-1"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="8" x2="14" y2="8" />
          <polyline points="10 4 14 8 10 12" />
        </svg>
      </span>
    </Link>
  );
}

function saveStartMode(mode: BrfStartMode) {
  writeBrfRequestMeta({ startMode: mode });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BRF_REQUEST_META_UPDATED_EVENT));
  }
}

export default function BrfStartPage() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("byggplattformen-role", "brf");
    }
  }, []);

  return (
    <Shell backHref="/brf" backLabel="Tillbaka till BRF-sidan">
      <main id="content" className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            BRF · Initiera projekt
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Hur vill ni starta?
          </h1>
          <p className="mt-3 max-w-3xl text-[#766B60]">
            Underhållsplan är en accelerator men inget krav. Välj det spår som passar
            föreningens nuläge och bygg ett jämförbart offertunderlag stegvis.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StartTypeCard
            title="Vi har underhållsplan"
            body="Ladda upp plan och extrahera åtgärder. Snabbaste vägen till ett första utskick."
            href="/dashboard/brf/underhallsplan"
            onClick={() => saveStartMode("underhallsplan")}
            accent="bg-[#EAF3FB] text-[#34506B]"
          />
          <StartTypeCard
            title="Vi har åtgärder men ingen plan"
            body="Lägg in åtgärder manuellt med kategori, år, status och kostnad i ett enkelt arbetsblad."
            href="/brf/start/atgarder"
            onClick={() => saveStartMode("manuell")}
            accent="bg-[#FFF2D8] text-[#7A5623]"
          />
          <StartTypeCard
            title="Vi är osäkra"
            body="Få en guidad prioritering av vanliga BRF-åtgärder och bygg ut scope successivt."
            href="/brf/start/guidad"
            onClick={() => saveStartMode("guidad")}
            accent="bg-[#F3EFFF] text-[#5D4A8F]"
          />
        </section>

        <section className="mt-6 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-[#2A2520]">Nästa steg efter starttyp</h2>
          <ol className="mt-3 space-y-2 text-sm text-[#6B5A47]">
            <li>1. Lägg till eller välj åtgärder som ska upphandlas nu.</li>
            <li>2. Komplettera startfönster, budgetram och kontaktperson.</li>
            <li>3. Gå till sammanfattning och skicka förfrågan till entreprenörer.</li>
          </ol>
          <div className="mt-4">
            <Link
              href="/brf/start/sammanfattning"
              className="inline-flex items-center rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Gå till BRF-sammanfattning
            </Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}
