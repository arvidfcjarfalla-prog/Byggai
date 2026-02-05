"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { Notice } from "../../components/ui/notice";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";

export default function BudgetPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep, stepConfig } = useWizard();
  const [intervalMin, setIntervalMin] = useState<string>(
    data.budget?.intervalMin?.toString() ?? ""
  );
  const [intervalMax, setIntervalMax] = useState<string>(
    data.budget?.intervalMax?.toString() ?? ""
  );
  const [isHard, setIsHard] = useState<boolean>(data.budget?.isHard ?? false);
  const [financing, setFinancing] = useState<string>(
    data.budget?.financing ?? ""
  );
  const [budgetAcknowledged, setBudgetAcknowledged] = useState<boolean>(
    data.budget?.budgetAcknowledged ?? false
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
    { href: "/start/omfattning", label: "Omfattning" },
    { label: "Budget" },
  ];

  const minNum = intervalMin ? parseInt(intervalMin, 10) : undefined;
  const maxNum = intervalMax ? parseInt(intervalMax, 10) : undefined;
  const canContinue = (minNum !== undefined && minNum >= 0) || (maxNum !== undefined && maxNum >= 0);

  const handleContinue = () => {
    updateData({
      budget: {
        intervalMin: minNum,
        intervalMax: maxNum,
        isHard,
        financing: financing as "egen" | "bank" | "osaker" | undefined,
        budgetAcknowledged: budgetWarning ? budgetAcknowledged : undefined,
      },
    });
    const idx = stepConfig.findIndex((s) => s.path === "/start/tidplan");
    if (idx >= 0) setCurrentStep(idx + 1);
    router.push("/start/tidplan");
  };

  const budgetWarning = (() => {
    if (minNum == null && maxNum == null) return null;
    const low = minNum ?? 0;
    const high = maxNum ?? low;
    if (projectType === "nybyggnation" && high > 0 && high < 500) {
      return {
        text: "Nybyggnation är vanligtvis svårt att genomföra inom detta spann. Vill du justera budgeten eller fortsätta ändå?",
        context: "nybyggnation",
      };
    }
    if (projectType === "renovering" && high > 2000) {
      return {
        text: "Ett så stort spann för renovering är vanligtvis svårt för entreprenörer att prissätta. Vill du justera eller fortsätta ändå?",
        context: "renovering",
      };
    }
    return null;
  })();

  return (
    <Shell backHref="/start/omfattning" backLabel="Tillbaka">
      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={breadcrumbs} />
          <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
            Steg · Budget
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Budget och finansiering
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60]">
            Ange ett intervall (t.ex. 200–400 tkr) och om budgeten är hård eller
            flexibel. Vi visar en varning om något verkar orealistiskt.
          </p>
          <div className="mt-8">
            <WizardProgress />
          </div>

          <Card className="mt-8">
            <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
              Budgetintervall (tkr)
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label htmlFor="min" className="sr-only">
                  Min (tkr)
                </label>
                <input
                  id="min"
                  type="number"
                  min={0}
                  step={50}
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(e.target.value)}
                  placeholder="Min"
                  className="w-32 rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-[#2A2520] placeholder:text-[#9A9086] focus:border-[#8C7860] focus:outline-none focus:ring-2 focus:ring-[#8C7860]/20"
                />
                <span className="ml-2 text-sm text-[#766B60]">tkr</span>
              </div>
              <span className="text-[#766B60]">–</span>
              <div>
                <label htmlFor="max" className="sr-only">
                  Max (tkr)
                </label>
                <input
                  id="max"
                  type="number"
                  min={0}
                  step={50}
                  value={intervalMax}
                  onChange={(e) => setIntervalMax(e.target.value)}
                  placeholder="Max"
                  className="w-32 rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-[#2A2520] placeholder:text-[#9A9086] focus:border-[#8C7860] focus:outline-none focus:ring-2 focus:ring-[#8C7860]/20"
                />
                <span className="ml-2 text-sm text-[#766B60]">tkr</span>
              </div>
            </div>

            <div className="mt-6">
              <span className="mb-2 block text-sm font-bold text-[#2A2520]">
                Budgettyp
              </span>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="hard"
                    checked={!isHard}
                    onChange={() => setIsHard(false)}
                    className="h-4 w-4 border-[#8C7860] text-[#8C7860] focus:ring-[#8C7860]"
                  />
                  <span className="text-sm text-[#2A2520]">Flexibel (soft)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="hard"
                    checked={isHard}
                    onChange={() => setIsHard(true)}
                    className="h-4 w-4 border-[#8C7860] text-[#8C7860] focus:ring-[#8C7860]"
                  />
                  <span className="text-sm text-[#2A2520]">Hård budget</span>
                </label>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="financing" className="mb-2 block text-sm font-bold text-[#2A2520]">
                Finansiering
              </label>
              <select
                id="financing"
                value={financing}
                onChange={(e) => setFinancing(e.target.value)}
                className="w-full max-w-xs rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-[#2A2520] focus:border-[#8C7860] focus:outline-none focus:ring-2 focus:ring-[#8C7860]/20"
              >
                <option value="">Välj</option>
                <option value="egen">Egen finansiering</option>
                <option value="bank">Banklån / bygglån</option>
                <option value="osaker">Osäker ännu</option>
              </select>
            </div>
          </Card>

          {budgetWarning && (
            <div className="mt-6 space-y-3">
              <Notice variant="warning">
                {budgetWarning.text}
              </Notice>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E8E3DC] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={budgetAcknowledged}
                  onChange={(e) => setBudgetAcknowledged(e.target.checked)}
                  className="h-4 w-4 rounded border-[#8C7860] text-[#8C7860] focus:ring-[#8C7860]"
                />
                <span className="text-sm font-medium text-[#2A2520]">
                  Jag vill fortsätta ändå
                </span>
              </label>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/start/omfattning"
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
              disabled={!canContinue}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Fortsätt till tidplan
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
