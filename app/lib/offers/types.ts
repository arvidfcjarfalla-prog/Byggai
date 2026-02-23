export type OfferStatus = "draft" | "sent" | "accepted" | "rejected";
export type LineItemType = "material" | "arbete" | "ue" | "ovrigt";
export type OfferInternalCostCategory =
  | "personal"
  | "material"
  | "ue"
  | "planering"
  | "maskin"
  | "logistik"
  | "ovrigt"
  | "riskreserv";

export interface LineItem {
  id: string;
  title: string;
  category: string;
  type: LineItemType;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface OfferTimelineEntry {
  label: string;
  amount: number;
  date?: string;
}

export interface OfferTotals {
  exVat: number;
  vat: number;
  incVat: number;
}

export interface OfferInternalCostLine {
  id: string;
  label: string;
  category: OfferInternalCostCategory;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  notes?: string;
}

export interface OfferInternalEstimate {
  costLines: OfferInternalCostLine[];
  updatedAt?: string;
}

export interface Offer {
  id: string;
  projectId: string;
  contractorId: string;
  version: number;
  status: OfferStatus;
  lineItems: LineItem[];
  assumptions?: string[];
  timeline?: OfferTimelineEntry[];
  internalEstimate?: OfferInternalEstimate;
  totals: OfferTotals;
  createdAt: Date;
}

export interface OfferComparisonRow {
  offerId: string;
  contractorId: string;
  version: number;
  status: OfferStatus;
  totals: OfferTotals;
  itemCount: number;
}

export interface OfferTypeBreakdown {
  type: LineItemType;
  amount: number;
  share: number;
}

export interface OfferInternalCostBreakdown {
  category: OfferInternalCostCategory;
  amount: number;
  share: number;
}

export interface OfferCategoryBreakdown {
  category: string;
  amount: number;
  share: number;
}

export interface OfferTopDriver {
  lineItemId: string;
  title: string;
  category: string;
  amount: number;
  share: number;
}

export interface OfferRiskFlag {
  kind:
    | "missing_quantity"
    | "zero_value"
    | "extreme_unit_price"
    | "unclear_title";
  lineItemId?: string;
  message: string;
}

export interface OfferAnalysisSummary {
  revenue: number;
  typeBreakdown: OfferTypeBreakdown[];
  categoryBreakdown: OfferCategoryBreakdown[];
  topDrivers: OfferTopDriver[];
  riskFlags: OfferRiskFlag[];
}

export interface OfferProfitabilitySummary {
  revenueExVat: number;
  revenueIncVat: number;
  vat: number;
  internalCostExVat: number;
  grossProfitExVat: number;
  grossMarginPercent: number | null;
  costCoveragePercent: number | null;
}

export interface OfferSimulationModification {
  removeLineItemId?: string;
  replaceLineItem?: Partial<LineItem> & { id: string };
  updateQuantity?: { lineItemId: string; quantity: number };
  updateUnitPrice?: { lineItemId: string; unitPrice: number };
}
