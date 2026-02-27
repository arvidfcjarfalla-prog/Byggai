"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  PlatformRequest,
  ProcurementAction,
  ProcurementActionDetail,
  RequestDocumentSummary,
  RequestFileRecord,
  RequestPropertySnapshot,
  RequestProcurementScopeSnapshotItem,
} from "../../lib/requests-store";
import {
  defaultRecipientsForAudience,
  listRequests,
  saveRequest,
  toRecipientLabel,
} from "../../lib/requests-store";
import type { BrfFileRecord } from "../../lib/brf-workspace";
import {
  BRF_FILES_UPDATED_EVENT,
  clearWorkspaceFiles,
  getFileExtension,
  getFileTypeLabel,
  hasWorkspaceFilePayload,
  inferBrfFileType,
  inferContentGroup,
  normalizeWorkspaceFileRecord,
  openWorkspaceFile,
  readWorkspaceFiles,
  removeWorkspaceFile,
  storeWorkspaceFilePayload,
  structureWorkspaceFiles,
  writeWorkspaceFiles,
} from "../../lib/brf-workspace";
import type { BrfPropertyProfile } from "../../lib/workspace-profiles";
import {
  BRF_PROPERTY_PROFILE_KEY,
  DEFAULT_BRF_PROPERTY_PROFILE,
  readStoredObject,
  toAddress,
} from "../../lib/workspace-profiles";
import {
  buildProjectSnapshotFromBrfSeed,
  formatSnapshotBudget,
  formatSnapshotTimeline,
  toSwedishRiskLabel,
} from "../../lib/project-snapshot";
import { routes } from "../../lib/routes";
import { listDocumentsByRequest } from "../../lib/documents-store";
import { renderDocumentToHtml } from "../../lib/document-renderer";
import { listLatestOffersByProject, setOfferStatus, subscribeOffers } from "../../lib/offers/store";
import type { Offer } from "../../lib/offers/types";
import {
  BRF_ACTIONS_DRAFT_UPDATED_EVENT,
  fromProcurementAction,
  readBrfActionsDraft,
  readBrfRequestMeta,
  toProcurementAction,
  writeBrfActionsDraft,
  writeBrfRequestMeta,
} from "../../lib/brf-start";
import {
  buildAdjustedScopeItem,
  buildOriginalScopeItem,
  resolveProcurementTemplate,
  type ProcurementAdjustedScopeItem,
  type ScopeStandardLevel,
} from "../../lib/procurement/template-engine";
import {
  createOfferDecisionLogEntry,
  listOfferDecisionLogsByProject,
  subscribeOfferDecisionLogs,
} from "../../lib/decisions/offer-decision-log-store";
import {
  updateBrfProcurementFlowState,
  useBrfProcurementFlowStore,
} from "../../lib/brf-procurement-flow-store";
import { AtgardDetaljPanel } from "../../components/atgard-detalj-panel";

const FALLBACK_ACTIONS = [
  "Byta belysningsarmatur LED i trapphus",
  "Måla trapphus och entréplan",
  "Byta ventilationsaggregat (FTX)",
  "Fasadrenovering och omfogning",
  "Tätskikt och ytskikt i källare",
  "Byte av undercentral för värme",
  "Taköversyn och partiell omläggning",
];

const BRF_UPLOAD_VIEW_KEY = "byggplattformen-brf-upload-view";

type BrfUploadViewState = {
  searchQuery: string;
  categoryFilter: string;
  statusFilter: string;
  yearFilter: string;
  selectedActionIds: string[];
  procurementMaintenanceActionsVisible: boolean;
  sentCount: number;
  extractNotice: string | null;
  requestTitle: string;
  lastUploadedFileName: string | null;
};

const DEFAULT_BRF_UPLOAD_VIEW_STATE: BrfUploadViewState = {
  searchQuery: "",
  categoryFilter: "alla",
  statusFilter: "alla",
  yearFilter: "alla",
  selectedActionIds: [],
  procurementMaintenanceActionsVisible: false,
  sentCount: 0,
  extractNotice: null,
  requestTitle: "BRF Underhållsplan 2026–2028",
  lastUploadedFileName: null,
};

type ParsedRow = {
  title: string;
  category?: string;
  status?: "Planerad" | "Eftersatt" | "Genomförd";
  plannedYear?: number;
  estimatedPriceSek?: number;
  emissionsKgCo2e?: number;
  rawRow: string;
  sourceSheet?: string;
  sourceRow?: number;
  extraDetails?: ProcurementActionDetail[];
};

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("el") || t.includes("belys")) return "El och belysning";
  if (t.includes("vent")) return "Ventilation";
  if (t.includes("fasad") || t.includes("tak")) return "Byggnadsskal";
  if (t.includes("mål") || t.includes("golv")) return "Invändigt";
  if (t.includes("värme") || t.includes("undercentral")) return "VVS och värme";
  return "Övrigt underhåll";
}

function parseSek(value: string): number | null {
  const normalized = value.replace(/\s+/g, "");
  const match = normalized.match(/(\d+)(?=kr)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parseCo2(value: string): number | null {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*co2/i);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseYear(value: string): number | undefined {
  const match = value.match(/\b(20\d{2})\b/);
  if (!match) return undefined;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : undefined;
}

function parsePlanimaStructuredRows(
  rows: (string | number | boolean | null)[][],
  sourceSheet: string
): ParsedRow[] {
  if (rows.length < 2) return [];
  const header = (rows[0] || []).map((cell) => toCleanCell(String(cell ?? "")));
  const headerLower = header.map((h) => h.toLowerCase());
  const getIndex = (candidates: string[]) =>
    headerLower.findIndex((h) => candidates.some((candidate) => h.includes(candidate)));

  const yearIndex = getIndex(["år"]);
  const titleIndex = getIndex(["namn"]);
  const categoryIndex = getIndex(["kategori"]);
  const statusIndex = getIndex(["status"]);
  const totalPriceIndex = getIndex(["totalt pris"]);
  const investmentPriceIndex = getIndex(["investeringskostnad"]);
  const emissionsIndex = getIndex(["totalt utsläpp"]);

  if (titleIndex < 0 || yearIndex < 0) return [];

  const labelMappings: Array<{ key: string; label: string }> = [
    { key: "fastighet", label: "Fastighet" },
    { key: "märkning", label: "Märkning" },
    { key: "läge", label: "Läge" },
    { key: "byggnad", label: "Byggnad" },
    { key: "antal", label: "Antal" },
    { key: "enhet", label: "Enhet" },
    { key: "styckpris", label: "Styckpris" },
    { key: "faktiskt pris", label: "Faktiskt pris" },
    { key: "andel investering", label: "Andel investering" },
    { key: "underhållskostnad", label: "Underhållskostnad" },
    { key: "energibesparande", label: "Energibesparande" },
    { key: "elbesparing", label: "Elbesparing/år" },
    { key: "värmebesparing", label: "Värmebesparing/år" },
    { key: "komponent", label: "Komponent" },
    { key: "komponenttyp", label: "Komponenttyp" },
    { key: "beskrivning", label: "Beskrivning" },
  ];

  const detailIndexes = labelMappings
    .map((item) => {
      const idx = getIndex([item.key]);
      return idx >= 0 ? { index: idx, label: item.label } : null;
    })
    .filter((item): item is { index: number; label: string } => item !== null);

  const parsed: ParsedRow[] = [];
  for (let rowIndex = 1; rowIndex < Math.min(rows.length, 700); rowIndex += 1) {
    const row = rows[rowIndex];
    if (!Array.isArray(row)) continue;
    const rowCells = row.map((cell) => toCleanCell(String(cell ?? "")));
    const rowText = rowCells.filter(Boolean).join(" | ");
    if (!rowText) continue;
    const title = rowCells[titleIndex] || "";
    if (title.length < 3) continue;

    const plannedYear = parseYear(rowCells[yearIndex] || "");
    const priceText =
      (totalPriceIndex >= 0 ? rowCells[totalPriceIndex] : "") ||
      (investmentPriceIndex >= 0 ? rowCells[investmentPriceIndex] : "");
    const estimatedPriceSek = parseSek(priceText || "");
    const emissionsKgCo2e =
      emissionsIndex >= 0 ? parseCo2(rowCells[emissionsIndex] || "") : null;

    const extraDetails: ProcurementActionDetail[] = [
      { label: "Källa", value: `${sourceSheet}, rad ${rowIndex + 1}` },
    ];
    for (const detail of detailIndexes) {
      const value = rowCells[detail.index];
      if (!value) continue;
      if (extraDetails.length >= 14) break;
      extraDetails.push({ label: detail.label, value: value.slice(0, 180) });
    }

    parsed.push({
      title,
      category: categoryIndex >= 0 ? rowCells[categoryIndex] || undefined : undefined,
      status:
        statusIndex >= 0 && rowCells[statusIndex]
          ? /eftersatt/i.test(rowCells[statusIndex])
            ? "Eftersatt"
            : /genomförd/i.test(rowCells[statusIndex])
              ? "Genomförd"
              : "Planerad"
          : undefined,
      plannedYear,
      estimatedPriceSek: estimatedPriceSek ?? undefined,
      emissionsKgCo2e: emissionsKgCo2e ?? undefined,
      rawRow: rowText,
      sourceSheet,
      sourceRow: rowIndex + 1,
      extraDetails,
    });
  }

  return parsed;
}

function toCleanCell(cell: string): string {
  return cell.replace(/\s+/g, " ").trim();
}

function parsePlanimaLikeRow(
  rowCells: string[],
  rowText: string,
  sourceSheet?: string,
  sourceRow?: number
): ParsedRow | null {
  const segments = rowCells.map(toCleanCell).filter(Boolean);
  if (segments.length < 3) return null;

  const actionRegex =
    /(byta|byte|måla|renover|stambyte|dräner|isolera|installera|ventilation|undercentral|tak|fasad|belysning|fönster)/i;
  const noiseRegex =
    /^(ja|nej|st|kr|moms|andel investering|investeringskostnad|totalt utsläpp|energibesparing\??|projekt|bostadshus \d+|q[1-4]|planerad|eftersatt|genomförd)$/i;

  const titleIndex =
    segments.findIndex(
      (s) => actionRegex.test(s) && s.length >= 8 && s.length <= 180
    ) >= 0
      ? segments.findIndex(
          (s) => actionRegex.test(s) && s.length >= 8 && s.length <= 180
        )
      : segments.findIndex(
          (s) => !noiseRegex.test(s) && s.length >= 10 && s.length <= 180
        );
  const titleCandidate = titleIndex >= 0 ? segments[titleIndex] : null;
  if (!titleCandidate) return null;

  const yearIndex = segments.findIndex((s) => /^20\d{2}$/.test(s));
  const statusIndex = segments.findIndex((s) =>
    /^(planerad|eftersatt|genomförd)$/i.test(s)
  );
  const categoryIndex = segments.findIndex((s) =>
    /^(el och belysning|invändigt|ventilation|vvs|byggnadsskal|mark|tak|fasad)$/i.test(
      s
    )
  );

  const usedIndexes = new Set<number>([titleIndex, yearIndex, statusIndex, categoryIndex]);
  const extraDetails: ProcurementActionDetail[] = [];
  if (sourceSheet && sourceRow) {
    extraDetails.push({
      label: "Källa",
      value: `${sourceSheet}, rad ${sourceRow}`,
    });
  }
  let fieldCount = 1;
  for (let i = 0; i < segments.length; i += 1) {
    if (usedIndexes.has(i)) continue;
    const value = segments[i];
    if (!value || value.length < 2) continue;
    if (extraDetails.length >= 12) break;
    extraDetails.push({
      label: `Fält ${fieldCount}`,
      value: value.slice(0, 180),
    });
    fieldCount += 1;
  }

  const sekValues = segments.map(parseSek).filter((n): n is number => n !== null);
  const co2Values = segments.map(parseCo2).filter((n): n is number => n !== null);

  return {
    title: titleCandidate.replace(/\s+/g, " ").trim(),
    category: categoryIndex >= 0 ? segments[categoryIndex] : undefined,
    status:
      statusIndex >= 0
        ? /eftersatt/i.test(segments[statusIndex])
        ? "Eftersatt"
        : /genomförd/i.test(segments[statusIndex])
          ? "Genomförd"
          : "Planerad"
        : undefined,
    plannedYear: yearIndex >= 0 ? Number(segments[yearIndex]) : undefined,
    estimatedPriceSek: sekValues.length ? Math.max(...sekValues) : undefined,
    emissionsKgCo2e: co2Values.length ? Math.max(...co2Values) : undefined,
    rawRow: rowText,
    sourceSheet,
    sourceRow,
    extraDetails,
  };
}

function isHeaderLikeRow(rowCells: string[]): boolean {
  const rowText = rowCells.join(" | ");
  const lower = rowText.toLowerCase();
  const headerHits = [
    "åtgärd",
    "kategori",
    "status",
    "planerat",
    "totalt pris",
    "utsläpp",
    "co2",
    "komponent",
    "beskrivning",
    "investeringskostnad",
  ].filter((token) => lower.includes(token)).length;

  const actionRegex =
    /(byta|byte|måla|renover|stambyte|dräner|isolera|installera|ventilation|undercentral|tak|fasad|belysning|fönster)/i;
  const hasFewDigits = rowCells.every((cell) => !/\d{3,}/.test(cell));

  return headerHits >= 3 && !actionRegex.test(rowText) && hasFewDigits;
}

function extractActionTitles(rawText: string): string[] {
  const lines = rawText
    .split(/\r?\n|[.;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8);

  const actionLike = lines.filter((line) =>
    /(byta|byte|måla|renover|stambyte|tak|fasad|ventilation|värme|dränering|fönster|belysning|el)/i.test(
      line
    )
  );

  const selected = actionLike.length ? actionLike : lines;
  const unique = Array.from(new Set(selected.map((s) => s.replace(/\s+/g, " ").trim())));
  return unique.slice(0, 20);
}

async function extractActions(file: File): Promise<ProcurementAction[]> {
  const canReadAsText =
    file.type.startsWith("text/") ||
    /\.(txt|csv|md|json)$/i.test(file.name);
  const isSpreadsheet = /\.(xlsx|xls|xlsm)$/i.test(file.name);

  let titles: string[] = [];
  const parsedRows: ParsedRow[] = [];
  if (canReadAsText) {
    try {
      const text = await file.text();
      titles = extractActionTitles(text);
    } catch {
      titles = [];
    }
  }

  if (titles.length === 0 && isSpreadsheet) {
    try {
      const xlsx = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "array" });
      const rowsAsText: string[] = [];
      let usedStructuredParser = false;
      for (const sheetName of workbook.SheetNames.slice(0, 8)) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = xlsx.utils.sheet_to_json<(string | number | boolean | null)[]>(
          sheet,
          { header: 1, raw: false }
        );
        if (!usedStructuredParser) {
          const structuredRows = parsePlanimaStructuredRows(rows, sheetName);
          if (structuredRows.length > 0) {
            parsedRows.push(...structuredRows);
            usedStructuredParser = true;
            continue;
          }
        }
        if (usedStructuredParser) continue;
        const limitedRows = rows.slice(0, 700);
        for (let rowIndex = 0; rowIndex < limitedRows.length; rowIndex += 1) {
          const row = limitedRows[rowIndex];
          if (!Array.isArray(row)) continue;
          const rowCells = row
            .map((cell) => (cell == null ? "" : toCleanCell(String(cell))))
            .filter(Boolean);
          const rowText = rowCells.join(" | ");
          if (rowText) {
            if (isHeaderLikeRow(rowCells)) continue;
            rowsAsText.push(rowText);
            const parsed = parsePlanimaLikeRow(
              rowCells,
              rowText,
              sheetName,
              rowIndex + 1
            );
            if (parsed) {
              parsedRows.push(parsed);
            } else if (rowText.length > 10) {
              const titleCandidate =
                rowCells.find((cell) => cell.length >= 10 && cell.length <= 160) ??
                rowText.slice(0, 160);
              parsedRows.push({
                title: titleCandidate,
                rawRow: rowText,
                sourceSheet: sheetName,
                sourceRow: rowIndex + 1,
                extraDetails: [
                  {
                    label: "Källa",
                    value: `${sheetName}, rad ${rowIndex + 1}`,
                  },
                  {
                    label: "Rådata",
                    value: rowText.slice(0, 220),
                  },
                ],
              });
            }
          }
        }
      }
      if (parsedRows.length === 0) {
        titles = extractActionTitles(rowsAsText.join("\n"));
      }
    } catch {
      titles = [];
    }
  }

  if (titles.length === 0) {
    titles = extractActionTitles(file.name.replace(/[_-]+/g, " "));
  }

  if (titles.length === 0) {
    titles = FALLBACK_ACTIONS;
  }

  const baseYear = 2026;
  const sourceRows: ParsedRow[] =
    parsedRows.length > 0
      ? parsedRows.slice(0, 30)
      : titles.map((title) => ({
          title,
          rawRow: title,
          extraDetails: [{ label: "Källa", value: "Lokal fallback från filtext" }],
        }));

  return sourceRows.map((row, index) => {
    const title = row.title;
    const category = row.category || inferCategory(title);
    const estimatedPriceSek = 90_000 + (index % 6) * 120_000;
    const emissionsKgCo2e = 250 + (index % 7) * 180;
    const status =
      index % 5 === 0
        ? "Eftersatt"
        : index % 7 === 0
          ? "Genomförd"
          : "Planerad";

    return {
      id: `a-${Date.now()}-${index}`,
      title,
      category,
      status: row.status || status,
      plannedYear: row.plannedYear || baseYear + Math.floor(index / 4),
      estimatedPriceSek: row.estimatedPriceSek || estimatedPriceSek,
      emissionsKgCo2e: row.emissionsKgCo2e || emissionsKgCo2e,
      source: "local",
      details:
        row.extraDetails && row.extraDetails.length > 0
          ? row.extraDetails
              .slice(0, 3)
              .map((d) => `${d.label}: ${d.value}`)
              .join(" · ")
          : undefined,
      rawRow: row.rawRow,
      sourceSheet: row.sourceSheet,
      sourceRow: row.sourceRow,
      extraDetails: row.extraDetails,
    };
  });
}

