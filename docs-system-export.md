# Dokumentationssystem – kodexport

Genererad: 2026-02-19 15:56:34

## app/start/beskrivning/page.tsx

```tsx
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

```

## app/components/routing-utilities.ts

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Routing Utilities
 *
 * Hanterar wizard-nav och enklare route guards för startflödet.
 */

export type ProjectType = "renovering" | "tillbyggnad" | "nybyggnation" | "annat" | null;

const BASE_STEP_ORDER = [
  "/start",
  "/start/nulage",
] as const;

const COMMON_END_STEPS = [
  "/start/beskrivning",
  "/start/underlag",
  "/start/omfattning",
  "/start/budget",
  "/start/tidplan",
  "/start/sammanfattning",
] as const;

export type WizardStepPath =
  | (typeof BASE_STEP_ORDER)[number]
  | "/start/renovering"
  | "/start/tillbyggnad"
  | "/start/nybyggnation"
  | (typeof COMMON_END_STEPS)[number];

function getProjectSpecificStep(projectType: ProjectType): WizardStepPath | null {
  if (projectType === "renovering") return "/start/renovering";
  if (projectType === "tillbyggnad") return "/start/tillbyggnad";
  if (projectType === "nybyggnation") return "/start/nybyggnation";
  return null;
}

function getWizardStepOrder(projectType: ProjectType): WizardStepPath[] {
  const order: WizardStepPath[] = [...BASE_STEP_ORDER];
  const projectSpecificStep = getProjectSpecificStep(projectType);
  if (projectSpecificStep) {
    order.push(projectSpecificStep);
  }

  if (projectType) {
    order.push(...COMMON_END_STEPS);
  }

  return order;
}

/**
 * Smooth navigation med enkel fade-out på body innan route push.
 */
export function useSmoothNavigation() {
  const router = useRouter();

  const navigate = useCallback(
    (path: string, delay = 200) => {
      window.setTimeout(() => {
        router.push(path);
      }, delay);
    },
    [router]
  );

  return { navigate };
}

/**
 * Route guards för wizard med lättviktig validering.
 */
export function canAccessWizardStep(
  targetPath: string,
  completedSteps: string[] = [],
  currentProjectType: ProjectType
): { allowed: boolean; redirectTo?: string; reason?: string } {
  const projectType = currentProjectType;

  if (targetPath === "/start") return { allowed: true };

  if (!projectType && targetPath !== "/start/nulage") {
    return {
      allowed: false,
      redirectTo: "/start",
      reason: "Du måste välja projekttyp först.",
    };
  }

  const projectStep = getProjectSpecificStep(projectType);
  if (
    targetPath === "/start/renovering" ||
    targetPath === "/start/tillbyggnad" ||
    targetPath === "/start/nybyggnation"
  ) {
    if (!projectStep || targetPath !== projectStep) {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Det här steget matchar inte vald projekttyp.",
      };
    }
    return { allowed: true };
  }

  if (completedSteps.includes(targetPath)) {
    return { allowed: true };
  }

  const order = getWizardStepOrder(projectType);
  const targetIndex = order.indexOf(targetPath as WizardStepPath);
  if (targetIndex <= 0) return { allowed: true };

  const previousPath = order[targetIndex - 1];
  if (!completedSteps.includes(previousPath)) {
    return {
      allowed: false,
      redirectTo: previousPath,
      reason: "Slutför föregående steg först.",
    };
  }

  return { allowed: true };
}

/**
 * Routing-regler per roll.
 */
export const ROLE_ROUTES = {
  privat: {
    landing: "/privatperson",
    wizard: "/start",
    dashboard: "/projekt",
  },
  brf: {
    landing: "/brf",
    wizard: "/brf/start",
    dashboard: "/brf/atgarder",
  },
  entreprenor: {
    landing: "/entreprenor",
    wizard: null,
    dashboard: "/entreprenor/projekt",
  },
  osaker: {
    landing: "/start",
    wizard: "/start",
    dashboard: null,
  },
} as const;

export function getRoleRoute(
  role: keyof typeof ROLE_ROUTES,
  type: "landing" | "wizard" | "dashboard"
): string | null {
  return ROLE_ROUTES[role]?.[type] ?? null;
}

/**
 * Hitta nästa steg i wizard.
 */
export function getNextWizardStep(
  currentPath: string,
  projectType: ProjectType
): WizardStepPath | null {
  const order = getWizardStepOrder(projectType);
  const currentIndex = order.indexOf(currentPath as WizardStepPath);
  if (currentIndex === -1) return null;
  const nextIndex = currentIndex + 1;
  if (nextIndex >= order.length) return null;
  return order[nextIndex];
}

/**
 * Hitta föregående steg i wizard.
 */
export function getPreviousWizardStep(
  currentPath: string,
  projectType: ProjectType
): WizardStepPath | null {
  const order = getWizardStepOrder(projectType);
  const currentIndex = order.indexOf(currentPath as WizardStepPath);
  if (currentIndex <= 0) return null;
  return order[currentIndex - 1];
}

/**
 * Navigation hooks för wizard.
 */
export function useWizardNavigation() {
  const { navigate } = useSmoothNavigation();

  const goToNextStep = useCallback(
    (currentPath: string, projectType: ProjectType) => {
      const next = getNextWizardStep(currentPath, projectType);
      if (next) {
        navigate(next);
      }
    },
    [navigate]
  );

  const goToPreviousStep = useCallback(
    (currentPath: string, projectType: ProjectType) => {
      const prev = getPreviousWizardStep(currentPath, projectType);
      if (prev) {
        navigate(prev);
      }
    },
    [navigate]
  );

  const goToStep = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  return {
    goToNextStep,
    goToPreviousStep,
    goToStep,
  };
}

/**
 * Exit wizard med bekräftelse.
 */
export function useWizardExit() {
  const router = useRouter();

  const exit = useCallback(
    (hasUnsavedChanges = false) => {
      if (hasUnsavedChanges) {
        const confirmExit = window.confirm(
          "Du har osparade ändringar. Är du säker på att du vill avsluta?"
        );
        if (!confirmExit) return;
      }
      router.push("/");
    },
    [router]
  );

  return { exit };
}

