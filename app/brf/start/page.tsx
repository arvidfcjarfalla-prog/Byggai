"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell } from "../../components/ui/shell";

const BRF_PROJECT_DRAFT_KEY = "byggplattformen-brf-draft";

type BrfProjectType =
  | "underhall"
  | "energi"
  | "stambyte"
  | "fasad_tak"
  | "annat";

export default function BrfStartPage() {
  const [associationName, setAssociationName] = useState("");
  const [projectTitle, setProjectTitle] = useState("BRF underhållsprojekt 2026");
  const [projectType, setProjectType] = useState<BrfProjectType>("underhall");
  const [targetYear, setTargetYear] = useState("2026");
  const [needProjectManager, setNeedProjectManager] = useState<"ja" | "nej">("ja");

  const canContinue = useMemo(
    () => projectTitle.trim().length >= 3 && targetYear.trim().length === 4,
    [projectTitle, targetYear]
  );

  const saveDraft = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      BRF_PROJECT_DRAFT_KEY,
      JSON.stringify({
        associationName: associationName.trim(),
        projectTitle: projectTitle.trim(),
        projectType,
        targetYear: targetYear.trim(),
        needProjectManager,
        updatedAt: new Date().toISOString(),
      })
    );
  };

  return (
    <Shell backHref="/brf" backLabel="Tillbaka till BRF-sidan">
      <main id="content" className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            BRF-wizard · Steg 1 av 2
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Initiera BRF-projekt
          </h1>
          <p className="mt-3 max-w-3xl text-[#766B60]">
            Detta är ett separat BRF-flöde. Beskriv projektets grunddata här, och gå
            sedan vidare till uppladdning av underhållsplan för åtgärdslista och
            offertförfrågan.
          </p>
        </header>

        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#2A2520]">
                Förening (valfritt)
              </span>
              <input
                value={associationName}
                onChange={(e) => setAssociationName(e.target.value)}
                placeholder="t.ex. BRF Diamanten"
                className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#2A2520]">
                Projekttitel
              </span>
              <input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#2A2520]">
                Projektkategori
              </span>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as BrfProjectType)}
                className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
              >
                <option value="underhall">Löpande underhåll</option>
                <option value="energi">Energieffektivisering</option>
                <option value="stambyte">Stambyte / tekniska system</option>
                <option value="fasad_tak">Fasad / tak / klimatskal</option>
                <option value="annat">Annat BRF-projekt</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#2A2520]">
                Målår för åtgärd
              </span>
              <input
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                placeholder="2026"
                className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-[#2A2520]">
              Behöver ni extern projektledare?
            </legend>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="pm"
                  checked={needProjectManager === "ja"}
                  onChange={() => setNeedProjectManager("ja")}
                />
                Ja, föreslå projektledare
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="pm"
                  checked={needProjectManager === "nej"}
                  onChange={() => setNeedProjectManager("nej")}
                />
                Nej, vi driver internt
              </label>
            </div>
          </fieldset>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={{
                pathname: "/dashboard/brf/underhallsplan",
                query: {
                  title: projectTitle.trim() || "BRF underhållsprojekt",
                  year: targetYear.trim() || "2026",
                  category: projectType,
                },
              }}
              onClick={saveDraft}
              aria-disabled={!canContinue}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white ${
                canContinue
                  ? "bg-[#8C7860] hover:bg-[#6B5A47]"
                  : "pointer-events-none bg-[#B8AA99]"
              }`}
            >
              Fortsätt till uppladdning (steg 2)
            </Link>

            <Link
              href="/dashboard/brf/underhallsplan"
              className="rounded-2xl border border-[#D2C5B5] bg-white px-5 py-3 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Hoppa direkt till uppladdning
            </Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}
