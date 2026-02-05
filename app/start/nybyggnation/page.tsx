"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";

export default function NybyggnationPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep } = useWizard();

  const [harTomt, setHarTomt] = useState<boolean | null>(
    data.nybyggnation?.harTomt ?? null
  );
  const [detaljplan, setDetaljplan] = useState<string>(
    data.nybyggnation?.detaljplan || ""
  );
  const [bygglov, setBygglov] = useState<string>(
    data.nybyggnation?.bygglov || ""
  );

  const canContinue = harTomt !== null && Boolean(detaljplan) && Boolean(bygglov);

  const handleContinue = () => {
    if (!canContinue) return;

    updateData({
      nybyggnation: { harTomt, detaljplan, bygglov },
    });

    setCurrentStep(5);
    router.push("/start/beskrivning");
  };

  // Smart “risk assessment”
  const getRisks = () => {
    if (!canContinue) return null;

    const r: string[] = [];
    if (!harTomt) r.push("Ingen tomt ännu (kan påverka tidplan och val av lösning)");
    if (detaljplan === "nej") r.push("Ingen detaljplan (kan innebära längre process/utredning)");
    if (bygglov === "nej") r.push("Bygglov inte sökt (vanligt steg innan upphandling)");
    if (detaljplan === "vet-ej") r.push("Detaljplan oklar (behöver kontrolleras med kommunen)");

    return r.length ? r : null;
  };

  const risks = getRisks();

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
              <span className="font-semibold text-[#8C7860]">Nybyggnation</span>
            </div>

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
              Steg 3 · Nybyggnation
            </div>

            <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Förutsättningar för nybyggnation
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60] md:text-lg">
              Nybyggnation påverkas ofta av tomt, detaljplan och bygglov. Berätta var
              du är i processen så kan vi flagga rätt nästa steg.
            </p>

            {/* Progress */}
            <div className="mt-8">
              <WizardProgress />
            </div>

            {/* Questions */}
            <div className="mt-10 space-y-8">
              {/* Har tomt */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                  Har du redan en tomt?
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      id: true,
                      label: "Ja, jag har en tomt",
                      desc: "Äger eller har köpt tomt",
                      info: "Bra — då går vi vidare med plan/bygglov",
                    },
                    {
                      id: false,
                      label: "Nej, letar fortfarande",
                      desc: "Behöver hitta rätt tomt",
                      info: "Vi kan hjälpa dig med krav/urval",
                    },
                  ].map((opt) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setHarTomt(opt.id)}
                      className={`rounded-3xl border-2 p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        harTomt === opt.id
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 shadow-lg"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="font-bold text-[#2A2520]">{opt.label}</div>
                        {harTomt === opt.id && (
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
                      <div className="mb-2 text-sm text-[#766B60]">{opt.desc}</div>
                      <div className="text-xs font-semibold text-[#8C7860]">{opt.info}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detaljplan */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                  Finns det en godkänd detaljplan?
                </h3>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { id: "ja", label: "Ja, detaljplan finns" },
                    { id: "vet-ej", label: "Vet ej" },
                    { id: "nej", label: "Nej / osäkert" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDetaljplan(opt.id)}
                      className={`rounded-3xl border-2 p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        detaljplan === opt.id
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 shadow-lg"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-bold text-[#2A2520]">{opt.label}</div>
                        {detaljplan === opt.id && (
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
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-xs text-[#766B60]">
                  Detaljplanen styr vad som får byggas (t.ex. höjd, placering, byggyta).
                </p>
              </div>

              {/* Bygglov */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                  Status för bygglov?
                </h3>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { id: "ja", label: "Beviljat bygglov", desc: "Redo för nästa steg" },
                    { id: "pagar", label: "Ansökan pågår", desc: "Väntar på beslut" },
                    { id: "nej", label: "Inte sökt ännu", desc: "Behöver tas fram" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBygglov(opt.id)}
                      className={`rounded-3xl border-2 p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ${
                        bygglov === opt.id
                          ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 shadow-lg"
                          : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="font-bold text-[#2A2520]">{opt.label}</div>
                        {bygglov === opt.id && (
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

              {/* Risk / Success */}
              {canContinue && risks && (
                <div className="rounded-3xl border border-[#E8E3DC] bg-white p-6">
                  <div>
                    <div className="mb-2 font-bold text-[#2A2520]">
                      Viktiga steg kvar (bra att veta)
                    </div>
                      <ul className="space-y-1.5 text-sm text-[#766B60]">
                        {risks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[#8C7860]">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-sm text-[#766B60]">
                        Vi kommer föreslå en rimlig ordning för nästa beslut.
                      </p>
                  </div>
                </div>
              )}

              {canContinue && !risks && (
                <div className="rounded-3xl border border-[#E8E3DC] bg-white p-6">
                  <div>
                    <div className="mb-2 font-bold text-[#2A2520]">Bra läge!</div>
                      <p className="text-sm text-[#766B60]">
                        Med tomt, planstatus och bygglov på plats kan du gå vidare mer
                        effektivt till projektering och upphandling.
                      </p>
                  </div>
                </div>
              )}

              {/* Continue */}
              {canContinue && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                  >
                    Fortsätt till nästa steg
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

      {/* Footer */}
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

