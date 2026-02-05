"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  useWizard,
  type FileDoc,
  type FileTag,
} from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { Notice } from "../../components/ui/notice";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";

const FILE_TAGS: { id: FileTag; label: string }[] = [
  { id: "ritning", label: "Ritning" },
  { id: "foto", label: "Foto" },
  { id: "bygghandling", label: "Bygghandling" },
  { id: "ovrigt", label: "Övrigt" },
];

const FOTOGUIDE_ITEMS = [
  "Ta översiktsfoto av varje rum",
  "Fota detaljer (fönster, dörrar, tak)",
  "Mät och anteckna mått (längd, bredd, höjd)",
  "Fota befintliga installationer (el, vatten)",
  "Skapa enkel skiss om möjligt",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UnderlagPage() {
  const router = useRouter();
  const { data, setCurrentStep, stepConfig, addFile, removeFile, updateFileTags } =
    useWizard();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = data.files ?? [];
  const projectType = data.projectType;
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
      backHref={typePath ?? "/start/nulage"}
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
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60]">
            Ladda upp filer du redan har (ritningar, foton, bygghandlingar) eller
            använd vår fotoguide om du börjar från noll.
          </p>
          <div className="mt-8">
            <WizardProgress />
          </div>

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
                Följ checklistan nedan för att skapa underlag som underlättar
                nästa steg.
              </p>
              <ul className="space-y-2">
                {FOTOGUIDE_ITEMS.map((item, i) => (
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

          <Notice className="mt-8">
            Dina filer sparas endast i webbläsaren (localStorage). Ingen
            uppladdning till server i denna version.
          </Notice>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={
                projectType === "renovering"
                  ? "/start/renovering"
                  : projectType === "tillbyggnad"
                    ? "/start/tillbyggnad"
                    : "/start/nybyggnation"
              }
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
