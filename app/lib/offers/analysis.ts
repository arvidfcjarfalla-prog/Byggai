import {
  calculateCategoryBreakdown,
  calculateTopDrivers,
  calculateTypeBreakdown,
  recomputeOffer,
} from "./calculations";
import type { LineItem, Offer, OfferAnalysisSummary, OfferRiskFlag } from "./types";

const UNCLEAR_TITLE_TOKENS = ["rad", "post", "övrigt", "arbete", "material", "item"];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle] ?? 0;
}

function buildRiskFlags(lineItems: LineItem[]): OfferRiskFlag[] {
  const flags: OfferRiskFlag[] = [];
  const priceMedian = median(
    lineItems
      .map((lineItem) => lineItem.unitPrice)
      .filter((unitPrice) => Number.isFinite(unitPrice) && unitPrice > 0)
  );

  lineItems.forEach((lineItem) => {
    if (!Number.isFinite(lineItem.quantity) || lineItem.quantity <= 0) {
      flags.push({
        kind: "missing_quantity",
        lineItemId: lineItem.id,
        message: `Post "${lineItem.title}" saknar mängd eller har mängd 0.`,
      });
    }

    if (
      !Number.isFinite(lineItem.unitPrice) ||
      lineItem.unitPrice <= 0 ||
      !Number.isFinite(lineItem.total) ||
      lineItem.total <= 0
    ) {
      flags.push({
        kind: "zero_value",
        lineItemId: lineItem.id,
        message: `Post "${lineItem.title}" har 0-värde i á-pris eller totalsumma.`,
      });
    }

    if (priceMedian > 0 && Number.isFinite(lineItem.unitPrice) && lineItem.unitPrice > 0) {
      const ratio = lineItem.unitPrice / priceMedian;
      if (ratio > 4 || ratio < 0.2) {
        flags.push({
          kind: "extreme_unit_price",
          lineItemId: lineItem.id,
          message: `Post "${lineItem.title}" avviker kraftigt i á-pris jämfört med övriga poster.`,
        });
      }
    }

    const normalizedTitle = lineItem.title.trim().toLowerCase();
    if (
      normalizedTitle.length < 5 ||
      UNCLEAR_TITLE_TOKENS.some((token) => normalizedTitle === token)
    ) {
      flags.push({
        kind: "unclear_title",
        lineItemId: lineItem.id,
        message: `Post "${lineItem.title}" bör få en tydligare benämning för att minska tolkningsrisk.`,
      });
    }
  });

  return flags;
}

export function analyzeOfferStructure(offer: Offer): OfferAnalysisSummary {
  const normalized = recomputeOffer(offer);
  const { lineItems, totals } = normalized;
  return {
    revenue: totals.exVat,
    typeBreakdown: calculateTypeBreakdown(lineItems, totals.exVat),
    categoryBreakdown: calculateCategoryBreakdown(lineItems, totals.exVat),
    topDrivers: calculateTopDrivers(lineItems, totals.exVat, 5),
    riskFlags: buildRiskFlags(lineItems),
  };
}

export function estimateMargin(input: {
  offer: Offer;
  estimatedCostExVat?: number;
}): { amount: number | null; percent: number | null } {
  const normalized = recomputeOffer(input.offer);
  if (!input.estimatedCostExVat || input.estimatedCostExVat <= 0) {
    return { amount: null, percent: null };
  }
  const amount = normalized.totals.exVat - input.estimatedCostExVat;
  const percent = normalized.totals.exVat > 0 ? (amount / normalized.totals.exVat) * 100 : 0;
  return {
    amount: Math.round(amount * 100) / 100,
    percent: Math.round(percent * 100) / 100,
  };
}
