"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "../../../../../components/auth-context";
import { DashboardShell } from "../../../../../components/dashboard-shell";
import { EntreprenorOfferFlowShell } from "../../../../../components/offers/EntreprenorOfferFlowShell";
import { OfferCategoryChart } from "../../../../../components/offers/OfferCategoryChart";
import { OfferSummaryCards } from "../../../../../components/offers/OfferSummaryCards";
import { OfferTimelineChart } from "../../../../../components/offers/OfferTimelineChart";
import { OfferTopDrivers } from "../../../../../components/offers/OfferTopDrivers";
import { OfferTypeChart } from "../../../../../components/offers/OfferTypeChart";
import { formatSek } from "../../../../../components/offers/format";
import { listDocumentsByRequest, subscribeDocuments } from "../../../../../lib/documents-store";
import {
  buildEntreprenorOfferFlowSteps,
  getLatestQuoteDocumentForRequest,
} from "../../../../../lib/offers/flow";
import {
  buildOfferPreviewFromRequest,
  ensureDraftOfferForRequest,
  listLatestOffersByProject,
  subscribeOffers,
} from "../../../../../lib/offers/store";
import type { Offer } from "../../../../../lib/offers/types";
import {
  listRequests,
  subscribeRequests,
  type PlatformRequest,
  type ProcurementAction,
} from "../../../../../lib/requests-store";
import {
  formatSnapshotBudget,
  formatSnapshotTimeline,
  toSwedishRiskLabel,
} from "../../../../../lib/project-snapshot";

function parseAreaM2(request: PlatformRequest | null): number | undefined {
  const raw = request?.propertySnapshot?.areaSummary;
  if (!raw) return undefined;
  const match = raw.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1].replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function requestStatusLabel(status: PlatformRequest["status"]): string {
  if (status === "received") return "Svar inkommen";
  if (status === "draft") return "Utkast";
  return "Skickad";
}

