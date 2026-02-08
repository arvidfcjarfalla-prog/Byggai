"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../../components/ui/shell";
import { Card } from "../../../components/ui/card";
import { Notice } from "../../../components/ui/notice";
import type { BrfFileRecord } from "../../../lib/brf-workspace";
import {
  BRF_FILES_KEY,
  BRF_FILES_UPDATED_EVENT,
  getFileTypeLabel,
} from "../../../lib/brf-workspace";
import {
  BRF_PROPERTY_PROFILE_KEY,
  BRF_PROPERTY_PROFILE_UPDATED_EVENT,
  DEFAULT_BRF_PROPERTY_PROFILE,
  readStoredObject,
  toAddress,
  type BrfPropertyProfile,
} from "../../../lib/workspace-profiles";
import {
  BRF_ACTIONS_DRAFT_UPDATED_EVENT,
  BRF_REQUEST_META_UPDATED_EVENT,
  readBrfActionsDraft,
  readBrfRequestMeta,
  toProcurementAction,
  writeBrfActionsDraft,
  writeBrfRequestMeta,
  type BrfActionDraft,
  type BrfRequestMetaDraft,
} from "../../../lib/brf-start";
import {
  buildProjectSnapshotFromBrfSeed,
  formatSnapshotBudget,
  formatSnapshotTimeline,
  toSwedishRiskLabel,
  type ProjectSnapshot,
  writeProjectSnapshotToStorage,
} from "../../../lib/project-snapshot";
import { saveRequest, type PlatformRequest, type RequestFileRecord } from "../../../lib/requests-store";

function readBrfFiles(): BrfFileRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BRF_FILES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BrfFileRecord[]) : [];
  } catch {
    return [];
  }
}

function readBrfProfile(): BrfPropertyProfile {
  return (
    readStoredObject<BrfPropertyProfile>(BRF_PROPERTY_PROFILE_KEY) ||
    DEFAULT_BRF_PROPERTY_PROFILE
  );
}

function formatBudgetFromMeta(meta: BrfRequestMetaDraft, snapshot: ProjectSnapshot): string {
  if (meta.budgetUnknown) return "Budget oklar - önskar prisindikation";

  const min = meta.budgetMinSek;
  const max = meta.budgetMaxSek;

  const formatNumber = (value: number) => new Intl.NumberFormat("sv-SE").format(value);

  if (min != null && max != null) return `${formatNumber(min)} - ${formatNumber(max)} kr`;
  if (min != null) return `${formatNumber(min)} kr`;
  if (max != null) return `${formatNumber(max)} kr`;

  return formatSnapshotBudget(snapshot);
}

function formatStartWindow(meta: BrfRequestMetaDraft, snapshot: ProjectSnapshot): string {
  const from = meta.desiredStartFrom?.trim();
  const to = meta.desiredStartTo?.trim();

  if (from && to) return `${from} till ${to}`;
  if (from || to) return from || to || "Startfönster ej angivet";
  if (meta.flexibleStart) return "Flexibel start";

  return formatSnapshotTimeline(snapshot);
}

function mapFilesForRequest(files: BrfFileRecord[]): RequestFileRecord[] {
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    fileTypeLabel: getFileTypeLabel(file.fileType),
    extension: file.extension,
    sizeKb: file.sizeKb,
    uploadedAt: file.uploadedAt,
    sourceLabel: file.sourceLabel,
    linkedActionTitle: file.linkedActionTitle,
  }));
}

function buildDocumentSummary(files: RequestFileRecord[]) {
  const byTypeMap = files.reduce<Record<string, number>>((acc, file) => {
    acc[file.fileTypeLabel] = (acc[file.fileTypeLabel] || 0) + 1;
    return acc;
  }, {});

  const byType = Object.entries(byTypeMap)
    .map(([typeLabel, count]) => ({ typeLabel, count }))
    .sort((a, b) => b.count - a.count || a.typeLabel.localeCompare(b.typeLabel, "sv"));

  return {
    totalFiles: files.length,
    byType,
    highlights: byType.slice(0, 3).map((entry) => `${entry.typeLabel}: ${entry.count} st`),
  };
}

function validateHardGate(
  selectedActions: BrfActionDraft[],
  meta: BrfRequestMetaDraft
): string[] {
  const errors: string[] = [];

  if (selectedActions.length === 0) {
    errors.push("Välj minst en åtgärd som ska upphandlas.");
  }

  const hasContactName = meta.contactName.trim().length > 0;
  const hasContactChannel =
    meta.contactEmail.trim().length > 0 || meta.contactPhone.trim().length > 0;
  if (!hasContactName || !hasContactChannel) {
    errors.push("Ange kontaktperson samt e-post eller telefon.");
  }

  const hasDesiredStart =
    meta.desiredStartFrom?.trim().length || meta.desiredStartTo?.trim().length;
  if (!hasDesiredStart && !meta.flexibleStart) {
    errors.push("Ange startfönster eller markera att start är flexibel.");
  }

  const hasBudget =
    (meta.budgetMinSek != null && meta.budgetMinSek > 0) ||
    (meta.budgetMaxSek != null && meta.budgetMaxSek > 0);
  if (!hasBudget && !meta.budgetUnknown) {
    errors.push("Ange budgetram eller markera budget som oklar.");
  }

  return errors;
}

