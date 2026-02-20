import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocumentSectionItem, PlatformDocument } from "../documents-store";
import { renderDocumentToHtml } from "../document-renderer";
import type { PlatformRequest } from "../requests-store";
import { loadNordicFontBytes } from "./font-loader";

interface RenderLineItem {
  moment: string;
  ref: string;
  note: string;
  qty: string;
  unitPrice: string;
  total: string;
}

interface RenderSection {
  id: string;
  title: string;
  description?: string;
  rows: Array<{ label: string; value: string }>;
  items: RenderLineItem[];
  attachments: Array<{ filename: string; refId: string }>;
  isAttachmentSection: boolean;
}

export interface DocumentRenderModel {
  localeSample: string;
  docTypeLabel: string;
  generatedAt: string;
  projectRows: Array<{ label: string; value: string }>;
  summaryRows: Array<{ label: string; value: string }>;
  sections: RenderSection[];
  lineItems: RenderLineItem[];
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_RESERVED = 34;

const C = {
  text: rgb(0.165, 0.145, 0.125),
  muted: rgb(0.47, 0.42, 0.37),
  line: rgb(0.91, 0.89, 0.86),
  panel: rgb(0.988, 0.984, 0.973),
  panelBorder: rgb(0.9, 0.88, 0.85),
  badgeBg: rgb(0.965, 0.95, 0.925),
  badgeBorder: rgb(0.82, 0.76, 0.69),
  rowAlt: rgb(0.99, 0.985, 0.976),
};

const PREVIEW_SNAPSHOT_WIDTH = 1200;
const PREVIEW_SNAPSHOT_MAX_SCALE = 2;

function typeLabel(type: PlatformDocument["type"]): string {
  if (type === "quote") return "OFFERT";
  if (type === "contract") return "AVTAL";
  return "ÄTA";
}

function statusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "SKICKAD";
  if (status === "accepted") return "ACCEPTERAD";
  if (status === "rejected") return "AVSLOGEN";
  if (status === "superseded") return "ERSATT";
  return "UTKAST";
}

function folderSafeProjectName(input: string): string {
  return input
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-zA-Z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 50);
}

export function buildDocumentPdfFilename(document: PlatformDocument, request: PlatformRequest | null): string {
  const prefix = document.type === "quote" ? "Offert" : document.type === "contract" ? "Avtal" : "ÄTA";
  const date = new Date(document.updatedAt || document.createdAt).toISOString().slice(0, 10);
  const projectName = folderSafeProjectName(request?.title || document.title || document.requestId) || "Projekt";
  return `${prefix}_${projectName}_${date}_v${document.version}.pdf`;
}

function formatDateSv(value: string | undefined): string {
  if (!value) return "Ej angiven";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("sv-SE");
}

