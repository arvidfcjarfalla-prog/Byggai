export interface ProcurementActionDetail {
  label: string;
  value: string;
}

export interface RequestPropertySnapshot {
  audience: "brf" | "privat";
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
  name: string;
  fileTypeLabel: string;
  extension: string;
  sizeKb: number;
  uploadedAt: string;
  sourceLabel: string;
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

export interface EntrepreneurRequest {
  id: string;
  createdAt: string;
  title: string;
  location: string;
  budgetRange: string;
  desiredStart: string;
  documentationLevel: string;
  riskProfile: "Låg" | "Medel" | "Hög";
  actions: ProcurementAction[];
  propertySnapshot?: RequestPropertySnapshot;
  documentSummary?: RequestDocumentSummary;
  files?: RequestFileRecord[];
}

export const PROCUREMENT_REQUESTS_KEY = "byggplattformen-procurement-requests";
export const PROCUREMENT_UPDATED_EVENT = "byggplattformen-procurement-updated";
