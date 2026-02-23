import type {
  LineItem,
  LineItemType,
  Offer,
  OfferCategoryBreakdown,
  OfferComparisonRow,
  OfferInternalCostBreakdown,
  OfferInternalCostCategory,
  OfferInternalCostLine,
  OfferProfitabilitySummary,
  OfferTimelineEntry,
  OfferTopDriver,
  OfferTotals,
  OfferTypeBreakdown,
} from "./types";

const DEFAULT_VAT_RATE = 0.25;

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateLineItemTotal(quantity: number, unitPrice: number): number {
  const qty = Math.max(0, toFiniteNumber(quantity, 0));
  const price = Math.max(0, toFiniteNumber(unitPrice, 0));
  return roundCurrency(qty * price);
}

export function calculateInternalCostLineTotal(quantity: number, unitCost: number): number {
  const qty = Math.max(0, toFiniteNumber(quantity, 0));
  const cost = Math.max(0, toFiniteNumber(unitCost, 0));
  return roundCurrency(qty * cost);
}

export function normalizeLineItem(input: LineItem): LineItem {
  const quantity = Math.max(0, toFiniteNumber(input.quantity, 0));
  const unitPrice = Math.max(0, toFiniteNumber(input.unitPrice, 0));
  const total = calculateLineItemTotal(quantity, unitPrice);
  const type: LineItemType =
    input.type === "arbete" ||
    input.type === "material" ||
    input.type === "ue" ||
    input.type === "ovrigt"
      ? input.type
      : "ovrigt";

  return {
    ...input,
    title: input.title.trim(),
    category: input.category.trim() || "Övrigt",
    type,
    quantity,
    unit: input.unit.trim() || "st",
    unitPrice,
    total,
  };
}

export function normalizeInternalCostLine(input: OfferInternalCostLine): OfferInternalCostLine {
  const quantity = Math.max(0, toFiniteNumber(input.quantity, 0));
  const unitCost = Math.max(0, toFiniteNumber(input.unitCost, 0));
  const total = calculateInternalCostLineTotal(quantity, unitCost);
  const category: OfferInternalCostCategory =
    input.category === "personal" ||
    input.category === "material" ||
    input.category === "ue" ||
    input.category === "planering" ||
    input.category === "maskin" ||
    input.category === "logistik" ||
    input.category === "ovrigt" ||
    input.category === "riskreserv"
      ? input.category
      : "ovrigt";

  return {
    ...input,
    label: input.label.trim(),
    category,
    quantity,
    unit: input.unit.trim() || "st",
    unitCost,
    total,
    notes: input.notes?.trim() || undefined,
  };
}

export function calculateTotalsFromLineItems(
  lineItems: LineItem[],
  vatRate = DEFAULT_VAT_RATE
): OfferTotals {
  const exVat = roundCurrency(
    lineItems.reduce((sum, lineItem) => sum + calculateLineItemTotal(lineItem.quantity, lineItem.unitPrice), 0)
  );
  const vat = roundCurrency(exVat * Math.max(0, vatRate));
  const incVat = roundCurrency(exVat + vat);
  return { exVat, vat, incVat };
}

export function recomputeOffer(offer: Offer, vatRate = DEFAULT_VAT_RATE): Offer {
  const normalizedItems = offer.lineItems.map((lineItem) => normalizeLineItem(lineItem));
  return {
    ...offer,
    lineItems: normalizedItems,
    internalEstimate: offer.internalEstimate
      ? {
          ...offer.internalEstimate,
          costLines: offer.internalEstimate.costLines.map((line) => normalizeInternalCostLine(line)),
        }
      : undefined,
    totals: calculateTotalsFromLineItems(normalizedItems, vatRate),
  };
}

