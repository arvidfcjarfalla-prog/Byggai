"use client";

import Link from "next/link";
import { useState } from "react";
import { Typewriter } from "./typewriter";

type PersonaId = "privat" | "brf" | "entreprenor" | "utforskar";

const INTRO_TEXT =
  "Hej. Vi hjälper dig att få struktur på ditt byggprojekt – innan du pratar med entreprenörer eller tar beslut. Vem vill du vara idag?";

const PERSONA_CONFIRM: Record<PersonaId, string> = {
  privat:
    "Du är privatperson och vill initiera ett projekt. Vi guidar dig steg för steg genom nuläge, underlag och omfattning. Nästa steg: börja med att välja typ av projekt.",
  brf: "Du representerar en bostadsrättsförening. Vi har ett särskilt flöde för ärenden som rör gemensamma beslut. Nästa steg: starta ett ärende.",
  entreprenor:
    "Du är entreprenör och vill se inkommande projekt och förfrågningar. Nästa steg: gå till din översikt.",
  utforskar:
    "Du vill bara utforska eller ge råd. Hoppa ned till «Så funkar det» för att se flödet utan att skapa projekt.",
};

const PERSONAS: { id: PersonaId; title: string; description: string }[] = [
  {
    id: "privat",
    title: "Privatperson",
    description: "Jag vill planera eller genomföra ett eget byggprojekt.",
  },
  {
    id: "brf",
    title: "Bostadsrättsförening",
    description: "Vi ska fatta beslut om renovering eller underhåll i föreningen.",
  },
  {
    id: "entreprenor",
    title: "Entreprenör",
    description: "Jag vill se inkommande projekt och svara på förfrågningar.",
  },
  {
    id: "utforskar",
    title: "Utforskar / Rådgivning",
    description: "Jag vill bara se hur det funkar eller ge råd till andra.",
  },
];

export function LandingHero() {
  const [phase, setPhase] = useState<"intro" | "persona" | "chosen">("intro");
  const [selectedPersona, setSelectedPersona] = useState<PersonaId | null>(null);
  const [confirmDone, setConfirmDone] = useState(false);

  const handleIntroComplete = () => {
    setPhase("persona");
  };

  const handlePersonaSelect = (id: PersonaId) => {
    setSelectedPersona(id);
    setPhase("chosen");
    setConfirmDone(false);
  };

  const handleConfirmComplete = () => {
    setConfirmDone(true);
  };

  const scrollToHur = () => {
    const el = document.getElementById("hur");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="content" className="px-4 pb-24 pt-20 lg:pt-28">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <div className="relative w-full max-w-3xl">
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-[#CDB49B]/20 to-transparent blur-3xl" />
          <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-gradient-to-tl from-[#8C7860]/15 to-transparent blur-3xl" />

          <div className="relative rounded-3xl border-2 border-[#E8E3DC] bg-white/95 p-8 shadow-2xl backdrop-blur-sm md:p-12 lg:rounded-[2.5rem]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-[#CDB49B]/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B5A47]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
              Beslutsstöd · Tidigt skede
            </div>

            {phase === "intro" && (
              <>
                <h1 className="font-display mt-8 min-h-[4.5rem] text-4xl font-bold leading-tight tracking-tight text-[#2A2520] md:text-5xl lg:min-h-[5.5rem] lg:text-6xl">
                  <Typewriter
                    text={INTRO_TEXT}
                    speed={35}
                    delay={400}
                    onComplete={handleIntroComplete}
                    cursor
                  />
                </h1>
              </>
            )}

            {phase === "persona" && (
              <>
                <p className="mt-6 text-lg text-[#2A2520] md:text-xl">
                  Välj det som bäst stämmer:
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {PERSONAS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePersonaSelect(p.id)}
                      className="rounded-2xl border-2 border-[#E8E3DC] bg-white p-6 text-left shadow-md transition-all duration-300 hover:border-[#CDB49B] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                    >
                      <h3 className="text-lg font-bold text-[#2A2520]">
                        {p.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#766B60]">
                        {p.description}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {phase === "chosen" && selectedPersona && (
              <>
                <h2 className="mt-8 text-xl font-bold text-[#2A2520] md:text-2xl">
                  {PERSONAS.find((x) => x.id === selectedPersona)?.title}
                </h2>
                <p className="mt-4 min-h-[3rem] text-lg leading-relaxed text-[#766B60] md:text-xl">
                  <Typewriter
                    text={PERSONA_CONFIRM[selectedPersona]}
                    speed={25}
                    delay={200}
                    onComplete={handleConfirmComplete}
                    cursor
                  />
                </p>
                {confirmDone && (
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                    {selectedPersona === "privat" && (
                      <Link
                        href="/start"
                        className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8C7860] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#6B5A47] hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                      >
                        Initiera projekt
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="8" x2="14" y2="8" />
                          <polyline points="10 4 14 8 10 12" />
                        </svg>
                      </Link>
                    )}
                    {selectedPersona === "brf" && (
                      <Link
                        href="/brf/start"
                        className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8C7860] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#6B5A47] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                      >
                        Starta ärende
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="8" x2="14" y2="8" />
                          <polyline points="10 4 14 8 10 12" />
                        </svg>
                      </Link>
                    )}
                    {selectedPersona === "entreprenor" && (
                      <Link
                        href="/entreprenor"
                        className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8C7860] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#6B5A47] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                      >
                        Se inkommande projekt
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="8" x2="14" y2="8" />
                          <polyline points="10 4 14 8 10 12" />
                        </svg>
                      </Link>
                    )}
                    {selectedPersona === "utforskar" && (
                      <button
                        type="button"
                        onClick={scrollToHur}
                        className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8C7860] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-[#6B5A47] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                      >
                        Se hur det funkar
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="4 6 8 10 12 6" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPhase("persona");
                        setSelectedPersona(null);
                      }}
                      className="text-sm font-semibold text-[#6B5A47] underline-offset-4 hover:underline"
                    >
                      Välj annat
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="mt-6 flex items-center gap-2 text-xs text-[#6B5A47]">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 2" />
              </svg>
              Ingen inloggning i första steget. Du kan avbryta när som helst.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
