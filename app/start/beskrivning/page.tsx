"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";

const HINTS = [
  "Vad ska göras?",
  "Var i huset?",
  "Varför nu?",
  "Några mått eller krav?",
];

export default function BeskrivningPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep, stepConfig, deriveSummaryFromText } =
    useWizard();
  const [text, setText] = useState(data.freeTextDescription ?? "");
  const liveDerived = deriveSummaryFromText(text, data.projectType ?? null);

  const projectType = data.projectType;
  const typePath =
    projectType === "renovering"
      ? "/start/renovering"
      : projectType === "tillbyggnad"
        ? "/start/tillbyggnad"
        : projectType === "nybyggnation"
          ? "/start/nybyggnation"
          : "/start/nulage";
  const typeLabel =
    projectType === "renovering"
      ? "Renovering"
      : projectType === "tillbyggnad"
        ? "Tillbyggnad"
        : projectType === "nybyggnation"
          ? "Nybyggnation"
          : "Nuläge";

  const breadcrumbs: Crumb[] = [
    { href: "/start", label: "Projekttyp" },
    { href: "/start/nulage", label: "Nuläge" },
    ...(projectType && projectType !== "annat"
      ? [{ href: typePath, label: typeLabel }]
      : []),
    { label: "Beskrivning" },
  ];

  const handleContinue = () => {
    updateData({ freeTextDescription: text, derivedSummary: liveDerived });
    const idx = stepConfig.findIndex((s) => s.path === "/start/underlag");
    if (idx >= 0) setCurrentStep(idx + 1);
    router.push("/start/underlag");
  };

  return (
    <Shell backHref={typePath} backLabel="Tillbaka">
      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={breadcrumbs} />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-[#CDB49B]/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
            Beskrivning
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Beskriv vad du vill göra
          </h1>
          <p className="mt-2 text-base text-[#766B60]">
            Inga beslut fattas ännu. Vi samlar bara underlag.
          </p>
          <div className="mt-8">
            <WizardProgress />
          </div>

          <Card className="mt-8">
            <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
              <p className="text-sm font-medium text-[#2A2520]">
                Beskriv kort vad du vill göra. 2–5 meningar räcker. Du kan skriva fritt – vi omvandlar det till strukturerade punkter.
              </p>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="T.ex. Jag vill renovera köket och eventuellt flytta en vägg. Badrummet behöver nytt golv och tätskikt. Vi har ritningar från förra året."
              rows={5}
              className="mt-4 w-full rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-3 font-sans text-[#2A2520] placeholder:text-[#9A9086] focus:border-[#8C7860] focus:outline-none focus:ring-2 focus:ring-[#8C7860]/20"
            />
            <p className="mt-2 text-xs text-[#766B60]">
              {HINTS.join(" · ")}
            </p>
          </Card>

          {(liveDerived.goal || liveDerived.scope || (liveDerived.flags?.length) || (liveDerived.extractedRooms?.length)) ? (
            <Card className="mt-6 border-[#CDB49B]/40 bg-[#CDB49B]/5">
              <h2 className="mb-3 text-base font-bold text-[#2A2520]">
                Strukturerad tolkning (förhandsvisning)
              </h2>
              <dl className="space-y-2 text-sm">
                {liveDerived.goal && (
                  <div>
                    <dt className="font-semibold text-[#8C7860]">Mål</dt>
                    <dd className="mt-0.5 text-[#2A2520]">{liveDerived.goal}</dd>
                  </div>
                )}
                {liveDerived.scope && (
                  <div>
                    <dt className="font-semibold text-[#8C7860]">Omfattning</dt>
                    <dd className="mt-0.5 text-[#2A2520]">{liveDerived.scope}</dd>
                  </div>
                )}
                {liveDerived.flags && liveDerived.flags.length > 0 && (
                  <div>
                    <dt className="font-semibold text-[#8C7860]">Riskflaggor</dt>
                    <dd className="mt-0.5 text-[#2A2520]">
                      {liveDerived.flags.join(", ")}
                    </dd>
                  </div>
                )}
                {liveDerived.extractedRooms && liveDerived.extractedRooms.length > 0 && (
                  <div>
                    <dt className="font-semibold text-[#8C7860]">Rum/områden</dt>
                    <dd className="mt-0.5 text-[#2A2520]">
                      {liveDerived.extractedRooms.join(", ")}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          ) : null}

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={typePath}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#E8E3DC] bg-white px-6 py-4 text-sm font-semibold text-[#766B60] outline-none transition-all hover:border-[#CDB49B] focus-visible:ring-2 focus-visible:ring-[#8C7860]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="10 4 6 8 10 12" />
              </svg>
              Tillbaka
            </Link>
            <button
              type="button"
              onClick={handleContinue}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8C7860] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all hover:bg-[#6B5A47] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Fortsätt till underlag
              <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="8" x2="14" y2="8" />
                <polyline points="10 4 14 8 10 12" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </Shell>
  );
}