function readBrfFiles(): BrfFileRecord[] {
  return readWorkspaceFiles("brf");
}

function readBrfProfile(): BrfPropertyProfile {
  return (
    readStoredObject<BrfPropertyProfile>(BRF_PROPERTY_PROFILE_KEY) ||
    DEFAULT_BRF_PROPERTY_PROFILE
  );
}

function readBrfUploadViewState(): BrfUploadViewState {
  if (typeof window === "undefined") return { ...DEFAULT_BRF_UPLOAD_VIEW_STATE };
  const raw = localStorage.getItem(BRF_UPLOAD_VIEW_KEY);
  if (!raw) return { ...DEFAULT_BRF_UPLOAD_VIEW_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<BrfUploadViewState>;
    return {
      searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
      categoryFilter:
        typeof parsed.categoryFilter === "string" ? parsed.categoryFilter : "alla",
      statusFilter: typeof parsed.statusFilter === "string" ? parsed.statusFilter : "alla",
      yearFilter: typeof parsed.yearFilter === "string" ? parsed.yearFilter : "alla",
      selectedActionIds: Array.isArray(parsed.selectedActionIds)
        ? parsed.selectedActionIds.filter((value): value is string => typeof value === "string")
        : [],
      procurementMaintenanceActionsVisible:
        parsed.procurementMaintenanceActionsVisible === true,
      sentCount:
        typeof parsed.sentCount === "number" && Number.isFinite(parsed.sentCount)
          ? parsed.sentCount
          : 0,
      extractNotice: typeof parsed.extractNotice === "string" ? parsed.extractNotice : null,
      requestTitle:
        typeof parsed.requestTitle === "string" && parsed.requestTitle.trim().length > 0
          ? parsed.requestTitle
          : DEFAULT_BRF_UPLOAD_VIEW_STATE.requestTitle,
      lastUploadedFileName:
        typeof parsed.lastUploadedFileName === "string" &&
        parsed.lastUploadedFileName.trim().length > 0
          ? parsed.lastUploadedFileName
          : null,
    };
  } catch {
    return { ...DEFAULT_BRF_UPLOAD_VIEW_STATE };
  }
}

function writeBrfUploadViewState(state: BrfUploadViewState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRF_UPLOAD_VIEW_KEY, JSON.stringify(state));
}

async function persistUploadedBrfFile(file: File, sourceLabel: string) {
  if (typeof window === "undefined") return;
  const id = `${file.name.toLowerCase()}-${file.size}`;
  const fileType = inferBrfFileType(file.name);
  const entry: BrfFileRecord = normalizeWorkspaceFileRecord({
    id,
    name: file.name,
    fileType,
    extension: getFileExtension(file.name),
    sizeKb: Number((file.size / 1024).toFixed(1)),
    uploadedAt: new Date().toISOString(),
    sourceLabel,
    mimeType: file.type || undefined,
    contentGroup: inferContentGroup(fileType),
  });

  const existing = readBrfFiles();
  const updated = [entry, ...existing.filter((item) => item.id !== id)].slice(0, 250);
  writeWorkspaceFiles("brf", updated);
  await storeWorkspaceFilePayload("brf", id, file);
}

