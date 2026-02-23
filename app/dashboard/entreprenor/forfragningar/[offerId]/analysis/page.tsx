"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { OfferInternalAnalysis } from "../../../../../components/offers/OfferInternalAnalysis";
import { OfferInternalCostEditor } from "../../../../../components/offers/OfferInternalCostEditor";
import { DashboardShell } from "../../../../../components/dashboard-shell";
import { useAuth } from "../../../../../components/auth-context";
import { EntreprenorOfferFlowShell } from "../../../../../components/offers/EntreprenorOfferFlowShell";
import {
  analyzeOfferForContractor,
  type StructuredOfferAiResult,
} from "../../../../../lib/ai-utilities";
import { listDocumentsByRequest, subscribeDocuments } from "../../../../../lib/documents-store";
import {
  calculateInternalCostLineTotal,
  calculateOfferProfitabilitySummary,
  recomputeOffer,
} from "../../../../../lib/offers/calculations";
import { exportOfferToXlsx } from "../../../../../lib/offers/export";
import {
  createDefaultInternalCostLines,
  getOfferById,
  saveOffer,
  setOfferStatus,
  subscribeOffers,
} from "../../../../../lib/offers/store";
import {
  buildEntreprenorOfferFlowSteps,
  getLatestQuoteDocumentForRequest,
} from "../../../../../lib/offers/flow";
import type { Offer, OfferInternalCostLine } from "../../../../../lib/offers/types";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../../../lib/requests-store";