```

## app/components/request-document-generator-panel.tsx

```tsx
"use client";

import { useMemo, useState } from "react";
import { sendRequestMessage, type ConversationActorRole } from "../lib/request-messages";
import type { PlatformRequest } from "../lib/requests-store";

type DocumentKind = "contract" | "quote" | "ate";
type RecipientTarget = "brf" | "privatperson" | "both";

interface RequestDocumentGeneratorPanelProps {
  request: PlatformRequest;
  actorLabel: string;
  onDocumentSent?: () => void;
}

const DOCUMENT_OPTIONS: Array<{ kind: DocumentKind; label: string; intro: string }> = [
  { kind: "contract", label: "Avtal", intro: "utkast till entreprenadavtal" },
  { kind: "quote", label: "Offert", intro: "utkast till offert" },
  { kind: "ate", label: "ÄTA-arbete", intro: "utkast till ÄTA-arbete" },
];

function recipientLabel(target: RecipientTarget): string {
  if (target === "brf") return "BRF";
  if (target === "privatperson") return "Privatperson";
  return "BRF + Privatperson";
}

function targetRoles(target: RecipientTarget): ConversationActorRole[] {
  if (target === "brf") return ["brf"];
  if (target === "privatperson") return ["privatperson"];
  return ["brf", "privatperson"];
}

function buildDocumentTemplate(
  request: PlatformRequest,
  kind: DocumentKind,
  note: string,
  target: RecipientTarget
): string {
  const option = DOCUMENT_OPTIONS.find((item) => item.kind === kind) ?? DOCUMENT_OPTIONS[0];
  const scopeText =
    request.scope.scopeItems?.map((item) => `- ${item.title}`).join("\n") ||
    request.scope.actions?.map((action) => `- ${action.title}`).join("\n") ||
    "- Specificeras i dialog";

  return [
    `${option.label} (${recipientLabel(target)})`,
    "",
    `Hej! Här kommer ett ${option.intro} för ${request.title.toLowerCase()}.`,
    "",
    "Projekt",
    `- Titel: ${request.title}`,
    `- Plats: ${request.location}`,
    `- Önskad start: ${request.desiredStart}`,
    `- Budgetram: ${request.budgetRange}`,
    "",
    "Omfattning",
    scopeText,
    "",
    "Pris, tidplan och villkor",
    "- Pris: Specificeras i slutlig handling",
    "- Tidplan: Bekräftas efter platsbesök",
    "- Betalningsvillkor: 30 dagar netto",
    "- Giltighet: 30 dagar från utskick",
    "",
    "Kommentar",
    note.trim().length > 0 ? note.trim() : "Inga extra kommentarer.",
  ].join("\n");
}

export function RequestDocumentGeneratorPanel({
  request,
  actorLabel,
  onDocumentSent,
}: RequestDocumentGeneratorPanelProps) {
  const [kind, setKind] = useState<DocumentKind>("contract");
  const [target, setTarget] = useState<RecipientTarget>(request.audience === "privat" ? "privatperson" : "brf");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const preview = useMemo(() => buildDocumentTemplate(request, kind, note, target), [request, kind, note, target]);

  const handleSend = () => {
    sendRequestMessage({
      requestId: request.id,
      authorRole: "entreprenor",
      authorLabel: actorLabel,
      body: preview,
      messageType: "document",
      targetRoles: targetRoles(target),
    });
    setNotice(`${DOCUMENT_OPTIONS.find((item) => item.kind === kind)?.label ?? "Dokument"} skickat till ${recipientLabel(target)}.`);
    onDocumentSent?.();
  };

  return (
    <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-[#2A2520]">Autogenerera dokument</h3>
      <p className="mt-1 text-sm text-[#766B60]">
        Skapa ett utkast för avtal, offert eller ÄTA-arbete och skicka direkt i tråden.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
          <label className="block text-xs font-semibold text-[#6B5A47]">
            Dokumenttyp
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as DocumentKind)}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            >
              {DOCUMENT_OPTIONS.map((option) => (
                <option key={option.kind} value={option.kind}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-[#6B5A47]">
            Mottagare
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value as RecipientTarget)}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            >
              <option value="brf">BRF</option>
              <option value="privatperson">Privatperson</option>
              <option value="both">BRF + Privatperson</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-[#6B5A47]">
            Extra kommentar
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
              placeholder="Lägg till exempelvis giltighet, reservationsvillkor eller nästa steg..."
            />
          </label>

          <button
            type="button"
            onClick={handleSend}
            className="w-full rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47]"
          >
            Generera och skicka i meddelanden
          </button>
        </div>

        <article className="rounded-2xl border border-[#E8E3DC] bg-[#FCFBF8] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">Förhandsvisning</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[#EFE8DD] bg-white p-3 text-xs text-[#2A2520]">
            {preview}
          </pre>
        </article>
      </div>

      {notice && (
        <p className="mt-3 rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
          {notice}
        </p>
      )}
    </section>
  );
}

```

## app/dashboard/entreprenor/dokument/page.tsx

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/auth-context";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestConversationsSidebar } from "../../../components/request-conversations-sidebar";
import { RequestDocumentGeneratorPanel } from "../../../components/request-document-generator-panel";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../lib/requests-store";

export default function EntreprenorDokumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get("requestId");
  const { user, ready } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(() => listRequests());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") {
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
    }
  }, [ready, router, user]);

  useEffect(() => subscribeRequests(() => setIncomingRequests(listRequests())), []);

  if (!ready || !user) return null;

  const resolvedSelectedRequestId =
    selectedRequestId && incomingRequests.some((request) => request.id === selectedRequestId)
      ? selectedRequestId
      : incomingRequests[0]?.id || null;

  const selectedRequest =
    incomingRequests.find((request) => request.id === resolvedSelectedRequestId) ||
    incomingRequests[0] ||
    null;

  const actorLabel = user.name?.trim() || user.email || "Entreprenör";

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Dokumentgenerator"
      subheading="Autogenerera avtal, offerter och ÄTA-dokument och skicka direkt till BRF eller privatperson."
      startProjectHref="/dashboard/entreprenor/forfragningar"
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
        { href: "/dashboard/entreprenor/meddelanden", label: "Meddelanden" },
        { href: "/dashboard/entreprenor/dokument", label: "Dokumentgenerator" },
      ]}
      cards={[]}
    >
      {incomingRequests.length === 0 && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#766B60]">Inga förfrågningar ännu.</p>
        </section>
      )}

      {selectedRequest && (
        <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <RequestConversationsSidebar
            requests={incomingRequests}
            selectedRequestId={resolvedSelectedRequestId}
            actorRole="entreprenor"
            title="Inkorg"
            onSelectRequest={setSelectedRequestId}
          />

          <main>
            <RequestDocumentGeneratorPanel request={selectedRequest} actorLabel={actorLabel} />
          </main>
        </section>
      )}
    </DashboardShell>
  );
}

```

## app/dashboard/privat/dokumentinkorg/page.tsx

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestsOutboxPanel } from "../../../components/requests-outbox-panel";
import { useAuth } from "../../../components/auth-context";

export default function PrivatDokumentinkorgPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=privat");
      return;
    }
    if (user.role === "brf") {
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
    }
  }, [ready, router, user]);

  if (!ready) return null;
  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading="Dokumentinkorg"
      subheading="Här hittar du avtal, offerter och ÄTA-dokument som entreprenörer skickat till ditt projekt."
      startProjectHref="/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      navItems={[
        { href: "/dashboard/privat", label: "Översikt" },
        { href: "/dashboard/privat/underlag", label: "Bostad & underlag" },
        { href: "/timeline", label: "Timeline" },
        { href: "/dashboard/privat/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/privat/dokumentinkorg", label: "Dokumentinkorg" },
        { href: "/start", label: "Initiera / fortsätt projekt" },
      ]}
      cards={[]}
    >
      <RequestsOutboxPanel audience="privat" mode="documents" />
    </DashboardShell>
  );
}

