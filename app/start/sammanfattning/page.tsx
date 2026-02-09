"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWizard } from "../../components/wizard-context";
import { WizardProgress } from "../../components/wizard-progress";
import { Shell } from "../../components/ui/shell";
import { Card } from "../../components/ui/card";
import { Notice } from "../../components/ui/notice";
import { Breadcrumbs, type Crumb } from "../../components/ui/breadcrumbs";
import { SchedulePreviewCard } from "../../components/gantt/SchedulePreviewCard";
import type {
  RequestRecipient,
  PlatformRequest,
  ProcurementAction,
  RequestDocumentSummary,
  RequestFileRecord,
  RequestPropertySnapshot,
  RequestScopeItem,
} from "../../lib/requests-store";
import {
  defaultRecipientsForAudience,
  saveRequest,
  toRecipientLabel,
} from "../../lib/requests-store";
import {
  buildProjectSnapshotFromWizard,
  formatSnapshotBudget,
  formatSnapshotTimeline,
  PROJECT_SNAPSHOT_KEY,
  readProjectSnapshotFromStorage,
  toSwedishRiskLabel,
  type ProjectSnapshot,
  writeProjectSnapshotToStorage,
} from "../../lib/project-snapshot";
import type { ScheduleProjectContext } from "../../lib/schedule";