function formatDateTimeSv(value: string | undefined): string {
  if (!value) return "Ej angiven";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNumberSv(value: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrencySv(value: number): string {
  return `${formatNumberSv(value)} kr`;
}

function parseNumberLike(value: string): number | null {
  const cleaned = value.replaceAll(/[\s'´]/g, "").replaceAll(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrencyRange(input: string): string {
  const tokens = input.match(/[\d][\d\s'´,.]*/g) ?? [];
  const parsed = tokens.map((token) => parseNumberLike(token)).filter((entry): entry is number => entry !== null);
  if (parsed.length === 0) return input;
  if (parsed.length === 1) return formatCurrencySv(parsed[0]);
  return `${formatNumberSv(parsed[0])} - ${formatNumberSv(parsed[1])} kr`;
}

function fieldValueToDisplay(field: PlatformDocument["sections"][number]["fields"][number]): string {
  if (field.type === "checkbox") return field.value ? "Ja" : "Nej";
  if (field.type === "number") {
    return typeof field.value === "number" ? formatNumberSv(field.value) : String(field.value ?? "");
  }
  if (field.type === "date") {
    return typeof field.value === "string" ? formatDateSv(field.value) : "";
  }
  if (field.type === "select") {
    const selected = field.options?.find((option) => option.value === String(field.value ?? ""));
    return selected?.label ?? String(field.value ?? "");
  }
  return String(field.value ?? "");
}

function toLineItem(item: DocumentSectionItem): RenderLineItem {
  return {
    moment: item.label || "Moment",
    ref: item.description?.trim() || "-",
    note: item.value?.trim() || "-",
    qty: typeof item.quantity === "number" ? formatNumberSv(item.quantity) : "–",
    unitPrice: typeof item.unitPrice === "number" ? formatCurrencySv(item.unitPrice) : "–",
    total: typeof item.total === "number" ? formatCurrencySv(item.total) : "–",
  };
}

function extractEntrepreneurOrgNumber(document: PlatformDocument): string {
  const fromExplicit = document.sections
    .flatMap((section) => section.fields)
    .find((field) => {
      const key = `${field.id} ${field.label}`.toLowerCase();
      return key.includes("org") || key.includes("organisationsnummer");
    });

  if (fromExplicit && typeof fromExplicit.value === "string" && fromExplicit.value.trim().length > 0) {
    return fromExplicit.value.trim();
  }

  const orgPattern = /\b\d{6}[- ]?\d{4}\b|\b\d{10}\b|\b\d{12}\b/;
  const fromAnyField = document.sections
    .flatMap((section) => section.fields)
    .find((field) => typeof field.value === "string" && orgPattern.test(field.value));

  if (fromAnyField && typeof fromAnyField.value === "string") {
    return fromAnyField.value.match(orgPattern)?.[0] ?? "Ej angivet";
  }

  return "Ej angivet";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const normalized = text.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
      current = word;
      return;
    }

    let chunk = "";
    for (const char of word) {
      const next = `${chunk}${char}`;
      if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  });

  if (current) lines.push(current);
  return lines;
}

function drawBadge(page: PDFPage, font: PDFFont, label: string, x: number, yTop: number): number {
  const text = label.toUpperCase();
  const textWidth = font.widthOfTextAtSize(text, 8.5);
  const width = Math.max(56, textWidth + 16);
  const height = 20;
  const y = yTop - height;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: C.badgeBorder,
    borderWidth: 1,
    color: C.badgeBg,
  });

  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y: y + 5.5,
    size: 8.5,
    font,
    color: C.muted,
  });

  return width;
}

function canRenderPreviewSnapshotPdf(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (typeof Image === "undefined" || typeof Blob === "undefined") return false;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return false;
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("2d") !== null;
  } catch {
    return false;
  }
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

async function waitForFonts(previewDoc: Document): Promise<void> {
  type MaybeFontDocument = Document & { fonts?: { ready?: Promise<unknown> } };
  const docWithFonts = previewDoc as MaybeFontDocument;
  if (!docWithFonts.fonts?.ready) return;
  try {
    await docWithFonts.fonts.ready;
  } catch {
    // Ignore font readiness errors and continue with fallback rendering if needed.
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Kunde inte skapa PNG från dokumentrendering."));
        return;
      }
      const buffer = await blob.arrayBuffer();
      resolve(new Uint8Array(buffer));
    }, "image/png");
  });
}

async function renderPreviewToCanvas(
  target: HTMLElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const scale = Math.max(1, Math.min(PREVIEW_SNAPSHOT_MAX_SCALE, window.devicePixelRatio || 1));

  return html2canvas(target, {
    backgroundColor: "#ffffff",
    logging: false,
    scale,
    useCORS: true,
    scrollX: 0,
    scrollY: 0,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  });
}

