"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  useWizard,
  type FileDoc,
  type FileTag,
  type RelatesTo,
} from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { Notice } from "../../components/ui/notice";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";
import { NextUp } from "../../components/next-up";

const FILE_TAGS: { id: FileTag; label: string }[] = [
  { id: "ritning", label: "Ritning" },
  { id: "foto", label: "Foto" },
  { id: "bygghandling", label: "Bygghandling" },
  { id: "detaljplan", label: "Detaljplan" },
  { id: "ovrigt", label: "Övrigt" },
];

const RELATES_TO_OPTIONS: { id: RelatesTo; label: string }[] = [
  { id: "kök", label: "Kök" },
  { id: "badrum", label: "Badrum" },
  { id: "fasad", label: "Fasad" },
  { id: "mark", label: "Mark" },
  { id: "tak", label: "Tak" },
  { id: "el", label: "El" },
  { id: "vvs", label: "VVS" },
  { id: "övrigt", label: "Övrigt" },
];

const FOTOGUIDE_RENOVERING = [
  "Översiktsfoto av varje rum som ska renoveras",
  "Foton av fönster, dörrar och tak i berörda rum",
  "Befintliga el- och VVS-anläggningar (doser, kranar, avlopp)",
  "Mät och anteckna längd, bredd och takhöjd",
  "Skador eller fukt (om synliga)",
  "Enkel skiss med mått och placering av väggar",
  "Foton av golv och eventuell befintlig tätskikt (badrum)",
  "Ventilation och fönster (kök/badrum)",
];

const FOTOGUIDE_TILLBYGGNAD = [
  "Foto av fasaden där tillbyggnaden ska ansluta",
  "Översikt av tomt/trädgård och tillgång",
  "Befintlig grund och väggar vid anslutningspunkt",
  "Mått på befintlig byggnad och önskad tillbyggnad",
  "El och VVS – var finns anslutningar idag",
  "Enkel planritning över nuvarande och önskat läge",
  "Foton av tak och takfall (för takanslutning)",
  "Eventuella hinder (träd, ledningar, gränser)",
  "Sektion eller skiss som visar höjd och nivåer",
];

const FOTOGUIDE_NYBYGGNAD = [
  "Platsen/tomten – översiktsfoto och läge",
  "Tillgång och väg för maskiner och material",
  "Befintliga ledningar och avlopp (om på tomt)",
  "Närliggande byggnader och gränser",
  "Markförhållanden (sluttning, sten, vatten)",
  "Solkurs och vindriktning (för placering)",
  "Detaljplan eller bygglov – foto av beslut/karta",
  "Enkel skiss med önskad placering och mått",
  "Eventuella krav från kommun eller BRF",
  "Foton från liknande byggnader du gillar (referens)",
];

const FOTOGUIDE_DEFAULT = [
  "Ta översiktsfoto av varje berört område",
  "Fota detaljer (fönster, dörrar, tak)",
  "Mät och anteckna mått (längd, bredd, höjd)",
  "Fota befintliga installationer (el, vatten)",
  "Skapa enkel skiss om möjligt",
  "Eventuella ritningar eller handlingar du redan har",
];

function getFotoguideItems(projectType: string | null): string[] {
  if (projectType === "renovering") return FOTOGUIDE_RENOVERING;
  if (projectType === "tillbyggnad") return FOTOGUIDE_TILLBYGGNAD;
  if (projectType === "nybyggnation") return FOTOGUIDE_NYBYGGNAD;
  return FOTOGUIDE_DEFAULT;
}