```

## app/dashboard/brf/dokumentinkorg/page.tsx

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestsOutboxPanel } from "../../../components/requests-outbox-panel";
import { useAuth } from "../../../components/auth-context";

export default function BrfDokumentinkorgPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
    }
  }, [ready, router, user]);

  if (!ready) return null;
  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading="Avtalsinkorg"
      subheading="Här hittar du avtal, offerter och ÄTA-dokument som entreprenörer har skickat till föreningen."
      startProjectHref="/brf/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      navItems={[
        { href: "/dashboard/brf", label: "Översikt" },
        { href: "/dashboard/brf/fastighet", label: "Fastighet" },
        { href: "/dashboard/brf/underhallsplan", label: "Underhållsplan" },
        { href: "/timeline", label: "Timeline" },
        { href: "/dashboard/brf/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/brf/dokumentinkorg", label: "Avtalsinkorg" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[]}
    >
      <RequestsOutboxPanel audience="brf" mode="documents" />
    </DashboardShell>
  );
}

```

## app/start/underlag/page.tsx

```tsx
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

```

## app/lib/brf-workspace.ts

```tsx
export type BrfFileType =
  | "Underhallsplan"
  | "Ritning"
  | "Detaljplan"
  | "Avtal"
  | "Offert"
  | "Myndighet"
  | "Kalkyl"
  | "Bild"
  | "Dokument"
  | "Annat";

export interface BrfFileRecord {
  id: string;
  name: string;
  fileType: BrfFileType;
  extension: string;
  sizeKb: number;
  uploadedAt: string;
  sourceLabel: string;
  linkedActionTitle?: string;
  mimeType?: string;
  contentGroup?: string;
  tags?: string[];
}

export const BRF_FILES_KEY = "byggplattformen-brf-files";
export const BRF_FILES_UPDATED_EVENT = "byggplattformen-brf-files-updated";
export const PRIVATE_FILES_KEY = "byggplattformen-private-files";
export const PRIVATE_FILES_UPDATED_EVENT = "byggplattformen-private-files-updated";
export const BRF_FILE_PAYLOADS_KEY = "byggplattformen-brf-file-payloads";
export const PRIVATE_FILE_PAYLOADS_KEY = "byggplattformen-private-file-payloads";
export const FILE_PAYLOAD_MAX_BYTES = 2_500_000;

export type WorkspaceFileScope = "brf" | "privat";

interface FilePayload {
  id: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
  sizeKb: number;
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function inferBrfFileType(fileName: string): BrfFileType {
  const lower = fileName.toLowerCase();
  const ext = getFileExtension(fileName);

  if (
    lower.includes("underhållsplan") ||
    lower.includes("underhallsplan") ||
    lower.includes("maintenance") ||
    ["xls", "xlsx", "xlsm"].includes(ext)
  ) {
    return "Underhallsplan";
  }

  if (
    lower.includes("ritning") ||
    lower.includes("dwg") ||
    lower.includes("ifc") ||
    ext === "dwg" ||
    ext === "ifc"
  ) {
    return "Ritning";
  }

  if (lower.includes("detaljplan") || lower.includes("planbeskrivning")) {
    return "Detaljplan";
  }

  if (
    lower.includes("avtal") ||
    lower.includes("kontrakt") ||
    lower.includes("upphandling")
  ) {
    return "Avtal";
  }

  if (lower.includes("offert") || lower.includes("anbud")) {
    return "Offert";
  }

  if (
    lower.includes("bygglov") ||
    lower.includes("tillstånd") ||
    lower.includes("myndighet")
  ) {
    return "Myndighet";
  }

  if (lower.includes("kalkyl") || lower.includes("budget")) {
    return "Kalkyl";
  }

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return "Bild";
  }

  if (["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)) {
    return "Dokument";
  }

  return "Annat";
}

export function getFileTypeLabel(fileType: BrfFileType): string {
  if (fileType === "Underhallsplan") return "Underhållsplan";
  if (fileType === "Ritning") return "Ritning";
  if (fileType === "Detaljplan") return "Detaljplan";
  if (fileType === "Avtal") return "Avtal";
  if (fileType === "Offert") return "Offert";
  if (fileType === "Myndighet") return "Myndighet";
  if (fileType === "Kalkyl") return "Kalkyl";
  if (fileType === "Bild") return "Bild";
  if (fileType === "Dokument") return "Dokument";
  return "Annat";
}

export function inferContentGroup(fileType: BrfFileType): string {
  if (fileType === "Underhallsplan") return "Planering och underhåll";
  if (fileType === "Kalkyl") return "Ekonomi och kalkyl";
  if (fileType === "Ritning" || fileType === "Detaljplan") return "Tekniskt underlag";
  if (fileType === "Avtal" || fileType === "Offert") return "Upphandling och avtal";
  if (fileType === "Myndighet") return "Myndighetsunderlag";
  if (fileType === "Bild") return "Foto och media";
  if (fileType === "Dokument") return "Övriga dokument";
  return "Övrigt";
}

export function inferFileTags(fileName: string, fileType: BrfFileType): string[] {
  const lower = fileName.toLowerCase();
  const tags = new Set<string>([getFileTypeLabel(fileType)]);

  const mappings: Array<{ token: string; tag: string }> = [
    { token: "underhåll", tag: "Underhåll" },
    { token: "underhalls", tag: "Underhåll" },
    { token: "ritning", tag: "Ritning" },
    { token: "dwg", tag: "CAD" },
    { token: "ifc", tag: "BIM" },
    { token: "fasad", tag: "Fasad" },
    { token: "tak", tag: "Tak" },
    { token: "el", tag: "El" },
    { token: "belys", tag: "Belysning" },
    { token: "vent", tag: "Ventilation" },
    { token: "värme", tag: "Värme" },
    { token: "varme", tag: "Värme" },
    { token: "avtal", tag: "Avtal" },
    { token: "offert", tag: "Offert" },
    { token: "bygglov", tag: "Bygglov" },
    { token: "kalkyl", tag: "Kalkyl" },
    { token: "budget", tag: "Budget" },
    { token: "bild", tag: "Foto" },
  ];

  mappings.forEach((mapping) => {
    if (lower.includes(mapping.token)) tags.add(mapping.tag);
  });

  return Array.from(tags).slice(0, 8);
}

export function normalizeWorkspaceFileRecord(record: BrfFileRecord): BrfFileRecord {
  const fileType = record.fileType || inferBrfFileType(record.name);
  return {
    ...record,
    fileType,
    extension: record.extension || getFileExtension(record.name),
    contentGroup: record.contentGroup || inferContentGroup(fileType),
    tags: record.tags && record.tags.length > 0 ? record.tags : inferFileTags(record.name, fileType),
  };
}

function fileStorageKey(scope: WorkspaceFileScope): string {
  return scope === "brf" ? BRF_FILES_KEY : PRIVATE_FILES_KEY;
}

function fileUpdatedEvent(scope: WorkspaceFileScope): string {
  return scope === "brf" ? BRF_FILES_UPDATED_EVENT : PRIVATE_FILES_UPDATED_EVENT;
}

function payloadStorageKey(scope: WorkspaceFileScope): string {
  return scope === "brf" ? BRF_FILE_PAYLOADS_KEY : PRIVATE_FILE_PAYLOADS_KEY;
}

export function readWorkspaceFiles(scope: WorkspaceFileScope): BrfFileRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(fileStorageKey(scope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((entry): entry is BrfFileRecord => Boolean(entry && typeof entry.name === "string"))
          .map(normalizeWorkspaceFileRecord)
      : [];
  } catch {
    return [];
  }
}

export function writeWorkspaceFiles(scope: WorkspaceFileScope, files: BrfFileRecord[]) {
  if (typeof window === "undefined") return;
  const normalized = files.map(normalizeWorkspaceFileRecord);
  localStorage.setItem(fileStorageKey(scope), JSON.stringify(normalized));
  window.dispatchEvent(new Event(fileUpdatedEvent(scope)));
}

export function removeWorkspaceFile(scope: WorkspaceFileScope, fileId: string) {
  const current = readWorkspaceFiles(scope);
  const next = current.filter((file) => file.id !== fileId);
  writeWorkspaceFiles(scope, next);
  removeWorkspaceFilePayload(scope, fileId);
}

export function clearWorkspaceFiles(scope: WorkspaceFileScope) {
  writeWorkspaceFiles(scope, []);
  if (typeof window !== "undefined") {
    localStorage.removeItem(payloadStorageKey(scope));
  }
}

export function structureWorkspaceFiles(scope: WorkspaceFileScope): BrfFileRecord[] {
  const normalized = readWorkspaceFiles(scope).map(normalizeWorkspaceFileRecord);
  writeWorkspaceFiles(scope, normalized);
  return normalized;
}

function readFilePayloadMap(scope: WorkspaceFileScope): Record<string, FilePayload> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(payloadStorageKey(scope));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, FilePayload>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFilePayloadMap(scope: WorkspaceFileScope, map: Record<string, FilePayload>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(payloadStorageKey(scope), JSON.stringify(map));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Fil kunde inte läsas som data URL."));
      }
    };
    reader.onerror = () => reject(new Error("Filinläsning misslyckades."));
    reader.readAsDataURL(file);
  });
}

export async function storeWorkspaceFilePayload(
  scope: WorkspaceFileScope,
  fileId: string,
  file: File
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (file.size > FILE_PAYLOAD_MAX_BYTES) return false;

  try {
    const dataUrl = await fileToDataUrl(file);
    const map = readFilePayloadMap(scope);
    map[fileId] = {
      id: fileId,
      mimeType: file.type || "application/octet-stream",
      dataUrl,
      uploadedAt: new Date().toISOString(),
      sizeKb: Number((file.size / 1024).toFixed(1)),
    };
    writeFilePayloadMap(scope, map);
    return true;
  } catch {
    return false;
  }
}

export function removeWorkspaceFilePayload(scope: WorkspaceFileScope, fileId: string) {
  const map = readFilePayloadMap(scope);
  if (!map[fileId]) return;
  delete map[fileId];
  writeFilePayloadMap(scope, map);
}

export function hasWorkspaceFilePayload(scope: WorkspaceFileScope, fileId: string): boolean {
  const map = readFilePayloadMap(scope);
  return Boolean(map[fileId]?.dataUrl);
}

export function openWorkspaceFile(scope: WorkspaceFileScope, fileId: string): boolean {
  if (typeof window === "undefined") return false;
  const map = readFilePayloadMap(scope);
  const payload = map[fileId];
  if (!payload?.dataUrl) return false;
  window.open(payload.dataUrl, "_blank", "noopener,noreferrer");
  return true;
}

```

