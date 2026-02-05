"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ProjectType } from "../components/wizard-context";
import { useWizard } from "../components/wizard-context";
import { WizardProgress } from "../components/wizard-progress";

type Complexity = "Låg–medel" | "Medel–hög" | "Hög";

const projectTypes: Array<{
  id: Exclude<ProjectType, null>;
  title: string;
  description: string;
  examples: string;
  complexity: Complexity;
  requiresPermit: string;
}> = [
  {
    id: "renovering",
    title: "Renovering",
    description: "Förbättra eller ändra befintliga ytor.",
    examples: "Badrum, kök, vardagsrum…",
    complexity: "Låg–medel",
    requiresPermit: "Sällan",
  },
  {
    id: "tillbyggnad",
    title: "Tillbyggnad",
    description: "Utöka din befintliga byggnad.",
    examples: "Sovrum, uterum, garage…",
    complexity: "Medel–hög",
    requiresPermit: "Oftast",
  },
  {
    id: "nybyggnation",
    title: "Nybyggnation",
    description: "Bygg en helt ny byggnad från grunden.",
    examples: "Villa, fritidshus, garage…",
    complexity: "Hög",
    requiresPermit: "Alltid",
  },
  {
    id: "annat",
    title: "Annat / Osäker",
    description: "Jag behöver hjälp att avgöra rätt spår.",
    examples: "Guided hjälp att välja rätt",
    complexity: "Medel–hög",
    requiresPermit: "Varierar",
  },
];

function complexityPill(c: Complexity) {
  // Mer “premium” än grönt/gult/rött
  if (c === "Låg–medel") return "bg-[#CDB49B]/25 text-[#6B5A47] border-[#CDB49B]/40";
  if (c === "Medel–hög") return "bg-[#8C7860]/15 text-[#6B5A47] border-[#8C7860]/25";
  return "bg-[#6B5A47]/10 text-[#2A2520] border-[#6B5A47]/20";
}

export default function StartPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep } = useWizard();

  const [selectedType, setSelectedType] = useState<Exclude<ProjectType, null> | null>(
    data.projectType
  );

  const selectedMeta = useMemo(
    () => projectTypes.find((t) => t.id === selectedType),
    [selectedType]
  );

  const handleSelectType = (typeId: Exclude<ProjectType, null>) => {
    setSelectedType(typeId);
  };

  const handleContinue = () => {
    if (!selectedType) return;

    updateData({ projectType: selectedType });
    setCurrentStep(2);

    // Nästa steg: nuläge (använd "nulage" i route)
    router.push("/start/nulage");
  };

  return (
    <main
      className="min-h-screen bg-[#FAF8F5] text-[#2A2520] antialiased"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(205, 180, 155, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(140, 120, 100, 0.06) 0%, transparent 50%)
        `,
      }}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-4 focus:z-[60] focus:rounded-2xl focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860]"
      >
        Hoppa till innehåll
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#E8E3DC] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-2xl outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8C7860] to-[#6B5A47] shadow-md transition-transform duration-300 group-hover:scale-105">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">Byggplattformen</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="10 4 6 8 10 12" />
            </svg>
            Tillbaka
          </Link>
        </div>
      </header>

      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="relative max-w-4xl">
            <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-[#CDB49B]/20 to-transparent blur-3xl" />
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gradient-to-tl from-[#8C7860]/15 to-transparent blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
                Steg 1 · Projekttyp
              </div>

              <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Vilken typ av projekt planerar du?
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60] md:text-lg">
                Välj kategorin som bäst beskriver ditt projekt. Det gör att vi kan
                ställa rätt frågor och ge relevanta nästa steg.
              </p>

              <div className="mt-8">
                <WizardProgress />
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {projectTypes.map((type, idx) => {
                  const selected = selectedType === type.id;

                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleSelectType(type.id)}
                      aria-pressed={selected}
                      className={`group relative overflow-hidden rounded-3xl border-2 p-6 text-left shadow-lg transition-all duration-300 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        selected
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      {selected && (
                        <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#8C7860] text-white shadow-lg">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 8 6 11 13 4" />
                          </svg>
                        </div>
                      )}

                      <h3 className="text-xl font-bold text-[#2A2520]">{type.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#766B60]">
                        {type.description}
                      </p>

                      <div className="mt-4 space-y-2 border-t border-[#E8E3DC] pt-4">
                        <div className="flex items-center gap-2 text-xs text-[#766B60]">
                          <span className="font-semibold">Exempel:</span>
                          <span>{type.examples}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold ${complexityPill(
                              type.complexity
                            )}`}
                          >
                            Komplexitet: {type.complexity}
                          </span>

                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E3DC] bg-white px-2.5 py-1 text-[#766B60]">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="3" width="10" height="10" rx="2" />
                              <path d="M7 3v10M3 7h10" />
                            </svg>
                            Bygglov: {type.requiresPermit}
                          </span>
                        </div>
                      </div>

                      <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[#CDB49B]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>

              {selectedType && (
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-[1.01] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                  >
                    Fortsätt
                    <svg
                      className="transition-transform duration-300 group-hover:translate-x-1"
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
                  </button>

                  <div className="flex flex-col gap-1 text-sm text-[#766B60] sm:items-end">
                    <div className="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 5v3l2 2" />
                      </svg>
                      Nästa: Nuvarande läge & underlag
                    </div>
                    {selectedMeta && (
                      <div className="text-xs text-[#9A9086]">
                        Vald projekttyp: <span className="font-semibold text-[#6B5A47]">{selectedMeta.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E8E3DC] bg-white px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 text-sm text-[#766B60] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span>© 2026 Byggplattformen</span>
              <span className="text-[#CDB49B]">•</span>
              <span>Alla rättigheter förbehållna</span>
            </div>
            <div className="flex flex-wrap gap-6">
              <Link
                className="font-medium outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                href="/"
              >
                Tillbaka till startsidan
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

