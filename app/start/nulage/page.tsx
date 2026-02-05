"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import type { CurrentPhase } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";

const phases: Array<{
  id: Exclude<CurrentPhase, null>;
  title: string;
  description: string;
  hasDocuments: boolean;
  nextSteps: string[];
}> = [
  {
    id: "ide",
    title: "Tidig idé",
    description: "Jag har en övergripande idé men inget konkret underlag ännu",
    hasDocuments: false,
    nextSteps: ["Behöver hjälp att forma idén", "Beställa skiss/ritningar"],
  },
  {
    id: "skiss",
    title: "Skiss / Planritning",
    description: "Jag har skisser eller enkla planritningar",
    hasDocuments: true,
    nextSteps: ["Få offert baserat på skiss", "Ta fram bygghandlingar"],
  },
  {
    id: "ritningar",
    title: "Färdiga ritningar",
    description: "Jag har kompletta bygghandlingar från arkitekt/konstruktör",
    hasDocuments: true,
    nextSteps: ["Söka bygglov", "Få offert från entreprenörer"],
  },
  {
    id: "fardigt",
    title: "Färdigt underlag + tillstånd",
    description: "Jag har ritningar och eventuellt bygglov är beviljat",
    hasDocuments: true,
    nextSteps: ["Handla upp entreprenör", "Börja bygga"],
  },
];

export default function NulagePage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep } = useWizard();

  const [selectedPhase, setSelectedPhase] = useState<CurrentPhase>(data.currentPhase);

  // Skydd: om användaren kommer hit utan att välja projekttyp
  // (t.ex. via direkt URL)
  const canContinue = Boolean(selectedPhase) && Boolean(data.projectType);

  const handleContinue = () => {
    if (!selectedPhase || !data.projectType) return;

    updateData({ currentPhase: selectedPhase });
    setCurrentStep(3);

    // Nästa route baserat på projekttyp
    if (data.projectType === "renovering") router.push("/start/renovering");
    else if (data.projectType === "tillbyggnad") router.push("/start/tillbyggnad");
    else if (data.projectType === "nybyggnation") router.push("/start/nybyggnation");
    else router.push("/start/underlag");
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
            href="/start"
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
              <div className="mb-4 flex items-center gap-2 text-sm text-[#766B60]">
                <Link href="/start" className="transition-colors hover:text-[#8C7860]">
                  Projekttyp
                </Link>
                <span>/</span>
                <span className="font-semibold text-[#8C7860]">Nuläge</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
                Steg 2 · Nuläge
              </div>

              <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Vilket skede är projektet i idag?
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60] md:text-lg">
                Välj det alternativ som bäst beskriver nuläget. Det hjälper oss att föreslå rätt nästa steg.
              </p>

              <div className="mt-8">
                <WizardProgress />
              </div>

              <div className="mt-10 grid gap-4">
                {phases.map((phase, idx) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setSelectedPhase(phase.id)}
                    className={`group relative overflow-hidden rounded-3xl border-2 p-6 text-left shadow-lg transition-all duration-300 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                      selectedPhase === phase.id
                        ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5"
                        : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                    }`}
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className="flex-1">
                        <h3 className="flex items-center gap-3 text-xl font-bold text-[#2A2520]">
                          {phase.title}
                          {selectedPhase === phase.id && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8C7860] text-white">
                              <svg
                                width="14"
                                height="14"
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
                        </h3>

                        <p className="mt-2 text-sm leading-relaxed text-[#766B60]">
                          {phase.description}
                        </p>

                        <div className="mt-4 rounded-2xl bg-[#FAF8F5] p-4">
                          <div className="mb-2 text-xs font-semibold text-[#8C7860]">
                            Typiska nästa steg
                          </div>
                          <ul className="space-y-1">
                            {phase.nextSteps.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-[#766B60]">
                                <svg
                                  className="mt-0.5 flex-shrink-0"
                                  width="12"
                                  height="12"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="5 8 8 11 13 6" />
                                </svg>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                    </div>

                    <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[#CDB49B]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </button>
                ))}
              </div>

              {selectedPhase && (
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!canContinue}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

                  <div className="flex items-center gap-2 text-sm text-[#766B60]">
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
                    Nästa: Projektspecifika frågor
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
          </div>
        </div>
      </footer>
    </main>
  );
}

