"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { OfferCategoryChart } from "../../../../components/offers/OfferCategoryChart";
import { OfferComparison } from "../../../../components/offers/OfferComparison";
import { OfferSummaryCards } from "../../../../components/offers/OfferSummaryCards";
import { OfferTimelineChart } from "../../../../components/offers/OfferTimelineChart";
import { OfferTopDrivers } from "../../../../components/offers/OfferTopDrivers";
import { OfferTypeChart } from "../../../../components/offers/OfferTypeChart";
import { DashboardShell } from "../../../../components/dashboard-shell";
import { useAuth } from "../../../../components/auth-context";
import { Breadcrumbs } from "../../../../components/ui/breadcrumbs";
import {
  analyzeOfferForCustomer,
  simulateOfferScenario,
  type StructuredOfferAiResult,
} from "../../../../lib/ai-utilities";
import { exportOfferToXlsx } from "../../../../lib/offers/export";
import {
  getOfferById,
  listLatestOffersByProject,
  subscribeOffers,
} from "../../../../lib/offers/store";
import type { Offer } from "../../../../lib/offers/types";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../../lib/requests-store";
import { routes } from "../../../../lib/routes";

function parseAreaM2(request: PlatformRequest | null): number | undefined {
  const raw = request?.propertySnapshot?.areaSummary;
  if (!raw) return undefined;
  const match = raw.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1].replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function statusLabel(status: Offer["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslagen";
  return "Utkast";
}

export default function PrivatOfferDetailsPage() {
  const params = useParams<{ offerId: string }>();
  const router = useRouter();
  const { user, ready } = useAuth();
  const offerId = params.offerId;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [request, setRequest] = useState<PlatformRequest | null>(null);
  const [projectOffers, setProjectOffers] = useState<Offer[]>([]);
  const [aiResultState, setAiResultState] = useState<{
    offerId: string;
    result: StructuredOfferAiResult;
  } | null>(null);
  const [simulationResult, setSimulationResult] = useState<StructuredOfferAiResult | null>(null);
  const [scenarioLineItemId, setScenarioLineItemId] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=privat");
      return;
    }
    if (user.role === "brf") {
      router.replace(routes.brf.overview());
      return;
    }
    if (user.role === "entreprenor") {
      router.replace(routes.entreprenor.overview());
    }
  }, [ready, router, user]);

  useEffect(() => {
    const sync = () => {
      const nextOffer = getOfferById(offerId);
      setOffer(nextOffer);
      if (!nextOffer) {
        setRequest(null);
        setProjectOffers([]);
        return;
      }
      setRequest(listRequests().find((entry) => entry.id === nextOffer.projectId) ?? null);
      setProjectOffers(listLatestOffersByProject(nextOffer.projectId));
    };

    sync();
    const unsubOffers = subscribeOffers(sync);
    const unsubRequests = subscribeRequests(sync);
    return () => {
      unsubOffers();
      unsubRequests();
    };
  }, [offerId]);

  useEffect(() => {
    let cancelled = false;
    if (!offer) return;

    const run = async () => {
      const result = await analyzeOfferForCustomer(offer);
      if (!cancelled) {
        setAiResultState({ offerId: offer.id, result });
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [offer]);

  const areaM2 = useMemo(() => parseAreaM2(request), [request]);
  const effectiveScenarioLineItemId = useMemo(() => {
    if (!offer) return "";
    if (scenarioLineItemId && offer.lineItems.some((lineItem) => lineItem.id === scenarioLineItemId)) {
      return scenarioLineItemId;
    }
    return offer.lineItems[0]?.id ?? "";
  }, [offer, scenarioLineItemId]);
  const aiResult =
    offer && aiResultState?.offerId === offer.id ? aiResultState.result : null;

  if (!ready || !user) return null;

  if (!offer) {
    return (
      <DashboardShell
        roleLabel="Privatperson"
        heading="Offert"
        subheading="Offerten kunde inte hittas."
        cards={[]}
      >
        <section className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#6B5A47]">Ingen offert hittades för ID: {offerId}</p>
          <Link
            href={routes.privatperson.requestsIndex()}
            className="mt-3 inline-flex rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Tillbaka till förfrågningar
          </Link>
        </section>
      </DashboardShell>
    );
  }

  const canCompare = projectOffers.length > 1;
  const requestsIndexHref = routes.privatperson.requestsIndex({ requestId: request?.id ?? offer.projectId });

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading={`Offertvy: ${request?.title ?? offer.projectId}`}
      subheading="Datadriven offertöversikt byggd på lineItems: kostnadsfördelning, drivare, tidsprofil och jämförelse."
      cards={[]}
      contextHeader={{
        projectName: request?.title ?? offer.projectId,
        roleLabel: "Kundvy",
        statusLabel: `${statusLabel(offer.status)} · v${offer.version}`,
      }}
    >
      <section className="mb-4 rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
        <Breadcrumbs
          items={[
            { href: requestsIndexHref, label: "Förfrågningar" },
            { label: request?.title ?? `Offert ${offer.version}` },
          ]}
        />
        <Link
          href={requestsIndexHref}
          className="inline-flex rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
        >
          Till förfrågningsöversikt
        </Link>
      </section>

      <section className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link
            href={requestsIndexHref}
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Tillbaka
          </Link>
          {request && (
            <Link
              href={routes.privatperson.timelineIndex({ projectId: request.id })}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Projektets tidslinje
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const fileName = exportOfferToXlsx({
              offer,
              comparisonOffers: projectOffers,
            });
            setNotice(`Excel-export skapad: ${fileName}`);
          }}
          className="rounded-xl bg-[#2F2F31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#19191A]"
        >
          Exportera Excel (.xlsx)
        </button>
      </section>

      <OfferSummaryCards offer={offer} areaM2={areaM2} />

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <OfferCategoryChart offer={offer} />
        <OfferTypeChart offer={offer} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <OfferTopDrivers offer={offer} />
        <OfferTimelineChart offer={offer} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <OfferComparison offers={projectOffers} selectedOfferId={offer.id} />

        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">AI-analys (kund)</p>
          <h3 className="text-xl font-bold text-[#2A2520]">Förklaring och scenario</h3>
          <p className="mt-2 text-xs text-[#6B5A47]">
            AI analyserar endast lineItems och föreslår förbättringar. Offerten ändras aldrig automatiskt.
          </p>

          {aiResult ? (
            <>
              <p className="mt-3 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2 text-sm text-[#2A2520]">
                {aiResult.explanation}
              </p>

              {aiResult.risks.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Risker</p>
                  <ul className="mt-1 space-y-1">
                    {aiResult.risks.map((risk) => (
                      <li
                        key={risk}
                        className="rounded-lg border border-[#F0D8D0] bg-[#FFF5F2] px-2 py-1.5 text-sm text-[#7A3F2F]"
                      >
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiResult.suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Förslag</p>
                  <ul className="mt-1 space-y-1">
                    {aiResult.suggestions.map((suggestion) => (
                      <li
                        key={suggestion}
                        className="rounded-lg border border-[#E8E3DC] bg-[#FAF8F5] px-2 py-1.5 text-sm text-[#2A2520]"
                      >
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-[#6B5A47]">Analyserar offert...</p>
          )}

          <div className="mt-4 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
              Simulera (utan ändring)
            </p>
            <label className="mt-2 block text-xs font-semibold text-[#6B5A47]">
              Välj lineItem
              <select
                value={effectiveScenarioLineItemId}
                onChange={(event) => setScenarioLineItemId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-2 text-sm text-[#2A2520]"
              >
                {offer.lineItems.map((lineItem) => (
                  <option key={lineItem.id} value={lineItem.id}>
                    {lineItem.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!effectiveScenarioLineItemId}
              onClick={async () => {
                const lineItem = offer.lineItems.find((entry) => entry.id === effectiveScenarioLineItemId);
                if (!lineItem) return;
                const result = await simulateOfferScenario(offer, {
                  updateQuantity: {
                    lineItemId: lineItem.id,
                    quantity: Math.max(0, Number((lineItem.quantity * 0.9).toFixed(2))),
                  },
                });
                setSimulationResult(result);
              }}
              className="mt-3 rounded-lg border border-[#D2C5B5] bg-white px-3 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8] disabled:opacity-60"
            >
              Simulera -10% mängd på vald rad
            </button>

            {simulationResult?.simulatedTotals && (
              <div className="mt-3 rounded-lg border border-[#D7C3A8] bg-[#FFF9F1] px-3 py-2 text-sm">
                <p className="font-semibold text-[#2A2520]">Simulerad totalsumma</p>
                <p className="text-[#5D5245]">Ex moms: {simulationResult.simulatedTotals.exVat.toLocaleString("sv-SE")} kr</p>
                <p className="text-[#5D5245]">Moms: {simulationResult.simulatedTotals.vat.toLocaleString("sv-SE")} kr</p>
                <p className="text-[#5D5245]">Inkl moms: {simulationResult.simulatedTotals.incVat.toLocaleString("sv-SE")} kr</p>
              </div>
            )}
          </div>
        </article>
      </section>

      {canCompare && (
        <p className="mt-3 text-xs text-[#6B5A47]">
          Jämförelsen visar senaste versionen per entreprenör för detta projekt.
        </p>
      )}

      {notice && (
        <p className="mt-3 rounded-xl border border-[#D7E8D2] bg-[#F3FAF0] px-3 py-2 text-sm text-[#355C38]">
          {notice}
        </p>
      )}
    </DashboardShell>
  );
}
