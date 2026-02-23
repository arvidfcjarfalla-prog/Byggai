import type { PlatformDocument } from "../documents-store";
import { routes } from "../routes";

export type EntreprenorOfferFlowStepId = "request" | "analysis" | "generate" | "preview";
export type EntreprenorOfferFlowStepState = "current" | "complete" | "available" | "locked";

export interface EntreprenorOfferFlowStep {
  id: EntreprenorOfferFlowStepId;
  number: number;
  title: string;
  description: string;
  state: EntreprenorOfferFlowStepState;
  href?: string;
}

function statusRank(status: PlatformDocument["status"]): number {
  if (status === "sent") return 5;
  if (status === "accepted") return 4;
  if (status === "rejected") return 3;
  if (status === "draft") return 2;
  return 1;
}

function documentSortValue(document: PlatformDocument): number {
  const updated = Date.parse(document.updatedAt);
  return Number.isNaN(updated) ? 0 : updated;
}

export function getLatestQuoteDocumentForRequest(
  documents: PlatformDocument[] | undefined
): PlatformDocument | null {
  if (!documents || documents.length === 0) return null;
  const candidates = documents.filter(
    (document) => document.type === "quote" && document.status !== "superseded"
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    if (a.version !== b.version) return b.version - a.version;
    const statusDelta = statusRank(b.status) - statusRank(a.status);
    if (statusDelta !== 0) return statusDelta;
    return documentSortValue(b) - documentSortValue(a);
  })[0] ?? null;
}

export function buildEntreprenorOfferFlowSteps(input: {
  activeStepId: EntreprenorOfferFlowStepId;
  requestId: string;
  offerId?: string | null;
  generateDocumentId?: string | null;
  previewDocumentId?: string | null;
}): EntreprenorOfferFlowStep[] {
  const requestHref = routes.entreprenor.requestDetail({ requestId: input.requestId });
  const analysisHref = input.offerId
    ? routes.entreprenor.offerAnalysis({ offerId: input.offerId })
    : undefined;
  const generateHref = input.generateDocumentId
    ? routes.entreprenor.documentDetail({
        documentId: input.generateDocumentId,
        requestId: input.requestId,
      })
    : routes.entreprenor.documentsIndex({ requestId: input.requestId });
  const previewHref = input.previewDocumentId
    ? routes.entreprenor.documentDetail({
        documentId: input.previewDocumentId,
        requestId: input.requestId,
      })
    : undefined;

  const order: EntreprenorOfferFlowStepId[] = ["request", "analysis", "generate", "preview"];
  const activeIndex = order.indexOf(input.activeStepId);

  const baseSteps: Array<Omit<EntreprenorOfferFlowStep, "state"> & { href?: string }> = [
    {
      id: "request",
      number: 1,
      title: "Förfrågningsöversikt",
      description: "Förstå scope, plats, tidsram och underlag.",
      href: requestHref,
    },
    {
      id: "analysis",
      number: 2,
      title: "Ekonomisk analys",
      description: "Kalkyl, marginal, risker och nyckeltal.",
      href: analysisHref,
    },
    {
      id: "generate",
      number: 3,
      title: "Offertgenerering",
      description: "Skapa/redigera offertdokument från underlaget.",
      href: generateHref,
    },
    {
      id: "preview",
      number: 4,
      title: "Offertförhandsvisning",
      description: "Se exakt det kunden får innan skick.",
      href: previewHref,
    },
  ];

  return baseSteps.map((step) => {
    const stepIndex = order.indexOf(step.id);
    const hasLink = Boolean(step.href);
    const isCurrent = step.id === input.activeStepId;

    let state: EntreprenorOfferFlowStepState = "locked";
    if (isCurrent) {
      state = "current";
    } else if (!hasLink && step.id !== "analysis" && step.id !== "preview") {
      state = "locked";
    } else if (!hasLink) {
      state = "locked";
    } else if (stepIndex < activeIndex) {
      state = "complete";
    } else if (stepIndex > activeIndex) {
      state = "available";
    }

    return {
      ...step,
      state,
    };
  });
}