function buildDocumentSummary(files: BrfFileRecord[]): RequestDocumentSummary {
  const byTypeMap = files.reduce<Record<string, number>>((acc, file) => {
    const typeLabel = getFileTypeLabel(file.fileType);
    acc[typeLabel] = (acc[typeLabel] || 0) + 1;
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

function mapFilesForRequest(files: BrfFileRecord[]): RequestFileRecord[] {
  return files.slice(0, 80).map((file) => ({
    name: file.name,
    fileTypeLabel: getFileTypeLabel(file.fileType),
    extension: file.extension,
    sizeKb: file.sizeKb,
    uploadedAt: file.uploadedAt,
    sourceLabel: file.sourceLabel,
  }));
}

function formatSek(value: number) {
  return `${new Intl.NumberFormat("sv-SE").format(value)} kr`;
}

type ProcurementWizardStep = 1 | 2 | 3;
type Step3DrawerTab = "pdf" | "economy" | "coverage";
type OfferComparisonSort = "price" | "time";
type Step2ReviewStage = "overview" | "sequential" | "summary";

type ComparisonCandidate = {
  id: string;
  contractorId: string;
  label: string;
  isMock: boolean;
  offer?: Offer;
  priceIncVat: number;
  priceExVat: number;
  vat: number;
  timeWeeks: number;
  guaranteeLabel: string;
  statusLabel: string;
  assumptions: string[];
  hasContractTerms: boolean;
  hasPaymentTerms: boolean;
  hasAtaProcess: boolean;
  hasResponsibility: boolean;
  hasAttachments: boolean;
};

function createWizardStepperLabels(step: ProcurementWizardStep): Array<{ id: ProcurementWizardStep; label: string; active: boolean; complete: boolean }> {
  return ([
    { id: 1 as const, label: "Välj åtgärder" },
    { id: 2 as const, label: "Granska & komplettera" },
    { id: 3 as const, label: "Jämför offerter" },
  ]).map((item) => ({
    ...item,
    active: item.id === step,
    complete: item.id < step,
  }));
}

function deriveSelectedSummary(selectedActions: ProcurementAction[]) {
  const totalBudget = selectedActions.reduce((sum, action) => sum + (action.estimatedPriceSek || 0), 0);
  const totalCo2e = selectedActions.reduce((sum, action) => sum + (action.emissionsKgCo2e || 0), 0);
  const overdueCount = selectedActions.filter((action) => action.status === "Eftersatt").length;
  return {
    count: selectedActions.length,
    totalBudget,
    totalCo2e,
    overdueCount,
  };
}

function toRequestProcurementScopeItem(item: ProcurementAdjustedScopeItem): RequestProcurementScopeSnapshotItem {
  return {
    actionId: item.actionId,
    title: item.title,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    standardLevel: item.standardLevel,
    additionalRequirements: item.additionalRequirements,
    isOption: item.isOption,
    templateId: item.templateId,
    templateVersionId: item.templateVersionId,
  };
}

function estimateTimelineWeeksFromOffer(offer: Offer): number {
  if (offer.timeline && offer.timeline.length > 0) {
    return Math.max(2, Math.min(52, offer.timeline.length * 2));
  }
  return Math.max(2, Math.min(52, Math.ceil(offer.lineItems.length / 2)));
}

function buildMockComparisonCandidates(
  projectId: string,
  selectedActions: ProcurementAction[],
  baseBudget: number
): ComparisonCandidate[] {
  const seedBase = baseBudget > 0 ? baseBudget : selectedActions.reduce((s, a) => s + a.estimatedPriceSek, 0) || 500_000;
  const mockDefs = [
    { contractorId: "Nordbygg AB", factor: 0.94, weeks: 12, guaranteeLabel: "2 år garanti", statusLabel: "Inkommen offert" },
    { contractorId: "Trapphusgruppen", factor: 1.02, weeks: 10, guaranteeLabel: "3 år garanti", statusLabel: "Inkommen offert" },
    { contractorId: "Svea Entreprenad", factor: 1.08, weeks: 9, guaranteeLabel: "2 år garanti + service", statusLabel: "Inkommen offert" },
  ];

  return mockDefs.map((mock, index) => {
    const incVat = Math.round(seedBase * mock.factor);
    const exVat = Math.round(incVat / 1.25);
    const vat = incVat - exVat;
    return {
      id: `mock-${projectId}-${index}`,
      contractorId: mock.contractorId,
      label: mock.contractorId,
      isMock: true,
      priceIncVat: incVat,
      priceExVat: exVat,
      vat,
      timeWeeks: mock.weeks,
      guaranteeLabel: mock.guaranteeLabel,
      statusLabel: mock.statusLabel,
      assumptions: [
        "Mockdata visas eftersom inga riktiga offerter finns registrerade ännu.",
        "Pris och ledtid är exempelvärden för jämförelsevy.",
      ],
      hasContractTerms: true,
      hasPaymentTerms: true,
      hasAtaProcess: true,
      hasResponsibility: true,
      hasAttachments: index !== 2,
    };
  });
}

function buildComparisonCandidatesFromOffers(offers: Offer[]): ComparisonCandidate[] {
  return offers.map((offer) => ({
    id: offer.id,
    contractorId: offer.contractorId,
    label: offer.contractorId,
    isMock: false,
    offer,
    priceIncVat: offer.totals.incVat,
    priceExVat: offer.totals.exVat,
    vat: offer.totals.vat,
    timeWeeks: estimateTimelineWeeksFromOffer(offer),
    guaranteeLabel: "Kontrollera i offertdokument",
    statusLabel:
      offer.status === "accepted"
        ? "Vald"
        : offer.status === "sent"
          ? "Inkommen offert"
          : offer.status === "rejected"
            ? "Avslagen"
            : "Utkast",
    assumptions: offer.assumptions ?? [],
    hasContractTerms: true,
    hasPaymentTerms: true,
    hasAtaProcess: true,
    hasResponsibility: true,
    hasAttachments: offer.lineItems.length > 0,
  }));
}

function buildInlineOfferPreviewHtml(candidate: ComparisonCandidate, requestTitle: string): string {
  const lineItems = candidate.offer?.lineItems ?? [];
  const rows = lineItems
    .slice(0, 10)
    .map(
      (item) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.title}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${item.quantity} ${item.unit}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${new Intl.NumberFormat("sv-SE").format(Math.round(item.total))} kr</td></tr>`
    )
    .join("");
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"/><title>Offertpreview</title><style>body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;color:#222}h1{margin:0 0 4px;font-size:22px}h2{margin:18px 0 8px;font-size:16px}table{width:100%;border-collapse:collapse;font-size:12px} .muted{color:#666;font-size:12px} .box{border:1px solid #ddd;border-radius:10px;padding:12px;background:#fafafa}</style></head><body><h1>${candidate.label}</h1><div class="muted">${requestTitle}</div><div class="box" style="margin-top:12px"><div><strong>Total inkl moms:</strong> ${formatSek(candidate.priceIncVat)}</div><div><strong>Tid:</strong> ca ${candidate.timeWeeks} veckor</div><div><strong>Garanti:</strong> ${candidate.guaranteeLabel}</div></div><h2>Sammanfattning</h2><p class="muted">${candidate.isMock ? "Mockpreview (ingen riktig PDF registrerad ännu)." : "Inline förhandsvisning av offertunderlag."}</p><table><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Post</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">Mängd</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">Belopp</th></tr></thead><tbody>${rows || "<tr><td colspan='3' style='padding:8px;color:#666'>Detaljerad radlista saknas i denna preview.</td></tr>"}</tbody></table></body></html>`;
}

type BrfUploadWorkspaceMode = "full" | "analysis-only" | "wizard-only";

export function BrfUploadWorkspace({
  embedded = false,
  mode = "full",
  wizardStepOverride,
}: {
  embedded?: boolean;
  mode?: BrfUploadWorkspaceMode;
  wizardStepOverride?: ProcurementWizardStep;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const procurementFlowState = useBrfProcurementFlowStore();
  const returnPath = pathname || routes.brf.maintenanceIndex();
  const [initialState] = useState(() => {
    const draftActions = readBrfActionsDraft();
    const storedFiles = readBrfFiles();
    const viewState = readBrfUploadViewState();
    const meta = readBrfRequestMeta();
    const actionsFromDraft = draftActions.map(toProcurementAction);
    const selectedFromDraft = draftActions
      .filter((action) => action.selected !== false)
      .map((action) => action.id);
    const hasMaintenancePlanFile = storedFiles.some(
      (file) => file.fileType === "Underhallsplan"
    );
    const procurementMaintenanceActionsVisible =
      (viewState.procurementMaintenanceActionsVisible === true && hasMaintenancePlanFile) ||
      (procurementFlowState.selectedActionIds.length > 0 && hasMaintenancePlanFile) ||
      (wizardStepOverride ?? 1) > 1;
    return {
      actionsFromDraft,
      selectedFromDraft,
      storedFiles,
      procurementMaintenanceActionsVisible,
      viewState,
      meta,
    };
  });
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [actions, setActions] = useState<ProcurementAction[]>(initialState.actionsFromDraft);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(
    procurementFlowState.selectedActionIds.length > 0
      ? procurementFlowState.selectedActionIds
      : initialState.selectedFromDraft.length > 0
      ? initialState.selectedFromDraft
      : initialState.viewState.selectedActionIds
  );
  const [searchQuery, setSearchQuery] = useState(initialState.viewState.searchQuery);
  const [categoryFilter, setCategoryFilter] = useState(initialState.viewState.categoryFilter);
  const [statusFilter, setStatusFilter] = useState(initialState.viewState.statusFilter);
  const [yearFilter, setYearFilter] = useState(initialState.viewState.yearFilter);
  const [sentCount, setSentCount] = useState(initialState.viewState.sentCount);
  const [requestTitle, setRequestTitle] = useState(
    initialState.meta.title?.trim() || initialState.viewState.requestTitle
  );
  const [extractNotice, setExtractNotice] = useState<string | null>(
    initialState.viewState.extractNotice
  );
  const [lastUploadedFileName, setLastUploadedFileName] = useState<string | null>(
    initialState.viewState.lastUploadedFileName
  );
  const [showProcurementMaintenanceActions, setShowProcurementMaintenanceActions] = useState(
    initialState.procurementMaintenanceActionsVisible
  );
  const [storedFiles, setStoredFiles] = useState<BrfFileRecord[]>(initialState.storedFiles);
  const [fileSystemNotice, setFileSystemNotice] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<ProcurementWizardStep>(wizardStepOverride ?? 1);
  const [adjustedScopeByActionId, setAdjustedScopeByActionId] = useState<Record<string, ProcurementAdjustedScopeItem>>(
    procurementFlowState.adjustedScopeByActionId
  );
  const [step2ReviewStage, setStep2ReviewStage] = useState<Step2ReviewStage>("sequential");
  const [step2ReviewIndex, setStep2ReviewIndex] = useState(0);
  const [step2ReviewInitialized, setStep2ReviewInitialized] = useState(false);
  const [step1ExpandedYears, setStep1ExpandedYears] = useState<number[]>([]);
  const [step1DrawerActionId, setStep1DrawerActionId] = useState<string | null>(null);
  const [step1DrawerAutoFocusToken, setStep1DrawerAutoFocusToken] = useState(0);
  const [lastSentRequestId, setLastSentRequestId] = useState<string | null>(
    procurementFlowState.currentRequestId ?? null
  );
  const [offersVersion, setOffersVersion] = useState(0);
  const [decisionLogsVersion, setDecisionLogsVersion] = useState(0);
  const [comparisonSort, setComparisonSort] = useState<OfferComparisonSort>("price");
  const [comparisonSortAsc, setComparisonSortAsc] = useState(true);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);
  const [step3DrawerOfferId, setStep3DrawerOfferId] = useState<string | null>(null);
  const [step3DrawerTab, setStep3DrawerTab] = useState<Step3DrawerTab>("pdf");
  const [financeRatePercent, setFinanceRatePercent] = useState(4);
  const [financeYears, setFinanceYears] = useState(20);
  const effectiveWizardStep = wizardStepOverride ?? wizardStep;
  const isAnalysisOnly = mode === "analysis-only";
  const isWizardOnly = mode === "wizard-only";
  const showUploadAndFileManagement = !isWizardOnly;

  useEffect(() => {
    const titleFromQuery = searchParams.get("title");
    const yearFromQuery = searchParams.get("year");
    if (titleFromQuery && yearFromQuery) {
      setRequestTitle(`${titleFromQuery} (${yearFromQuery})`);
      return;
    }
    if (titleFromQuery) {
      setRequestTitle(titleFromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    const syncFiles = () => setStoredFiles(readBrfFiles());
    syncFiles();
    window.addEventListener(BRF_FILES_UPDATED_EVENT, syncFiles);
    window.addEventListener("storage", syncFiles);
    return () => {
      window.removeEventListener(BRF_FILES_UPDATED_EVENT, syncFiles);
      window.removeEventListener("storage", syncFiles);
    };
  }, []);

  useEffect(() => {
    const syncDraftActions = () => {
      const draftActions = readBrfActionsDraft();
      setActions(draftActions.map(toProcurementAction));
    };
    window.addEventListener(BRF_ACTIONS_DRAFT_UPDATED_EVENT, syncDraftActions);
    window.addEventListener("storage", syncDraftActions);
    return () => {
      window.removeEventListener(BRF_ACTIONS_DRAFT_UPDATED_EVENT, syncDraftActions);
      window.removeEventListener("storage", syncDraftActions);
    };
  }, []);

  useEffect(() => {
    if (isAnalysisOnly) return;
    const hasMaintenancePlanFile = storedFiles.some(
      (file) => file.fileType === "Underhallsplan"
    );
    if (!hasMaintenancePlanFile && showProcurementMaintenanceActions) {
      setShowProcurementMaintenanceActions(false);
    }
  }, [isAnalysisOnly, showProcurementMaintenanceActions, storedFiles]);

  useEffect(() => subscribeOffers(() => setOffersVersion((v) => v + 1)), []);
  useEffect(() => subscribeOfferDecisionLogs(() => setDecisionLogsVersion((v) => v + 1)), []);

  useEffect(() => {
    if (wizardStepOverride && wizardStep !== wizardStepOverride) {
      setWizardStep(wizardStepOverride);
    }
  }, [wizardStep, wizardStepOverride]);

  useEffect(() => {
    const validSelected = selectedActionIds.filter((id) =>
      actions.some((action) => action.id === id)
    );
    writeBrfUploadViewState({
      searchQuery,
      categoryFilter,
      statusFilter,
      yearFilter,
      selectedActionIds: validSelected,
      procurementMaintenanceActionsVisible: showProcurementMaintenanceActions,
      sentCount,
      extractNotice,
      requestTitle,
      lastUploadedFileName,
    });
  }, [
    actions,
    categoryFilter,
    extractNotice,
    lastUploadedFileName,
    requestTitle,
    searchQuery,
    selectedActionIds,
    showProcurementMaintenanceActions,
    sentCount,
    statusFilter,
    yearFilter,
  ]);

  useEffect(() => {
    const selectedKey = selectedActionIds.join("|");
    const adjustedScopeJson = JSON.stringify(adjustedScopeByActionId);
    updateBrfProcurementFlowState((current) => {
      const currentSelectedKey = current.selectedActionIds.join("|");
      const currentAdjustedScopeJson = JSON.stringify(current.adjustedScopeByActionId);
      const nextRequestId = lastSentRequestId ?? current.currentRequestId;
      const nextProcurementId = nextRequestId ?? current.currentProcurementId;
      if (
        currentSelectedKey === selectedKey &&
        currentAdjustedScopeJson === adjustedScopeJson &&
        current.currentRequestId === nextRequestId &&
        current.currentProcurementId === nextProcurementId
      ) {
        return current;
      }
      return {
        ...current,
        selectedActionIds,
        adjustedScopeByActionId,
        currentRequestId: nextRequestId,
        currentProcurementId: nextProcurementId,
      };
    });
  }, [adjustedScopeByActionId, lastSentRequestId, selectedActionIds]);

  const hasSelectedImportedMaintenanceAction = useMemo(
    () => {
      const hasMaintenancePlanFile = storedFiles.some(
        (file) => file.fileType === "Underhallsplan"
      );
      if (!hasMaintenancePlanFile) return false;
      return actions.some(
        (action) =>
          action.customAction !== true && selectedActionIds.includes(action.id)
      );
    },
    [actions, selectedActionIds, storedFiles]
  );

  const step1ShowsImportedMaintenanceActions =
    isAnalysisOnly ||
    effectiveWizardStep !== 1 ||
    showProcurementMaintenanceActions ||
    hasSelectedImportedMaintenanceAction;

  const filterSourceActions = useMemo(
    () =>
      step1ShowsImportedMaintenanceActions
        ? actions
        : actions.filter((action) => action.customAction === true),
    [actions, step1ShowsImportedMaintenanceActions]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(filterSourceActions.map((action) => action.category))).sort((a, b) =>
        a.localeCompare(b, "sv")
      ),
    [filterSourceActions]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(filterSourceActions.map((action) => action.status))).sort((a, b) =>
        a.localeCompare(b, "sv")
      ),
    [filterSourceActions]
  );

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(filterSourceActions.map((action) => action.plannedYear))).sort(
        (a, b) => a - b
      ),
    [filterSourceActions]
  );

  const filteredActions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return filterSourceActions.filter(
      (action) =>
        (q.length === 0 ||
          action.title.toLowerCase().includes(q) ||
          action.category.toLowerCase().includes(q)) &&
        (categoryFilter === "alla" || action.category === categoryFilter) &&
        (statusFilter === "alla" || action.status === statusFilter) &&
        (yearFilter === "alla" || String(action.plannedYear) === yearFilter)
    );
  }, [filterSourceActions, searchQuery, categoryFilter, statusFilter, yearFilter]);

  const selectedActions = useMemo(
    () => actions.filter((action) => selectedActionIds.includes(action.id)),
    [actions, selectedActionIds]
  );
  const selectedSummary = useMemo(() => deriveSelectedSummary(selectedActions), [selectedActions]);
  const step1SelectedActions = useMemo(
    () => filterSourceActions.filter((action) => selectedActionIds.includes(action.id)),
    [filterSourceActions, selectedActionIds]
  );
  const step1SelectedSummary = useMemo(
    () => deriveSelectedSummary(step1SelectedActions),
    [step1SelectedActions]
  );
  const filteredActionsByYear = useMemo(() => {
    const grouped = filteredActions.reduce<Record<number, ProcurementAction[]>>((acc, action) => {
      const year = Number.isFinite(action.plannedYear) ? action.plannedYear : new Date().getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(action);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([year, items]) => ({
        year: Number(year),
        items: [...items].sort((a, b) => a.title.localeCompare(b.title, "sv")),
        overdueCount: items.filter((item) => item.status === "Eftersatt").length,
      }))
      .sort((a, b) => a.year - b.year);
  }, [filteredActions]);
  const hasImportedMaintenanceActions = useMemo(
    () => actions.some((action) => action.customAction !== true),
    [actions]
  );
  const step1DrawerAction = useMemo(
    () => actions.find((action) => action.id === step1DrawerActionId) ?? null,
    [actions, step1DrawerActionId]
  );

  useEffect(() => {
    if (effectiveWizardStep !== 2) {
      if (step2ReviewInitialized) setStep2ReviewInitialized(false);
      return;
    }
    if (step2ReviewInitialized) return;
    setStep2ReviewStage(selectedActions.length > 5 ? "overview" : "sequential");
    setStep2ReviewIndex(0);
    setStep2ReviewInitialized(true);
  }, [effectiveWizardStep, selectedActions.length, step2ReviewInitialized]);

  useEffect(() => {
    setStep2ReviewIndex((current) => {
      if (selectedActions.length <= 1) return 0;
      return Math.min(current, selectedActions.length - 1);
    });
    if (selectedActions.length === 0 && effectiveWizardStep === 2) {
      setStep2ReviewStage("overview");
    }
  }, [effectiveWizardStep, selectedActions.length]);

  useEffect(() => {
    if (!(isAnalysisOnly || effectiveWizardStep === 1)) return;
    if (filteredActionsByYear.length === 1) {
      const onlyYear = filteredActionsByYear[0]?.year;
      if (typeof onlyYear === "number") {
        setStep1ExpandedYears((current) => (current.length === 1 && current[0] === onlyYear ? current : [onlyYear]));
      }
      return;
    }
    setStep1ExpandedYears((current) => current.filter((year) => filteredActionsByYear.some((group) => group.year === year)));
  }, [effectiveWizardStep, filteredActionsByYear, isAnalysisOnly]);

  const totalFilteredBudget = useMemo(
    () =>
      filteredActions.reduce((sum, action) => sum + (action.estimatedPriceSek || 0), 0),
    [filteredActions]
  );

  const overdueCount = useMemo(
    () => filteredActions.filter((action) => action.status === "Eftersatt").length,
    [filteredActions]
  );

  const groupedStoredFiles = useMemo(() => {
    return storedFiles.reduce<Record<string, BrfFileRecord[]>>((acc, file) => {
      const group = file.contentGroup || inferContentGroup(file.fileType);
      if (!acc[group]) acc[group] = [];
      acc[group].push(file);
      return acc;
    }, {});
  }, [storedFiles]);
  const hasStoredMaintenancePlanFile = useMemo(
    () => storedFiles.some((file) => file.fileType === "Underhallsplan"),
    [storedFiles]
  );

  useEffect(() => {
    setAdjustedScopeByActionId((current) => {
      const selectedIds = new Set(selectedActions.map((action) => action.id));
      const next: Record<string, ProcurementAdjustedScopeItem> = {};
      selectedActions.forEach((action) => {
        next[action.id] = current[action.id] ?? buildAdjustedScopeItem(action);
      });
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      const unchanged =
        currentKeys.length === nextKeys.length &&
        currentKeys.every((key) => selectedIds.has(key) && next[key] === current[key]);
      return unchanged ? current : next;
    });
  }, [selectedActions]);

  const persistDraft = (nextActions: ProcurementAction[], nextSelectedIds: string[]) => {
    writeBrfActionsDraft(
      nextActions.map((action) => ({
        ...fromProcurementAction(action),
        selected: nextSelectedIds.includes(action.id),
      }))
    );
  };

  const clearImportedMaintenanceActions = (notice: string) => {
    const remainingActions = actions.filter((action) => action.customAction === true);
    const remainingIds = new Set(remainingActions.map((action) => action.id));
    const remainingSelectedIds = selectedActionIds.filter((id) => remainingIds.has(id));

    if (remainingActions.length !== actions.length) {
      setActions(remainingActions);
      setSelectedActionIds(remainingSelectedIds);
      persistDraft(remainingActions, remainingSelectedIds);
      setExtractNotice(notice);
      setLastUploadedFileName(null);
      setShowProcurementMaintenanceActions(false);

      if (step1DrawerActionId && !remainingIds.has(step1DrawerActionId)) {
        setStep1DrawerActionId(null);
      }

      updateBrfProcurementFlowState((current) => {
        const nextAdjustedScopeByActionId = Object.fromEntries(
          Object.entries(current.adjustedScopeByActionId).filter(([actionId]) => remainingIds.has(actionId))
        );
        const nextSelected = current.selectedActionIds.filter((id) => remainingIds.has(id));
        if (
          nextSelected.length === current.selectedActionIds.length &&
          Object.keys(nextAdjustedScopeByActionId).length === Object.keys(current.adjustedScopeByActionId).length
        ) {
          return current;
        }
        return {
          ...current,
          selectedActionIds: nextSelected,
          adjustedScopeByActionId: nextAdjustedScopeByActionId,
        };
      });
    }
  };

  const importMaintenanceActionsIntoProcurement = () => {
    const hasMaintenancePlanFile = storedFiles.some(
      (file) => file.fileType === "Underhallsplan"
    );
    if (!hasMaintenancePlanFile) {
      setExtractNotice(
        "Ingen underhållsplan hittades i projektets filer ännu. Lägg till eller öppna underhållsplanen först."
      );
      return;
    }

    const draftActions = readBrfActionsDraft();
    const importedDraftActions = draftActions.filter((action) => action.customAction !== true);
    if (importedDraftActions.length === 0) {
      setExtractNotice(
        "Inga poster hittades att hämta från underhållsplanen ännu. Gå till underhållsplanen och extrahera/välj poster först."
      );
      return;
    }

    setActions(draftActions.map(toProcurementAction));
    setShowProcurementMaintenanceActions(true);
    setExtractNotice(
      `Hämtade ${importedDraftActions.length} poster från underhållsplanen till offertflödet.`
    );
  };

  const openCreateCustomActionModal = () => {
    const customActionId = `custom-${Date.now()}`;
    const currentYear = new Date().getFullYear();
    const nextAction: ProcurementAction = {
      id: customActionId,
      title: "",
      category: "Övrigt",
      status: "Planerad",
      plannedYear: currentYear,
      estimatedPriceSek: 0,
      emissionsKgCo2e: 0,
      source: "local",
      customAction: true,
      details: "",
      rawRow: "Manuellt skapad",
      sourceSheet: "Manuellt skapad",
      extraDetails: [],
    };
    const nextActions = [nextAction, ...actions];
    const nextSelectedIds = Array.from(new Set([customActionId, ...selectedActionIds]));
    setActions(nextActions);
    setSelectedActionIds(nextSelectedIds);
    persistDraft(nextActions, nextSelectedIds);
    setStep1DrawerActionId(customActionId);
    setStep1DrawerAutoFocusToken((v) => v + 1);
    setStep1ExpandedYears((current) =>
      current.includes(currentYear) ? current : [...current, currentYear].sort((a, b) => a - b)
    );
    setExtractNotice("Ny egen åtgärd skapad. Fyll i detaljer i panelen till höger.");
  };

  const removeStoredFile = (fileId: string) => {
    const filesBefore = readBrfFiles();
    const removedFile = filesBefore.find((file) => file.id === fileId);
    removeWorkspaceFile("brf", fileId);
    setFileSystemNotice("Fil borttagen.");

    const remainingFiles = filesBefore.filter((file) => file.id !== fileId);
    const hasRemainingMaintenancePlan = remainingFiles.some((file) => file.fileType === "Underhallsplan");
    if (removedFile?.fileType === "Underhallsplan" && !hasRemainingMaintenancePlan) {
      clearImportedMaintenanceActions(
        "Underhållsplanen togs bort. Inlästa poster från underhållsplanen har rensats från offertflödet."
      );
    }
  };

  const clearAllStoredFiles = () => {
    const filesBefore = readBrfFiles();
    const hadMaintenancePlan = filesBefore.some((file) => file.fileType === "Underhallsplan");
    clearWorkspaceFiles("brf");
    setFileSystemNotice("Alla uppladdade filer rensades.");
    if (hadMaintenancePlan) {
      clearImportedMaintenanceActions(
        "Alla underhållsplansfiler togs bort. Inlästa poster från underhållsplanen har rensats från offertflödet."
      );
    }
  };

  const structureStoredFiles = () => {
    const structured = structureWorkspaceFiles("brf");
    setStoredFiles(structured);
    setFileSystemNotice("Filstrukturen uppdaterades efter innehåll.");
  };

  const openStoredFile = (fileId: string) => {
    const ok = openWorkspaceFile("brf", fileId);
    if (!ok) {
      setFileSystemNotice(
        "Filen kan inte öppnas lokalt ännu. Ladda upp den igen om du vill förhandsvisa den här."
      );
    } else {
      setFileSystemNotice(null);
    }
  };

  const toggleAction = (id: string) => {
    const nextSelected = selectedActionIds.includes(id)
      ? selectedActionIds.filter((x) => x !== id)
      : [...selectedActionIds, id];
    setSelectedActionIds(nextSelected);
    persistDraft(actions, nextSelected);
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredActions.map((a) => a.id);
    const nextSelected = Array.from(new Set([...selectedActionIds, ...filteredIds]));
    setSelectedActionIds(nextSelected);
    persistDraft(actions, nextSelected);
  };

  const unselectAllFiltered = () => {
    const filteredIdSet = new Set(filteredActions.map((a) => a.id));
    const nextSelected = selectedActionIds.filter((id) => !filteredIdSet.has(id));
    setSelectedActionIds(nextSelected);
    persistDraft(actions, nextSelected);
  };

  const clearSelection = () => {
    setSelectedActionIds([]);
    persistDraft(actions, []);
  };

  const toggleStep1Year = (year: number) => {
    setStep1ExpandedYears((current) =>
      current.includes(year) ? current.filter((value) => value !== year) : [...current, year].sort((a, b) => a - b)
    );
  };

  const updateAdjustedScope = (
    actionId: string,
    updater: (current: ProcurementAdjustedScopeItem) => ProcurementAdjustedScopeItem
  ) => {
    setAdjustedScopeByActionId((current) => {
      const existing = current[actionId];
      if (!existing) return current;
      const next = updater(existing);
      if (next === existing) return current;
      return { ...current, [actionId]: next };
    });
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    setSentCount(0);
    setExtractNotice(null);
    setLastUploadedFileName(file.name);
    await persistUploadedBrfFile(file, requestTitle.trim() || "BRF underhållsprojekt");
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          errorPayload?.error || `Extraktion misslyckades (${response.status})`
        );
      }

      const payload = (await response.json()) as { actions?: ProcurementAction[] };
      const extracted = Array.isArray(payload.actions) ? payload.actions : [];
      if (extracted.length === 0) {
        throw new Error("AI returnerade ingen åtgärdslista.");
      }
      const normalized = extracted.map((action, index) => ({
        ...action,
        id: action.id || `ai-${Date.now()}-${index}`,
        source: action.source || "ai",
      }));
      setActions(normalized);
      setSelectedActionIds(normalized.map((item) => item.id));
      writeBrfActionsDraft(normalized.map(fromProcurementAction));
      writeBrfRequestMeta({
        startMode: "underhallsplan",
        title: requestTitle.trim() || "BRF underhållsprojekt",
        description: `${normalized.length} extraherade åtgärder från underhållsplan.`,
      });
      setExtractNotice("AI-extraktion klar. Granska listan och skicka förfrågan.");
    } catch (error) {
      const extracted = await extractActions(file);
      setActions(extracted);
      setSelectedActionIds(extracted.map((item) => item.id));
      writeBrfActionsDraft(extracted.map(fromProcurementAction));
      writeBrfRequestMeta({
        startMode: "underhallsplan",
        title: requestTitle.trim() || "BRF underhållsprojekt",
        description: `${extracted.length} extraherade åtgärder från underhållsplan.`,
      });
      setExtractNotice(
        `AI-extraktion kunde inte användas just nu (${error instanceof Error ? error.message : "okänt fel"}). Visar lokal fallback-lista.`
      );
    }
    setIsExtracting(false);
  };

  const sendRequest = (
    selected: ProcurementAction[],
    options?: {
      mallVersionId?: string;
      adjustedScope?: ProcurementAdjustedScopeItem[];
      replyDeadline?: string;
    }
  ): PlatformRequest | null => {
    if (selected.length === 0) return null;
    const profile = readBrfProfile();
    const storedFiles = readBrfFiles();
    const fallbackFile: BrfFileRecord[] =
      file === null
        ? []
        : [
            {
              id: `${file.name.toLowerCase()}-${file.size}`,
              name: file.name,
              fileType: inferBrfFileType(file.name),
              extension: getFileExtension(file.name),
              sizeKb: Number((file.size / 1024).toFixed(1)),
              uploadedAt: new Date().toISOString(),
              sourceLabel: "Underhållsplan",
            },
          ];
    const requestFiles = storedFiles.length > 0 ? storedFiles : fallbackFile;
    const propertySnapshot: RequestPropertySnapshot = {
      audience: "brf",
      title: profile.propertyName,
      address: toAddress([profile.addressLine, `${profile.postalCode} ${profile.city}`]),
      buildingYear: profile.buildingYear,
      apartmentsCount: profile.apartmentsCount,
      buildingsCount: profile.buildingsCount,
      areaSummary: `BOA ${profile.boaM2 || "?"} m² · LOA ${profile.loaM2 || "?"} m²`,
      occupancy: "Boende kvar under större delar av genomförandet",
      accessAndLogistics: profile.accessibilityLogistics,
      knownConstraints: profile.authorityConstraints,
      contactName: profile.procurementContact,
      contactEmail: profile.procurementEmail,
      contactPhone: profile.procurementPhone,
    };
    const plannedYears = selected
      .map((action) => action.plannedYear)
      .filter((year): year is number => Number.isFinite(year));
    const earliestYear = plannedYears.length > 0 ? Math.min(...plannedYears) : undefined;
    const snapshot = buildProjectSnapshotFromBrfSeed({
      title: requestTitle.trim() || "BRF underhållsprojekt",
      location:
        toAddress([profile.addressLine, `${profile.postalCode} ${profile.city}`]) ||
        "Stockholm",
      description: `${selected.length} åtgärder markerade för offertförfrågan.`,
      actions: selected,
      files: requestFiles.map((record) => ({
        id: record.id,
        name: record.name,
        type: getFileTypeLabel(record.fileType),
        size: Math.round(record.sizeKb * 1024),
        tags: [getFileTypeLabel(record.fileType), record.sourceLabel],
      })),
      desiredStartFrom: earliestYear ? `${earliestYear}-04-01` : undefined,
      desiredStartTo: earliestYear ? `${earliestYear}-09-30` : undefined,
      projectSpecific: {
        apartmentsCount: profile.apartmentsCount,
        buildingsCount: profile.buildingsCount,
        boaM2: profile.boaM2,
        loaM2: profile.loaM2,
      },
    });
    const recipients = defaultRecipientsForAudience("brf");
    const createdAtIso = new Date().toISOString();
    const replyDeadline =
      options?.replyDeadline ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const originalScope = selected.map((action) => buildOriginalScopeItem(action));
    const adjustedScope = (options?.adjustedScope ?? []).map((item) => toRequestProcurementScopeItem(item));
    const derivedMallVersionId =
      options?.mallVersionId ??
      (Array.from(new Set((options?.adjustedScope ?? []).map((item) => item.templateVersionId))).join("+") ||
        "byggprocess-v1-general");

    const nextRequest: PlatformRequest = {
      id: `req-${Date.now()}`,
      refId: "",
      createdAt: createdAtIso,
      audience: "brf",
      status: "sent",
      requestType: "offer_request_v1",
      snapshot,
      title: snapshot.overview.title,
      location: snapshot.overview.location || "Stockholm",
      budgetRange: formatSnapshotBudget(snapshot),
      desiredStart: formatSnapshotTimeline(snapshot),
      scope: {
        actions: selected,
        scopeItems: selected.map((action) => ({ title: action.title, details: action.details })),
      },
      completeness: snapshot.completenessScore,
      missingInfo: [
        ...(requestFiles.length === 0 ? ["Inga bilagor uppladdade."] : []),
        ...(profile.procurementContact.trim().length === 0 ? ["Kontaktperson saknas."] : []),
      ],
      documentationLevel: file ? `Underhållsplan uppladdad: ${file.name}` : "Skiss/plan",
      riskProfile: toSwedishRiskLabel(snapshot.riskProfile.level),
      actions: selected,
      propertySnapshot,
      documentSummary: buildDocumentSummary(requestFiles),
      files: mapFilesForRequest(requestFiles),
      recipients,
      distribution: recipients.map((recipient) => toRecipientLabel(recipient)),
      sharingApproved: false,
      replyDeadline,
      procurementWizard: {
        mallVersionId: derivedMallVersionId,
        sentAt: createdAtIso,
        originalScope,
        adjustedScope: adjustedScope.length > 0 ? adjustedScope : undefined,
      },
    };

    persistDraft(actions, selectedActionIds);
    writeBrfRequestMeta({
      startMode: "underhallsplan",
      title: snapshot.overview.title,
      description: snapshot.overview.description,
      location: snapshot.overview.location,
      desiredStartFrom: snapshot.timeline.desiredStartFrom,
      desiredStartTo: snapshot.timeline.desiredStartTo,
      flexibleStart: snapshot.timeline.flexibility === "flexible",
      budgetMinSek: snapshot.budget.min,
      budgetMaxSek: snapshot.budget.max,
      contactName: profile.procurementContact,
      contactEmail: profile.procurementEmail,
      contactPhone: profile.procurementPhone,
      budgetUnknown: snapshot.budget.min == null && snapshot.budget.max == null,
    });
    saveRequest(nextRequest);
    setSentCount((c) => c + 1);
    return nextRequest;
  };

  const adjustedScopeList = useMemo(
    () =>
      selectedActions
        .map((action) => adjustedScopeByActionId[action.id])
        .filter((item): item is ProcurementAdjustedScopeItem => Boolean(item)),
    [adjustedScopeByActionId, selectedActions]
  );

  const resolvedMallVersionId = useMemo(() => {
    const unique = Array.from(new Set(adjustedScopeList.map((item) => item.templateVersionId)));
    return unique.length > 0 ? unique.join("+") : "byggprocess-v1-general";
  }, [adjustedScopeList]);

  const step2CurrentAction = useMemo(
    () => selectedActions[step2ReviewIndex] ?? null,
    [selectedActions, step2ReviewIndex]
  );
  const step2CurrentAdjustedScope = useMemo(
    () => (step2CurrentAction ? adjustedScopeByActionId[step2CurrentAction.id] ?? null : null),
    [adjustedScopeByActionId, step2CurrentAction]
  );
  const step2CurrentTemplate = useMemo(
    () => (step2CurrentAction ? resolveProcurementTemplate(step2CurrentAction) : null),
    [step2CurrentAction]
  );
  const showStep2Overview = step2ReviewStage === "overview" && selectedActions.length > 5;
  const showStep2Summary = step2ReviewStage === "summary";

  const startSequentialStep2Review = (startIndex = 0) => {
    const clampedIndex =
      selectedActions.length === 0 ? 0 : Math.min(Math.max(startIndex, 0), selectedActions.length - 1);
    setStep2ReviewIndex(clampedIndex);
    setStep2ReviewStage("sequential");
  };

  const handleStep2SaveAndNext = () => {
    if (selectedActions.length === 0) {
      setStep2ReviewStage("overview");
      return;
    }
    if (step2ReviewIndex >= selectedActions.length - 1) {
      setStep2ReviewStage("summary");
      return;
    }
    setStep2ReviewIndex((current) => Math.min(current + 1, selectedActions.length - 1));
  };

  const comparisonProjectId = useMemo(() => {
    if (lastSentRequestId) return lastSentRequestId;
    const latestMatching = listRequests().find(
      (request) =>
        request.audience === "brf" &&
        request.title === (requestTitle.trim() || request.title) &&
        (request.scope.actions?.length ?? 0) > 0
    );
    return latestMatching?.id ?? null;
  }, [lastSentRequestId, requestTitle, sentCount]);

  const realComparisonOffers = useMemo(() => {
    const marker = offersVersion;
    void marker;
    if (!comparisonProjectId) return [];
    return listLatestOffersByProject(comparisonProjectId).filter((offer) => offer.status !== "draft");
  }, [comparisonProjectId, offersVersion]);

  const comparisonCandidates = useMemo(() => {
    if (!comparisonProjectId) return [];
    const fromReal = buildComparisonCandidatesFromOffers(realComparisonOffers);
    if (fromReal.length > 0) return fromReal;
    if (effectiveWizardStep === 3) {
      return buildMockComparisonCandidates(comparisonProjectId, selectedActions, selectedSummary.totalBudget);
    }
    return [];
  }, [comparisonProjectId, effectiveWizardStep, realComparisonOffers, selectedActions, selectedSummary.totalBudget]);

  const sortedComparisonCandidates = useMemo(() => {
    const list = [...comparisonCandidates];
    list.sort((a, b) => {
      const dir = comparisonSortAsc ? 1 : -1;
      if (comparisonSort === "price") return (a.priceIncVat - b.priceIncVat) * dir;
      return (a.timeWeeks - b.timeWeeks) * dir;
    });
    return list;
  }, [comparisonCandidates, comparisonSort, comparisonSortAsc]);

  const lowestPriceId = useMemo(() => {
    if (comparisonCandidates.length === 0) return null;
    return comparisonCandidates.reduce((min, candidate) => (candidate.priceIncVat < min.priceIncVat ? candidate : min)).id;
  }, [comparisonCandidates]);

  const comparisonDecisionLogs = useMemo(() => {
    const marker = decisionLogsVersion;
    void marker;
    if (!comparisonProjectId) return [];
    return listOfferDecisionLogsByProject(comparisonProjectId);
  }, [comparisonProjectId, decisionLogsVersion]);

  const latestDecision = comparisonDecisionLogs[0] ?? null;

  useEffect(() => {
    if (!selectedComparisonId && latestDecision) {
      setSelectedComparisonId(latestDecision.offerId);
    }
  }, [latestDecision, selectedComparisonId]);

  const activeStep3Candidate = useMemo(
    () =>
      sortedComparisonCandidates.find((candidate) => candidate.id === (step3DrawerOfferId ?? selectedComparisonId)) ??
      sortedComparisonCandidates[0] ??
      null,
    [selectedComparisonId, sortedComparisonCandidates, step3DrawerOfferId]
  );

  const step3RelatedQuoteDocHtml = useMemo(() => {
    if (!comparisonProjectId) return null;
    const quoteDoc =
      listDocumentsByRequest(comparisonProjectId)
        .filter((doc) => doc.type === "quote" && (doc.status === "accepted" || doc.status === "sent"))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
    if (!quoteDoc) return null;
    const relatedRequest = listRequests().find((request) => request.id === comparisonProjectId) ?? null;
    return renderDocumentToHtml(quoteDoc, relatedRequest);
  }, [comparisonProjectId, offersVersion, sentCount]);

  const handleSendWizardRequest = () => {
    const replyDeadline = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const created = sendRequest(selectedActions, {
      mallVersionId: resolvedMallVersionId,
      adjustedScope: adjustedScopeList,
      replyDeadline,
    });
    if (!created) return;
    setLastSentRequestId(created.id);
    persistProcurementFlowSnapshot(created.id);
    goToWizardStep(3);
  };

  const handleChooseContractor = async (candidate: ComparisonCandidate) => {
    const motivation =
      typeof window !== "undefined"
        ? window.prompt("Valfri motivering till beslut (kan lämnas tom):", "")
        : "";
    if (candidate.offer && !candidate.isMock) {
      setOfferStatus(candidate.offer.id, "accepted");
    }
    if (comparisonProjectId) {
      createOfferDecisionLogEntry({
        projectId: comparisonProjectId,
        offerId: candidate.id,
        contractorId: candidate.contractorId,
        offerLabel: candidate.label,
        userLabel: "BRF-användare",
        motivation: motivation?.trim() ? motivation.trim() : undefined,
        isMock: candidate.isMock,
      });
    }
    setSelectedComparisonId(candidate.id);
  };

  const nextStepPanel = useMemo(() => {
    if (!comparisonProjectId) {
      return {
        title: "Nästa steg",
        body: "Starta offertförfrågan genom att välja åtgärder och gå vidare till granskning.",
        cta: "Starta offertförfrågan",
        targetStep: 1 as ProcurementWizardStep,
      };
    }
    if (comparisonCandidates.length === 0) {
      return {
        title: "Nästa steg",
        body: "Förfrågan är skickad. Invänta svar från entreprenörer och följ status i Mina förfrågningar.",
        cta: "Invänta svar",
        targetStep: 3 as ProcurementWizardStep,
      };
    }
    return {
      title: "Nästa steg",
      body: "Offerter finns. Jämför pris, tid och villkor och välj entreprenör.",
      cta: "Jämför och välj",
      targetStep: 3 as ProcurementWizardStep,
    };
  }, [comparisonCandidates.length, comparisonProjectId]);

  const routeForWizardStep = (step: ProcurementWizardStep) => {
    if (step === 1) return routes.brf.procurementOfferStep1();
    if (step === 2) return routes.brf.procurementOfferStep2();
    return routes.brf.procurementOfferStep3();
  };

  const persistProcurementFlowSnapshot = (nextStepRequestId?: string | null) => {
    updateBrfProcurementFlowState((current) => ({
      ...current,
      selectedActionIds,
      adjustedScopeByActionId,
      currentRequestId: nextStepRequestId ?? lastSentRequestId ?? current.currentRequestId,
      currentProcurementId:
        nextStepRequestId ?? lastSentRequestId ?? current.currentProcurementId,
    }));
  };

  const goToWizardStep = (step: ProcurementWizardStep) => {
    if (isWizardOnly) {
      persistProcurementFlowSnapshot();
      router.push(routeForWizardStep(step));
      return;
    }
    setWizardStep(step);
  };

  const goToProcurementFlow = (preferredStep: ProcurementWizardStep = 2) => {
    const targetStep = selectedSummary.count > 0 ? preferredStep : 1;
    persistProcurementFlowSnapshot();
    router.push(routeForWizardStep(targetStep));
  };

  const shouldRenderProcurementPanel =
    actions.length > 0 || effectiveWizardStep === 1 || isAnalysisOnly;

  const content = (
    <div className="mx-auto max-w-7xl">
        {!embedded && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                BRF · Underhåll & upphandling
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Ladda upp underhållsplan och extrahera åtgärder
              </h1>
              <p className="mt-2 text-sm text-[#766B60]">
                Plattformen läser underhållsplanen, föreslår åtgärdslista och låter dig
                skicka förfrågningar till entreprenörer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={routes.brf.overview()}
                className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Till BRF-dashboard
              </Link>
              <Link
                href={routes.brf.requestsIndex()}
                className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
              >
                Mina förfrågningar
              </Link>
            </div>
          </div>
        )}

        <section className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold tracking-tight text-[#2A2520]">
              Fastighetskontext
            </h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Projekt
                </p>
                <p className="mt-1 font-semibold text-[#2A2520]">{requestTitle}</p>
              </div>
              <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Fil
                </p>
                <p className="mt-1 font-semibold text-[#2A2520]">
                  {file ? file.name : lastUploadedFileName || "Ingen fil vald ännu"}
                </p>
              </div>
              <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Filtrerade åtgärder
                </p>
                <p className="mt-1 font-semibold text-[#2A2520]">{filteredActions.length}</p>
              </div>
              <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Total budget (filtrerat)
                </p>
                <p className="mt-1 font-semibold text-[#2A2520]">
                  {formatSek(totalFilteredBudget)}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-lg font-bold tracking-tight text-[#2A2520]">
              Risk & prioritering
            </h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                  Eftersatta åtgärder
                </p>
                <p className="mt-1 text-2xl font-bold text-[#2A2520]">{overdueCount}</p>
              </div>
              <p className="rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
                Tips: filtrera på <span className="font-semibold">Status: Eftersatt</span>{" "}
                och skicka först de mest kritiska åtgärderna till entreprenör.
              </p>
            </div>
          </article>
        </section>

        {showUploadAndFileManagement && (
        <>
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[#2A2520]">
                Underhållsplan (PDF, DOCX, XLSX, TXT)
              </label>
              <input
                type="file"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] ?? null;
                  setFile(nextFile);
                  if (nextFile) {
                    setLastUploadedFileName(nextFile.name);
                  }
                }}
                className="block w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
              />
              <label className="block text-sm font-semibold text-[#2A2520]">
                Projekttitel för förfrågan
              </label>
              <input
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleExtract}
              disabled={!file || isExtracting}
              className="rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-6 py-3 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExtracting ? "Analyserar med AI..." : "Extrahera åtgärder"}
            </button>
          </div>
          {sentCount > 0 && (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Förfrågan skickad ({sentCount}). Öppna “Mina förfrågningar” för status,
              mottagare och kompletteringar.
            </p>
          )}
          {extractNotice && (
            <p className="mt-3 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B5A47]">
              {extractNotice}
            </p>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#2A2520]">
                Dokumentöversikt
              </h2>
              <p className="mt-1 text-sm text-[#766B60]">
                Filerna sorteras automatiskt efter innehållstyp. Klicka på en fil för att öppna.
              </p>
            </div>
            <button
              type="button"
              onClick={structureStoredFiles}
              disabled={storedFiles.length === 0}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Strukturera efter innehåll
            </button>
            <button
              type="button"
              onClick={clearAllStoredFiles}
              disabled={storedFiles.length === 0}
              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Rensa alla filer
            </button>
          </div>

          {fileSystemNotice && (
            <p className="mt-3 rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B5A47]">
              {fileSystemNotice}
            </p>
          )}

          {storedFiles.length === 0 && (
            <p className="mt-4 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B5A47]">
              Inga uppladdade filer ännu.
            </p>
          )}

          {storedFiles.length > 0 && (
            <div className="mt-4 space-y-4">
              {Object.entries(groupedStoredFiles)
                .sort(([a], [b]) => a.localeCompare(b, "sv"))
                .map(([group, filesInGroup]) => (
                  <article
                    key={group}
                    className="rounded-2xl border border-[#EFE8DD] bg-[#FAF8F5] p-4"
                  >
                    <h3 className="text-sm font-semibold text-[#2A2520]">
                      {group} ({filesInGroup.length})
                    </h3>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[860px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[#E6DFD6] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                            <th className="px-3 py-3">Fil</th>
                            <th className="px-3 py-3">Filtyp</th>
                            <th className="px-3 py-3">Taggar</th>
                            <th className="px-3 py-3">Källa</th>
                            <th className="px-3 py-3">Åtgärd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filesInGroup.map((storedFile) => (
                            <tr key={storedFile.id} className="border-b border-[#EFE8DD]">
                              <td className="px-3 py-3 font-semibold text-[#2A2520]">
                                {storedFile.name}
                              </td>
                              <td className="px-3 py-3">{getFileTypeLabel(storedFile.fileType)}</td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {(storedFile.tags || []).slice(0, 4).map((tag) => (
                                    <span
                                      key={`${storedFile.id}-${tag}`}
                                      className="rounded-full border border-[#D9D1C6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-3">{storedFile.sourceLabel}</td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openStoredFile(storedFile.id)}
                                    className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                                  >
                                    {hasWorkspaceFilePayload("brf", storedFile.id)
                                      ? "Öppna"
                                      : "Öppna (saknas lokalt)"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeStoredFile(storedFile.id)}
                                    className="rounded-lg border border-[#E8D4BF] bg-white px-3 py-1.5 text-xs font-semibold text-[#8A5B2A] hover:bg-[#FFF5EA]"
                                  >
                                    Ta bort
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>
        </>
        )}

        {isWizardOnly && actions.length === 0 && effectiveWizardStep !== 1 && (
          <section className="mt-6 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Upphandling</p>
            <h2 className="mt-1 text-lg font-bold text-[#2A2520]">Inga åtgärder valda ännu</h2>
            <p className="mt-2 text-sm text-[#6B5A47]">
              Gå till underhållsplanen för att analysera och välja åtgärder innan du startar offertflödet.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={routes.brf.maintenanceIndex()}
                className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Gå till underhållsplan
              </Link>
              <Link
                href={routes.brf.procurementOfferStep1()}
                className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
              >
                Öppna offertflöde steg 1
              </Link>
            </div>
          </section>
        )}

        {shouldRenderProcurementPanel && (
          <section className="mt-6 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                    {isAnalysisOnly ? "Underhållsplan · Analys & urval" : `Offertflöde – Steg ${effectiveWizardStep} av 3`}
                  </p>
                  <h2 className="text-lg font-bold text-[#2A2520]">
                    {isAnalysisOnly ? "Analys & urval inför upphandling" : createWizardStepperLabels(effectiveWizardStep).find((s) => s.id === effectiveWizardStep)?.label}
                  </h2>
                  {isAnalysisOnly && (
                    <p className="mt-1 text-sm text-[#6B5A47]">
                      Välj åtgärder i underhållsplanen. Själva offertflödet har flyttat till Upphandling.
                    </p>
                  )}
                </div>
                {isAnalysisOnly ? (
                  <button
                    type="button"
                    onClick={() => goToProcurementFlow(selectedSummary.count > 0 ? 2 : 1)}
                    className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                  >
                    {selectedSummary.count > 0 ? "Starta upphandling" : "Gå till upphandling"}
                  </button>
                ) : effectiveWizardStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => goToWizardStep(2)}
                    disabled={step1SelectedSummary.count === 0}
                    className="rounded-xl bg-[#E7B54A] px-4 py-2 text-sm font-semibold text-[#2A2520] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Fortsätt ({step1SelectedSummary.count} valda)
                  </button>
                ) : (
                  <div className="rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#6B5A47]">
                    {nextStepPanel.title}: <span className="font-semibold text-[#2A2520]">{nextStepPanel.body}</span>
                    <button
                      type="button"
                      onClick={() => goToWizardStep(nextStepPanel.targetStep)}
                      className="ml-3 rounded-lg border border-[#D2C5B5] bg-[#FAF8F5] px-2.5 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-white"
                    >
                      {nextStepPanel.cta}
                    </button>
                  </div>
                )}
              </div>

              {isAnalysisOnly ? (
                <div className="mt-4 rounded-xl border border-[#D7C3A8] bg-[#FFF6E8] px-4 py-3 text-sm text-[#6B5A47]">
                  Offertflödet har flyttat till <span className="font-semibold text-[#2A2520]">Upphandling</span>.
                  Välj åtgärder här och fortsätt sedan till steg 2 för granskning och utskick.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="h-2 rounded-full bg-[#E8E3DC]">
                    <div
                      className="h-full rounded-full bg-[#8C7860]"
                      style={{ width: `${Math.max(12, Math.round((effectiveWizardStep / 3) * 100))}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {createWizardStepperLabels(effectiveWizardStep).map((stepItem) => (
                      <button
                        key={stepItem.id}
                        type="button"
                        onClick={() => {
                          if (stepItem.id === 2 && step1SelectedSummary.count === 0) return;
                          if (stepItem.id === 3 && !comparisonProjectId && sentCount === 0) return;
                          goToWizardStep(stepItem.id);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          stepItem.active
                            ? "border-[#8C7860] bg-[#F6F0E8] text-[#2A2520]"
                            : stepItem.complete
                              ? "border-[#D9D1C6] bg-white text-[#6B5A47]"
                              : "border-[#E8E3DC] bg-white text-[#6B5A47]"
                        }`}
                      >
                        {stepItem.id}. {stepItem.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(isAnalysisOnly || effectiveWizardStep === 1) && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6B5A47]">
                  <span>
                    Valda: <span className="font-semibold text-[#2A2520]">{(isAnalysisOnly ? selectedSummary : step1SelectedSummary).count}</span>
                  </span>
                  <span className="text-[#B7AA9A]">|</span>
                  <span>
                    Budget: <span className="font-semibold text-[#2A2520]">{formatSek((isAnalysisOnly ? selectedSummary : step1SelectedSummary).totalBudget)}</span>
                  </span>
                  <span className="text-[#B7AA9A]">|</span>
                  <span>
                    Eftersatta: <span className="font-semibold text-[#2A2520]">{(isAnalysisOnly ? selectedSummary : step1SelectedSummary).overdueCount}</span>
                  </span>
                  <span className="text-[#B7AA9A]">|</span>
                  <span>
                    CO₂:{" "}
                    <span className="font-semibold text-[#2A2520]">
                      {new Intl.NumberFormat("sv-SE").format(Math.round((isAnalysisOnly ? selectedSummary : step1SelectedSummary).totalCo2e))} kg
                    </span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Sök åtgärd efter namn eller kategori"
                    className="min-w-[260px] flex-1 rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                  >
                    <option value="alla">Kategori: Alla</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                  >
                    <option value="alla">Status: Alla</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                  >
                    <option value="alla">Planerat år: Alla</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openCreateCustomActionModal}
                    className="rounded-xl border border-[#D2C5B5] bg-[#FFF8EB] px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#FFF2D8]"
                  >
                    + Skapa ny åtgärd
                  </button>
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="rounded-xl border border-[#D9D1C6] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47]"
                  >
                    Markera alla filtrerade
                  </button>
                  <button
                    type="button"
                    onClick={unselectAllFiltered}
                    className="rounded-xl border border-[#D9D1C6] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47]"
                  >
                    Avmarkera alla filtrerade
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-xl border border-[#D9D1C6] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47]"
                  >
                    Rensa urval
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCategoryFilter("alla");
                      setStatusFilter("alla");
                      setYearFilter("alla");
                    }}
                    className="rounded-xl border border-[#D9D1C6] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47]"
                  >
                    Rensa filter
                  </button>
                </div>

                <p className="text-xs text-[#766B60]">
                  Filtrering påverkar inte urvalet. Valda åtgärder ligger kvar.
                </p>

                {filteredActionsByYear.length > 0 && step1ShowsImportedMaintenanceActions && hasImportedMaintenanceActions && (
                  <p className="text-xs text-[#6B5A47]">
                    Åren nedan innehåller <span className="font-semibold text-[#2A2520]">poster från underhållsplanen</span> (efter aktuellt filter).
                    Expandera ett år för att se posterna och öppna detaljvyn.
                  </p>
                )}

                {!isAnalysisOnly && (
                  <div
                    className={`rounded-2xl px-4 py-4 text-sm ${
                      hasImportedMaintenanceActions
                        ? "border border-[#D9D1C6] bg-[#FAF8F5] text-[#6B5A47]"
                        : "border border-[#D7C3A8] bg-[#FFF6E8] text-[#6B5A47]"
                    }`}
                  >
                    <p className="font-semibold text-[#2A2520]">
                      {hasImportedMaintenanceActions && step1ShowsImportedMaintenanceActions
                        ? "Vill du hämta in fler poster från underhållsplanen?"
                        : "Vill du hämta in åtgärder från underhållsplanen så att de visas här?"}
                    </p>
                    <p className="mt-1">
                      {hasImportedMaintenanceActions && step1ShowsImportedMaintenanceActions
                        ? "Du kan gå till underhållsplanen för att extrahera/uppdatera poster. De blir sedan tillgängliga här i offertflödet."
                        : hasStoredMaintenancePlanFile
                          ? "Offertflödet visar poster från underhållsplanen först när du aktivt väljer att hämta in dem här."
                          : "Lägg till eller öppna underhållsplanen först. Därefter kan du hämta in poster hit till offertflödet."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={importMaintenanceActionsIntoProcurement}
                        className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                      >
                        Hämta från underhållsplanen
                      </button>
                      <Link
                        href={routes.brf.maintenanceIndex()}
                        className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                      >
                        Öppna underhållsplanen
                      </Link>
                      <button
                        type="button"
                        onClick={openCreateCustomActionModal}
                        className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
                      >
                        Skapa egen post
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {filteredActionsByYear.map((yearGroup) => {
                    const isExpanded = step1ExpandedYears.includes(yearGroup.year);
                    return (
                      <section key={yearGroup.year} className="overflow-hidden rounded-2xl border border-[#E6DFD6] bg-white">
                        <button
                          type="button"
                          onClick={() => toggleStep1Year(yearGroup.year)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#FAF8F5]"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#2A2520]">
                              {isExpanded ? "▾" : "▸"} {yearGroup.year} ({yearGroup.items.length} poster)
                            </p>
                            {yearGroup.overdueCount > 0 && (
                              <p className="mt-0.5 text-xs text-[#8A5B20]">
                                Eftersatta poster: {yearGroup.overdueCount}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-0.5 text-xs font-semibold text-[#6B5A47]">
                            {yearGroup.items.filter((item) => selectedActionIds.includes(item.id)).length} valda
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-[#EFE8DD]">
                            {yearGroup.items.map((action) => {
                              const isSelected = selectedActionIds.includes(action.id);
                              return (
                                <div
                                  key={action.id}
                                  className={`flex items-start gap-3 border-b border-[#F2ECE3] px-4 py-3 last:border-b-0 ${
                                    isSelected ? "bg-[#FFFBF4]" : "bg-white"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleAction(action.id)}
                                    onClick={(event) => event.stopPropagation()}
                                    className="mt-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setStep1DrawerActionId(action.id)}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="truncate text-sm font-semibold text-[#2A2520]">
                                        {action.title.trim() || "Namnlös åtgärd"}
                                      </p>
                                      {action.customAction && (
                                        <span className="rounded-full border border-[#D7C3A8] bg-[#FFF4DE] px-2 py-0.5 text-[10px] font-semibold text-[#6B5A47]">
                                          Egen åtgärd
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-[#6B5A47]">
                                      {action.category} • {action.status} • CO₂{" "}
                                      {action.emissionsKgCo2e > 0 ? `${action.emissionsKgCo2e.toFixed(1)} kg` : "—"} •{" "}
                                      Pris {action.estimatedPriceSek > 0 ? formatSek(action.estimatedPriceSek) : "—"}
                                    </p>
                                  </button>
                                  <details className="relative mt-0.5">
                                    <summary
                                      className="cursor-pointer list-none rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      Mer
                                    </summary>
                                    <div className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-[#E6DFD6] bg-white p-2 shadow-lg">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          sendRequest([action]);
                                        }}
                                        className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                                      >
                                        Skapa separat snabbförfrågan
                                      </button>
                                    </div>
                                  </details>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}

                  {filteredActionsByYear.length === 0 && (
                    filterSourceActions.length === 0 && !isAnalysisOnly ? (
                      <div className="rounded-2xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-4 py-6 text-sm text-[#6B5A47]">
                        <p className="font-semibold text-[#2A2520]">
                          Vill du hämta in poster från underhållsplanen?
                        </p>
                        <p className="mt-1">
                          Öppna underhållsplanen och välj/extrahera poster där, så dyker de upp här i offertflödet.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={routes.brf.maintenanceIndex()}
                            className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Gå till underhållsplan
                          </Link>
                          <button
                            type="button"
                            onClick={openCreateCustomActionModal}
                            className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
                          >
                            Skapa egen post
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-4 py-8 text-center text-sm text-[#6B5A47]">
                        Inga poster matchar filtret just nu. Skapa en egen post eller rensa filter.
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {effectiveWizardStep === 2 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Steg 2 · Granska & komplettera</p>
                    <p className="mt-1 text-sm text-[#6B5A47]">
                      Progressiv genomgång: en åtgärd i taget. Justera omfattning, granska standardmoment och lägg till krav utan att UI blir överväldigande.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToWizardStep(1)}
                      className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Tillbaka till val
                    </button>
                    {showStep2Overview && (
                      <button
                        type="button"
                        onClick={() => startSequentialStep2Review(0)}
                        disabled={selectedActions.length === 0}
                        className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Granska
                      </button>
                    )}
                    {showStep2Summary && (
                      <button
                        type="button"
                        onClick={handleSendWizardRequest}
                        disabled={adjustedScopeList.length === 0}
                        className="rounded-xl bg-[#E7B54A] px-4 py-2 text-sm font-semibold text-[#2A2520] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Skicka förfrågan
                      </button>
                    )}
                  </div>
                </div>

                {selectedActions.length === 0 ? (
                  <div className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
                    <p className="text-sm text-[#6B5A47]">
                      Inga åtgärder valda ännu. Gå tillbaka till steg 1 och välj eller skapa en åtgärd först.
                    </p>
                    <button
                      type="button"
                      onClick={() => goToWizardStep(1)}
                      className="mt-4 rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Till steg 1
                    </button>
                  </div>
                ) : showStep2Overview ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Översikt först</p>
                      <p className="mt-1 text-sm text-[#6B5A47]">
                        Du har valt {selectedActions.length} åtgärder. Börja med att skumma korten och klicka sedan “Granska” på en åtgärd för sekventiell genomgång.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {selectedActions.map((action, index) => {
                        const adjusted = adjustedScopeByActionId[action.id];
                        const template = resolveProcurementTemplate(action);
                        return (
                          <article key={action.id} className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[#2A2520]">{action.title}</p>
                                <p className="mt-1 text-xs text-[#6B5A47]">{action.category}</p>
                              </div>
                              {action.customAction && (
                                <span className="rounded-full border border-[#D7C3A8] bg-[#FFF4DE] px-2 py-0.5 text-[10px] font-semibold text-[#6B5A47]">
                                  Egen
                                </span>
                              )}
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-[#6B5A47]">
                              <p>Mall: {template.versionId}</p>
                              <p>Budget: {formatSek(action.estimatedPriceSek)}</p>
                              <p>Nivå: {adjusted?.standardLevel ?? "Standard"}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => startSequentialStep2Review(index)}
                              className="mt-3 w-full rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            >
                              Granska
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : showStep2Summary ? (
                  <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Sammanfattning</p>
                        <h3 className="mt-1 text-lg font-bold text-[#2A2520]">Redo att skicka förfrågan</h3>
                        <p className="mt-1 text-sm text-[#6B5A47]">
                          Alla valda åtgärder är genomgångna. Du kan öppna en åtgärd igen för att justera innan utskick.
                        </p>
                      </div>
                      {selectedActions.map((action, index) => {
                        const adjusted = adjustedScopeByActionId[action.id];
                        if (!adjusted) return null;
                        return (
                          <article key={action.id} className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[#2A2520]">{action.title}</p>
                                <p className="mt-1 text-xs text-[#6B5A47]">
                                  {action.category} · {adjusted.standardLevel} · {adjusted.isOption ? "Option" : "Ingår"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => startSequentialStep2Review(index)}
                                className="rounded-lg border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                              >
                                Granska igen
                              </button>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-[#6B5A47] md:grid-cols-3">
                              <p>
                                <span className="font-semibold text-[#2A2520]">Mängd:</span>{" "}
                                {adjusted.quantity == null ? "Ej angiven" : `${adjusted.quantity} ${adjusted.unit}`}
                              </p>
                              <p>
                                <span className="font-semibold text-[#2A2520]">Budget (ref):</span> {formatSek(action.estimatedPriceSek)}
                              </p>
                              <p>
                                <span className="font-semibold text-[#2A2520]">CO₂e:</span> {action.emissionsKgCo2e.toFixed(1)} kg
                              </p>
                            </div>
                            {adjusted.additionalRequirements.trim().length > 0 && (
                              <div className="mt-3 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3 text-sm text-[#6B5A47]">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Tilläggskrav</p>
                                <p className="mt-1 whitespace-pre-wrap">{adjusted.additionalRequirements}</p>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>

                    <aside className="space-y-4">
                      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Skickas med förfrågan</p>
                        <p className="mt-2 text-sm text-[#6B5A47]">
                          `originalScope`, `adjustedScope`, `mallVersionId`, timestamp, svarsdatum och mottagare sparas på requesten.
                        </p>
                        <div className="mt-3 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3 text-xs text-[#6B5A47]">
                          <p><span className="font-semibold text-[#2A2520]">Mallversion:</span> {resolvedMallVersionId}</p>
                          <p><span className="font-semibold text-[#2A2520]">Valda åtgärder:</span> {selectedSummary.count}</p>
                          <p><span className="font-semibold text-[#2A2520]">Prelim. svarsdatum:</span> {new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString("sv-SE")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendWizardRequest}
                          disabled={adjustedScopeList.length === 0}
                          className="mt-4 w-full rounded-xl bg-[#E7B54A] px-4 py-2 text-sm font-semibold text-[#2A2520] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Skicka förfrågan
                        </button>
                      </section>
                    </aside>
                  </div>
                ) : !step2CurrentAction || !step2CurrentAdjustedScope || !step2CurrentTemplate ? (
                  <div className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
                    <p className="text-sm text-[#6B5A47]">Förbereder genomgång...</p>
                  </div>
                ) : (
                  <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                              Åtgärd {step2ReviewIndex + 1} av {selectedActions.length}
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-[#2A2520]">{step2CurrentAction.title}</h3>
                            <p className="mt-1 text-sm text-[#6B5A47]">
                              {step2CurrentAction.category} · Mall {step2CurrentTemplate.versionId}
                            </p>
                          </div>
                          {step2CurrentAction.customAction && (
                            <span className="rounded-full border border-[#D7C3A8] bg-[#FFF4DE] px-2 py-1 text-xs font-semibold text-[#6B5A47]">
                              Egen åtgärd
                            </span>
                          )}
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-[#EFE8DD]">
                          <div
                            className="h-full rounded-full bg-[#8C7860]"
                            style={{
                              width: `${Math.round(((step2ReviewIndex + 1) / Math.max(selectedActions.length, 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Omfattning</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-[140px_180px_auto]">
                          <label className="text-xs font-semibold text-[#6B5A47]">
                            Mängd
                            <input
                              type="number"
                              inputMode="decimal"
                              value={step2CurrentAdjustedScope.quantity ?? ""}
                              onChange={(event) =>
                                updateAdjustedScope(step2CurrentAction.id, (current) => ({
                                  ...current,
                                  quantity:
                                    event.target.value.trim().length === 0
                                      ? null
                                      : Number(event.target.value),
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="text-xs font-semibold text-[#6B5A47]">
                            Standardnivå
                            <select
                              value={step2CurrentAdjustedScope.standardLevel}
                              onChange={(event) =>
                                updateAdjustedScope(step2CurrentAction.id, (current) => ({
                                  ...current,
                                  standardLevel: event.target.value as ScopeStandardLevel,
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm"
                            >
                              <option value="Bas">Bas</option>
                              <option value="Standard">Standard</option>
                              <option value="Premium">Premium</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-2 self-end rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                            <input
                              type="checkbox"
                              checked={step2CurrentAdjustedScope.isOption}
                              onChange={(event) =>
                                updateAdjustedScope(step2CurrentAction.id, (current) => ({
                                  ...current,
                                  isOption: event.target.checked,
                                }))
                              }
                            />
                            Markera som option
                          </label>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Standardmoment (read-only)</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Processsteg</p>
                            <ul className="mt-2 space-y-1 text-sm text-[#6B5A47]">
                              {step2CurrentTemplate.processSteps.map((step) => (
                                <li key={step.id}>• {step.title}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Delmoment</p>
                            <ul className="mt-2 space-y-1 text-sm text-[#6B5A47]">
                              {step2CurrentTemplate.subSteps.map((subStep) => (
                                <li key={subStep}>• {subStep}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                          Tilläggskrav
                          <textarea
                            rows={4}
                            value={step2CurrentAdjustedScope.additionalRequirements}
                            onChange={(event) =>
                              updateAdjustedScope(step2CurrentAction.id, (current) => ({
                                ...current,
                                additionalRequirements: event.target.value,
                              }))
                            }
                            placeholder="Ex: boende kvar under arbete, kvällstid i trapphus, specifik kulör, arbetsmiljökrav..."
                            className="mt-2 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm font-normal text-[#2A2520]"
                          />
                        </label>
                      </section>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {selectedActions.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setStep2ReviewStage("overview")}
                              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            >
                              Till översikt
                            </button>
                          )}
                          {step2ReviewIndex > 0 && (
                            <button
                              type="button"
                              onClick={() => setStep2ReviewIndex((current) => Math.max(0, current - 1))}
                              className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            >
                              Föregående
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleStep2SaveAndNext}
                          className="rounded-xl bg-[#E7B54A] px-4 py-2 text-sm font-semibold text-[#2A2520]"
                        >
                          {step2ReviewIndex >= selectedActions.length - 1 ? "Spara & Visa sammanfattning" : "Spara & Nästa"}
                        </button>
                      </div>
                    </div>

                    <aside className="space-y-4">
                      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Valda åtgärder</p>
                        <div className="mt-3 space-y-2">
                          {selectedActions.map((action, index) => {
                            const adjusted = adjustedScopeByActionId[action.id];
                            const isCurrent = index === step2ReviewIndex;
                            return (
                              <button
                                key={action.id}
                                type="button"
                                onClick={() => startSequentialStep2Review(index)}
                                className={`w-full rounded-xl border px-3 py-2 text-left ${
                                  isCurrent
                                    ? "border-[#8C7860] bg-[#F6F0E8]"
                                    : "border-[#E8E3DC] bg-white hover:bg-[#FAF8F5]"
                                }`}
                              >
                                <p className="truncate text-sm font-semibold text-[#2A2520]">{action.title}</p>
                                <p className="mt-1 text-xs text-[#6B5A47]">
                                  {adjusted?.standardLevel ?? "Standard"} · {adjusted?.isOption ? "Option" : "Ingår"}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Skickas med förfrågan</p>
                        <div className="mt-3 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3 text-xs text-[#6B5A47]">
                          <p><span className="font-semibold text-[#2A2520]">Mallversion:</span> {resolvedMallVersionId}</p>
                          <p><span className="font-semibold text-[#2A2520]">Valda åtgärder:</span> {selectedSummary.count}</p>
                          <p><span className="font-semibold text-[#2A2520]">Original scope:</span> sparas</p>
                          <p><span className="font-semibold text-[#2A2520]">Adjusted scope:</span> sparas löpande</p>
                        </div>
                      </section>
                    </aside>
                  </div>
                )}
              </div>
            )}

            {effectiveWizardStep === 3 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Steg 3 · Jämför offerter & välj entreprenör</p>
                    <p className="mt-1 text-sm text-[#6B5A47]">
                      Beslutsvy: jämför pris, tid och vad som faktiskt ingår. Välj entreprenör och logga beslut.
                    </p>
                    {comparisonCandidates.length === 0 && (
                      <p className="mt-2 text-xs text-[#8A5B20]">Inga offerter ännu. När du skickat förfrågan visas inkomna offerter här. Mockdata visas när du öppnar Steg 3 direkt efter utskick.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToWizardStep(2)}
                      className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Tillbaka till granskning
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonSort("price");
                        setComparisonSortAsc((v) => (comparisonSort === "price" ? !v : true));
                      }}
                      className="rounded-xl border border-[#D9D1C6] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47]"
                    >
                      Sortera pris {comparisonSort === "price" ? (comparisonSortAsc ? "↑" : "↓") : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonSort("time");
                        setComparisonSortAsc((v) => (comparisonSort === "time" ? !v : true));
                      }}
                      className="rounded-xl border border-[#D9D1C6] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47]"
                    >
                      Sortera tid {comparisonSort === "time" ? (comparisonSortAsc ? "↑" : "↓") : ""}
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-[#E6DFD6] bg-white shadow-sm">
                      <table className="w-full min-w-[820px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[#E8E3DC] text-left text-xs uppercase tracking-wide text-[#8C7860]">
                            <th className="px-3 py-3">Entreprenör</th>
                            <th className="px-3 py-3">Pris</th>
                            <th className="px-3 py-3">Tid</th>
                            <th className="px-3 py-3">Garanti</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3">Åtgärder</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedComparisonCandidates.map((candidate) => {
                            const isLowest = candidate.id === lowestPriceId;
                            const isSelected = candidate.id === selectedComparisonId;
                            return (
                              <tr key={candidate.id} className={`border-b border-[#EFE8DD] ${isSelected ? "bg-[#FFF9F1]" : ""}`}>
                                <td className="px-3 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-[#2A2520]">{candidate.label}</span>
                                    {isLowest && (
                                      <span className="rounded-full border border-[#CFE6CC] bg-[#F2FAF0] px-2 py-0.5 text-[10px] font-semibold text-[#355C38]">
                                        Lägsta pris
                                      </span>
                                    )}
                                    {isSelected && (
                                      <span className="rounded-full border border-[#D7C3A8] bg-[#FFF4DE] px-2 py-0.5 text-[10px] font-semibold text-[#6B5A47]">
                                        Vald entreprenör
                                      </span>
                                    )}
                                    {candidate.isMock && (
                                      <span className="rounded-full border border-[#D7E4F3] bg-[#F2F7FC] px-2 py-0.5 text-[10px] font-semibold text-[#2E5F8A]">
                                        Mock
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 font-semibold text-[#2A2520]">{formatSek(candidate.priceIncVat)}</td>
                                <td className="px-3 py-3 text-[#6B5A47]">{candidate.timeWeeks} veckor</td>
                                <td className="px-3 py-3 text-[#6B5A47]">{candidate.guaranteeLabel}</td>
                                <td className="px-3 py-3 text-[#6B5A47]">{candidate.statusLabel}</td>
                                <td className="px-3 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStep3DrawerOfferId(candidate.id);
                                        setStep3DrawerTab("pdf");
                                      }}
                                      className="rounded-lg border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                                    >
                                      Visa underlag
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleChooseContractor(candidate)}
                                      className="rounded-lg bg-[#2F2F31] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#19191A]"
                                    >
                                      Välj entreprenör
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {sortedComparisonCandidates.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-sm text-[#6B5A47]">
                                Inga offerter registrerade ännu.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Beslutslogg</p>
                      <div className="mt-2 space-y-2">
                        {comparisonDecisionLogs.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                            <p className="text-sm font-semibold text-[#2A2520]">{entry.offerLabel}</p>
                            <p className="mt-1 text-xs text-[#6B5A47]">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleString("sv-SE") : "—"} · {entry.userLabel}
                            </p>
                            {entry.motivation && (
                              <p className="mt-1 text-xs text-[#766B60]">Motivering: {entry.motivation}</p>
                            )}
                          </div>
                        ))}
                        {comparisonDecisionLogs.length === 0 && (
                          <p className="rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
                            Ingen beslutslogg ännu.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-4">
                    <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStep3DrawerTab("pdf")}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${step3DrawerTab === "pdf" ? "bg-[#EFE9DE] text-[#2A2520]" : "border border-[#D9D1C6] bg-white text-[#6B5A47]"}`}
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep3DrawerTab("economy")}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${step3DrawerTab === "economy" ? "bg-[#EFE9DE] text-[#2A2520]" : "border border-[#D9D1C6] bg-white text-[#6B5A47]"}`}
                        >
                          Ekonomisk analys
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep3DrawerTab("coverage")}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${step3DrawerTab === "coverage" ? "bg-[#EFE9DE] text-[#2A2520]" : "border border-[#D9D1C6] bg-white text-[#6B5A47]"}`}
                        >
                          Vad gäller?
                        </button>
                      </div>

                      {!activeStep3Candidate ? (
                        <p className="mt-3 text-sm text-[#6B5A47]">Välj en offert för att se underlag och analys.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="text-sm font-bold text-[#2A2520]">{activeStep3Candidate.label}</p>
                            <p className="text-xs text-[#6B5A47]">
                              {activeStep3Candidate.statusLabel} · {formatSek(activeStep3Candidate.priceIncVat)} · {activeStep3Candidate.timeWeeks} veckor
                            </p>
                          </div>

                          {step3DrawerTab === "pdf" && (
                            <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-2">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                                Inline viewer (PDF/preview)
                              </p>
                              <div className="h-[460px] overflow-hidden rounded-lg border border-[#E8E3DC] bg-white">
                                <iframe
                                  title="Offertpreview inline"
                                  className="h-full w-full"
                                  srcDoc={step3RelatedQuoteDocHtml ?? buildInlineOfferPreviewHtml(activeStep3Candidate, requestTitle)}
                                />
                              </div>
                            </div>
                          )}

                          {step3DrawerTab === "economy" && (() => {
                            const budget = Math.max(selectedSummary.totalBudget, 1);
                            const diff = activeStep3Candidate.priceIncVat - budget;
                            const diffPct = (diff / budget) * 100;
                            const profile = readBrfProfile();
                            const apartments = Number(profile.apartmentsCount || 0) || 1;
                            const costPerApartment = activeStep3Candidate.priceIncVat / apartments;
                            const rate = financeRatePercent / 100;
                            const years = Math.max(1, financeYears);
                            const monthlyRate = rate / 12;
                            const months = years * 12;
                            const monthlyImpact =
                              monthlyRate > 0
                                ? (activeStep3Candidate.priceIncVat * monthlyRate) /
                                  (1 - Math.pow(1 + monthlyRate, -months))
                                : activeStep3Candidate.priceIncVat / months;
                            const barMax = Math.max(budget, activeStep3Candidate.priceIncVat, Math.abs(diff), 1);
                            return (
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Totalkostnad</p>
                                    <p className="mt-1 text-lg font-bold text-[#2A2520]">{formatSek(activeStep3Candidate.priceIncVat)}</p>
                                  </div>
                                  <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Avvikelse mot budget</p>
                                    <p className={`mt-1 text-lg font-bold ${diff <= 0 ? "text-[#355C38]" : "text-[#8A5B20]"}`}>
                                      {diff >= 0 ? "+" : ""}{formatSek(diff)} ({diff >= 0 ? "+" : ""}{diffPct.toFixed(1)}%)
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Kostnad per lägenhet</p>
                                    <p className="mt-1 text-lg font-bold text-[#2A2520]">{formatSek(costPerApartment)}</p>
                                  </div>
                                  <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Månadspåverkan</p>
                                    <p className="mt-1 text-lg font-bold text-[#2A2520]">{formatSek(monthlyImpact)}</p>
                                  </div>
                                </div>
                                <div className="rounded-xl border border-[#E8E3DC] bg-white p-3">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="text-xs font-semibold text-[#6B5A47]">
                                      Ränta (%)
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={financeRatePercent}
                                        onChange={(e) => setFinanceRatePercent(Number(e.target.value || 0))}
                                        className="mt-1 w-full rounded-lg border border-[#D9D1C6] px-2 py-1.5 text-sm"
                                      />
                                    </label>
                                    <label className="text-xs font-semibold text-[#6B5A47]">
                                      Amortering (år)
                                      <input
                                        type="number"
                                        value={financeYears}
                                        onChange={(e) => setFinanceYears(Number(e.target.value || 1))}
                                        className="mt-1 w-full rounded-lg border border-[#D9D1C6] px-2 py-1.5 text-sm"
                                      />
                                    </label>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {[
                                      { label: "Budget", value: budget, color: "bg-[#D7C3A8]" },
                                      { label: "Offert", value: activeStep3Candidate.priceIncVat, color: "bg-[#8C7860]" },
                                      { label: "Diff", value: Math.abs(diff), color: diff <= 0 ? "bg-[#9AC59A]" : "bg-[#E7B54A]" },
                                    ].map((bar) => (
                                      <div key={bar.label}>
                                        <div className="mb-1 flex items-center justify-between text-xs text-[#6B5A47]">
                                          <span>{bar.label}</span>
                                          <span>{formatSek(bar.value)}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-[#EFE8DD]">
                                          <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${Math.max(4, (bar.value / barMax) * 100)}%` }} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5E7893]">Antaganden</p>
                                  <ul className="mt-2 space-y-1 text-sm text-[#314A60]">
                                    <li>• Ränta {financeRatePercent.toFixed(1)}%, amortering {financeYears} år</li>
                                    <li>• Kostnad per lägenhet baseras på {readBrfProfile().apartmentsCount || "1"} lägenhet(er)</li>
                                    <li>• Jämförelse utgår från valda åtgärders summerade budget</li>
                                  </ul>
                                </div>
                              </div>
                            );
                          })()}

                          {step3DrawerTab === "coverage" && (
                            <div className="space-y-2">
                              {[
                                { label: "Omfattning", ok: true },
                                { label: "Tidplan", ok: activeStep3Candidate.timeWeeks > 0 },
                                { label: "Garanti", ok: activeStep3Candidate.guaranteeLabel.trim().length > 0 },
                                { label: "Betalningsvillkor", ok: activeStep3Candidate.hasPaymentTerms },
                                { label: "ÄTA-process", ok: activeStep3Candidate.hasAtaProcess },
                                { label: "Ansvar", ok: activeStep3Candidate.hasResponsibility },
                                { label: "Bilagor", ok: activeStep3Candidate.hasAttachments },
                              ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm">
                                  <span className="font-semibold text-[#2A2520]">{item.label}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${item.ok ? "border-[#CFE6CC] bg-[#F2FAF0] text-[#355C38]" : "border-[#F2D6B0] bg-[#FFF8EE] text-[#8A5B20]"}`}>
                                    {item.ok ? "OK" : "Saknas"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  </aside>
                </div>
              </div>
            )}
          </section>
        )}

        {step1DrawerAction && (isAnalysisOnly || effectiveWizardStep === 1) && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/35">
            <div
              className="h-full w-full max-w-[880px] overflow-y-auto border-l border-[#E6DFD6] bg-[#F6F3EE] p-4 shadow-2xl md:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Åtgärdsdetaljer"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Åtgärdsdetaljer</p>
                  <p className="text-sm text-[#6B5A47]">
                    Samma detaljvy som i underhållsplanen, öppnad i side-drawer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep1DrawerActionId(null)}
                  className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Stäng
                </button>
              </div>

              <AtgardDetaljPanel
                key={`${step1DrawerAction.id}-${step1DrawerAutoFocusToken}`}
                actionId={step1DrawerAction.id}
                backHref={returnPath}
                variant="drawer"
                onClose={() => setStep1DrawerActionId(null)}
                isSelected={selectedActionIds.includes(step1DrawerAction.id)}
                onToggleSelected={() => toggleAction(step1DrawerAction.id)}
                autoFocusTitle={step1DrawerAction.customAction === true}
                onSaved={() => {
                  const synced = readBrfActionsDraft().map(toProcurementAction);
                  if (synced.length > 0) setActions(synced);
                }}
              />
            </div>
          </div>
        )}
    </div>
  );

  if (embedded) {
    return <div className="text-[#2A2520] antialiased">{content}</div>;
  }

  return (
    <main className="min-h-screen bg-[#F6F3EE] px-4 py-8 text-[#2A2520] antialiased md:px-6">
      {content}
    </main>
  );
}

export default function UploadPage() {
  return <BrfUploadWorkspace />;
}