const RISK_COLORS: Record<ProjectSnapshot["riskProfile"]["level"], string> = {
  low: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
  medium: "border-amber-200 bg-amber-50/80 text-amber-800",
  high: "border-red-200 bg-red-50/80 text-red-800",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferCategory(projectType: string): string {
  if (projectType === "renovering") return "Renovering";
  if (projectType === "tillbyggnad") return "Tillbyggnad";
  if (projectType === "nybyggnation") return "Nybyggnation";
  return "Övrigt";
}

function buildActionsFromSnapshot(snapshot: ProjectSnapshot): ProcurementAction[] {
  const titles = snapshot.scope.selectedItems.length
    ? snapshot.scope.selectedItems
    : [snapshot.overview.title];
  const baseYear = Number(
    (snapshot.timeline.desiredStartFrom || snapshot.createdAt).slice(0, 4)
  );
  const year = Number.isFinite(baseYear) ? baseYear : new Date().getFullYear();
  const budgetMin = snapshot.budget.min ?? snapshot.budget.max ?? 0;
  const budgetMax = snapshot.budget.max ?? snapshot.budget.min ?? budgetMin;
  const totalBudget = budgetMin > 0 || budgetMax > 0 ? Math.max(budgetMin, budgetMax) : 0;
  const perAction = titles.length > 0 ? Math.round(totalBudget / titles.length) : totalBudget;

  return titles.slice(0, 20).map((title, index) => ({
    id: `privat-action-${Date.now()}-${index}`,
    title,
    category: inferCategory(snapshot.overview.projectType),
    status: "Planerad",
    plannedYear: year + Math.floor(index / 4),
    estimatedPriceSek: perAction > 0 ? perAction : 0,
    emissionsKgCo2e: 0,
    source: "local",
    details: "Skapad från privat sammanfattning.",
  }));
}

function mapSnapshotFiles(snapshot: ProjectSnapshot): RequestFileRecord[] {
  return snapshot.files.map((file, index) => ({
    id: file.id || `${file.name.toLowerCase()}-${index}`,
    name: file.name,
    fileTypeLabel: file.type,
    extension: file.name.includes(".") ? file.name.split(".").pop() ?? "" : "",
    sizeKb: Number((file.size / 1024).toFixed(1)),
    uploadedAt: file.id ? snapshot.createdAt : new Date().toISOString(),
    sourceLabel: "ProjectSnapshot",
    tags: [...file.tags],
  }));
}

function buildDocumentSummary(files: RequestFileRecord[]): RequestDocumentSummary {
  const byType = files.reduce<Record<string, number>>((acc, file) => {
    const key = file.fileTypeLabel || "Okänd";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const summary = Object.entries(byType)
    .map(([typeLabel, count]) => ({ typeLabel, count }))
    .sort((a, b) => b.count - a.count || a.typeLabel.localeCompare(b.typeLabel, "sv"));

  return {
    totalFiles: files.length,
    byType: summary,
    highlights: summary.slice(0, 3).map((entry) => `${entry.typeLabel}: ${entry.count} st`),
  };
}

function buildScopeItems(snapshot: ProjectSnapshot): RequestScopeItem[] {
  if (snapshot.scope.selectedItems.length > 0) {
    return snapshot.scope.selectedItems.map((title) => ({ title }));
  }

  if (snapshot.scope.freeDescription && snapshot.scope.freeDescription.trim().length > 0) {
    return [
      {
        title: snapshot.overview.title,
        details: snapshot.scope.freeDescription,
      },
    ];
  }

  return [];
}

function validateSendPrerequisites(
  snapshot: ProjectSnapshot,
  scopeItems: RequestScopeItem[],
  budgetUnknownExplicit: boolean
): string[] {
  const errors: string[] = [];

  if (snapshot.overview.description.trim().length < 20) {
    errors.push("Beskriv projektet tydligare (minst 20 tecken) innan du skickar.");
  }

  const hasBudgetRange = snapshot.budget.min != null || snapshot.budget.max != null;
  if (!hasBudgetRange && !budgetUnknownExplicit) {
    errors.push("Ange budgetspann eller markera att budgeten är oklar.");
  }

  const hasDesiredStart = Boolean(
    snapshot.timeline.desiredStartFrom || snapshot.timeline.desiredStartTo
  );
  const hasFlexibleStart = snapshot.timeline.flexibility === "flexible";
  if (!hasDesiredStart && !hasFlexibleStart) {
    errors.push("Ange önskat startfönster eller markera att starten är flexibel.");
  }

  if (scopeItems.length === 0) {
    errors.push("Välj minst en scope-post i omfattning innan du skickar.");
  }

  return errors;
}

function deriveMissingInfo(
  snapshot: ProjectSnapshot,
  scopeItems: RequestScopeItem[],
  files: RequestFileRecord[]
): string[] {
  const missing: string[] = [];

  if (scopeItems.length === 0) {
    missing.push("Omfattning saknar tydliga åtgärdsposter.");
  }

  if (files.length === 0) {
    missing.push("Inga dokumentfiler uppladdade.");
  }

  if (!snapshot.overview.location || snapshot.overview.location.trim().length === 0) {
    missing.push("Adress/område saknas.");
  }

  if (snapshot.budget.min == null && snapshot.budget.max == null) {
    missing.push("Budgetspann saknas.");
  }

  if (!snapshot.timeline.desiredStartFrom && !snapshot.timeline.desiredStartTo) {
    missing.push("Startfönster saknas.");
  }

  return missing;
}

export default function SammanfattningPage() {
  const { data, stepConfig, projectBrief } = useWizard();
  const [snapshotSeed, setSnapshotSeed] = useState<Partial<ProjectSnapshot>>(() => {
    const persisted = readProjectSnapshotFromStorage();
    if (persisted) return persisted;
    return {
      id: `snapshot-${Date.now()}`,
      createdAt: new Date().toISOString(),
      audience: data.userRole === "brf" ? "brf" : "privat",
    };
  });

  const snapshot = useMemo(
    () =>
      buildProjectSnapshotFromWizard(
        data,
        snapshotSeed.audience &&
          snapshotSeed.audience !== (data.userRole === "brf" ? "brf" : "privat")
          ? undefined
          : snapshotSeed
      ),
    [data, snapshotSeed]
  );

  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [sendValidationErrors, setSendValidationErrors] = useState<string[]>([]);

  const completionHref =
    data.userRole === "brf"
      ? "/brf"
      : data.userRole === "entreprenor"
        ? "/entreprenor"
        : "/privatperson";
  const requestsHref = snapshot.audience === "brf" ? "/dashboard/brf/forfragningar" : "/dashboard/privat/forfragningar";

  const typeCrumb: Crumb | null =
    data.projectType && data.projectType !== "annat"
      ? {
          href:
            data.projectType === "renovering"
              ? "/start/renovering"
              : data.projectType === "tillbyggnad"
                ? "/start/tillbyggnad"
                : "/start/nybyggnation",
          label:
            data.projectType === "renovering"
              ? "Renovering"
              : data.projectType === "tillbyggnad"
                ? "Tillbyggnad"
                : "Nybyggnation",
        }
      : null;

  const breadcrumbs: Crumb[] = [
    { href: "/start", label: "Projekttyp" },
    { href: "/start/nulage", label: "Nuläge" },
    ...(typeCrumb ? [typeCrumb] : []),
    { href: "/start/beskrivning", label: "Beskrivning" },
    { href: "/start/underlag", label: "Underlag" },
    { href: "/start/omfattning", label: "Omfattning" },
    { href: "/start/budget", label: "Budget" },
    { href: "/start/tidplan", label: "Tidplan" },
    { label: "Sammanfattning" },
  ];

  const selectedScopeSummary = useMemo(() => {
    if (snapshot.scope.selectedItems.length === 0) return "Inga specifika delmoment valda ännu.";
    return snapshot.scope.selectedItems.slice(0, 8).join(", ");
  }, [snapshot.scope.selectedItems]);

  const scheduleContext = useMemo<ScheduleProjectContext>(
    () => ({
      projectId: snapshot.id,
      title: snapshot.overview.title,
      audience: snapshot.audience,
      snapshot,
    }),
    [snapshot]
  );

  useEffect(() => {
    writeProjectSnapshotToStorage(snapshot);
  }, [snapshot]);

  const handleGenerateQuote = () => {
    const lockedSnapshot: ProjectSnapshot = {
      ...snapshot,
      lockedAt: new Date().toISOString(),
    };
    setSnapshotSeed(lockedSnapshot);
    writeProjectSnapshotToStorage(lockedSnapshot);
    setSendValidationErrors([]);
    setRequestNotice(null);
  };

  const handleSkickaForfragan = () => {
    const baseSnapshot = snapshot.lockedAt
      ? snapshot
      : {
          ...snapshot,
          lockedAt: new Date().toISOString(),
        };

    if (!snapshot.lockedAt) {
      setSnapshotSeed(baseSnapshot);
      writeProjectSnapshotToStorage(baseSnapshot);
    }

    const scopeItems = buildScopeItems(baseSnapshot);
    const budgetUnknownExplicit = data.budget?.financing === "osaker";
    const gateErrors = validateSendPrerequisites(
      baseSnapshot,
      scopeItems,
      budgetUnknownExplicit
    );

    if (gateErrors.length > 0) {
      setSendValidationErrors(gateErrors);
      setRequestNotice(null);
      return;
    }

    const actions = buildActionsFromSnapshot(baseSnapshot);
    const files = mapSnapshotFiles(baseSnapshot);
    const recipients: RequestRecipient[] = defaultRecipientsForAudience("privat");
    const propertySnapshot: RequestPropertySnapshot = {
      audience: "privat",
      title: baseSnapshot.overview.title,
      address: baseSnapshot.overview.location || "Adress ej angiven",
      accessAndLogistics:
        typeof baseSnapshot.scope.projectSpecific.accessibility === "string"
          ? baseSnapshot.scope.projectSpecific.accessibility
          : undefined,
    };

    const nextRequest: PlatformRequest = {
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
      audience: "privat",
      status: "sent",
      requestType: "offer_request_v1",
      snapshot: baseSnapshot,
      title: baseSnapshot.overview.title,
      location: baseSnapshot.overview.location || "Okänt område",
      budgetRange: formatSnapshotBudget(baseSnapshot),
      desiredStart: formatSnapshotTimeline(baseSnapshot),
      scope: {
        actions,
        scopeItems,
      },
      completeness: baseSnapshot.completenessScore,
      missingInfo: deriveMissingInfo(baseSnapshot, scopeItems, files),
      documentationLevel:
        files.length > 0
          ? `${files.length} filer från wizard-snapshot`
          : "Ingen fil uppladdad ännu",
      riskProfile: toSwedishRiskLabel(baseSnapshot.riskProfile.level),
      propertySnapshot,
      documentSummary: buildDocumentSummary(files),
      files,
      recipients,
      distribution: recipients.map((recipient) => toRecipientLabel(recipient)),
    };

    saveRequest(nextRequest);
    setSendValidationErrors([]);
    setRequestNotice(
      `Förfrågan skickad (${nextRequest.id}). Se status och mottagare under Mina förfrågningar.`
    );
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
            Projektets sammanfattning
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#766B60]">
            Här byggs din offertbara sanning. Snapshoten används i privat dashboard,
            BRF-förfrågan och entreprenörsvy.
          </p>
          <div className="mt-8">
            <WizardProgress />
          </div>

          <Card className="mt-8 border-2 border-[#8C7860]/30 bg-white">
            <h2 className="mb-4 text-lg font-bold text-[#2A2520]">Snapshot</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Projekttyp
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#2A2520]">
                  {snapshot.overview.projectType}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Publik
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#2A2520]">{snapshot.audience}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Budget
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#2A2520]">
                  {formatSnapshotBudget(snapshot)} ({snapshot.budget.confidence})
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Tidsfönster
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#2A2520]">
                  {formatSnapshotTimeline(snapshot)} ({snapshot.timeline.flexibility})
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Omfattning
                </dt>
                <dd className="mt-1 text-sm text-[#2A2520]">{selectedScopeSummary}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Beskrivning
                </dt>
                <dd className="mt-1 text-sm text-[#2A2520]">{snapshot.overview.description}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerateQuote}
                className="rounded-2xl bg-[#8C7860] px-6 py-3 text-sm font-semibold text-white shadow-md outline-none transition-all hover:bg-[#6B5A47] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              >
                Generera offertunderlag
              </button>
              <button
                type="button"
                onClick={handleSkickaForfragan}
                className="rounded-2xl border-2 border-[#8C7860] bg-white px-6 py-3 text-sm font-semibold text-[#8C7860] outline-none transition-all hover:bg-[#8C7860]/10 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              >
                Skicka förfrågan
              </button>
              <Link
                href={requestsHref}
                className="rounded-2xl border-2 border-[#D9D1C6] bg-[#FAF8F5] px-6 py-3 text-sm font-semibold text-[#6B5A47] outline-none transition-all hover:bg-white focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              >
                Mina förfrågningar
              </Link>
              <Link
                href={`/timeline?projectId=${encodeURIComponent(snapshot.id)}`}
                className="rounded-2xl border-2 border-[#D9D1C6] bg-white px-6 py-3 text-sm font-semibold text-[#6B5A47] outline-none transition-all hover:bg-[#FAF8F5] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              >
                Open Timeline
              </Link>
              <span className="inline-flex items-center rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                Snapshot-ID: {snapshot.id}
              </span>
              <span className="inline-flex items-center rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                Lagrad i {PROJECT_SNAPSHOT_KEY}
              </span>
            </div>

            {snapshot.lockedAt && (
              <Notice variant="success" className="mt-4">
                Offertunderlaget är låst ({new Date(snapshot.lockedAt).toLocaleString("sv-SE")}).
              </Notice>
            )}
            {sendValidationErrors.length > 0 && (
              <Notice variant="warning" className="mt-3">
                <p className="font-semibold">Kan inte skicka än:</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {sendValidationErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Notice>
            )}
            {requestNotice && (
              <Notice variant="success" className="mt-3">
                {requestNotice}
              </Notice>
            )}
          </Card>

          <div className="mt-6">
            <SchedulePreviewCard
              context={scheduleContext}
              heading="Generated schedule preview"
              description="Auto-fylld pre/build/post-plan som du kan redigera i Timeline."
              maxTasks={12}
            />
          </div>

          <Card className={`mt-6 border-2 ${RISK_COLORS[snapshot.riskProfile.level]}`}>
            <h2 className="mb-2 text-lg font-bold">Riskprofil</h2>
            <p className="mb-3 text-sm">
              Nivå: {toSwedishRiskLabel(snapshot.riskProfile.level)} · Kompletthet: {" "}
              {snapshot.completenessScore}%
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {snapshot.riskProfile.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {snapshot.riskProfile.recommendedNextSteps.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-semibold">Rekommenderade nästa steg</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {snapshot.riskProfile.recommendedNextSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="mb-4 text-lg font-bold text-[#2A2520]">Dina val</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {stepConfig
                .filter((step) => step.path !== "/start/sammanfattning")
                .map((step) => (
                  <div key={step.path} className="flex items-start justify-between gap-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase text-[#8C7860]">
                        {step.label}
                      </dt>
                      <dd className="mt-0.5 text-[#2A2520]">
                        {step.path === "/start/underlag"
                          ? `${snapshot.files.length} filer`
                          : step.path === "/start/omfattning"
                            ? selectedScopeSummary
                            : "Ifyllt"}
                      </dd>
                    </div>
                    <Link
                      href={step.path}
                      className="shrink-0 text-sm font-semibold text-[#8C7860] underline-offset-2 hover:underline"
                    >
                      Redigera
                    </Link>
                  </div>
                ))}
            </dl>
            {projectBrief.openQuestions.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3">
                <p className="text-sm font-semibold text-[#2A2520]">Saker som behöver beslutas</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#6B5A47]">
                  {projectBrief.openQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="mb-4 text-lg font-bold text-[#2A2520]">
              Filer som ingår i snapshot
            </h2>
            {snapshot.files.length === 0 && (
              <p className="text-sm text-[#766B60]">
                Inga filer kopplade ännu. Lägg till filer i steget Underlag.
              </p>
            )}
            {snapshot.files.length > 0 && (
              <ul className="space-y-2 text-sm text-[#2A2520]">
                {snapshot.files.map((file) => (
                  <li
                    key={file.id}
                    className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2"
                  >
                    <span className="font-semibold">{file.name}</span>
                    <span className="ml-2 text-[#766B60]">
                      ({file.type} · {formatBytes(file.size)})
                    </span>
                    {file.tags.length > 0 && (
                      <div className="mt-1 text-xs text-[#6B5A47]">
                        Taggar: {file.tags.join(", ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/start/tidplan"
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#E8E3DC] bg-white px-6 py-4 text-sm font-semibold text-[#766B60] outline-none transition-all hover:border-[#CDB49B] focus-visible:ring-2 focus-visible:ring-[#8C7860]"
            >
              Tillbaka
            </Link>
            <Link
              href={completionHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Klar - till landningssidan
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}
