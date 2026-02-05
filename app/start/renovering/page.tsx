"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import type { RenoveringRooms } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";

const rooms = [
  {
    id: "badrum",
    title: "Badrum",
    description: "Komplett badrumsrenovering",
    complexity: "Hög",
    avgCost: "150–400 tkr",
    avgTime: "3–6 veckor",
    requiresPermit: "Sällan",
    tips: ["Ofta vatteninstallationer", "Kräver fuktsäker stomme"],
  },
  {
    id: "kok",
    title: "Kök",
    description: "Luckor, bänk, vitvaror, el & ytskikt",
    complexity: "Medel–Hög",
    avgCost: "100–350 tkr",
    avgTime: "2–5 veckor",
    requiresPermit: "Sällan",
    tips: ["Elarbete vanligt", "Ventilation viktigt"],
  },
  {
    id: "vardagsrum",
    title: "Vardagsrum",
    description: "Golv, målning, tak, inredning",
    complexity: "Låg–Medel",
    avgCost: "50–150 tkr",
    avgTime: "1–3 veckor",
    requiresPermit: "Nej",
    tips: ["Ofta kosmetiska åtgärder", "Snabbare genomförande"],
  },
  {
    id: "sovrum",
    title: "Sovrum",
    description: "Golv, målning, garderober",
    complexity: "Låg",
    avgCost: "30–100 tkr",
    avgTime: "1–2 veckor",
    requiresPermit: "Nej",
    tips: ["Oftast enkla åtgärder", "Ljuddämpning kan vara relevant"],
  },
  {
    id: "hall",
    title: "Hall / Entré",
    description: "Golv, målning, förvaring",
    complexity: "Låg",
    avgCost: "20–80 tkr",
    avgTime: "1–2 veckor",
    requiresPermit: "Nej",
    tips: ["Slitstarka material viktigt", "Smart förvaring uppskattat"],
  },
  {
    id: "tvattrum",
    title: "Tvättstuga",
    description: "Installationer, skåp, bänk",
    complexity: "Medel",
    avgCost: "40–120 tkr",
    avgTime: "1–3 veckor",
    requiresPermit: "Sällan",
    tips: ["Vatteninstallationer", "Ventilation viktigt"],
  },
  {
    id: "kontor",
    title: "Arbetsrum / Kontor",
    description: "Anpassning för hemmakontor",
    complexity: "Låg",
    avgCost: "25–90 tkr",
    avgTime: "1–2 veckor",
    requiresPermit: "Nej",
    tips: ["El för utrustning", "Bra belysning viktigt"],
  },
  {
    id: "annat",
    title: "Annat utrymme",
    description: "Källare, vind, förråd, etc.",
    complexity: "Varierar",
    avgCost: "Varierar",
    avgTime: "Varierar",
    requiresPermit: "Ibland",
    tips: ["Du kan beskriva mer i nästa steg"],
  },
] as const;

type RoomId = RenoveringRooms extends infer R ? keyof R : never;

export default function RenoveringPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep } = useWizard();

  const [selectedRooms, setSelectedRooms] = useState<RenoveringRooms>(
    data.renovering ?? {}
  );

  const toggleRoom = (roomId: RoomId) => {
    setSelectedRooms((prev) => ({
      ...prev,
      [roomId]: !prev?.[roomId],
    }));
  };

  const selectedCount = Object.values(selectedRooms).filter(Boolean).length;

  const handleContinue = () => {
    if (selectedCount === 0) return;

    updateData({ renovering: selectedRooms });
    setCurrentStep(4);

    router.push("/start/underlag");
  };

  const getComplexityColor = (complexity: string) => {
    // Lite mer “premium” mot din palett (inte neon-grön/gul)
    if (complexity.startsWith("Låg")) return "text-[#6B5A47]";
    if (complexity.startsWith("Medel")) return "text-[#8C7860]";
    return "text-[#5A4937]";
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
            href="/start/nulage"
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
          <div className="relative max-w-5xl">
            <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-[#CDB49B]/20 to-transparent blur-3xl" />
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gradient-to-tl from-[#8C7860]/15 to-transparent blur-3xl" />

            <div className="relative">
              <div className="mb-4 flex items-center gap-2 text-sm text-[#766B60]">
                <Link href="/start" className="transition-colors hover:text-[#8C7860]">
                  Projekttyp
                </Link>
                <span>/</span>
                <Link
                  href="/start/nulage"
                  className="transition-colors hover:text-[#8C7860]"
                >
                  Nuläge
                </Link>
                <span>/</span>
                <span className="font-semibold text-[#8C7860]">Renovering</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
                Steg 3 · Renovering
              </div>

              <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Vilka utrymmen ska renoveras?
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60] md:text-lg">
                Välj ett eller flera rum. Vi visar typisk komplexitet och ungefärlig
                kostnads-/tidsbild, så du får en snabb känsla för omfattningen.
              </p>

              {selectedCount > 0 && (
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white shadow-lg">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 8 6 11 13 4" />
                  </svg>
                  {selectedCount} {selectedCount === 1 ? "utrymme valt" : "utrymmen valda"}
                </div>
              )}

              <div className="mt-8">
                <WizardProgress />
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {rooms.map((room, idx) => {
                  const isSelected = Boolean(
                    selectedRooms?.[room.id as keyof RenoveringRooms]
                  );

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => toggleRoom(room.id as RoomId)}
                      className={`group relative overflow-hidden rounded-3xl border-2 p-6 text-left shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        isSelected
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="absolute right-4 top-4">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all duration-300 ${
                            isSelected
                              ? "border-[#8C7860] bg-[#8C7860] shadow-md"
                              : "border-[#E8E3DC] bg-white group-hover:border-[#CDB49B]"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 8 6 11 13 4" />
                            </svg>
                          )}
                        </div>
                      </div>

                      <h3 className="pr-10 text-xl font-bold text-[#2A2520]">{room.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#766B60]">
                        {room.description}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#E8E3DC] pt-4">
                        <div>
                          <div className="text-xs font-semibold text-[#766B60]">
                            Komplexitet
                          </div>
                          <div className={`text-sm font-bold ${getComplexityColor(room.complexity)}`}>
                            {room.complexity}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#766B60]">Kostnad</div>
                          <div className="text-sm font-bold text-[#2A2520]">{room.avgCost}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#766B60]">Tid</div>
                          <div className="text-sm font-bold text-[#2A2520]">{room.avgTime}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#766B60]">Bygglov</div>
                          <div className="text-sm font-bold text-[#2A2520]">
                            {room.requiresPermit}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-4 rounded-2xl bg-[#8C7860]/5 p-3">
                          <div className="mb-1.5 text-xs font-semibold text-[#8C7860]">
                            Bra att veta
                          </div>
                          <ul className="space-y-1">
                            {room.tips.map((tip, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-[#766B60]">
                                <span className="mt-0.5 text-[#8C7860]">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[#CDB49B]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>

              {selectedCount > 0 && (
                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                  >
                    Fortsätt med {selectedCount} {selectedCount === 1 ? "utrymme" : "utrymmen"}
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
                    Nästa: Underlag (ritningar & filer)
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
