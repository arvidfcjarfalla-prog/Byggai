"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  PlatformRequest,
  ProcurementAction,
  ProcurementActionDetail,
  RequestDocumentSummary,
  RequestFileRecord,
  RequestPropertySnapshot,
} from "../../lib/requests-store";
import {
  defaultRecipientsForAudience,
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
import {
  fromProcurementAction,
  readBrfActionsDraft,
  readBrfRequestMeta,
  toProcurementAction,
  writeBrfActionsDraft,
  writeBrfRequestMeta,
} from "../../lib/brf-start";

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

export function BrfUploadWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const actionDetailsBasePath = pathname.startsWith("/dashboard/")
    ? "/dashboard/brf/underhallsplan/atgard"
    : "/start/upload/atgard";
  const returnPath = pathname || "/dashboard/brf/underhallsplan";
  const [initialState] = useState(() => {
    const draftActions = readBrfActionsDraft();
    const viewState = readBrfUploadViewState();
    const meta = readBrfRequestMeta();
    const actionsFromDraft = draftActions.map(toProcurementAction);
    const selectedFromDraft = draftActions
      .filter((action) => action.selected !== false)
      .map((action) => action.id);
    return {
      actionsFromDraft,
      selectedFromDraft,
      viewState,
      meta,
    };
  });
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [actions, setActions] = useState<ProcurementAction[]>(initialState.actionsFromDraft);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(
    initialState.selectedFromDraft.length > 0
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
  const [storedFiles, setStoredFiles] = useState<BrfFileRecord[]>(() => readBrfFiles());
  const [fileSystemNotice, setFileSystemNotice] = useState<string | null>(null);

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
    const validSelected = selectedActionIds.filter((id) =>
      actions.some((action) => action.id === id)
    );
    writeBrfUploadViewState({
      searchQuery,
      categoryFilter,
      statusFilter,
      yearFilter,
      selectedActionIds: validSelected,
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
    sentCount,
    statusFilter,
    yearFilter,
  ]);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(actions.map((action) => action.category))).sort((a, b) =>
        a.localeCompare(b, "sv")
      ),
    [actions]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(actions.map((action) => action.status))).sort((a, b) =>
        a.localeCompare(b, "sv")
      ),
    [actions]
  );

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(actions.map((action) => action.plannedYear))).sort(
        (a, b) => a - b
      ),
    [actions]
  );

  const filteredActions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return actions.filter(
      (action) =>
        (q.length === 0 ||
          action.title.toLowerCase().includes(q) ||
          action.category.toLowerCase().includes(q)) &&
        (categoryFilter === "alla" || action.category === categoryFilter) &&
        (statusFilter === "alla" || action.status === statusFilter) &&
        (yearFilter === "alla" || String(action.plannedYear) === yearFilter)
    );
  }, [actions, searchQuery, categoryFilter, statusFilter, yearFilter]);

  const selectedActions = useMemo(
    () => actions.filter((action) => selectedActionIds.includes(action.id)),
    [actions, selectedActionIds]
  );

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

  const persistDraft = (nextActions: ProcurementAction[], nextSelectedIds: string[]) => {
    writeBrfActionsDraft(
      nextActions.map((action) => ({
        ...fromProcurementAction(action),
        selected: nextSelectedIds.includes(action.id),
      }))
    );
  };

  const removeStoredFile = (fileId: string) => {
    removeWorkspaceFile("brf", fileId);
    setFileSystemNotice("Fil borttagen.");
  };

  const clearAllStoredFiles = () => {
    clearWorkspaceFiles("brf");
    setFileSystemNotice("Alla uppladdade filer rensades.");
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

  const toggleAllFiltered = () => {
    const filteredIds = filteredActions.map((a) => a.id);
    const allSelected = filteredIds.every((id) => selectedActionIds.includes(id));
    if (allSelected) {
      const nextSelected = selectedActionIds.filter((id) => !filteredIds.includes(id));
      setSelectedActionIds(nextSelected);
      persistDraft(actions, nextSelected);
      return;
    }
    const nextSelected = Array.from(new Set([...selectedActionIds, ...filteredIds]));
    setSelectedActionIds(nextSelected);
    persistDraft(actions, nextSelected);
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

  const sendRequest = (selected: ProcurementAction[]) => {
    if (selected.length === 0) return;
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

    const nextRequest: PlatformRequest = {
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
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
  };

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
                href="/dashboard/brf"
                className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Till BRF-dashboard
              </Link>
              <Link
                href="/dashboard/brf/forfragningar"
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

        {actions.length > 0 && (
          <section className="mt-6 rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
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
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="rounded-xl border border-[#D9D1C6] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47]"
              >
                Markera flera åtgärder
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
              <button
                type="button"
                onClick={() => sendRequest(selectedActions)}
                disabled={selectedActions.length === 0}
                className="rounded-xl bg-[#E7B54A] px-4 py-2 text-sm font-semibold text-[#2A2520] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Skicka förfrågan ({selectedActions.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E6DFD6] text-left text-xs uppercase tracking-wider text-[#8C7860]">
                    <th className="px-3 py-3">Val</th>
                    <th className="px-3 py-3">Åtgärd</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Planerat år</th>
                    <th className="px-3 py-3">CO₂e</th>
                    <th className="px-3 py-3">Totalt pris</th>
                    <th className="px-3 py-3">Förfrågan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActions.map((action) => (
                    <tr key={action.id} className="border-b border-[#EFE8DD] text-sm">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedActionIds.includes(action.id)}
                          onChange={() => toggleAction(action.id)}
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-[#2A2520]">
                        <Link
                          href={`${actionDetailsBasePath}/${encodeURIComponent(action.id)}?from=${encodeURIComponent(returnPath)}`}
                          className="text-left font-semibold text-[#2A2520] underline-offset-2 hover:text-[#8C7860] hover:underline"
                        >
                          {action.title}
                        </Link>
                        {(action.sourceSheet || action.sourceRow) && (
                          <div className="mt-1 text-xs font-normal text-[#766B60]">
                            Källa: {action.sourceSheet || "Ark"}{" "}
                            {action.sourceRow ? `rad ${action.sourceRow}` : ""}
                          </div>
                        )}
                        {action.extraDetails && action.extraDetails.length > 0 && (
                          <div className="mt-1 text-xs font-normal text-[#6B5A47]">
                            {action.extraDetails.length} detaljfält ifyllda
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[#6B5A47]">{action.category}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2.5 py-1 text-xs font-semibold">
                          {action.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">{action.plannedYear}</td>
                      <td className="px-3 py-3">{action.emissionsKgCo2e.toFixed(1)} kg</td>
                      <td className="px-3 py-3 font-semibold">{formatSek(action.estimatedPriceSek)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`${actionDetailsBasePath}/${encodeURIComponent(action.id)}?from=${encodeURIComponent(returnPath)}`}
                            className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Detaljer
                          </Link>
                          <button
                            type="button"
                            onClick={() => sendRequest([action])}
                            className="rounded-lg border border-[#D9D1C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Skicka
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
