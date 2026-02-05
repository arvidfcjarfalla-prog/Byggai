"use client";

import Link from "next/link";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";

export default function BrfStartPage() {
  return (
    <Shell backHref="/" backLabel="Tillbaka till startsidan">
      <div id="content" className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
          Starta ärende (BRF)
        </h1>
        <p className="mt-3 text-lg text-[#766B60]">
          Här kommer ett särskilt flöde för bostadsrättsföreningar – ärenden som
          rör gemensamma beslut om renovering och underhåll.
        </p>
        <Card className="mt-8">
          <p className="text-[#766B60]">
            Detta flöde är under utveckling. Du kan redan använda{" "}
            <Link href="/start" className="font-semibold text-[#8C7860] underline-offset-4 hover:underline">
              Initiera projekt
            </Link>{" "}
            för privata projekt.
          </p>
        </Card>
      </div>
    </Shell>
  );
}