function deriveMissingInfo(
  selectedActions: BrfActionDraft[],
  meta: BrfRequestMetaDraft,
  files: RequestFileRecord[]
): string[] {
  const missing: string[] = [];

  if (selectedActions.length === 0) {
    missing.push("Ingen åtgärd vald för upphandling.");
  }
  if (files.length === 0) {
    missing.push("Inga bilagor kopplade till underlaget.");
  }
  if (!meta.contactName.trim()) {
    missing.push("Kontaktperson saknas.");
  }
  if (!meta.contactEmail.trim() && !meta.contactPhone.trim()) {
    missing.push("Kontaktkanal saknas (e-post/telefon).");
  }
  if (!meta.desiredStartFrom?.trim() && !meta.desiredStartTo?.trim() && !meta.flexibleStart) {
    missing.push("Startfönster saknas.");
  }
  if (
    !meta.budgetUnknown &&
    !((meta.budgetMinSek != null && meta.budgetMinSek > 0) || (meta.budgetMaxSek != null && meta.budgetMaxSek > 0))
  ) {
    missing.push("Budgetram saknas.");
  }

  return missing;
}

function formatSek(value?: number): string {
  if (!value || value <= 0) return "-";
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}

export default function BrfStartSammanfattningPage() {
  const [actions, setActions] = useState<BrfActionDraft[]>(() => readBrfActionsDraft());
  const [meta, setMeta] = useState<BrfRequestMetaDraft>(() => readBrfRequestMeta());
  const [profile, setProfile] = useState<BrfPropertyProfile>(() => readBrfProfile());
  const [files, setFiles] = useState<BrfFileRecord[]>(() => readBrfFiles());
  const [snapshotSeed, setSnapshotSeed] = useState<Partial<ProjectSnapshot>>(() => ({
    id: `snapshot-${Date.now()}`,
    createdAt: new Date().toISOString(),
    audience: "brf",
  }));
  const [gateErrors, setGateErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setActions(readBrfActionsDraft());
      setMeta(readBrfRequestMeta());
      setProfile(readBrfProfile());
      setFiles(readBrfFiles());
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (
        event.key === BRF_PROPERTY_PROFILE_KEY ||
        event.key === BRF_FILES_KEY
      ) {
        sync();
      }
    };

    window.addEventListener(BRF_ACTIONS_DRAFT_UPDATED_EVENT, sync);
    window.addEventListener(BRF_REQUEST_META_UPDATED_EVENT, sync);
    window.addEventListener(BRF_PROPERTY_PROFILE_UPDATED_EVENT, sync);
    window.addEventListener(BRF_FILES_UPDATED_EVENT, sync);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(BRF_ACTIONS_DRAFT_UPDATED_EVENT, sync);
      window.removeEventListener(BRF_REQUEST_META_UPDATED_EVENT, sync);
      window.removeEventListener(BRF_PROPERTY_PROFILE_UPDATED_EVENT, sync);
      window.removeEventListener(BRF_FILES_UPDATED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const selectedActions = useMemo(
    () => actions.filter((action) => action.selected !== false && action.title.trim().length > 0),
    [actions]
  );

  const selectedProcActions = useMemo(
    () => selectedActions.map(toProcurementAction),
    [selectedActions]
  );

  const snapshot = useMemo(
    () =>
      buildProjectSnapshotFromBrfSeed(
        {
          title: meta.title.trim() || "BRF underhållsprojekt",
          location:
            meta.location?.trim() ||
            toAddress([profile.addressLine, `${profile.postalCode} ${profile.city}`]) ||
            undefined,
          description: meta.description.trim() || `${selectedActions.length} valda åtgärder för upphandling.`,
          actions: selectedProcActions,
          files: files.map((file) => ({
            id: file.id,
            name: file.name,
            type: getFileTypeLabel(file.fileType),
            size: Math.round(file.sizeKb * 1024),
            tags: [getFileTypeLabel(file.fileType), file.sourceLabel],
          })),
          desiredStartFrom: meta.desiredStartFrom?.trim() || undefined,
          desiredStartTo: meta.desiredStartTo?.trim() || undefined,
          projectSpecific: {
            apartmentsCount: profile.apartmentsCount,
            buildingsCount: profile.buildingsCount,
            boaM2: profile.boaM2,
            loaM2: profile.loaM2,
            flexibleStart: meta.flexibleStart ? "ja" : "nej",
            budgetUnknown: meta.budgetUnknown ? "ja" : "nej",
          },
        },
        snapshotSeed
      ),
    [files, meta, profile, selectedActions.length, selectedProcActions, snapshotSeed]
  );

  const requestFiles = useMemo(() => mapFilesForRequest(files), [files]);

  const budgetLabel = useMemo(() => formatBudgetFromMeta(meta, snapshot), [meta, snapshot]);
  const startLabel = useMemo(() => formatStartWindow(meta, snapshot), [meta, snapshot]);

  const updateMeta = (updates: Partial<BrfRequestMetaDraft>) => {
    const next = {
      ...meta,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setMeta(next);
    writeBrfRequestMeta(next);
  };

  const updateAction = <K extends keyof BrfActionDraft>(
    id: string,
    key: K,
    value: BrfActionDraft[K]
  ) => {
    const next = actions.map((row) => (row.id === id ? { ...row, [key]: value } : row));
    setActions(next);
    writeBrfActionsDraft(next);
  };

  const handleGenerateUnderlag = () => {
    const locked: ProjectSnapshot = {
      ...snapshot,
      lockedAt: new Date().toISOString(),
    };
    setSnapshotSeed(locked);
    writeProjectSnapshotToStorage(locked);
    setSuccessMessage("Offertunderlaget är låst och klart för granskning.");
    setGateErrors([]);
  };

  const handleSend = () => {
    const errors = validateHardGate(selectedActions, meta);
    if (errors.length > 0) {
      setGateErrors(errors);
      setSuccessMessage(null);
      return;
    }

    const lockedSnapshot: ProjectSnapshot = snapshot.lockedAt
      ? snapshot
      : { ...snapshot, lockedAt: new Date().toISOString() };

    setSnapshotSeed(lockedSnapshot);
    writeProjectSnapshotToStorage(lockedSnapshot);

    const request: PlatformRequest = {
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
      audience: "brf",
      status: "sent",
      requestType: "offer_request_v1",
      title: meta.title.trim() || lockedSnapshot.overview.title,
      location:
        meta.location?.trim() ||
        toAddress([profile.addressLine, `${profile.postalCode} ${profile.city}`]) ||
        "Ej angiven plats",
      desiredStart: startLabel,
      budgetRange: budgetLabel,
      scope: {
        actions: selectedProcActions,
        scopeItems: selectedActions.map((action) => ({ title: action.title, details: action.details })),
      },
      snapshot: lockedSnapshot,
      propertySnapshot: {
        audience: "brf",
        title: profile.propertyName || "BRF-fastighet",
        address:
          toAddress([profile.addressLine, `${profile.postalCode} ${profile.city}`]) ||
          "Adress ej angiven",
        buildingYear: profile.buildingYear,
        apartmentsCount: profile.apartmentsCount,
        buildingsCount: profile.buildingsCount,
        areaSummary: `BOA ${profile.boaM2 || "?"} m² · LOA ${profile.loaM2 || "?"} m²`,
        accessAndLogistics: profile.accessibilityLogistics,
        knownConstraints: profile.authorityConstraints,
        contactName: meta.contactName.trim(),
        contactEmail: meta.contactEmail.trim() || undefined,
        contactPhone: meta.contactPhone.trim() || undefined,
      },
      documentSummary: buildDocumentSummary(requestFiles),
      files: requestFiles,
      completeness: lockedSnapshot.completenessScore,
      missingInfo: deriveMissingInfo(selectedActions, meta, requestFiles),
      documentationLevel:
        requestFiles.length > 0
          ? `${requestFiles.length} filer i underlag`
          : "Inga uppladdade filer",
      riskProfile: toSwedishRiskLabel(lockedSnapshot.riskProfile.level),
      actions: selectedProcActions,
    };

    saveRequest(request);
    setGateErrors([]);
    setSuccessMessage("Förfrågan skickad. Entreprenörsinkorgen är uppdaterad.");
  };

  return (
    <Shell backHref="/brf/start" backLabel="Tillbaka till BRF-start">
      <main id="content" className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            BRF-start · Sammanfattning
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl">
            Skapa och skicka offertförfrågan
          </h1>
          <p className="mt-3 max-w-3xl text-[#766B60]">
            Här samlas åtgärder, kontakt och förutsättningar i ett gemensamt
            RequestSnapshot som entreprenörer läser.
          </p>
        </header>

        {gateErrors.length > 0 && (
          <Notice variant="warning" className="mb-4">
            <p className="font-semibold">Kan inte skicka än:</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {gateErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Notice>
        )}

        {successMessage && (
          <Notice variant="success" className="mb-4">
            {successMessage}
          </Notice>
        )}

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card className="border border-[#E6DFD6]">
            <h2 className="text-lg font-bold text-[#2A2520]">Projektparametrar</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Projekttitel</span>
                <input
                  value={meta.title}
                  onChange={(event) => updateMeta({ title: event.target.value })}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Plats/område</span>
                <input
                  value={meta.location || ""}
                  onChange={(event) => updateMeta({ location: event.target.value })}
                  placeholder="t.ex. Göteborg"
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-1 block font-semibold text-[#2A2520]">Kort beskrivning</span>
                <textarea
                  value={meta.description}
                  onChange={(event) => updateMeta({ description: event.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                  placeholder="Beskriv målbild, etapp och vad som ska upphandlas först."
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Önskad start från</span>
                <input
                  type="date"
                  value={meta.desiredStartFrom || ""}
                  onChange={(event) => updateMeta({ desiredStartFrom: event.target.value })}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Önskad start till</span>
                <input
                  type="date"
                  value={meta.desiredStartTo || ""}
                  onChange={(event) => updateMeta({ desiredStartTo: event.target.value })}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={meta.flexibleStart === true}
                  onChange={(event) => updateMeta({ flexibleStart: event.target.checked })}
                />
                Start är flexibel
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Budget min (SEK)</span>
                <input
                  type="number"
                  min={0}
                  value={meta.budgetMinSek ?? ""}
                  onChange={(event) => {
                    const value = event.target.value ? Number(event.target.value) : undefined;
                    updateMeta({ budgetMinSek: value });
                  }}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Budget max (SEK)</span>
                <input
                  type="number"
                  min={0}
                  value={meta.budgetMaxSek ?? ""}
                  onChange={(event) => {
                    const value = event.target.value ? Number(event.target.value) : undefined;
                    updateMeta({ budgetMaxSek: value });
                  }}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={meta.budgetUnknown === true}
                  onChange={(event) => updateMeta({ budgetUnknown: event.target.checked })}
                />
                Budget oklar (önskar budgetoffert)
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Kontaktperson</span>
                <input
                  value={meta.contactName}
                  onChange={(event) => updateMeta({ contactName: event.target.value })}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Kontakt e-post</span>
                <input
                  value={meta.contactEmail}
                  onChange={(event) => updateMeta({ contactEmail: event.target.value })}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">Kontakt telefon</span>
                <input
                  value={meta.contactPhone}
                  onChange={(event) => updateMeta({ contactPhone: event.target.value })}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                />
              </label>
            </div>
          </Card>

          <Card className="border border-[#E6DFD6]">
            <h2 className="text-lg font-bold text-[#2A2520]">Snapshot-status</h2>
            <div className="mt-4 space-y-2 text-sm text-[#2A2520]">
              <p>
                <span className="font-semibold">Kompletthet:</span> {snapshot.completenessScore}%
              </p>
              <p>
                <span className="font-semibold">Risk:</span> {toSwedishRiskLabel(snapshot.riskProfile.level)}
              </p>
              <p>
                <span className="font-semibold">Budget:</span> {budgetLabel}
              </p>
              <p>
                <span className="font-semibold">Startfönster:</span> {startLabel}
              </p>
              <p>
                <span className="font-semibold">Åtgärder:</span> {selectedActions.length}
              </p>
              <p>
                <span className="font-semibold">Filer:</span> {requestFiles.length}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleGenerateUnderlag}
                className="w-full rounded-xl bg-[#8C7860] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47]"
              >
                Generera offertunderlag
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="w-full rounded-xl border border-[#8C7860] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Skicka till entreprenörer
              </button>
              <Link
                href="/dashboard/entreprenor/forfragningar"
                className="inline-flex w-full items-center justify-center rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Öppna entreprenörsinkorg
              </Link>
            </div>
          </Card>
        </section>

        <section className="mt-6 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#2A2520]">Åtgärder i förfrågan</h2>
            <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-1 text-xs font-semibold text-[#6B5A47]">
              {selectedActions.length} valda
            </span>
          </div>

          {actions.length === 0 && (
            <p className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B5A47]">
              Inga åtgärder registrerade ännu. Gå till <Link href="/brf/start/atgarder" className="font-semibold underline">manuell åtgärdslista</Link> eller ladda upp underhållsplan.
            </p>
          )}

          {actions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#EFE8DD] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                    <th className="px-3 py-3">Val</th>
                    <th className="px-3 py-3">Åtgärd</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Planerat år</th>
                    <th className="px-3 py-3">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id} className="border-b border-[#F1ECE5]">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={action.selected !== false}
                          onChange={(event) =>
                            updateAction(action.id, "selected", event.target.checked)
                          }
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-[#2A2520]">{action.title}</td>
                      <td className="px-3 py-3">{action.category}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-1 text-xs font-semibold">
                          {action.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">{action.plannedYear}</td>
                      <td className="px-3 py-3">{formatSek(action.estimatedPriceSek)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