async function renderDocumentToPdfBytesFromPreview(input: {
  document: PlatformDocument;
  request: PlatformRequest | null;
}): Promise<Uint8Array> {
  const previewHtml = renderDocumentToHtml(input.document, input.request);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${PREVIEW_SNAPSHOT_WIDTH}px`;
  iframe.style.height = "2000px";
  iframe.style.border = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.opacity = "0";

  document.body.appendChild(iframe);

  try {
    const loaded = new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(() => resolve(), 1000);
      const finish = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      iframe.addEventListener("load", finish, { once: true });
    });

    iframe.srcdoc = previewHtml;
    await loaded;

    const previewDoc = iframe.contentDocument;
    if (!previewDoc) {
      throw new Error("Kunde inte läsa preview-dokumentet för PDF-export.");
    }

    await waitForFonts(previewDoc);
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    const root = previewDoc.documentElement;
    const body = previewDoc.body;
    const contentWidth = Math.max(
      PREVIEW_SNAPSHOT_WIDTH,
      root.scrollWidth,
      root.clientWidth,
      body?.scrollWidth ?? 0,
      body?.clientWidth ?? 0
    );
    const contentHeight = Math.max(
      root.scrollHeight,
      root.clientHeight,
      body?.scrollHeight ?? 0,
      body?.clientHeight ?? 0
    );

    if (contentWidth <= 0 || contentHeight <= 0) {
      throw new Error("Dokumentets preview är tom och kunde inte konverteras till PDF.");
    }

    const snapshotCanvas = await renderPreviewToCanvas(previewDoc.body, contentWidth, contentHeight);
    const snapshotWidthPx = snapshotCanvas.width;
    const snapshotHeightPx = snapshotCanvas.height;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`${typeLabel(input.document.type)} ${input.document.title}`);
    pdfDoc.setCreator("Byggplattformen");
    pdfDoc.setProducer("Byggplattformen PDF Renderer");
    pdfDoc.setKeywords(["preview-snapshot", input.document.refId]);

    const pointsPerPixel = PAGE_WIDTH / snapshotWidthPx;
    const maxSliceHeightPx = Math.max(1, Math.floor(PAGE_HEIGHT / pointsPerPixel));
    let offsetPx = 0;

    while (offsetPx < snapshotHeightPx) {
      const sliceHeightPx = Math.min(maxSliceHeightPx, snapshotHeightPx - offsetPx);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = snapshotWidthPx;
      sliceCanvas.height = sliceHeightPx;
      const sliceContext = sliceCanvas.getContext("2d");

      if (!sliceContext) {
        throw new Error("Kunde inte skapa slice-canvas för PDF-export.");
      }

      sliceContext.drawImage(
        snapshotCanvas,
        0,
        offsetPx,
        snapshotWidthPx,
        sliceHeightPx,
        0,
        0,
        snapshotWidthPx,
        sliceHeightPx
      );

      const pngBytes = await canvasToPngBytes(sliceCanvas);
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const drawHeight = sliceHeightPx * pointsPerPixel;
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

      page.drawImage(pngImage, {
        x: 0,
        y: PAGE_HEIGHT - drawHeight,
        width: PAGE_WIDTH,
        height: drawHeight,
      });

      offsetPx += sliceHeightPx;
    }

    return pdfDoc.save({ useObjectStreams: false });
  } finally {
    iframe.remove();
  }
}

export function buildDocumentRenderModel(input: {
  document: PlatformDocument;
  request: PlatformRequest | null;
  generatedAtIso?: string;
}): DocumentRenderModel {
  const { document, request } = input;
  const generatedAt = input.generatedAtIso ?? document.updatedAt ?? document.createdAt;

  const fileMap = new Map<string, string>();
  (request?.files ?? []).forEach((file) => {
    if (file.id) fileMap.set(file.id, file.name);
  });

  const resolvedAttachments =
    document.attachments.length > 0
      ? document.attachments
      : document.linkedFileIds.map((fileId) => ({
          fileId,
          fileRefId: "",
          filename: fileMap.get(fileId) ?? fileId,
          folder: "ovrigt" as const,
          mimeType: "application/octet-stream",
        }));

  const sections: RenderSection[] = document.sections
    .filter((section) => section.enabled)
    .map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      rows: section.fields.map((field) => ({
        label: field.label,
        value: fieldValueToDisplay(field),
      })),
      items: (section.items ?? []).map(toLineItem),
      attachments: section.title.toLowerCase().includes("bilag")
        ? resolvedAttachments.map((entry) => ({
            filename: entry.filename,
            refId: entry.fileRefId || "Saknar RefID",
          }))
        : [],
      isAttachmentSection: section.title.toLowerCase().includes("bilag"),
    }));

  const lineItems = sections.flatMap((section) => section.items);
  const budgetRaw = request?.budgetRange || "Ej angiven";

  return {
    localeSample: "ÅÄÖ åäö",
    docTypeLabel: typeLabel(document.type),
    generatedAt,
    projectRows: [
      { label: "Projekt", value: request?.title || document.title },
      { label: "Plats", value: request?.location || "Ej angiven" },
      { label: "Kontakt", value: request?.propertySnapshot?.contactName || "Ej angiven" },
      { label: "Request-ID", value: document.requestId },
      { label: "Dokument-ID", value: document.id },
      { label: "RefID", value: document.refId || "Saknas" },
      { label: "Uppdaterad", value: formatDateTimeSv(document.updatedAt) },
    ],
    summaryRows: [
      { label: "Budget", value: normalizeCurrencyRange(budgetRaw) },
      { label: "Önskad start", value: request?.desiredStart || "Ej angiven" },
    ],
    sections,
    lineItems,
  };
}

export async function renderDocumentToPdfBytes(input: {
  document: PlatformDocument;
  request: PlatformRequest | null;
  generatedAtIso?: string;
  fontBytes?: Uint8Array;
}): Promise<Uint8Array> {
  if (canRenderPreviewSnapshotPdf()) {
    try {
      return await renderDocumentToPdfBytesFromPreview(input);
    } catch {
      // Fall back to structured PDF renderer if snapshot rendering fails.
    }
  }

  return renderDocumentToPdfBytesWithStructuredLayout(input);
}

async function renderDocumentToPdfBytesWithStructuredLayout(input: {
  document: PlatformDocument;
  request: PlatformRequest | null;
  generatedAtIso?: string;
  fontBytes?: Uint8Array;
}): Promise<Uint8Array> {
  const model = buildDocumentRenderModel(input);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = input.fontBytes ?? (await loadNordicFontBytes());
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  pdfDoc.setTitle(`${model.docTypeLabel} ${input.document.title}`);
  pdfDoc.setCreator("Byggplattformen");
  pdfDoc.setProducer("Byggplattformen PDF Renderer");
  pdfDoc.setKeywords(["embedded-font:noto-sans-regular", model.localeSample, input.document.refId]);

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const lineHeight = 13;
  const bodySize = 10.5;
  const orgNumber = extractEntrepreneurOrgNumber(input.document);

  const drawHeader = (target: PDFPage, firstPage: boolean): number => {
    const top = PAGE_HEIGHT - MARGIN;
    const titleSize = firstPage ? 20 : 15;
    const titleMaxWidth = CONTENT_WIDTH - 170;

    target.drawText("BYGGPLATTFORMEN", {
      x: MARGIN,
      y: top - 14,
      size: 11,
      font,
      color: C.muted,
    });

    const titleText = firstPage ? input.document.title : `${input.document.title} (forts.)`;
    const titleLines = wrapText(titleText, font, titleSize, titleMaxWidth).slice(0, firstPage ? 3 : 2);
    let titleY = top - 46;
    titleLines.forEach((line) => {
      target.drawText(line, {
        x: MARGIN,
        y: titleY,
        size: titleSize,
        font,
        color: C.text,
      });
      titleY -= firstPage ? 23 : 17;
    });

    const badgeBaseX = PAGE_WIDTH - MARGIN - 178;
    const badgeY = top - 8;
    const w1 = drawBadge(target, font, model.docTypeLabel, badgeBaseX, badgeY);
    drawBadge(target, font, statusLabel(input.document.status), badgeBaseX + w1 + 8, badgeY);
    drawBadge(target, font, `V${input.document.version}`, PAGE_WIDTH - MARGIN - 56, badgeY - 26);

    const lineY = Math.min(titleY + 6, top - 88);
    target.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: PAGE_WIDTH - MARGIN, y: lineY },
      thickness: 0.9,
      color: C.line,
    });

    return lineY - 16;
  };

  const addPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = drawHeader(page, false);
  };

  const ensureSpace = (height: number, sectionTitleForContinuation?: string) => {
    if (y - height >= MARGIN + FOOTER_RESERVED) return;
    addPage();
    if (sectionTitleForContinuation) {
      drawSectionHeading(`${sectionTitleForContinuation} (forts.)`, true);
    }
  };

  const drawWrapped = (
    text: string,
    x: number,
    availableWidth: number,
    size: number,
    color = C.text,
    lineGap = lineHeight
  ) => {
    const lines = wrapText(text, font, size, availableWidth);
    lines.forEach((line) => {
      page.drawText(line, {
        x,
        y,
        size,
        font,
        color,
      });
      y -= lineGap;
    });
    return lines.length;
  };

  const drawSectionHeading = (title: string, continuation = false) => {
    ensureSpace(48);
    if (!continuation) {
      page.drawLine({
        start: { x: MARGIN, y: y + 6 },
        end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
        thickness: 0.75,
        color: C.line,
      });
      y -= 12;
    }
    page.drawText(title, {
      x: MARGIN,
      y,
      size: 17,
      font,
      color: C.text,
    });
    const underlineWidth = Math.min(font.widthOfTextAtSize(title, 17), 210);
    page.drawLine({
      start: { x: MARGIN, y: y - 2 },
      end: { x: MARGIN + underlineWidth, y: y - 2 },
      thickness: 1.1,
      color: C.badgeBorder,
    });
    y -= 18;
  };

  y = drawHeader(page, true);

  const drawOverview = () => {
    const leftWidth = 336;
    const gap = 12;
    const rightWidth = CONTENT_WIDTH - leftWidth - gap;
    const leftX = MARGIN;
    const rightX = leftX + leftWidth + gap;

    const leftRows = model.projectRows;
    const rowsPerColumn = Math.ceil(leftRows.length / 2);
    const rowBlockHeight = 38;
    const leftHeight = Math.max(214, rowsPerColumn * rowBlockHeight + 26);
    const rightHeight = leftHeight;

    ensureSpace(leftHeight + 20);
    const topY = y;
    const bottomY = topY - leftHeight;

    page.drawRectangle({
      x: leftX,
      y: bottomY,
      width: leftWidth,
      height: leftHeight,
      borderColor: C.panelBorder,
      borderWidth: 1,
      color: C.panel,
    });
    page.drawRectangle({
      x: rightX,
      y: topY - rightHeight,
      width: rightWidth,
      height: rightHeight,
      borderColor: C.panelBorder,
      borderWidth: 1,
      color: C.panel,
    });

    const colWidth = (leftWidth - 26) / 2;
    for (let col = 0; col < 2; col += 1) {
      const colRows = leftRows.slice(col * rowsPerColumn, col * rowsPerColumn + rowsPerColumn);
      let rowY = topY - 22;
      const colX = leftX + 10 + col * (colWidth + 6);

      colRows.forEach((row) => {
        page.drawText(row.label.toUpperCase(), {
          x: colX,
          y: rowY,
          size: 8,
          font,
          color: C.muted,
        });
        const valueLines = wrapText(row.value || "-", font, 11, colWidth - 2).slice(0, 3);
        let valueY = rowY - 13;
        valueLines.forEach((line) => {
          page.drawText(line, {
            x: colX,
            y: valueY,
            size: 11,
            font,
            color: C.text,
          });
          valueY -= 12;
        });
        rowY -= rowBlockHeight;
      });
    }

    page.drawText("BUDGET OCH TID", {
      x: rightX + 10,
      y: topY - 22,
      size: 10,
      font,
      color: C.muted,
    });

    const budgetValue = model.summaryRows.find((row) => row.label === "Budget")?.value ?? "Ej angiven";
    const budgetLines = wrapText(budgetValue, font, 17.5, rightWidth - 20).slice(0, 3);
    let budgetY = topY - 50;
    budgetLines.forEach((line) => {
      page.drawText(line, {
        x: rightX + 10,
        y: budgetY,
        size: 17.5,
        font,
        color: C.text,
      });
      budgetY -= 21;
    });

    const startValue = model.summaryRows.find((row) => row.label === "Önskad start")?.value ?? "Ej angiven";
    const startLines = wrapText(`Önskad start: ${startValue}`, font, 10.5, rightWidth - 20).slice(0, 2);
    let startY = topY - rightHeight + 18;
    startLines.forEach((line) => {
      page.drawText(line, {
        x: rightX + 10,
        y: startY,
        size: 10.5,
        font,
        color: C.muted,
      });
      startY -= 11.5;
    });

    y = bottomY - 14;
  };

  const drawFieldCard = (label: string, value: string, sectionTitle: string) => {
    const valueLines = wrapText(value || "-", font, bodySize, CONTENT_WIDTH - 20).slice(0, 6);
    const cardHeight = 21 + valueLines.length * lineHeight + 8;
    ensureSpace(cardHeight + 6, sectionTitle);

    page.drawRectangle({
      x: MARGIN,
      y: y - cardHeight + 4,
      width: CONTENT_WIDTH,
      height: cardHeight,
      borderColor: C.line,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });
    page.drawText(label.toUpperCase(), {
      x: MARGIN + 8,
      y: y - 9,
      size: 8.2,
      font,
      color: C.muted,
    });
    let valueY = y - 22;
    valueLines.forEach((line) => {
      page.drawText(line, {
        x: MARGIN + 8,
        y: valueY,
        size: bodySize,
        font,
        color: C.text,
      });
      valueY -= lineHeight;
    });
    y -= cardHeight + 6;
  };

  const drawItemsTable = (items: RenderLineItem[], sectionTitle: string) => {
    if (items.length === 0) return;

    const columns = [
      { label: "Moment/Åtgärd", width: 140, align: "left" as const },
      { label: "Källa/Ref", width: 100, align: "left" as const },
      { label: "Antal", width: 45, align: "right" as const },
      { label: "A-pris", width: 68, align: "right" as const },
      { label: "Summa", width: 68, align: "right" as const },
      { label: "Notering", width: 118, align: "left" as const },
    ];
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const tableX = MARGIN;
    const headerHeight = 18;

    const drawHeaderRow = () => {
      ensureSpace(headerHeight + 6, sectionTitle);
      page.drawRectangle({
        x: tableX,
        y: y - headerHeight + 4,
        width: tableWidth,
        height: headerHeight,
        borderColor: C.panelBorder,
        borderWidth: 1,
        color: C.panel,
      });
      let x = tableX;
      columns.forEach((column) => {
        page.drawText(column.label, {
          x: x + 4,
          y: y - 10,
          size: 8,
          font,
          color: C.muted,
        });
        x += column.width;
      });
      y -= headerHeight;
    };

    drawHeaderRow();

    items.forEach((item, rowIndex) => {
      const values = [item.moment, item.ref, item.qty, item.unitPrice, item.total, item.note];
      const wrapped = values.map((value, index) =>
        wrapText(value, font, bodySize, columns[index].width - 8).slice(0, 4)
      );
      const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + 8;

      if (y - rowHeight < MARGIN + FOOTER_RESERVED) {
        addPage();
        drawSectionHeading(`${sectionTitle} (forts.)`, true);
        drawHeaderRow();
      }

      page.drawRectangle({
        x: tableX,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        borderColor: C.line,
        borderWidth: 0.6,
        color: rowIndex % 2 === 0 ? rgb(1, 1, 1) : C.rowAlt,
      });

      let x = tableX;
      wrapped.forEach((lines, idx) => {
        let lineY = y - 12;
        lines.forEach((line) => {
          if (columns[idx].align === "right") {
            const tw = font.widthOfTextAtSize(line, bodySize);
            page.drawText(line, {
              x: x + columns[idx].width - 4 - tw,
              y: lineY,
              size: bodySize,
              font,
              color: C.text,
            });
          } else {
            page.drawText(line, {
              x: x + 4,
              y: lineY,
              size: bodySize,
              font,
              color: C.text,
            });
          }
          lineY -= lineHeight;
        });
        x += columns[idx].width;
      });

      y -= rowHeight;
    });
    y -= 8;
  };

  const drawAttachments = (attachments: Array<{ filename: string; refId: string }>, sectionTitle: string) => {
    if (attachments.length === 0) {
      ensureSpace(24, sectionTitle);
      page.drawText("Inga bilagor valda.", {
        x: MARGIN,
        y,
        size: bodySize,
        font,
        color: C.muted,
      });
      y -= 20;
      return;
    }

    attachments.forEach((attachment) => {
      const fileLines = wrapText(attachment.filename, font, bodySize, CONTENT_WIDTH - 170).slice(0, 3);
      const rowHeight = Math.max(26, fileLines.length * lineHeight + 10);
      ensureSpace(rowHeight + 5, sectionTitle);

      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight + 4,
        width: CONTENT_WIDTH,
        height: rowHeight,
        borderColor: C.line,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      let fileY = y - 10;
      fileLines.forEach((line) => {
        page.drawText(line, {
          x: MARGIN + 8,
          y: fileY,
          size: bodySize,
          font,
          color: C.text,
        });
        fileY -= lineHeight;
      });

      const ref = attachment.refId || "Saknar RefID";
      const refWidth = font.widthOfTextAtSize(ref, 9.5);
      page.drawText(ref, {
        x: PAGE_WIDTH - MARGIN - 8 - refWidth,
        y: y - rowHeight / 2 + 2,
        size: 9.5,
        font,
        color: C.muted,
      });

      y -= rowHeight + 6;
    });
  };

  drawOverview();

  model.sections.forEach((section) => {
    drawSectionHeading(section.title);

    if (section.description) {
      ensureSpace(20, section.title);
      drawWrapped(section.description, MARGIN, CONTENT_WIDTH, 11, C.muted);
      y -= 2;
    }

    section.rows.forEach((row) => {
      drawFieldCard(row.label, row.value, section.title);
    });

    if (section.items.length > 0) {
      drawItemsTable(section.items, section.title);
    }

    if (section.isAttachmentSection) {
      drawAttachments(section.attachments, section.title);
    }
  });

  const totalPages = pages.length;
  pages.forEach((target, index) => {
    const pageNumber = index + 1;
    const baseY = MARGIN - 8;

    target.drawLine({
      start: { x: MARGIN, y: baseY + 14 },
      end: { x: PAGE_WIDTH - MARGIN, y: baseY + 14 },
      thickness: 0.7,
      color: C.line,
    });

    const leftText =
      `${input.document.requestId} · Dokument-ID ${input.document.id} · ` +
      `RefID ${input.document.refId} · Org.nr entreprenad ${orgNumber}`;
    const leftLines = wrapText(leftText, font, 7.5, CONTENT_WIDTH - 130).slice(0, 2);
    let leftY = baseY + (leftLines.length > 1 ? 8 : 2);
    leftLines.forEach((line) => {
      target.drawText(line, {
        x: MARGIN,
        y: leftY,
        size: 7.5,
        font,
        color: C.muted,
      });
      leftY -= 8;
    });

    const rightLine1 = `Sida ${pageNumber}/${totalPages}`;
    const rightLine2 = `Genererad ${formatDateTimeSv(model.generatedAt)}`;
    const rightLine3 = `Skapad av ${input.document.createdByLabel}`;

    const line1Width = font.widthOfTextAtSize(rightLine1, 8.5);
    const line2Width = font.widthOfTextAtSize(rightLine2, 7.5);
    const line3Width = font.widthOfTextAtSize(rightLine3, 7.5);

    target.drawText(rightLine1, {
      x: PAGE_WIDTH - MARGIN - line1Width,
      y: baseY + 2,
      size: 8.5,
      font,
      color: C.muted,
    });
    target.drawText(rightLine2, {
      x: PAGE_WIDTH - MARGIN - line2Width,
      y: baseY - 6,
      size: 7.5,
      font,
      color: C.muted,
    });
    target.drawText(rightLine3, {
      x: PAGE_WIDTH - MARGIN - line3Width,
      y: baseY - 14,
      size: 7.5,
      font,
      color: C.muted,
    });
  });

  return pdfDoc.save({ useObjectStreams: false });
}