export function calculateTypeBreakdown(
  lineItems: LineItem[],
  totalExVat: number
): OfferTypeBreakdown[] {
  const base = totalExVat > 0 ? totalExVat : 1;
  const grouped = lineItems.reduce<Record<LineItemType, number>>(
    (acc, lineItem) => {
      const type = lineItem.type;
      acc[type] = roundCurrency((acc[type] || 0) + lineItem.total);
      return acc;
    },
    { arbete: 0, material: 0, ue: 0, ovrigt: 0 }
  );

  return (Object.keys(grouped) as LineItemType[])
    .map((type) => ({
      type,
      amount: grouped[type],
      share: roundCurrency((grouped[type] / base) * 100),
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function calculateCategoryBreakdown(
  lineItems: LineItem[],
  totalExVat: number
): OfferCategoryBreakdown[] {
  const base = totalExVat > 0 ? totalExVat : 1;
  const grouped = lineItems.reduce<Record<string, number>>((acc, lineItem) => {
    const key = lineItem.category.trim() || "Övrigt";
    acc[key] = roundCurrency((acc[key] || 0) + lineItem.total);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([category, amount]) => ({
      category,
      amount,
      share: roundCurrency((amount / base) * 100),
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, "sv"));
}

export function calculateTopDrivers(
  lineItems: LineItem[],
  totalExVat: number,
  limit = 5
): OfferTopDriver[] {
  const base = totalExVat > 0 ? totalExVat : 1;
  return [...lineItems]
    .sort((a, b) => b.total - a.total)
    .slice(0, Math.max(1, limit))
    .map((lineItem) => ({
      lineItemId: lineItem.id,
      title: lineItem.title,
      category: lineItem.category,
      amount: lineItem.total,
      share: roundCurrency((lineItem.total / base) * 100),
    }));
}

export function calculateTimelineTotal(timeline: OfferTimelineEntry[] | undefined): number {
  if (!timeline || timeline.length === 0) return 0;
  return roundCurrency(
    timeline.reduce((sum, entry) => sum + Math.max(0, toFiniteNumber(entry.amount, 0)), 0)
  );
}

export function calculateInternalCostTotals(costLines: OfferInternalCostLine[] | undefined): number {
  if (!costLines || costLines.length === 0) return 0;
  return roundCurrency(
    costLines.reduce(
      (sum, line) => sum + calculateInternalCostLineTotal(line.quantity, line.unitCost),
      0
    )
  );
}

export function calculateInternalCostBreakdown(
  costLines: OfferInternalCostLine[] | undefined,
  totalCostExVat: number
): OfferInternalCostBreakdown[] {
  if (!costLines || costLines.length === 0) return [];

  const base = totalCostExVat > 0 ? totalCostExVat : 1;
  const grouped = costLines.reduce<Record<OfferInternalCostCategory, number>>(
    (acc, line) => {
      const normalized = normalizeInternalCostLine(line);
      acc[normalized.category] = roundCurrency((acc[normalized.category] || 0) + normalized.total);
      return acc;
    },
    {
      personal: 0,
      material: 0,
      ue: 0,
      planering: 0,
      maskin: 0,
      logistik: 0,
      ovrigt: 0,
      riskreserv: 0,
    }
  );

  return (Object.keys(grouped) as OfferInternalCostCategory[])
    .map((category) => ({
      category,
      amount: grouped[category],
      share: roundCurrency((grouped[category] / base) * 100),
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function calculateOfferProfitabilitySummary(offer: Offer): OfferProfitabilitySummary {
  const normalized = recomputeOffer(offer);
  const revenueExVat = normalized.totals.exVat;
  const internalCostExVat = calculateInternalCostTotals(normalized.internalEstimate?.costLines);
  const grossProfitExVat = roundCurrency(revenueExVat - internalCostExVat);
  const grossMarginPercent =
    revenueExVat > 0 ? roundCurrency((grossProfitExVat / revenueExVat) * 100) : null;
  const costCoveragePercent =
    revenueExVat > 0 ? roundCurrency((internalCostExVat / revenueExVat) * 100) : null;

  return {
    revenueExVat,
    revenueIncVat: normalized.totals.incVat,
    vat: normalized.totals.vat,
    internalCostExVat,
    grossProfitExVat,
    grossMarginPercent,
    costCoveragePercent,
  };
}

export function calculateCostPerSquareMeter(
  totalsExVat: number,
  areaM2: number | undefined
): number | null {
  if (!areaM2 || !Number.isFinite(areaM2) || areaM2 <= 0) return null;
  return roundCurrency(totalsExVat / areaM2);
}

export function toComparisonRows(offers: Offer[]): OfferComparisonRow[] {
  return offers
    .map((offer) => recomputeOffer(offer))
    .map((offer) => ({
      offerId: offer.id,
      contractorId: offer.contractorId,
      version: offer.version,
      status: offer.status,
      totals: offer.totals,
      itemCount: offer.lineItems.length,
    }))
    .sort((a, b) => a.totals.exVat - b.totals.exVat);
}
