"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWizard } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";

function getWeekId(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay() + 1);
  const y = start.getFullYear();
  const w = Math.ceil((start.getTime() - new Date(y, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${y}-W${String(w).padStart(2, "0")}`;
}

function nextWeeks(count: number): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i * 7);
    const id = getWeekId(d);
    const mon = new Date(d);
    mon.setDate(d.getDate() - d.getDay() + 1);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (x: Date) => x.toLocaleDateString("sv-SE", { month: "short", day: "numeric" });
    out.push({ id, label: `${fmt(mon)} – ${fmt(sun)}` });
  }
  return out;
}

export default function TidplanPage() {
  const router = useRouter();
  const { data, updateData, setCurrentStep, stepConfig } = useWizard();
  const [startFrom, setStartFrom] = useState(data.tidplan?.startFrom ?? "");
  const [startTo, setStartTo] = useState(data.tidplan?.startTo ?? "");
  const [executionPace, setExecutionPace] = useState<string>(
    data.tidplan?.executionPace ?? ""
  );
  const [blockedWeeks, setBlockedWeeks] = useState<string[]>(
    data.tidplan?.blockedWeeks ?? []
  );
  const [startWindowFlexible, setStartWindowFlexible] = useState<boolean | undefined>(
    data.tidplan?.startWindowFlexible
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
    { href: "/start/budget", label: "Budget" },
    { label: "Tidplan" },
  ];

  const weeks = nextWeeks(16);

  const toggleBlocked = (weekId: string) => {
    setBlockedWeeks((prev) =>
      prev.includes(weekId) ? prev.filter((w) => w !== weekId) : [...prev, weekId]
    );
  };

  const handleContinue = () => {
    updateData({
      tidplan: {
        startFrom: startFrom || undefined,
        startTo: startTo || undefined,
        executionPace: executionPace as "snabb" | "normal" | "kan_vanta" | undefined,
        blockedWeeks: blockedWeeks.length ? blockedWeeks : undefined,
        startWindowFlexible,
      },
    });
    const idx = stepConfig.findIndex((s) => s.path === "/start/sammanfattning");
    if (idx >= 0) setCurrentStep(idx + 1);
    router.push("/start/sammanfattning");
  };

  return (
    <Shell backHref="/start/budget" backLabel="Tillbaka">
      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={breadcrumbs} />
          <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
            Steg · Tidplan
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Önskat startintervall och tillgänglighet
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60]">
            När vill du kunna starta, och vilka veckor ska blockeras?
          </p>
          <div className="mt-8">
            <WizardProgress />
          </div>

          <Card className="mt-8">
            <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
              Önskat startintervall
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label htmlFor="startFrom" className="mb-1 block text-sm font-medium text-[#766B60]">
                  Från
                </label>
                <input
                  id="startFrom"
                  type="date"
                  value={startFrom}
                  onChange={(e) => setStartFrom(e.target.value)}
                  className="rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-[#2A2520] focus:border-[#8C7860] focus:outline-none focus:ring-2 focus:ring-[#8C7860]/20"
                />
              </div>
              <div>
                <label htmlFor="startTo" className="mb-1 block text-sm font-medium text-[#766B60]">
                  Till
                </label>
                <input
                  id="startTo"
                  type="date"
                  value={startTo}
                  onChange={(e) => setStartTo(e.target.value)}
                  className="rounded-xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-[#2A2520] focus:border-[#8C7860] focus:outline-none focus:ring-2 focus:ring-[#8C7860]/20"
                />
              </div>
            </div>
          </Card>

          <Card className="mt-6">
            <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
              Genomförandetid
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { id: "snabb", label: "Snabb", desc: "Vill starta så fort som möjligt" },
                { id: "normal", label: "Normal", desc: "Flexibel men inte dröjande" },
                { id: "kan_vanta", label: "Kan vänta", desc: "Ingen brådska" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExecutionPace(opt.id)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    executionPace === opt.id
                      ? "border-[#8C7860] bg-[#8C7860]/5"
                      : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                  }`}
                >
                  <div className="font-bold text-[#2A2520]">{opt.label}</div>
                  <div className="mt-1 text-sm text-[#766B60]">{opt.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="mt-6">
            <h3 className="mb-4 text-lg font-bold text-[#2A2520]">
              Start-fönster flexibelt?
            </h3>
            <p className="mb-4 text-sm text-[#766B60]">
              Kan du flytta startdatum något om det underlättar matchning mot entreprenörer?
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStartWindowFlexible(true)}
                className={`rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                  startWindowFlexible === true
                    ? "border-[#8C7860] bg-[#8C7860]/10 text-[#2A2520]"
                    : "border-[#E8E3DC] bg-white text-[#766B60] hover:border-[#CDB49B]"
                }`}
              >
                Ja, något flexibelt
              </button>
              <button
                type="button"
                onClick={() => setStartWindowFlexible(false)}
                className={`rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                  startWindowFlexible === false
                    ? "border-[#8C7860] bg-[#8C7860]/10 text-[#2A2520]"
                    : "border-[#E8E3DC] bg-white text-[#766B60] hover:border-[#CDB49B]"
                }`}
              >
                Nej, fast datum
              </button>
            </div>
          </Card>

          <Card className="mt-6">
            <h3 className="mb-2 text-lg font-bold text-[#2A2520]">
              Blockerade veckor
            </h3>
            <p className="mb-4 text-sm text-[#766B60]">
              Välj veckor då du inte kan ta emot arbete (semester, resor, etc.).
            </p>
            <div className="flex flex-wrap gap-2">
              {weeks.map((w) => {
                const blocked = blockedWeeks.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleBlocked(w.id)}
                    className={`rounded-xl border-2 px-3 py-2 text-xs font-medium transition-all ${
                      blocked
                        ? "border-[#8C7860] bg-[#8C7860] text-white"
                        : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/start/budget"
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
              Gå till sammanfattning
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
