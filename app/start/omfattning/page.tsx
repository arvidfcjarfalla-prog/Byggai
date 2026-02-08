"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { ChoiceCard } from "../../components/ui/choice-card";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";

export default function OmfattningPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep, stepConfig } = useWizard();
  const [scopeText, setScopeText] = useState(data.omfattning ?? "");
  const [scopeScope, setScopeScope] = useState<Record<string, boolean>>(
    (data.omfattningScope as Record<string, boolean>) ?? {}
  );

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
    { label: "Omfattning" },
  ];

  const toggle = (key: string) => {
    setScopeScope((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContinue = () => {
    updateData({
      omfattning: scopeText,
      omfattningScope: scopeScope,
    });
    const idx = stepConfig.findIndex((s) => s.path === "/start/budget");
    if (idx >= 0) setCurrentStep(idx + 1);
    router.push("/start/budget");
  };

  return (
    <Shell backHref="/start/underlag" backLabel="Tillbaka">
      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={breadcrumbs} />
          <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
            Steg · Omfattning
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Vad ingår – och vad ingår inte?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60]">
            Avgränsa projektet så att du och eventuella parter har samma bild.
          </p>
          <div className="mt-8">
            <WizardProgress />
          </div>

          {/* Kort sammanfattning "Dina val hittills" */}
          <Card className="mt-8 border-[#CDB49B]/30">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8C7860]">
              Dina val hittills
            </h3>
            <ul className="space-y-1 text-sm text-[#766B60]">
              {data.projectType && (
                <li>
                  <span className="font-medium text-[#2A2520]">Projekttyp:</span>{" "}
                  {data.projectType === "renovering"
                    ? "Renovering"
                    : data.projectType === "tillbyggnad"
                      ? "Tillbyggnad"
                      : data.projectType === "nybyggnation"
                        ? "Nybyggnation"
                        : "Annat"}
                </li>
              )}
              {data.currentPhase && (
                <li>
                  <span className="font-medium text-[#2A2520]">Nuläge:</span>{" "}
                  {data.currentPhase === "ide"
                    ? "Tidig idé"
                    : data.currentPhase === "skiss"
                      ? "Skiss"
                      : data.currentPhase === "ritningar"
                        ? "Färdiga ritningar"
                        : "Färdigt underlag"}
                </li>
              )}
              {(data.files?.length ?? 0) > 0 && (
                <li>
                  <span className="font-medium text-[#2A2520]">Filer:</span>{" "}
                  {data.files!.length} uppladdade
                </li>
              )}
            </ul>
          </Card>

          {/* Fri beskrivning */}
          <div className="mt-8">
            <label htmlFor="scope" className="mb-2 block text-sm font-bold text-[#2A2520]">
              Kort beskrivning av omfattning (valfritt)
            </label>
            <textarea
              id="scope"
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
              placeholder="T.ex. kök och badrum renoveras; vardagsrum och sovrum ingår inte."
              rows={3}
              className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-[#2A2520] placeholder:text-[#9A9086] focus:border-[#8C7860] focus:outline-none focus:ring-2 focus:ring-[#8C7860]/20"
            />
          </div>

          {/* Projektspecifika scope-frågor */}
          {projectType === "renovering" && (
            <div className="mt-8">
              <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                Renovering – vad gäller?
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "vatrum", label: "Våtrum (bad/kök/tvätt)" },
                  { key: "el", label: "Elarbeten" },
                  { key: "barande", label: "Bärande väggar / stomme" },
                  { key: "koksflytt", label: "Köksflytt / nytt läge" },
                ].map(({ key, label }) => (
                  <ChoiceCard
                    key={key}
                    selected={scopeScope[key]}
                    onClick={() => toggle(key)}
                  >
                    {label}
                  </ChoiceCard>
                ))}
              </div>
            </div>
          )}

          {projectType === "tillbyggnad" && (
            <div className="mt-8">
              <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                Tillbyggnad – vad ingår?
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "grund", label: "Ny grund" },
                  { key: "anslutning", label: "Anslutning till befintlig (el, VA)" },
                  { key: "barande", label: "Bärande / takstol" },
                  { key: "fasad", label: "Fasad / tak (avslutning)" },
                ].map(({ key, label }) => (
                  <ChoiceCard
                    key={key}
                    selected={scopeScope[key]}
                    onClick={() => toggle(key)}
                  >
                    {label}
                  </ChoiceCard>
                ))}
              </div>
            </div>
          )}

          {projectType === "nybyggnation" && (
            <div className="mt-8">
              <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
                Nybyggnation – ungefärlig omfattning
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: "hustyp", label: "Hustyp (villa/fritidshus/garage)" },
                  { key: "vaningar", label: "Antal våningar" },
                  { key: "boyta", label: "Boyta (ca m²)" },
                  { key: "energi", label: "Energikrav / solceller" },
                  { key: "va", label: "VA (avlopp, vatten)" },
                ].map(({ key, label }) => (
                  <ChoiceCard
                    key={key}
                    selected={scopeScope[key]}
                    onClick={() => toggle(key)}
                  >
                    {label}
                  </ChoiceCard>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/start/underlag"
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
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Fortsätt till budget
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
