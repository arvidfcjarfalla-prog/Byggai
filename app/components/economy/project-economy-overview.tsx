"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useActiveProject } from "../active-project-context";
import {
  listDocumentsByRequest,
  subscribeDocuments,
  type DocumentField,
  type PlatformDocument,
} from "../../lib/documents-store";
import { listLatestOffersByProject, subscribeOffers } from "../../lib/offers/store";
import type { Offer } from "../../lib/offers/types";
import { listChangeOrdersByProject, subscribeChangeOrders } from "../../lib/change-orders/store";
import type { ChangeOrderRecord } from "../../lib/state-machine";
import { routes } from "../../lib/routes";

type WorkspaceRole = "entreprenor" | "brf" | "privatperson";

function formatSek(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("sv-SE").format(Math.round(value))} kr`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function documentTypeLabel(type: PlatformDocument["type"]): string {
  if (type === "quote") return "Offert";
  if (type === "contract") return "Avtal";
  return "ÄTA";
}

function documentStatusLabel(status: PlatformDocument["status"]): string {
  if (status === "accepted") return "Signerad / godkänd";
  if (status === "sent") return "Skickad";
  if (status === "rejected") return "Avvisad";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

function offerStatusLabel(status: Offer["status"]): string {
  if (status === "accepted") return "Accepterad";
  if (status === "sent") return "Skickad";
  if (status === "rejected") return "Avslagen";
  return "Utkast";
}

function changeOrderStatusLabel(status: ChangeOrderRecord["status"]): string {
  if (status === "APPROVED") return "Godkänd";
  if (status === "REJECTED") return "Avvisad";
  if (status === "ESCALATED") return "Eskalering";
  return "Väntar svar";
}

function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/sek/gi, "")
    .replace(/kr/gi, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDocumentFieldValue(document: PlatformDocument, fieldIds: string[]): DocumentField["value"] | undefined {
  for (const section of document.sections) {
    for (const field of section.fields) {
      if (fieldIds.includes(field.id)) return field.value;
    }
  }
  return undefined;
}

function extractCommercialAmountIncVat(document: PlatformDocument): number | null {
  if (document.type === "contract") {
    return parseMoney(getDocumentFieldValue(document, ["compensation", "price-total"]));
  }
  if (document.type === "quote") {
    return parseMoney(getDocumentFieldValue(document, ["total-price", "price-total", "compensation"]));
  }
  return null;
}

function extractAtaAmountIncVat(document: PlatformDocument): number | null {
  return parseMoney(getDocumentFieldValue(document, ["price-total"]));
}

function acceptedAtSortValue(document: PlatformDocument): number {
  const iso = document.acceptedAt ?? document.updatedAt ?? document.createdAt;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function documentDetailHref(role: WorkspaceRole, documentId: string, requestId: string): string {
  if (role === "entreprenor") return routes.entreprenor.documentDetail({ documentId, requestId });
  if (role === "brf") return routes.brf.documentDetail({ documentId, requestId });
  return routes.privatperson.documentDetail({ documentId, requestId });
}

function statusPillTone(kind: "ok" | "warn" | "muted" | "info"): string {
  if (kind === "ok") return "border-[#CFE6CC] bg-[#F2FAF0] text-[#355C38]";
  if (kind === "warn") return "border-[#F2D6B0] bg-[#FFF8EE] text-[#8A5B20]";
  if (kind === "info") return "border-[#D7E4F3] bg-[#F2F7FC] text-[#2E5F8A]";
  return "border-[#D9D1C6] bg-[#FAF8F5] text-[#6B5A47]";
}

export function ProjectEconomyOverview({ role }: { role: WorkspaceRole }) {
  const { activeProject } = useActiveProject();
  const [offersVersion, setOffersVersion] = useState(0);
  const [documentsVersion, setDocumentsVersion] = useState(0);
  const [changeOrdersVersion, setChangeOrdersVersion] = useState(0);

  useEffect(() => subscribeOffers(() => setOffersVersion((v) => v + 1)), []);
  useEffect(() => subscribeDocuments(() => setDocumentsVersion((v) => v + 1)), []);
  useEffect(() => subscribeChangeOrders(() => setChangeOrdersVersion((v) => v + 1)), []);

  const economics = useMemo(() => {
    const marker = `${offersVersion}-${documentsVersion}-${changeOrdersVersion}`;
    void marker;
    if (!activeProject) return null;

    const projectId = activeProject.id;
    const offers = listLatestOffersByProject(projectId);
    const documents = listDocumentsByRequest(projectId).sort((a, b) => acceptedAtSortValue(b) - acceptedAtSortValue(a));
    const changeOrders = listChangeOrdersByProject(projectId);

    const acceptedOffer = offers.find((offer) => offer.status === "accepted") ?? null;
    const latestSentOffer = offers.find((offer) => offer.status === "sent") ?? null;

    const acceptedContractDoc =
      documents.filter((doc) => doc.type === "contract" && doc.status === "accepted")[0] ?? null;
    const acceptedQuoteDoc =
      documents.filter((doc) => doc.type === "quote" && doc.status === "accepted")[0] ?? null;
    const acceptedAtaDocs = documents.filter((doc) => doc.type === "ate" && doc.status === "accepted");

    const contractDocAmount = acceptedContractDoc ? extractCommercialAmountIncVat(acceptedContractDoc) : null;
    const quoteDocAmount = acceptedQuoteDoc ? extractCommercialAmountIncVat(acceptedQuoteDoc) : null;

    const baseAmountIncVat =
      contractDocAmount ??
      quoteDocAmount ??
      acceptedOffer?.totals.incVat ??
      latestSentOffer?.totals.incVat ??
      null;
    const baseAmountExVat = acceptedOffer?.totals.exVat ?? latestSentOffer?.totals.exVat ?? null;
    const baseVat = acceptedOffer?.totals.vat ?? latestSentOffer?.totals.vat ?? null;

    const signedAtaDocsTotal = acceptedAtaDocs.reduce((sum, doc) => sum + (extractAtaAmountIncVat(doc) ?? 0), 0);
    const hasSignedAtaPrice = acceptedAtaDocs.some((doc) => extractAtaAmountIncVat(doc) !== null);

    const approvedChangeOrders = changeOrders.filter((co) => co.status === "APPROVED");
    const pendingChangeOrders = changeOrders.filter((co) => co.status === "PENDING");
    const escalatedChangeOrders = changeOrders.filter((co) => co.status === "ESCALATED");
    const rejectedChangeOrders = changeOrders.filter((co) => co.status === "REJECTED");

    const approvedChangeOrdersTotal = approvedChangeOrders.reduce((sum, co) => sum + co.costEstimateSek, 0);
    const openChangeOrdersTotal = [...pendingChangeOrders, ...escalatedChangeOrders].reduce(
      (sum, co) => sum + co.costEstimateSek,
      0
    );

    const bindingAtaAmountIncVat =
      hasSignedAtaPrice ? signedAtaDocsTotal : approvedChangeOrdersTotal > 0 ? approvedChangeOrdersTotal : 0;
    const bindingTotalIncVat = (baseAmountIncVat ?? 0) + bindingAtaAmountIncVat;

    const governingSource =
      acceptedContractDoc
        ? { kind: "contract_doc" as const, label: "Signerat avtal", document: acceptedContractDoc }
        : acceptedQuoteDoc
          ? { kind: "quote_doc" as const, label: "Signerad offert", document: acceptedQuoteDoc }
          : acceptedOffer
            ? { kind: "accepted_offer" as const, label: "Accepterad offert (utan signerat avtal)", offer: acceptedOffer }
            : latestSentOffer
              ? { kind: "sent_offer" as const, label: "Senast skickad offert (ej accepterad)", offer: latestSentOffer }
              : null;

    return {
      offers,
      documents,
      changeOrders,
      acceptedOffer,
      latestSentOffer,
      acceptedContractDoc,
      acceptedQuoteDoc,
      acceptedAtaDocs,
      approvedChangeOrders,
      pendingChangeOrders,
      escalatedChangeOrders,
      rejectedChangeOrders,
      approvedChangeOrdersTotal,
      openChangeOrdersTotal,
      baseAmountIncVat,
      baseAmountExVat,
      baseVat,
      signedAtaDocsTotal,
      bindingAtaAmountIncVat,
      bindingTotalIncVat,
      governingSource,
    };
  }, [activeProject, changeOrdersVersion, documentsVersion, offersVersion]);

  if (!activeProject) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#2A2520]">Ekonomiöversikt</h2>
        <p className="mt-2 text-sm text-[#766B60]">
          Välj ett aktivt projekt i vänsterspalten för att se ekonomi, avtal, ÄTA och total kostnadsbild.
        </p>
      </section>
    );
  }

  if (!economics) return null;

  const hasSignedContract = Boolean(economics.acceptedContractDoc);
  const hasSignedCommercialDoc = Boolean(economics.acceptedContractDoc || economics.acceptedQuoteDoc);
  const signedAtaCount = economics.acceptedAtaDocs.length;
  const projectStatusLabel = activeProject.projectStatus ?? activeProject.status;

  const riskNotes = [
    !hasSignedCommercialDoc
      ? "Inget signerat avtal/offert registrerat ännu. Totalen är preliminär tills kundsignering finns."
      : null,
    economics.pendingChangeOrders.length + economics.escalatedChangeOrders.length > 0
      ? `${economics.pendingChangeOrders.length + economics.escalatedChangeOrders.length} ÄTA väntar svar eller är eskalerade.`
      : null,
    hasSignedCommercialDoc && economics.baseAmountIncVat === null
      ? "Signerat dokument finns men belopp kunde inte läsas ut automatiskt från dokumentfält."
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Ekonomiöversikt</p>
            <h2 className="mt-1 text-xl font-bold text-[#2A2520]">{activeProject.title}</h2>
            <p className="mt-1 text-sm text-[#6B5A47]">{activeProject.location}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full border px-2 py-1 font-semibold ${statusPillTone("muted")}`}>
                Projektstatus: {projectStatusLabel}
              </span>
              <span className={`rounded-full border px-2 py-1 font-semibold ${statusPillTone(hasSignedContract ? "ok" : "warn")}`}>
                {hasSignedContract ? "Avtal signerat" : hasSignedCommercialDoc ? "Offert signerad" : "Ej signerat avtal"}
              </span>
              <span className={`rounded-full border px-2 py-1 font-semibold ${statusPillTone(signedAtaCount > 0 ? "info" : "muted")}`}>
                Signerade ÄTA: {signedAtaCount}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3 min-w-[220px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Bindande total (inkl moms)</p>
            <p className="mt-1 text-2xl font-bold text-[#2A2520]">{formatSek(economics.bindingTotalIncVat)}</p>
            <p className="mt-1 text-xs text-[#6B5A47]">
              Bas {formatSek(economics.baseAmountIncVat)} + ÄTA {formatSek(economics.bindingAtaAmountIncVat)}
            </p>
          </div>
        </div>

        {riskNotes.length > 0 && (
          <div className="mt-4 space-y-2">
            {riskNotes.map((note) => (
              <p key={note} className="rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
                {note}
              </p>
            ))}
          </div>
        )}
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Basbelopp (gällande)</p>
          <p className="mt-1 text-xl font-bold text-[#2A2520]">{formatSek(economics.baseAmountIncVat)}</p>
          <p className="mt-1 text-xs text-[#6B5A47]">
            {economics.governingSource?.label ?? "Ingen offert/avtalssumma ännu"}
          </p>
        </article>
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Signerade ÄTA (inkl moms)</p>
          <p className="mt-1 text-xl font-bold text-[#2A2520]">{formatSek(economics.signedAtaDocsTotal)}</p>
          <p className="mt-1 text-xs text-[#6B5A47]">{signedAtaCount} signerade ÄTA-dokument</p>
        </article>
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">ÄTA beslutade (48h-panel)</p>
          <p className="mt-1 text-xl font-bold text-[#2A2520]">{formatSek(economics.approvedChangeOrdersTotal)}</p>
          <p className="mt-1 text-xs text-[#6B5A47]">
            {economics.approvedChangeOrders.length} godkända ÄTA-ärenden
          </p>
        </article>
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Öppna ÄTA (pipeline)</p>
          <p className="mt-1 text-xl font-bold text-[#2A2520]">{formatSek(economics.openChangeOrdersTotal)}</p>
          <p className="mt-1 text-xs text-[#6B5A47]">
            {economics.pendingChangeOrders.length} väntar · {economics.escalatedChangeOrders.length} eskalerade
          </p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Kostnadsbild (projekt)</h3>
          <p className="mt-1 text-sm text-[#6B5A47]">
            Summering av vad som gäller nu baserat på signerade dokument och registrerade ÄTA-beslut.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E8E3DC] text-left text-xs uppercase tracking-wide text-[#8C7860]">
                  <th className="px-2 py-2">Post</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Belopp (kr)</th>
                  <th className="px-2 py-2">Kommentar</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#EFE8DD]">
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">Basavtal / offert</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{economics.governingSource?.label ?? "Saknas"}</td>
                  <td className="px-2 py-2 text-right font-semibold text-[#2A2520]">
                    {formatSek(economics.baseAmountIncVat)}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#6B5A47]">
                    {economics.governingSource?.kind === "accepted_offer"
                      ? "Belopp från accepterad offert (inte signerat avtal ännu)"
                      : economics.governingSource?.kind === "sent_offer"
                        ? "Preliminärt från senast skickad offert"
                        : economics.governingSource?.kind === "contract_doc"
                          ? "Belopp från signerat avtal"
                          : economics.governingSource?.kind === "quote_doc"
                            ? "Belopp från signerad offert"
                            : "—"}
                  </td>
                </tr>
                <tr className="border-b border-[#EFE8DD]">
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">Signerade ÄTA-dokument</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{signedAtaCount} signerade</td>
                  <td className="px-2 py-2 text-right font-semibold text-[#2A2520]">
                    {formatSek(economics.signedAtaDocsTotal)}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#6B5A47]">Läggs till bindande total när ÄTA är signerad/godkänd</td>
                </tr>
                <tr className="border-b border-[#EFE8DD]">
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">Godkända ÄTA (48h-panel)</td>
                  <td className="px-2 py-2 text-[#6B5A47]">{economics.approvedChangeOrders.length} godkända</td>
                  <td className="px-2 py-2 text-right font-semibold text-[#2A2520]">
                    {formatSek(economics.approvedChangeOrdersTotal)}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#6B5A47]">
                    Beslutade ÄTA-ärenden. Kan behöva formaliseras i ÄTA-dokument beroende på arbetssätt.
                  </td>
                </tr>
                <tr className="border-b border-[#EFE8DD]">
                  <td className="px-2 py-2 font-semibold text-[#2A2520]">Öppna/eskalerade ÄTA</td>
                  <td className="px-2 py-2 text-[#6B5A47]">
                    {economics.pendingChangeOrders.length + economics.escalatedChangeOrders.length} ärenden
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-[#2A2520]">
                    {formatSek(economics.openChangeOrdersTotal)}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#6B5A47]">Ej bindande ännu (påverkar prognos, inte avtalad total)</td>
                </tr>
                <tr className="bg-[#FAF8F5]">
                  <td className="px-2 py-2 font-bold text-[#2A2520]">Bindande total (nu)</td>
                  <td className="px-2 py-2 text-[#6B5A47]">
                    {hasSignedCommercialDoc ? "Baserad på signerat underlag" : "Preliminär"}
                  </td>
                  <td className="px-2 py-2 text-right text-base font-bold text-[#2A2520]">
                    {formatSek(economics.bindingTotalIncVat)}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#6B5A47]">Basbelopp + signerade ÄTA (eller godkända ÄTA om signerade ÄTA-belopp saknas)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {(economics.baseAmountExVat !== null || economics.baseVat !== null) && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Ex moms (offerdata)</p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{formatSek(economics.baseAmountExVat)}</p>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Moms (offerdata)</p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{formatSek(economics.baseVat)}</p>
              </div>
              <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Inkl moms (offerdata)</p>
                <p className="mt-1 text-sm font-semibold text-[#2A2520]">{formatSek(economics.baseAmountIncVat)}</p>
              </div>
            </div>
          )}
        </article>

        <div className="space-y-6">
          <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#2A2520]">Gällande dokument & beslut</h3>
            <div className="mt-3 space-y-2">
              {economics.documents
                .filter((doc) => doc.status === "accepted" || doc.status === "sent")
                .slice(0, 8)
                .map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#2A2520]">{doc.title}</p>
                        <p className="mt-0.5 text-xs text-[#6B5A47]">
                          {documentTypeLabel(doc.type)} · {documentStatusLabel(doc.status)} · v{doc.version}
                        </p>
                        <p className="text-xs text-[#766B60]">
                          {doc.status === "accepted" ? "Signerad/godkänd" : "Skickad"}:{" "}
                          {formatDateTime(doc.acceptedAt ?? doc.sentAt ?? doc.updatedAt)}
                        </p>
                      </div>
                      <Link
                        href={documentDetailHref(role, doc.id, activeProject.id)}
                        className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                      >
                        Öppna
                      </Link>
                    </div>
                  </div>
                ))}

              {economics.documents.filter((doc) => doc.status === "accepted" || doc.status === "sent").length === 0 && (
                <p className="rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
                  Inga skickade eller signerade dokument ännu.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#2A2520]">ÄTA-status</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { label: "Väntar svar", count: economics.pendingChangeOrders.length, tone: "muted" as const },
                { label: "Eskalering", count: economics.escalatedChangeOrders.length, tone: "warn" as const },
                { label: "Godkända", count: economics.approvedChangeOrders.length, tone: "ok" as const },
                { label: "Avvisade", count: economics.rejectedChangeOrders.length, tone: "info" as const },
              ].map((row) => (
                <div key={row.label} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">{row.label}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#2A2520]">
                    <span>{row.count} st</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPillTone(row.tone)}`}>
                      {row.label}
                    </span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {[...economics.pendingChangeOrders, ...economics.escalatedChangeOrders, ...economics.approvedChangeOrders]
                .slice(0, 6)
                .map((co) => (
                  <div key={co.id} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                    <p className="text-sm font-semibold text-[#2A2520]">{co.description}</p>
                    <p className="mt-1 text-xs text-[#6B5A47]">
                      {changeOrderStatusLabel(co.status)} · {formatSek(co.costEstimateSek)} · {formatDateTime(co.createdAt)}
                    </p>
                  </div>
                ))}
            </div>
          </article>

          <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#2A2520]">Offerter i projektet</h3>
            <div className="mt-3 space-y-2">
              {economics.offers.map((offer) => (
                <div key={offer.id} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#2A2520]">{offer.contractorId}</p>
                      <p className="text-xs text-[#6B5A47]">
                        {offerStatusLabel(offer.status)} · v{offer.version}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#2A2520]">{formatSek(offer.totals.incVat)}</p>
                      <p className="text-xs text-[#6B5A47]">inkl moms</p>
                    </div>
                  </div>
                </div>
              ))}
              {economics.offers.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
                  Inga offerter registrerade för projektet ännu.
                </p>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