## app/lib/requests-store.ts

```tsx
import {
  formatSnapshotBudget,
  formatSnapshotTimeline,
  toSwedishRiskLabel,
  type ProjectSnapshot,
  type ProjectSnapshotFile,
} from "./project-snapshot";

export type RequestAudience = "brf" | "privat";
export type RequestStatus = "draft" | "sent" | "received";
export type RequestRecipientStatus = "sent" | "opened" | "responded" | "declined";

export interface ProcurementActionDetail {
  label: string;
  value: string;
}

export interface ProcurementAction {
  id: string;
  title: string;
  category: string;
  status: "Planerad" | "Eftersatt" | "Genomförd";
  plannedYear: number;
  estimatedPriceSek: number;
  emissionsKgCo2e: number;
  source?: "ai" | "local";
  details?: string;
  rawRow?: string;
  sourceSheet?: string;
  sourceRow?: number;
  extraDetails?: ProcurementActionDetail[];
}

export interface RequestPropertySnapshot {
  audience: RequestAudience;
  title: string;
  address: string;
  buildingYear?: string;
  apartmentsCount?: string;
  buildingsCount?: string;
  areaSummary?: string;
  occupancy?: string;
  accessAndLogistics?: string;
  knownConstraints?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface RequestDocumentSummaryItem {
  typeLabel: string;
  count: number;
}

export interface RequestDocumentSummary {
  totalFiles: number;
  byType: RequestDocumentSummaryItem[];
  highlights: string[];
}

export interface RequestFileRecord {
  id?: string;
  name: string;
  fileTypeLabel: string;
  extension: string;
  sizeKb: number;
  uploadedAt: string;
  sourceLabel: string;
  tags?: string[];
  linkedActionTitle?: string;
}

export interface RequestScopeItem {
  title: string;
  details?: string;
}

export interface RequestRecipient {
  id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  status: RequestRecipientStatus;
  sentAt: string;
}

export interface PlatformRequest {
  id: string;
  createdAt: string;
  audience: RequestAudience;
  status: RequestStatus;
  requestType?: "offer_request_v1";
  title: string;
  location: string;
  desiredStart: string;
  budgetRange: string;
  scope: {
    actions?: ProcurementAction[];
    scopeItems?: RequestScopeItem[];
  };
  snapshot?: ProjectSnapshot;
  propertySnapshot?: RequestPropertySnapshot;
  documentSummary?: RequestDocumentSummary;
  files?: RequestFileRecord[];
  completeness: number;
  missingInfo: string[];
  replyDeadline?: string;
  distribution?: string[];
  recipients?: RequestRecipient[];

  // Backwards compatibility for already-built views.
  actions?: ProcurementAction[];
  documentationLevel?: string;
  riskProfile?: "Låg" | "Medel" | "Hög";
}

export const REQUESTS_STORAGE_KEY = "byggplattformen-procurement-requests";
export const REQUESTS_UPDATED_EVENT = "byggplattformen-procurement-updated";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(raw: unknown): RequestStatus {
  if (raw === "draft" || raw === "received") return raw;
  return "sent";
}

function normalizeCreatedAt(raw: unknown): string {
  if (typeof raw !== "string") return new Date().toISOString();
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function inferAudience(raw: Record<string, unknown>): RequestAudience {
  if (raw.audience === "privat" || raw.audience === "brf") {
    return raw.audience;
  }

  if (isObject(raw.snapshot) && raw.snapshot.audience === "privat") return "privat";
  if (isObject(raw.propertySnapshot) && raw.propertySnapshot.audience === "privat") {
    return "privat";
  }

  return "brf";
}

function mapLegacySnapshotFile(file: ProjectSnapshotFile): RequestFileRecord {
  const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  return {
    id: file.id,
    name: file.name,
    fileTypeLabel: file.type || "Okänd",
    extension,
    sizeKb: Number((file.size / 1024).toFixed(1)),
    uploadedAt: new Date().toISOString(),
    sourceLabel: "ProjectSnapshot",
    tags: [...file.tags],
  };
}

function normalizeRecipientStatus(raw: unknown): RequestRecipientStatus {
  if (raw === "opened" || raw === "responded" || raw === "declined") return raw;
  return "sent";
}

function toRecipientId(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : `recipient-${Date.now()}`;
}

function parseDistributionLabel(label: string): {
  companyName: string;
  email?: string;
} {
  const trimmed = label.trim();
  const angleEmailMatch = trimmed.match(/^(.*)<([^>]+)>$/);
  if (angleEmailMatch) {
    return {
      companyName: angleEmailMatch[1].trim() || "Entreprenör",
      email: angleEmailMatch[2].trim(),
    };
  }

  const pipeSplit = trimmed.split("|");
  if (pipeSplit.length >= 2) {
    return {
      companyName: pipeSplit[0]?.trim() || "Entreprenör",
      email: pipeSplit.slice(1).join("|").trim() || undefined,
    };
  }

  return { companyName: trimmed || "Entreprenör" };
}

function normalizeRecipients(
  rawRecipients: unknown,
  distribution: string[],
  createdAt: string
): RequestRecipient[] {
  const fromRecipients = Array.isArray(rawRecipients)
    ? rawRecipients
        .map((entry, index) => {
          if (!isObject(entry)) return undefined;
          const companyName =
            typeof entry.companyName === "string" && entry.companyName.trim().length > 0
              ? entry.companyName.trim()
              : "Entreprenör";
          const email =
            typeof entry.email === "string" && entry.email.trim().length > 0
              ? entry.email.trim()
              : undefined;
          const contactName =
            typeof entry.contactName === "string" && entry.contactName.trim().length > 0
              ? entry.contactName.trim()
              : undefined;
          const id =
            typeof entry.id === "string" && entry.id.trim().length > 0
              ? entry.id
              : toRecipientId(`${companyName}-${email ?? index}`);
          const recipient: RequestRecipient = {
            id,
            companyName,
            status: normalizeRecipientStatus(entry.status),
            sentAt:
              typeof entry.sentAt === "string" && entry.sentAt.length > 0
                ? entry.sentAt
                : createdAt,
          };
          if (contactName) recipient.contactName = contactName;
          if (email) recipient.email = email;
          return recipient;
        })
        .filter((entry): entry is RequestRecipient => entry !== undefined)
    : [];

  if (fromRecipients.length > 0) return fromRecipients;

  if (distribution.length > 0) {
    return distribution.map((label, index) => {
      const parsed = parseDistributionLabel(label);
      return {
        id: toRecipientId(`${parsed.companyName}-${parsed.email ?? index}`),
        companyName: parsed.companyName,
        email: parsed.email,
        status: "sent",
        sentAt: createdAt,
      };
    });
  }

  return [];
}

export function toRecipientLabel(recipient: RequestRecipient): string {
  if (recipient.email) {
    return `${recipient.companyName} <${recipient.email}>`;
  }
  return recipient.companyName;
}

export function defaultRecipientsForAudience(audience: RequestAudience): RequestRecipient[] {
  const now = new Date().toISOString();
  if (audience === "brf") {
    return [
      {
        id: "rec-brf-1",
        companyName: "Nord Bygg & Renovering AB",
        email: "anbud@nordbygg.se",
        status: "sent",
        sentAt: now,
      },
      {
        id: "rec-brf-2",
        companyName: "Trygg Fastighetsentreprenad",
        email: "offert@tryggfastighet.se",
        status: "sent",
        sentAt: now,
      },
      {
        id: "rec-brf-3",
        companyName: "Stad & Stomme Projekt AB",
        email: "upphandling@stadstomme.se",
        status: "sent",
        sentAt: now,
      },
    ];
  }

  return [
    {
      id: "rec-pri-1",
      companyName: "HemmaBygg Entreprenad",
      email: "offert@hemmabygg.se",
      status: "sent",
      sentAt: now,
    },
    {
      id: "rec-pri-2",
      companyName: "Trygg Renovering i Sverige",
      email: "projekt@tryggrenovering.se",
      status: "sent",
      sentAt: now,
    },
    {
      id: "rec-pri-3",
      companyName: "Nordic Kök & Bad AB",
      email: "anbud@nordickokbad.se",
      status: "sent",
      sentAt: now,
    },
  ];
}

function normalizeFiles(
  rawFiles: unknown,
  snapshot: ProjectSnapshot | undefined,
  createdAt: string
): RequestFileRecord[] {
  const normalizedFromRaw = Array.isArray(rawFiles)
    ? rawFiles
        .map((item) => {
          if (!isObject(item)) return undefined;
          const name = typeof item.name === "string" ? item.name : "Dokument";
          const extension =
            typeof item.extension === "string"
              ? item.extension
              : name.includes(".")
                ? name.split(".").pop() ?? ""
                : "";
          const sizeKb =
            typeof item.sizeKb === "number" && Number.isFinite(item.sizeKb)
              ? item.sizeKb
              : 0;
          const uploadedAt =
            typeof item.uploadedAt === "string" && item.uploadedAt.length > 0
              ? item.uploadedAt
              : createdAt;

          const record: RequestFileRecord = {
            id: typeof item.id === "string" ? item.id : undefined,
            name,
            fileTypeLabel:
              typeof item.fileTypeLabel === "string" && item.fileTypeLabel.length > 0
                ? item.fileTypeLabel
                : "Okänd",
            extension,
            sizeKb,
            uploadedAt,
            sourceLabel:
              typeof item.sourceLabel === "string" && item.sourceLabel.length > 0
                ? item.sourceLabel
                : "Manuell uppladdning",
            tags: Array.isArray(item.tags)
              ? item.tags.filter((tag): tag is string => typeof tag === "string")
              : undefined,
            linkedActionTitle:
              typeof item.linkedActionTitle === "string" ? item.linkedActionTitle : undefined,
          };
          return record;
        })
        .filter((item): item is RequestFileRecord => item !== undefined)
    : ([] as RequestFileRecord[]);

  if (normalizedFromRaw.length > 0) {
    return normalizedFromRaw;
  }

  if (snapshot && Array.isArray(snapshot.files) && snapshot.files.length > 0) {
    return snapshot.files.map(mapLegacySnapshotFile).map((file) => ({
      ...file,
      uploadedAt: createdAt,
    }));
  }

  return [];
}

function normalizeActions(rawActions: unknown): ProcurementAction[] {
  if (!Array.isArray(rawActions)) return [];

  const normalized = rawActions
    .map((item, index) => {
      if (!isObject(item)) return undefined;

      const rawStatus = item.status;
      const normalizedStatus: ProcurementAction["status"] =
        rawStatus === "Eftersatt" || rawStatus === "Genomförd"
          ? rawStatus
          : "Planerad";

      const title = typeof item.title === "string" && item.title.trim().length > 0
        ? item.title.trim()
        : `Åtgärd ${index + 1}`;

      const action: ProcurementAction = {
        id: typeof item.id === "string" ? item.id : `action-${Date.now()}-${index}`,
        title,
        category:
          typeof item.category === "string" && item.category.trim().length > 0
            ? item.category
            : "Övrigt",
        status: normalizedStatus,
        plannedYear:
          typeof item.plannedYear === "number" && Number.isFinite(item.plannedYear)
            ? item.plannedYear
            : new Date().getFullYear(),
        estimatedPriceSek:
          typeof item.estimatedPriceSek === "number" && Number.isFinite(item.estimatedPriceSek)
            ? item.estimatedPriceSek
            : 0,
        emissionsKgCo2e:
          typeof item.emissionsKgCo2e === "number" && Number.isFinite(item.emissionsKgCo2e)
            ? item.emissionsKgCo2e
            : 0,
        source: item.source === "ai" ? "ai" : "local",
        details: typeof item.details === "string" ? item.details : undefined,
        rawRow: typeof item.rawRow === "string" ? item.rawRow : undefined,
        sourceSheet: typeof item.sourceSheet === "string" ? item.sourceSheet : undefined,
        sourceRow:
          typeof item.sourceRow === "number" && Number.isFinite(item.sourceRow)
            ? item.sourceRow
            : undefined,
        extraDetails: Array.isArray(item.extraDetails)
          ? item.extraDetails
              .map((detail) => {
                if (!isObject(detail)) return null;
                const label = typeof detail.label === "string" ? detail.label : "Fält";
                const value = typeof detail.value === "string" ? detail.value : "";
                return { label, value };
              })
              .filter((detail): detail is ProcurementActionDetail => detail !== null)
          : undefined,
      };
      return action;
    })
    .filter((item): item is ProcurementAction => item !== undefined);

  return normalized;
}

function normalizeScope(
  raw: Record<string, unknown>,
  snapshot: ProjectSnapshot | undefined
): PlatformRequest["scope"] {
  const rawScope: Record<string, unknown> | undefined = isObject(raw.scope) ? raw.scope : undefined;
  const legacyActions = normalizeActions(raw.actions);

  const actions = normalizeActions(rawScope?.actions ?? legacyActions);
  const scopeItemsFromRaw: Array<RequestScopeItem | undefined> = Array.isArray(rawScope?.scopeItems)
    ? rawScope?.scopeItems
        .map((item) => {
          if (!isObject(item)) return undefined;
          const title = typeof item.title === "string" ? item.title.trim() : "";
          if (!title) return undefined;
          const scopeItem: RequestScopeItem = {
            title,
            details: typeof item.details === "string" ? item.details : undefined,
          };
          return scopeItem;
        })
        .filter((item): item is RequestScopeItem => item !== undefined)
    : [];

  const scopeItemsFromSnapshot = snapshot
    ? snapshot.scope.selectedItems.map((item) => ({ title: item }))
    : [];
  const cleanedScopeItems = scopeItemsFromRaw.filter(
    (item): item is RequestScopeItem => item !== undefined
  );

  const scopeItems =
    cleanedScopeItems.length > 0
      ? cleanedScopeItems
      : scopeItemsFromSnapshot.length > 0
        ? scopeItemsFromSnapshot
        : actions.map((action) => ({ title: action.title }));

  return {
    actions,
    scopeItems,
  };
}

function normalizePropertySnapshot(
  raw: unknown,
  audience: RequestAudience,
  locationFallback: string
): RequestPropertySnapshot | undefined {
  if (!isObject(raw)) return undefined;

  const title = typeof raw.title === "string" && raw.title.trim().length > 0
    ? raw.title
    : "Projektunderlag";

  const address =
    typeof raw.address === "string" && raw.address.trim().length > 0
      ? raw.address
      : locationFallback;

  return {
    audience,
    title,
    address,
    buildingYear: typeof raw.buildingYear === "string" ? raw.buildingYear : undefined,
    apartmentsCount:
      typeof raw.apartmentsCount === "string" ? raw.apartmentsCount : undefined,
    buildingsCount:
      typeof raw.buildingsCount === "string" ? raw.buildingsCount : undefined,
    areaSummary: typeof raw.areaSummary === "string" ? raw.areaSummary : undefined,
    occupancy: typeof raw.occupancy === "string" ? raw.occupancy : undefined,
    accessAndLogistics:
      typeof raw.accessAndLogistics === "string" ? raw.accessAndLogistics : undefined,
    knownConstraints:
      typeof raw.knownConstraints === "string" ? raw.knownConstraints : undefined,
    contactName: typeof raw.contactName === "string" ? raw.contactName : undefined,
    contactEmail: typeof raw.contactEmail === "string" ? raw.contactEmail : undefined,
    contactPhone: typeof raw.contactPhone === "string" ? raw.contactPhone : undefined,
  };
}

function normalizeDocumentSummary(
  rawSummary: unknown,
  files: RequestFileRecord[]
): RequestDocumentSummary {
  if (isObject(rawSummary)) {
    const byType = Array.isArray(rawSummary.byType)
      ? rawSummary.byType
          .map((item) => {
            if (!isObject(item)) return null;
            const typeLabel =
              typeof item.typeLabel === "string" && item.typeLabel.length > 0
                ? item.typeLabel
                : "Okänd";
            const count =
              typeof item.count === "number" && Number.isFinite(item.count)
                ? item.count
                : 0;
            return { typeLabel, count };
          })
          .filter((item): item is RequestDocumentSummaryItem => item !== null)
      : [];

    const totalFiles =
      typeof rawSummary.totalFiles === "number" && Number.isFinite(rawSummary.totalFiles)
        ? rawSummary.totalFiles
        : files.length;

    const highlights = Array.isArray(rawSummary.highlights)
      ? rawSummary.highlights.filter((item): item is string => typeof item === "string")
      : [];

    if (byType.length > 0 || highlights.length > 0) {
      return { totalFiles, byType, highlights };
    }
  }

  const byTypeMap = files.reduce<Record<string, number>>((acc, file) => {
    const key = file.fileTypeLabel || "Okänd";
    acc[key] = (acc[key] || 0) + 1;
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

function deriveCompleteness(
  raw: Record<string, unknown>,
  snapshot: ProjectSnapshot | undefined,
  scope: PlatformRequest["scope"],
  files: RequestFileRecord[]
): number {
  if (typeof raw.completeness === "number" && Number.isFinite(raw.completeness)) {
    return Math.max(0, Math.min(100, Math.round(raw.completeness)));
  }
  if (snapshot && Number.isFinite(snapshot.completenessScore)) {
    return Math.max(0, Math.min(100, Math.round(snapshot.completenessScore)));
  }

  const checks = [
    typeof raw.title === "string" && raw.title.trim().length >= 3,
    typeof raw.location === "string" && raw.location.trim().length >= 3,
    (scope.actions?.length ?? 0) > 0 || (scope.scopeItems?.length ?? 0) > 0,
    typeof raw.budgetRange === "string" && raw.budgetRange.trim().length > 0,
    typeof raw.desiredStart === "string" && raw.desiredStart.trim().length > 0,
    files.length > 0,
  ];

  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function deriveMissingInfo(
  raw: Record<string, unknown>,
  scope: PlatformRequest["scope"],
  files: RequestFileRecord[]
): string[] {
  if (Array.isArray(raw.missingInfo)) {
    const fromRaw = raw.missingInfo.filter((item): item is string => typeof item === "string");
    if (fromRaw.length > 0) return fromRaw;
  }

  const missing: string[] = [];

  if (!(typeof raw.title === "string" && raw.title.trim().length >= 3)) {
    missing.push("Projektets titel eller beskrivning behöver förtydligas.");
  }

  if (!(typeof raw.location === "string" && raw.location.trim().length > 0)) {
    missing.push("Adress/område saknas.");
  }

  if ((scope.actions?.length ?? 0) === 0 && (scope.scopeItems?.length ?? 0) === 0) {
    missing.push("Ingen tydlig åtgärd eller omfattning vald.");
  }

  if (!(typeof raw.budgetRange === "string" && raw.budgetRange.trim().length > 0)) {
    missing.push("Budgetspann saknas eller är oklart.");
  }

  if (!(typeof raw.desiredStart === "string" && raw.desiredStart.trim().length > 0)) {
    missing.push("Startfönster saknas.");
  }

  if (files.length === 0) {
    missing.push("Inga underlagsfiler uppladdade.");
  }

  return missing;
}

function normalizeSnapshot(raw: unknown): ProjectSnapshot | undefined {
  if (!isObject(raw)) return undefined;
  if (typeof raw.id !== "string") return undefined;
  if (!isObject(raw.overview) || !isObject(raw.scope) || !isObject(raw.timeline)) {
    return undefined;
  }
  return raw as unknown as ProjectSnapshot;
}

function normalizeRequest(rawInput: unknown): PlatformRequest | null {
  if (!isObject(rawInput)) return null;

  const audience = inferAudience(rawInput);
  const snapshot = normalizeSnapshot(rawInput.snapshot);
  const createdAt = normalizeCreatedAt(rawInput.createdAt);
  const scope = normalizeScope(rawInput, snapshot);

  const title =
    typeof rawInput.title === "string" && rawInput.title.trim().length > 0
      ? rawInput.title
      : snapshot?.overview.title || "Projektförfrågan";

  const location =
    typeof rawInput.location === "string" && rawInput.location.trim().length > 0
      ? rawInput.location
      : snapshot?.overview.location || "Ej angiven plats";

  const budgetRange =
    typeof rawInput.budgetRange === "string" && rawInput.budgetRange.trim().length > 0
      ? rawInput.budgetRange
      : snapshot
        ? formatSnapshotBudget(snapshot)
        : "Budget ej angiven";

  const desiredStart =
    typeof rawInput.desiredStart === "string" && rawInput.desiredStart.trim().length > 0
      ? rawInput.desiredStart
      : snapshot
        ? formatSnapshotTimeline(snapshot)
        : "Startfönster ej angivet";

  const distribution = Array.isArray(rawInput.distribution)
    ? rawInput.distribution.filter((item): item is string => typeof item === "string")
    : [];
  const recipients = normalizeRecipients(rawInput.recipients, distribution, createdAt);
  const normalizedDistribution =
    distribution.length > 0 ? distribution : recipients.map((recipient) => toRecipientLabel(recipient));

  const files = normalizeFiles(rawInput.files, snapshot, createdAt);
  const completeness = deriveCompleteness(rawInput, snapshot, scope, files);
  const missingInfo = deriveMissingInfo(rawInput, scope, files);

  const id =
    typeof rawInput.id === "string" && rawInput.id.trim().length > 0
      ? rawInput.id
      : `req-${Date.now()}`;

  const status = normalizeStatus(rawInput.status);

  const documentationLevel =
    typeof rawInput.documentationLevel === "string" && rawInput.documentationLevel.trim().length > 0
      ? rawInput.documentationLevel
      : `${files.length} filer i underlag`;

  const riskProfile = snapshot
    ? toSwedishRiskLabel(snapshot.riskProfile.level)
    : rawInput.riskProfile === "Hög" || rawInput.riskProfile === "Medel"
      ? rawInput.riskProfile
      : "Låg";

  const actions = scope.actions ?? [];

  const request: PlatformRequest = {
    id,
    createdAt,
    audience,
    status,
    requestType: rawInput.requestType === "offer_request_v1" ? "offer_request_v1" : "offer_request_v1",
    title,
    location,
    desiredStart,
    budgetRange,
    scope,
    snapshot,
    propertySnapshot: normalizePropertySnapshot(rawInput.propertySnapshot, audience, location),
    documentSummary: normalizeDocumentSummary(rawInput.documentSummary, files),
    files,
    completeness,
    missingInfo,
    replyDeadline:
      typeof rawInput.replyDeadline === "string" ? rawInput.replyDeadline : undefined,
    distribution: normalizedDistribution.length > 0 ? normalizedDistribution : undefined,
    recipients: recipients.length > 0 ? recipients : undefined,
    actions,
    documentationLevel,
    riskProfile,
  };

  return request;
}

function writeAllRequests(requests: PlatformRequest[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new Event(REQUESTS_UPDATED_EVENT));
}

function requestDateValue(request: PlatformRequest): number {
  const parsed = Date.parse(request.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function listRequests(): PlatformRequest[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeRequest(item))
      .filter((item): item is PlatformRequest => item !== null)
      .sort((a, b) => requestDateValue(b) - requestDateValue(a));
  } catch {
    return [];
  }
}

export function replaceRequests(requests: PlatformRequest[]): PlatformRequest[] {
  const normalized = requests
    .map((request) => normalizeRequest(request))
    .filter((request): request is PlatformRequest => request !== null)
    .sort((a, b) => requestDateValue(b) - requestDateValue(a));

  writeAllRequests(normalized);
  return normalized;
}

export function saveRequest(request: PlatformRequest): PlatformRequest[] {
  const normalized = normalizeRequest(request);
  if (!normalized) return listRequests();

  const existing = listRequests().filter((item) => item.id !== normalized.id);
  const next = [normalized, ...existing];
  writeAllRequests(next);
  return next;
}

export function subscribeRequests(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === REQUESTS_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(REQUESTS_UPDATED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(REQUESTS_UPDATED_EVENT, callback);
  };
}

```

