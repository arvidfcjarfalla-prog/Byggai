"use client";

import Link from "next/link";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import type { RiskLevel } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { Notice } from "../../components/ui/notice";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";

const RISK_COLORS: Record<RiskLevel, string> = {
  green: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
  yellow: "border-amber-200 bg-amber-50/80 text-amber-800",
  red: "border-red-200 bg-red-50/80 text-red-800",
};

const DUMMY_ENTREPRENEURS = [
  { id: "1", name: "Bygg AB", score: 92, reason: "Matchar renovering, erfarenhet med våtrum" },
  { id: "2", name: "RenoPro", score: 88, reason: "Närhet, kapacitet nästa kvartal" },
  { id: "3", name: "Hantverk & Co", score: 85, reason: "Bra betyg, transparent prissättning" },
];

export default function SammanfattningPage() {
  const { data, updateData, computeRiskProfile } = useWizard();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [quoteGenerated, setQuoteGenerated] = useState(!!data.quoteDraft);
  const [matchList, setMatchList] = useState<typeof DUMMY_ENTREPRENEURS | null>(null);

  const risk = computeRiskProfile(data);
  const projectType = data.projectType;
  const typeCrumb: Crumb | null =
    projectType && projectType !== "annat"
      ? {
          href:
            projectType === "renovering"
              ? "/start/renovering"
              : projectType === "tillbyggnad"
                ? "/start/tillbyggnad"
                : "/start/nybyggnation",
          label:
            projectType === "renovering"
              ? "Renovering"
              : projectType === "tillbyggnad"
                ? "Tillbyggnad"
                : "Nybyggnation",
        }
      : null;
  const breadcrumbs: Crumb[] = [
    { href: "/start", label: "Projekttyp" },
    { href: "/start/nulage", label: "Nuläge" },
    ...(typeCrumb ? [typeCrumb] : []),
    { href: "/start/underlag", label: "Underlag" },
    { href: "/start/omfattning", label: "Omfattning" },
    { href: "/start/budget", label: "Budget" },
    { href: "/start/tidplan", label: "Tidplan" },
    { label: "Sammanfattning" },
  ];

  const handleGenerateQuote = () => {
    updateData({
      quoteDraft: {
        createdAt: new Date().toISOString(),
        summary: "Offertutkast genererat från dina svar (MVP-stub).",
      },
    });
    setQuoteGenerated(true);
  };

  const handleMatch = () => {
    setMatchList(DUMMY_ENTREPRENEURS);
  };

  const handleInvite = () => {
    setShowAuthGate(true);
  };

  return (
    <Shell backHref="/start/tidplan" backLabel="Tillbaka">
      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={breadcrumbs} />
          <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
            Sammanfattning
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Projektöversikt
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60]">
            Granska dina val, riskprofil och nästa steg. Härifrån kan du generera
            offertunderlag eller matcha entreprenörer.
          </p>
          <div className="mt-8">
            <WizardProgress />
          </div>

          {/* Dina val */}
          <Card className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-[#2A2520]">
              Dina val
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase text-[#8C7860]">Projekttyp</dt>
                <dd className="mt-0.5 text-[#2A2520]">
                  {projectType === "renovering"
                    ? "Renovering"
                    : projectType === "tillbyggnad"
                      ? "Tillbyggnad"
                      : projectType === "nybyggnation"
                        ? "Nybyggnation"
                        : "Annat"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-[#8C7860]">Nuläge</dt>
                <dd className="mt-0.5 text-[#2A2520]">
                  {data.currentPhase === "ide"
                    ? "Tidig idé"
                    : data.currentPhase === "skiss"
                      ? "Skiss"
                      : data.currentPhase === "ritningar"
                        ? "Färdiga ritningar"
                        : data.currentPhase === "fardigt"
                          ? "Färdigt underlag"
                          : "—"}
                </dd>
              </div>
              {data.budget && (data.budget.intervalMin != null || data.budget.intervalMax != null) && (
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#8C7860]">Budget</dt>
                  <dd className="mt-0.5 text-[#2A2520]">
                    {data.budget.intervalMin ?? "?"} – {data.budget.intervalMax ?? "?"} tkr
                    {data.budget.isHard ? " (hård)" : " (flex)"}
                  </dd>
                </div>
              )}
              {data.tidplan && (data.tidplan.startFrom || data.tidplan.startTo) && (
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#8C7860]">Startintervall</dt>
                  <dd className="mt-0.5 text-[#2A2520]">
                    {data.tidplan.startFrom ?? "—"} till {data.tidplan.startTo ?? "—"}
                  </dd>
                </div>
              )}
              {(data.files?.length ?? 0) > 0 && (
                <div>
                  <dt className="text-xs font-semibold uppercase text-[#8C7860]">Filer</dt>
                  <dd className="mt-0.5 text-[#2A2520]">{data.files!.length} uppladdade</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Riskkort */}
          <Card className={`mt-6 border-2 ${RISK_COLORS[risk.level]}`}>
            <h2 className="mb-2 text-lg font-bold">
              Riskprofil
            </h2>
            <p className="mb-4 text-sm opacity-90">
              Baserat på dina svar – neutral och transparent.
            </p>
            <ul className="mb-4 list-inside list-disc space-y-1 text-sm">
              {risk.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <div>
              <span className="text-xs font-semibold uppercase opacity-80">Rekommenderade nästa steg</span>
              <ul className="mt-2 space-y-1 text-sm">
                {risk.recommendedNextSteps.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Offert & Matchning */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Card>
              <h3 className="mb-2 text-base font-bold text-[#2A2520]">
                Generera offertunderlag
              </h3>
              <p className="mb-4 text-sm text-[#766B60]">
                Skapa ett utkast som du kan dela med entreprenörer (MVP: sparas i översikten).
              </p>
              {quoteGenerated ? (
                <Notice variant="success">
                  Offertutkast skapat. Du kan senare exportera eller dela det när du har konto.
                </Notice>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateQuote}
                  className="rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-6 py-3 text-sm font-semibold text-white shadow-md outline-none transition-all hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                >
                  Generera utkast
                </button>
              )}
            </Card>
            <Card>
              <h3 className="mb-2 text-base font-bold text-[#2A2520]">
                Matcha entreprenörer
              </h3>
              <p className="mb-4 text-sm text-[#766B60]">
                Få en shortlist med transparent scoring (MVP: exempeldata).
              </p>
              <button
                type="button"
                onClick={handleMatch}
                className="rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-6 py-3 text-sm font-semibold text-white shadow-md outline-none transition-all hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              >
                Visa matchning
              </button>
            </Card>
          </div>

          {matchList && (
            <Card className="mt-6">
              <h3 className="mb-4 text-base font-bold text-[#2A2520]">
                Föreslagna entreprenörer (stub)
              </h3>
              <ul className="space-y-4">
                {matchList.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4"
                  >
                    <div>
                      <p className="font-semibold text-[#2A2520]">{e.name}</p>
                      <p className="text-sm text-[#766B60]">{e.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#8C7860]/15 px-3 py-1 text-sm font-bold text-[#6B5A47]">
                        {e.score} %
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[#766B60]">
                Poäng är beräknade utifrån kompetens, kapacitet och geografi (stub-logik).
              </p>
            </Card>
          )}

          {/* Bjud in / Collaboration */}
          <Card className="mt-8">
            <h3 className="mb-2 text-base font-bold text-[#2A2520]">
              Bjud in någon
            </h3>
            <p className="mb-4 text-sm text-[#766B60]">
              Dela projektet med partner, arkitekt eller entreprenör. För delning krävs konto.
            </p>
            {showAuthGate ? (
              <div className="rounded-2xl border-2 border-[#8C7860]/40 bg-[#CDB49B]/10 p-6">
                <h4 className="mb-2 font-semibold text-[#2A2520]">
                  Konto krävs för delning
                </h4>
                <p className="mb-4 text-sm text-[#766B60]">
                  För att bjuda in andra och dela projektet behöver du skapa konto eller logga in.
                  Det säkerställer att endast du bestämmer vilka som får åtkomst.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/konto"
                    className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white outline-none transition-all hover:bg-[#6B5A47] focus-visible:ring-2 focus-visible:ring-[#8C7860]"
                  >
                    Skapa konto
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-2 text-sm font-semibold text-[#766B60] outline-none transition-all hover:border-[#CDB49B] focus-visible:ring-2 focus-visible:ring-[#8C7860]"
                  >
                    Logga in
                  </Link>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInvite}
                className="rounded-2xl border-2 border-[#CDB49B] bg-white px-6 py-3 text-sm font-semibold text-[#8C7860] outline-none transition-all hover:bg-[#CDB49B]/10 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              >
                Bjud in deltagare
              </button>
            )}
          </Card>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/start/tidplan"
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#E8E3DC] bg-white px-6 py-4 text-sm font-semibold text-[#766B60] outline-none transition-all hover:border-[#CDB49B] focus-visible:ring-2 focus-visible:ring-[#8C7860]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="10 4 6 8 10 12" />
              </svg>
              Tillbaka
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Klar – till startsidan
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}