/** Saknade / rekommenderade dokument utifrån nuläge och projekttyp */
function getSuggestedDocs(
  currentPhase: string | null,
  projectType: string | null
): { missing: string[]; niceToHave: string[] } {
  const missing: string[] = [];
  const niceToHave: string[] = [];

  if (currentPhase === "ritningar" || currentPhase === "fardigt") {
    missing.push("Ritning / planritning");
    missing.push("Sektion eller bygghandling (om du har)");
  }
  if (currentPhase === "skiss") {
    missing.push("Skiss eller planritning");
  }
  if (currentPhase === "ide") {
    missing.push("Enkel skiss eller mått (underlättar offerter)");
  }

  if (projectType === "nybyggnation") {
    niceToHave.push("Detaljplan");
    niceToHave.push("Bygglov / bygglovsansökan");
    niceToHave.push("Nybyggnadskarta eller tomtkarta");
  }

  return { missing, niceToHave };
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UnderlagPage() {
  const router = useRouter();
  const { data, setCurrentStep, stepConfig, addFile, removeFile, updateFileTags, updateFileRelatesTo } =
    useWizard();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = data.files ?? [];
  const projectType = data.projectType;
  const currentPhase = data.currentPhase;
  const fotoguideItems = getFotoguideItems(projectType);
  const { missing: missingDocs, niceToHave: niceToHaveDocs } = getSuggestedDocs(
    currentPhase ?? null,
    projectType ?? null
  );
  const typePath =
    projectType === "renovering"
      ? "/start/renovering"
      : projectType === "tillbyggnad"
        ? "/start/tillbyggnad"
        : projectType === "nybyggnation"
          ? "/start/nybyggnation"
          : null;
  const typeLabel =
    projectType === "renovering"
      ? "Renovering"
      : projectType === "tillbyggnad"
        ? "Tillbyggnad"
        : projectType === "nybyggnation"
          ? "Nybyggnation"
          : null;
  const breadcrumbs: Crumb[] = [
    { href: "/start", label: "Projekttyp" },
    { href: "/start/nulage", label: "Nuläge" },
    ...(typePath && typeLabel ? [{ href: typePath, label: typeLabel } as Crumb] : []),
    { href: "/start/beskrivning", label: "Beskrivning" },
    { label: "Underlag" },
  ];

  const handleFileSelect = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const doc: FileDoc = {
          id: `f-${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          tags: [],
          uploadedAt: new Date().toISOString(),
        };
        addFile(doc);
      }
    },
    [addFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleContinue = () => {
    const idx = stepConfig.findIndex((s) => s.path === "/start/omfattning");
    if (idx >= 0) setCurrentStep(idx + 1);
    router.push("/start/omfattning");
  };

  return (
    <Shell
      backHref="/start/beskrivning"
      backLabel="Tillbaka"
    >
      <section id="content" className="px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <Breadcrumbs items={breadcrumbs} />
          <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
            Steg · Underlag
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Ritningar, foton och handlingar
          </h1>
          <p className="mt-2 text-sm font-medium text-[#8C7860]">
            Vi frågar så att entreprenörer kan ge dig bättre offerter – rätt underlag sparar tid för alla.
          </p>
          <div className="mt-4">
            <NextUp nextStepName="Omfattning" upcomingSteps={["Budget", "Tidplan", "Sammanfattning"]} />
          </div>
          <div className="mt-8">
            <WizardProgress />
          </div>

          {files.length === 0 && (
            <Card className="mt-8 border-[#CDB49B]/40 bg-[#CDB49B]/5">
              <h2 className="mb-2 text-base font-bold text-[#2A2520]">
                Vad saknas?
              </h2>
              <p className="mb-4 text-sm text-[#766B60]">
                Du kan fortfarande gå vidare. Men ju bättre underlag, desto bättre offert.
              </p>
              <ul className="space-y-2 text-sm text-[#2A2520]">
                {getFotoguideItems(projectType ?? null).slice(0, 6).map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-[#8C7860] bg-transparent" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`mt-10 cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
              dragOver
                ? "border-[#8C7860] bg-[#CDB49B]/10"
                : "border-[#E8E3DC] bg-white hover:border-[#CDB49B] hover:bg-[#CDB49B]/5"
            }`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            aria-label="Ladda upp filer genom att klicka eller dra och släpp"
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              className="sr-only"
              onChange={(e) => {
                handleFileSelect(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CDB49B]/20 text-[#8C7860]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p className="mt-3 font-semibold text-[#2A2520]">
              Dra och släpp filer här, eller klicka för att välja
            </p>
            <p className="mt-1 text-sm text-[#766B60]">
              PDF, bilder (JPG, PNG), Word. Metadata sparas lokalt.
            </p>
          </div>

          {files.length > 0 && (
            <Card className="mt-8">
              <h2 className="mb-4 text-lg font-bold text-[#2A2520]">
                Uppladdade filer ({files.length})
              </h2>
              <ul className="space-y-4">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[#2A2520]">
                        {f.name}
                      </p>
                      <p className="text-xs text-[#766B60]">
                        {formatSize(f.size)} · {f.type || "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {FILE_TAGS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const next = f.tags.includes(t.id)
                              ? f.tags.filter((x) => x !== t.id)
                              : [...f.tags, t.id];
                            updateFileTags(f.id, next);
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                            f.tags.includes(t.id)
                              ? "bg-[#8C7860] text-white"
                              : "bg-[#E8E3DC] text-[#766B60] hover:bg-[#CDB49B]/30"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                      <select
                        value={f.relatesTo ?? ""}
                        onChange={(e) => updateFileRelatesTo(f.id, (e.target.value || undefined) as RelatesTo | undefined)}
                        className="rounded-lg border border-[#E8E3DC] bg-white px-3 py-1.5 text-xs text-[#2A2520] focus:border-[#8C7860] focus:outline-none"
                        title="Relaterar till"
                      >
                        <option value="">Relaterar till</option>
                        {RELATES_TO_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        className="rounded-lg p-2 text-[#766B60] hover:bg-red-100 hover:text-red-700"
                        aria-label={`Ta bort ${f.name}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v4M10 7v4M3 4l1 10a1 1 0 001 1h6a1 1 0 001-1L13 4" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {files.length === 0 && (
            <Card className="mt-8">
              <h2 className="mb-2 text-lg font-bold text-[#2A2520]">
                Fotoguide – inga filer ännu?
              </h2>
              <p className="mb-4 text-sm text-[#766B60]">
                Följ punkterna nedan för att skapa underlag som underlättar
                nästa steg och ger bättre offerter.
              </p>
              <ul className="space-y-2">
                {fotoguideItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-[#E8E3DC] bg-white px-4 py-3"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#E8E3DC] text-xs font-bold text-[#766B60]">
                      {i + 1}
                    </span>
                    <span className="text-sm text-[#2A2520]">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(missingDocs.length > 0 || niceToHaveDocs.length > 0) && (
            <Card className="mt-6 border-[#CDB49B]/40 bg-[#CDB49B]/5">
              <h2 className="mb-2 text-base font-bold text-[#2A2520]">
                Rekommenderade dokument
              </h2>
              {missingDocs.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-[#8C7860]">Bra att lägga till</p>
                  <ul className="flex flex-wrap gap-2">
                    {missingDocs.map((d, i) => (
                      <li key={i} className="rounded-full bg-[#8C7860]/15 px-3 py-1 text-sm font-medium text-[#6B5A47]">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {niceToHaveDocs.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-[#766B60]">Bra om du har</p>
                  <ul className="flex flex-wrap gap-2">
                    {niceToHaveDocs.map((d, i) => (
                      <li key={i} className="rounded-full border border-[#E8E3DC] bg-white px-3 py-1 text-sm text-[#766B60]">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Notice className="mt-8">
            Dina filer sparas endast i webbläsaren (localStorage). Ingen
            uppladdning till server i denna version.
          </Notice>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/start/beskrivning"
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#E8E3DC] bg-white px-6 py-4 text-sm font-semibold text-[#766B60] outline-none transition-all hover:border-[#CDB49B] hover:bg-[#CDB49B]/10 focus-visible:ring-2 focus-visible:ring-[#8C7860]"
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
              Fortsätt till omfattning
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