function offerStatusLabel(status: Offer["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslagen";
  return "Utkast";
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "Ej satt";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatOptional(value: string | undefined): string {
  return value && value.trim().length > 0 ? value : "Ej angivet";
}

function getContractorOfferForUser(offers: Offer[], userId?: string, userEmail?: string): Offer | null {
  const normalizedUserId = userId?.trim();
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  return (
    offers.find((offer) => {
      if (normalizedUserId && offer.contractorId === normalizedUserId) return true;
      if (normalizedUserEmail && offer.contractorId.toLowerCase() === normalizedUserEmail) return true;
      return false;
    }) ?? null
  );
}

function sumActionEstimates(actions: ProcurementAction[]): number {
  return Math.round(
    actions.reduce((sum, action) => {
      const amount =
        typeof action.estimatedPriceSek === "number" && Number.isFinite(action.estimatedPriceSek)
          ? Math.max(0, action.estimatedPriceSek)
          : 0;
      return sum + amount;
    }, 0)
  );
}

export default function EntreprenorRequestAnalysisPage() {
  const params = useParams<{ requestId: string }>();
  const router = useRouter();
  const { user, ready } = useAuth();
  const requestId = params.requestId;

  const [request, setRequest] = useState<PlatformRequest | null>(null);
  const [projectOffers, setProjectOffers] = useState<Offer[]>([]);
  const [documentsVersion, setDocumentsVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "entreprenor") {
      router.replace(user.role === "brf" ? "/dashboard/brf" : "/dashboard/privat");
    }
  }, [ready, router, user]);

  useEffect(() => {
    const sync = () => {
      const nextRequest = listRequests().find((entry) => entry.id === requestId) ?? null;
      setRequest(nextRequest);
      setProjectOffers(nextRequest ? listLatestOffersByProject(nextRequest.id) : []);
    };

    sync();
    const unsubRequests = subscribeRequests(sync);
    const unsubOffers = subscribeOffers(sync);
    const unsubDocuments = subscribeDocuments(() => {
      setDocumentsVersion((current) => current + 1);
    });
    return () => {
      unsubRequests();
      unsubOffers();
      unsubDocuments();
    };
  }, [requestId]);

  const contractorId = user?.id || user?.email || "entreprenor";
  const currentContractorOffer = useMemo(
    () => getContractorOfferForUser(projectOffers, user?.id, user?.email),
    [projectOffers, user?.email, user?.id]
  );
  const previewOffer = useMemo(() => {
    if (!request) return null;
    return currentContractorOffer ?? buildOfferPreviewFromRequest({ request, contractorId });
  }, [contractorId, currentContractorOffer, request]);
  const areaM2 = useMemo(() => parseAreaM2(request), [request]);
  const quoteDocuments = useMemo(() => {
    const marker = documentsVersion;
    void marker;
    if (!request) return [];
    return listDocumentsByRequest(request.id);
  }, [documentsVersion, request]);
  const latestQuoteDocument = useMemo(
    () => getLatestQuoteDocumentForRequest(quoteDocuments),
    [quoteDocuments]
  );
  const flowSteps = useMemo(
    () =>
      request
        ? buildEntreprenorOfferFlowSteps({
            activeStepId: "request",
            requestId: request.id,
            offerId: currentContractorOffer?.id ?? null,
            generateDocumentId: latestQuoteDocument?.id ?? null,
            previewDocumentId: latestQuoteDocument?.id ?? null,
          })
        : [],
    [currentContractorOffer?.id, latestQuoteDocument?.id, request]
  );

  const actions = useMemo(
    () => request?.scope.actions ?? request?.actions ?? [],
    [request?.actions, request?.scope.actions]
  );
  const totalActionEstimate = useMemo(() => sumActionEstimates(actions), [actions]);
  const actionStatusStats = useMemo(() => {
    const grouped = actions.reduce<Record<ProcurementAction["status"], { count: number; amount: number }>>(
      (acc, action) => {
        const amount =
          typeof action.estimatedPriceSek === "number" && Number.isFinite(action.estimatedPriceSek)
            ? Math.max(0, action.estimatedPriceSek)
            : 0;
        acc[action.status].count += 1;
        acc[action.status].amount += amount;
        return acc;
      },
      {
        Planerad: { count: 0, amount: 0 },
        Eftersatt: { count: 0, amount: 0 },
        Genomförd: { count: 0, amount: 0 },
      }
    );

    return (Object.keys(grouped) as Array<ProcurementAction["status"]>).map((status) => ({
      status,
      count: grouped[status].count,
      amount: Math.round(grouped[status].amount),
    }));
  }, [actions]);

  const maxStatusAmount = useMemo(
    () => actionStatusStats.reduce((max, entry) => Math.max(max, entry.amount), 0),
    [actionStatusStats]
  );

  if (!ready || !user) return null;

  if (!request || !previewOffer) {
    return (
      <DashboardShell
        roleLabel="Entreprenör"
        heading="Förfrågningsanalys"
        subheading="Förfrågan kunde inte hittas."
        cards={[]}
      >
        <section className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#6B5A47]">Ingen förfrågan hittades för ID: {requestId}</p>
          <Link
            href="/dashboard/entreprenor/forfragningar"
            className="mt-3 inline-flex rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Tillbaka till förfrågningar
          </Link>
        </section>
      </DashboardShell>
    );
  }

  const sourceLabel = currentContractorOffer
    ? `Visualisering baseras på din offert (v${currentContractorOffer.version}).`
    : "Visualisering baseras på inskickade åtgärder (pre-offert-preview).";

  const openOrCreateOffer = () => {
    const offer = ensureDraftOfferForRequest({
      request,
      contractorId,
    });
    setNotice(
      currentContractorOffer
        ? `Öppnar befintlig offertanalys (${offerStatusLabel(offer.status)} · v${offer.version}).`
        : `Offertutkast skapat från förfrågan (${offer.lineItems.length} lineItems).`
    );
    router.push(`/dashboard/entreprenor/forfragningar/${offer.id}/analysis`);
  };

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading={`Förfrågningsanalys: ${request.title}`}
      subheading="Förstå underlaget visuellt innan du bygger offert. All kostnadsanalys nedan baseras på strukturerade lineItems från förfrågan/offertutkast."
      cards={[]}
      contextHeader={{
        projectName: request.title,
        roleLabel: "Föranalys",
        statusLabel: `${requestStatusLabel(request.status)} · ${request.audience === "brf" ? "BRF" : "Privat"}`,
      }}
    >
      <section className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/entreprenor/forfragningar"
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Till inkorg
          </Link>
          <Link
            href={`/dashboard/entreprenor/meddelanden?requestId=${encodeURIComponent(request.id)}`}
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Meddelanden
          </Link>
        </div>

        <button
          type="button"
          onClick={openOrCreateOffer}
          className="rounded-xl bg-[#2F2F31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#19191A]"
        >
          {currentContractorOffer ? "Öppna offert & generera svar" : "Generera offertutkast"}
        </button>
      </section>

      <EntreprenorOfferFlowShell
        steps={flowSteps}
        stepperSubheading="Steg 1 fokuserar på att förstå kundens behov. När du skapar ett offertutkast låses steg 2 upp."
      >
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Underlagskvalitet</p>
              <h2 className="text-2xl font-bold text-[#2A2520]">Tydlig föranalys före offert</h2>
              <p className="mt-1 text-sm text-[#6B5A47]">
                {sourceLabel} Fortsätt till offertanalys för att kvalitetssäkra och exportera offert till kund.
              </p>
            </div>
            <span className="rounded-full border border-[#D7C3A8] bg-[#FFF4DE] px-3 py-1 text-xs font-semibold text-[#6B5A47]">
              {request.completeness}% komplett
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EFE8DD]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#F8B62A] to-[#2F2F31]"
              style={{ width: `${Math.max(4, Math.min(100, request.completeness))}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Åtgärder</p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">{actions.length}</p>
              <p className="text-xs text-[#6B5A47]">Poster i omfattningen</p>
            </div>
            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Est. underlagssumma</p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">{formatSek(totalActionEstimate)}</p>
              <p className="text-xs text-[#6B5A47]">Från inskickade åtgärdsrader</p>
            </div>
            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Saknade uppgifter</p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">{request.missingInfo.length}</p>
              <p className="text-xs text-[#6B5A47]">Behöver förtydligas före skick</p>
            </div>
            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Offerter i projekt</p>
              <p className="mt-1 text-lg font-bold text-[#2A2520]">{projectOffers.length}</p>
              <p className="text-xs text-[#6B5A47]">
                {currentContractorOffer ? `Din: ${offerStatusLabel(currentContractorOffer.status)}` : "Ingen från dig ännu"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Projektunderlag</p>
          <h3 className="text-xl font-bold text-[#2A2520]">Snabböverblick</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-[#8C7860]">Plats</dt>
              <dd className="font-semibold text-[#2A2520]">{request.location}</dd>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-[#8C7860]">Budget</dt>
              <dd className="font-semibold text-[#2A2520]">
                {request.snapshot ? formatSnapshotBudget(request.snapshot) : request.budgetRange}
              </dd>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-[#8C7860]">Startfönster</dt>
              <dd className="font-semibold text-[#2A2520]">
                {request.snapshot ? formatSnapshotTimeline(request.snapshot) : request.desiredStart}
              </dd>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-[#8C7860]">Riskprofil</dt>
              <dd className="font-semibold text-[#2A2520]">
                {request.snapshot ? toSwedishRiskLabel(request.snapshot.riskProfile.level) : request.riskProfile || "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-[#8C7860]">Svarstid</dt>
              <dd className="font-semibold text-[#2A2520]">{formatDate(request.replyDeadline)}</dd>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-[#8C7860]">Filer / mottagare</dt>
              <dd className="font-semibold text-[#2A2520]">
                {request.documentSummary?.totalFiles ?? request.files?.length ?? 0} filer · {(request.recipients ?? []).length} mottagare
              </dd>
            </div>
          </dl>
        </article>
        </section>

        <section className="mt-4">
        <OfferSummaryCards offer={previewOffer} areaM2={areaM2} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <OfferCategoryChart offer={previewOffer} />
        <OfferTypeChart offer={previewOffer} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <OfferTopDrivers offer={previewOffer} />
        <OfferTimelineChart offer={previewOffer} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Risker & frågor</p>
          <h3 className="text-xl font-bold text-[#2A2520]">Underlag att verifiera före offert</h3>

          {request.missingInfo.length === 0 ? (
            <p className="mt-3 rounded-xl border border-[#D7E8D2] bg-[#F3FAF0] px-3 py-2 text-sm text-[#355C38]">
              Inga markerade kompletteringar just nu.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {request.missingInfo.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Fastighetsdelning</p>
              <p className="mt-1 font-semibold text-[#2A2520]">
                {request.sharingApproved ? "Godkänd" : "Ej godkänd"}
              </p>
              <p className="text-xs text-[#6B5A47]">
                {request.sharingApproved
                  ? `Godkänd ${formatDate(request.sharingApprovedAt)}`
                  : "Kan begränsa analysdjup för entreprenör."}
              </p>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Kontakt</p>
              <p className="mt-1 font-semibold text-[#2A2520]">
                {formatOptional(request.propertySnapshot?.contactName)}
              </p>
              <p className="text-xs text-[#6B5A47]">
                {[request.propertySnapshot?.contactEmail, request.propertySnapshot?.contactPhone]
                  .filter((value): value is string => Boolean(value && value.trim().length > 0))
                  .join(" · ") || "Ej angivet"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Åtgärdsstatus</p>
          <h3 className="text-xl font-bold text-[#2A2520]">Fördelning i underlaget</h3>
          <p className="mt-1 text-sm text-[#6B5A47]">
            Visar antal och estimerad volym per status i beställarens åtgärdslista.
          </p>

          <div className="mt-4 space-y-3">
            {actionStatusStats.map((entry) => {
              const width = maxStatusAmount > 0 ? Math.max(6, (entry.amount / maxStatusAmount) * 100) : 0;
              const barColor =
                entry.status === "Planerad"
                  ? "bg-[#F8B62A]"
                  : entry.status === "Eftersatt"
                    ? "bg-[#2F2F31]"
                    : "bg-[#22C55E]";
              return (
                <div key={entry.status} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#2A2520]">{entry.status}</p>
                      <p className="text-xs text-[#6B5A47]">{entry.count} åtgärder</p>
                    </div>
                    <p className="font-semibold text-[#2A2520]">{formatSek(entry.amount)}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#EFE8DD]">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
        </section>

        <section className="mt-4 rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Omfattning</p>
            <h3 className="text-xl font-bold text-[#2A2520]">Åtgärder som blir grund för offertens lineItems</h3>
            <p className="mt-1 text-sm text-[#6B5A47]">
              Granska de viktigaste posterna här och gå sedan vidare till offertanalysen för att justera struktur, risker och export.
            </p>
          </div>
          <button
            type="button"
            onClick={openOrCreateOffer}
            className="rounded-xl border border-[#2F2F31] bg-white px-4 py-2 text-sm font-semibold text-[#2F2F31] hover:bg-[#F4F1EC]"
          >
            {currentContractorOffer ? "Fortsätt i offertanalys" : "Skapa offert från underlag"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E8E3DC] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                <th className="px-2 py-2">Åtgärd</th>
                <th className="px-2 py-2">Kategori</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">År</th>
                <th className="px-2 py-2">Estimerat värde</th>
                <th className="px-2 py-2">Detaljer</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} className="border-b border-[#EFE8DD]">
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">{action.title}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{action.category || "Övrigt"}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{action.status}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{action.plannedYear || "—"}</td>
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">
                    {formatSek(action.estimatedPriceSek || 0)}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#6B5A47]">
                    {action.details ||
                      (action.extraDetails && action.extraDetails.length > 0
                        ? action.extraDetails
                            .slice(0, 2)
                            .map((detail) => `${detail.label}: ${detail.value}`)
                            .join(" · ")
                        : "—")}
                  </td>
                </tr>
              ))}
              {actions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-sm text-[#6B5A47]">
                    Inga åtgärder registrerade i förfrågan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </section>
      </EntreprenorOfferFlowShell>

      {notice && (
        <p className="mt-3 rounded-xl border border-[#D7E8D2] bg-[#F3FAF0] px-3 py-2 text-sm text-[#355C38]">
          {notice}
        </p>
      )}
    </DashboardShell>
  );
}