function formatSek(value: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(Math.round(value))} kr`;
}

function cloneCostLines(lines: OfferInternalCostLine[]): OfferInternalCostLine[] {
  return lines.map((line) => ({ ...line }));
}

function normalizedCostLinesFingerprint(lines: OfferInternalCostLine[]): string {
  return JSON.stringify(
    lines.map((line) => ({
      id: line.id,
      label: line.label.trim(),
      category: line.category,
      quantity: Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0,
      unit: line.unit.trim(),
      unitCost: Number.isFinite(line.unitCost) ? Math.max(0, line.unitCost) : 0,
      notes: line.notes?.trim() || "",
    }))
  );
}

function nextCostLineId() {
  return `cost-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusLabel(status: Offer["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslagen";
  return "Utkast";
}

export default function EntreprenorOfferAnalysisPage() {
  const params = useParams<{ offerId: string }>();
  const router = useRouter();
  const { user, ready } = useAuth();
  const offerId = params.offerId;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [request, setRequest] = useState<PlatformRequest | null>(null);
  const [aiResultState, setAiResultState] = useState<{
    offerId: string;
    result: StructuredOfferAiResult;
  } | null>(null);
  const [costEditorState, setCostEditorState] = useState<{
    offerId: string;
    lines: OfferInternalCostLine[];
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSavingCostEstimate, setIsSavingCostEstimate] = useState(false);
  const [isSendingOffer, setIsSendingOffer] = useState(false);
  const [documentsVersion, setDocumentsVersion] = useState(0);

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
      const nextOffer = getOfferById(offerId);
      setOffer(nextOffer);
      setRequest(nextOffer ? listRequests().find((entry) => entry.id === nextOffer.projectId) ?? null : null);
    };

    sync();
    const unsubOffers = subscribeOffers(sync);
    const unsubRequests = subscribeRequests(sync);
    const unsubDocuments = subscribeDocuments(() => {
      setDocumentsVersion((current) => current + 1);
    });
    return () => {
      unsubOffers();
      unsubRequests();
      unsubDocuments();
    };
  }, [offerId]);

  useEffect(() => {
    let cancelled = false;
    if (!offer) return;

    const run = async () => {
      const result = await analyzeOfferForContractor(offer);
      if (!cancelled) {
        setAiResultState({ offerId: offer.id, result });
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [offer]);

  const aiResult = offer && aiResultState?.offerId === offer.id ? aiResultState.result : null;

  const persistedCostLines = useMemo(() => {
    if (!offer) return [];
    const saved = offer.internalEstimate?.costLines ?? [];
    const source = saved.length > 0 ? saved : createDefaultInternalCostLines();
    return cloneCostLines(source);
  }, [offer]);

  const draftCostLines = useMemo(() => {
    if (!offer) return [];
    if (costEditorState?.offerId === offer.id) {
      return costEditorState.lines;
    }
    return persistedCostLines;
  }, [costEditorState, offer, persistedCostLines]);

  const costDraftDirty = useMemo(() => {
    if (!offer) return false;
    return normalizedCostLinesFingerprint(draftCostLines) !== normalizedCostLinesFingerprint(persistedCostLines);
  }, [draftCostLines, offer, persistedCostLines]);

  const offerWithDraftCosts = useMemo(() => {
    if (!offer) return null;
    return recomputeOffer({
      ...offer,
      internalEstimate: {
        costLines: cloneCostLines(draftCostLines),
        updatedAt: offer.internalEstimate?.updatedAt,
      },
    });
  }, [draftCostLines, offer]);

  const profitability = useMemo(
    () => (offerWithDraftCosts ? calculateOfferProfitabilitySummary(offerWithDraftCosts) : null),
    [offerWithDraftCosts]
  );
  const quoteDocuments = useMemo(() => {
    const marker = documentsVersion;
    void marker;
    if (!offer) return [];
    return listDocumentsByRequest(offer.projectId);
  }, [documentsVersion, offer]);
  const latestQuoteDocument = useMemo(
    () => getLatestQuoteDocumentForRequest(quoteDocuments),
    [quoteDocuments]
  );
  const flowSteps = useMemo(
    () =>
      offer
        ? buildEntreprenorOfferFlowSteps({
            activeStepId: "analysis",
            requestId: offer.projectId,
            offerId: offer.id,
            generateDocumentId: latestQuoteDocument?.id ?? null,
            previewDocumentId: latestQuoteDocument?.id ?? null,
          })
        : [],
    [latestQuoteDocument?.id, offer]
  );

  const setDraftLines = (nextLines: OfferInternalCostLine[]) => {
    if (!offer) return;
    setCostEditorState({
      offerId: offer.id,
      lines: nextLines,
    });
  };

  const updateDraftCostLine = (lineId: string, patch: Partial<OfferInternalCostLine>) => {
    const next = draftCostLines.map((line) => {
      if (line.id !== lineId) return line;
      const merged = { ...line, ...patch };
      const quantity = Number.isFinite(merged.quantity) ? Math.max(0, merged.quantity) : 0;
      const unitCost = Number.isFinite(merged.unitCost) ? Math.max(0, merged.unitCost) : 0;
      return {
        ...merged,
        quantity,
        unitCost,
        total: calculateInternalCostLineTotal(quantity, unitCost),
      };
    });
    setDraftLines(next);
  };

  const addDraftCostLine = () => {
    setDraftLines([
      ...draftCostLines,
      {
        id: nextCostLineId(),
        label: "Ny kostnadsrad",
        category: "ovrigt",
        quantity: 0,
        unit: "st",
        unitCost: 0,
        total: 0,
      },
    ]);
  };

  const removeDraftCostLine = (lineId: string) => {
    const next = draftCostLines.filter((line) => line.id !== lineId);
    setDraftLines(next.length > 0 ? next : createDefaultInternalCostLines());
  };

  const resetDraftCostLines = () => {
    if (!offer) return;
    setCostEditorState({
      offerId: offer.id,
      lines: cloneCostLines(persistedCostLines),
    });
    setNotice("Intern kalkyl återställd till senast sparade värden.");
  };

  const persistCostEstimate = (): { offer: Offer; createdNewVersion: boolean } | null => {
    if (!offerWithDraftCosts || !offer) return null;
    const currentOfferId = offer.id;
    const result = saveOffer({
      ...offerWithDraftCosts,
      internalEstimate: {
        costLines: cloneCostLines(draftCostLines),
        updatedAt: new Date().toISOString(),
      },
    });
    setCostEditorState({
      offerId: result.offer.id,
      lines: cloneCostLines(result.offer.internalEstimate?.costLines ?? []),
    });
    if (result.offer.id !== currentOfferId) {
      router.replace(`/dashboard/entreprenor/forfragningar/${result.offer.id}/analysis`);
    }
    return result;
  };

  const handleSaveCostEstimate = () => {
    setIsSavingCostEstimate(true);
    try {
      const result = persistCostEstimate();
      if (!result) return;
      setNotice(
        result.createdNewVersion
          ? `Kalkyl sparad som ny offertversion (v${result.offer.version}) eftersom tidigare version var skickad.`
          : `Intern kalkyl sparad för offert v${result.offer.version}.`
      );
    } finally {
      setIsSavingCostEstimate(false);
    }
  };

  const handleSendOfferToCustomer = () => {
    if (!offerWithDraftCosts) return;
    setIsSendingOffer(true);
    try {
      let targetOffer = offerWithDraftCosts;

      if (costDraftDirty) {
        const saved = persistCostEstimate();
        if (!saved) return;
        targetOffer = saved.offer;
      }

      const sent = setOfferStatus(targetOffer.id, "sent");
      if (!sent) {
        setNotice("Kunde inte markera offerten som skickad.");
        return;
      }
      setNotice(
        `Offert v${sent.version} markerad som skickad till kund. Nästa steg: generera/uppdatera offertdokument i dokumentgeneratorn.`
      );
    } finally {
      setIsSendingOffer(false);
    }
  };

  if (!ready || !user) return null;

  if (!offer) {
    return (
      <DashboardShell
        roleLabel="Entreprenör"
        heading="Intern offertanalys"
        subheading="Offerten kunde inte hittas."
        cards={[]}
      >
        <section className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#6B5A47]">Ingen offert hittades för ID: {offerId}</p>
        </section>
      </DashboardShell>
    );
  }

  const analysisOffer = offerWithDraftCosts ?? offer;
  const hasInternalCostData = (profitability?.internalCostExVat ?? 0) > 0;

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading={`Intern analys: ${request?.title ?? offer.projectId}`}
      subheading="Riktig anbudskalkyl och lönsamhetsvisualisering före utskick. Vinst/marginal baseras endast på sparad intern kostnadsdata."
      cards={[]}
      contextHeader={{
        projectName: request?.title ?? offer.projectId,
        roleLabel: "Intern vy",
        statusLabel: `Offert v${offer.version} · ${statusLabel(offer.status)}`,
      }}
    >
      <section className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/entreprenor/forfragningar"
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Tillbaka till förfrågningar
          </Link>
          <Link
            href={`/dashboard/entreprenor/forfragningar/request/${encodeURIComponent(offer.projectId)}`}
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Förfrågningsanalys
          </Link>
          <Link
            href={
              latestQuoteDocument
                ? `/dashboard/entreprenor/dokument/${encodeURIComponent(latestQuoteDocument.id)}`
                : `/dashboard/entreprenor/dokument?requestId=${encodeURIComponent(offer.projectId)}`
            }
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Generera offertdokument
          </Link>
          {latestQuoteDocument && (
            <Link
              href={`/dashboard/entreprenor/dokument/${encodeURIComponent(latestQuoteDocument.id)}`}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Öppna live preview
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const fileName = exportOfferToXlsx({ offer: analysisOffer });
              setNotice(`Excel-export skapad: ${fileName}`);
            }}
            className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
          >
            Exportera Excel
          </button>
          <button
            type="button"
            onClick={handleSendOfferToCustomer}
            disabled={isSendingOffer || analysisOffer.lineItems.length === 0}
            className="rounded-xl bg-[#2F2F31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#19191A] disabled:opacity-60"
          >
            {isSendingOffer ? "Skickar..." : "Skicka offert till kund"}
          </button>
        </div>
      </section>

      <EntreprenorOfferFlowShell
        steps={flowSteps}
        stepperSubheading="Steg 2 fokuserar på kalkyl, marginal och risk. Gå vidare till steg 3 för att skapa/redigera offertdokument."
      >
        <section className="mb-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <OfferInternalCostEditor
          lines={draftCostLines}
          dirty={costDraftDirty}
          isSaving={isSavingCostEstimate}
          onChangeLine={updateDraftCostLine}
          onAddLine={addDraftCostLine}
          onRemoveLine={removeDraftCostLine}
          onSave={handleSaveCostEstimate}
          onReset={resetDraftCostLines}
        />

        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Nästa steg</p>
          <h3 className="text-xl font-bold text-[#2A2520]">Från kalkyl till kundoffert</h3>
          <ol className="mt-3 space-y-2 text-sm text-[#2A2520]">
            <li className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              1. Fyll i och spara intern kalkyl (riktiga kostnader).
            </li>
            <li className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              2. Granska vinst/marginal i visualiseringen nedan.
            </li>
            <li className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              3. Öppna dokumentgeneratorn och skapa/uppdatera offert-PDF.
            </li>
            <li className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              4. Markera offerten som skickad till kund när du är klar.
            </li>
          </ol>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Status</p>
              <p className="mt-1 font-bold text-[#2A2520]">{statusLabel(offer.status)}</p>
              <p className="text-xs text-[#6B5A47]">Offert v{offer.version}</p>
            </div>
            <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[#8C7860]">Kalkylstatus</p>
              <p className="mt-1 font-bold text-[#2A2520]">
                {costDraftDirty ? "Ej sparade ändringar" : "Sparad"}
              </p>
              <p className="text-xs text-[#6B5A47]">
                {hasInternalCostData ? `Kostnadsbas: ${formatSek(profitability?.internalCostExVat ?? 0)}` : "Ingen kostnadsbas ännu"}
              </p>
            </div>
          </div>

          {!hasInternalCostData && (
            <p className="mt-4 rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
              Vinstvyn blir exakt först när intern kostnadsdata är ifylld och sparad.
            </p>
          )}
        </article>
        </section>

        <OfferInternalAnalysis offer={analysisOffer} aiResult={aiResult ?? undefined} />

        <section className="mt-4 rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-[#2A2520]">LineItems (källdata för intäkt)</h3>
        <p className="mt-1 text-sm text-[#6B5A47]">
          Intäktssidan i kalkylen baseras på dessa offertrader. Vinst = intäkt (dessa rader) minus intern kostnad (kalkyleditorn ovan).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E8E3DC] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                <th className="px-2 py-2">Titel</th>
                <th className="px-2 py-2">Kategori</th>
                <th className="px-2 py-2">Typ</th>
                <th className="px-2 py-2">Mängd</th>
                <th className="px-2 py-2">Enhet</th>
                <th className="px-2 py-2">Á-pris</th>
                <th className="px-2 py-2">Summa</th>
              </tr>
            </thead>
            <tbody>
              {analysisOffer.lineItems.map((lineItem) => (
                <tr key={lineItem.id} className="border-b border-[#EFE8DD]">
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">{lineItem.title}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{lineItem.category}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{lineItem.type}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{lineItem.quantity}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{lineItem.unit}</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{formatSek(lineItem.unitPrice)}</td>
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">{formatSek(lineItem.total)}</td>
                </tr>
              ))}
              {analysisOffer.lineItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-sm text-[#6B5A47]">
                    Inga lineItems i offerten ännu.
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
