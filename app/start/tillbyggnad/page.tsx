"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";

export default function TillbyggnadPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep } = useWizard();

  const [storlek, setStorlek] = useState(data.tillbyggnad?.storlek || "");
  const [typ, setTyp] = useState(data.tillbyggnad?.typ || "");
  const [befintlig, setBefintlig] = useState(data.tillbyggnad?.befintlig || "");

  const canContinue = Boolean(storlek && typ && befintlig);

  const handleContinue = () => {
    if (!canContinue) return;

    updateData({
      tillbyggnad: { storlek, typ, befintlig },
    });

    setCurrentStep(5);
    router.push("/start/beskrivning");
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

      {/* Content */}
      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="relative">
            {/* Breadcrumb */}
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
              <span className="font-semibold text-[#8C7860]">Tillbyggnad</span>
            </div>

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
              Steg 3 · Tillbyggnad
            </div>

            <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Beskriv tillbyggnaden
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60] md:text-lg">
              Berätta lite mer om tillbyggnaden så kan vi ge bättre rekommendationer
              och tidiga riskflaggor.
            </p>

            <div className="mt-8">
              <WizardProgress />
            </div>

            <div className="mt-10 space-y-8">
              {/* Storlek */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                  Ungefärlig storlek?
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { id: "under-20", label: "Under 20 m²", desc: "Litet uterum, förråd", permit: "Ibland lov" },
                    { id: "20-50", label: "20–50 m²", desc: "Sovrum, kontor, garage", permit: "Oftast lov" },
                    { id: "over-50", label: "Över 50 m²", desc: "Större våningsplan", permit: "Alltid lov" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStorlek(opt.id)}
                      className={`rounded-3xl border-2 p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        storlek === opt.id
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 shadow-lg"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="font-bold text-[#2A2520]">{opt.label}</div>
                        {storlek === opt.id && (
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
                      </div>
                      <div className="text-sm text-[#766B60]">{opt.desc}</div>
                      <div className="mt-2 text-xs font-semibold text-[#8C7860]">
                        {opt.permit}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Typ */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                  Hur många våningsplan?
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { id: "enplan", label: "Ett plan", desc: "Mark eller befintligt plan" },
                    { id: "tvaplan", label: "Två plan", desc: "Markplan + övervåning" },
                    { id: "takterrass", label: "Med takterrass", desc: "Platt tak för uteplats" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTyp(opt.id)}
                      className={`rounded-3xl border-2 p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        typ === opt.id
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 shadow-lg"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="font-bold text-[#2A2520]">{opt.label}</div>
                        {typ === opt.id && (
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
                      </div>
                      <div className="text-sm text-[#766B60]">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Befintlig byggnad */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                  Typ av befintlig byggnad?
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { id: "villa", label: "Fristående villa", info: "Mest flexibilitet" },
                    { id: "radhus", label: "Radhus", info: "Grannar kan påverka" },
                    { id: "kedjehus", label: "Kedjehus/Parhus", info: "En granne påverkar" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBefintlig(opt.id)}
                      className={`rounded-3xl border-2 p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        befintlig === opt.id
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 shadow-lg"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="font-bold text-[#2A2520]">{opt.label}</div>
                        {befintlig === opt.id && (
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
                      </div>
                      <div className="text-xs text-[#766B60]">{opt.info}</div>
                    </button>
                  ))}
                </div>
              </div>

              {canContinue && (
                <div className="rounded-3xl border border-[#8C7860]/30 bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 p-6">
                  <div>
                    <div className="mb-2 font-bold text-[#2A2520]">Bra att veta</div>
                      <ul className="space-y-1.5 text-sm text-[#766B60]">
                        <li className="flex items-start gap-2">
                          <span className="text-[#8C7860]">•</span>
                          Tillbyggnader kräver ofta bygglov, särskilt vid större ytor.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#8C7860]">•</span>
                          Radhus/kedjehus kan kräva grannsamverkan.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#8C7860]">•</span>
                          Större tillbyggnader påverkar ibland byggnadens bärande delar.
                        </li>
                      </ul>
                  </div>
                </div>
              )}

              {canContinue && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
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

