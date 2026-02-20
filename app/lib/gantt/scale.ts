export type Scale = "week" | "month" | "year";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface HeaderSegment {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  days: number;
}

export interface ScaleHeader {
  paddedStartDate: string;
  paddedEndDate: string;
  totalDays: number;
  top: HeaderSegment[];
  bottom: HeaderSegment[];
}

function parseDate(isoDate: string): Date {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function toDateOnly(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function diffDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / dayMs);
}

function addDays(isoDate: string, days: number): string {
  const next = parseDate(isoDate);
  next.setDate(next.getDate() + days);
  return toDateOnly(next);
}

function maxDate(a: string, b: string): string {
  return parseDate(a).getTime() >= parseDate(b).getTime() ? a : b;
}

function minDate(a: string, b: string): string {
  return parseDate(a).getTime() <= parseDate(b).getTime() ? a : b;
}

function monthLabel(isoDate: string): string {
  return parseDate(isoDate).toLocaleDateString("sv-SE", { month: "short" });
}

function yearLabel(isoDate: string): string {
  return `${parseDate(isoDate).getFullYear()}`;
}

function startOfMonth(isoDate: string): string {
  const date = parseDate(isoDate);
  return toDateOnly(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(isoDate: string): string {
  const date = parseDate(isoDate);
  return toDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfYear(isoDate: string): string {
  const date = parseDate(isoDate);
  return toDateOnly(new Date(date.getFullYear(), 0, 1));
}

function endOfYear(isoDate: string): string {
  const date = parseDate(isoDate);
  return toDateOnly(new Date(date.getFullYear(), 11, 31));
}

function startOfDecade(isoDate: string): string {
  const year = parseDate(isoDate).getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}-01-01`;
}

function endOfDecade(isoDate: string): string {
  const year = parseDate(isoDate).getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart + 9}-12-31`;
}

function startOfIsoWeek(isoDate: string): string {
  const date = parseDate(isoDate);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - (weekday - 1));
  return toDateOnly(date);
}

function endOfIsoWeek(isoDate: string): string {
  return addDays(startOfIsoWeek(isoDate), 6);
}

function isoWeekNumber(isoDate: string): number {
  const date = parseDate(startOfIsoWeek(isoDate));
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstWeekStart = parseDate(startOfIsoWeek(toDateOnly(firstThursday)));
  return Math.floor((thursday.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function segmentDays(startDate: string, endDate: string): number {
  return Math.max(1, diffDays(startDate, endDate) + 1);
}

type UnitKind = "week" | "month" | "year" | "decade";

function unitBounds(anchorDate: string, kind: UnitKind): { startDate: string; endDate: string } {
  if (kind === "week") {
    return { startDate: startOfIsoWeek(anchorDate), endDate: endOfIsoWeek(anchorDate) };
  }
  if (kind === "month") {
    return { startDate: startOfMonth(anchorDate), endDate: endOfMonth(anchorDate) };
  }
  if (kind === "decade") {
    return { startDate: startOfDecade(anchorDate), endDate: endOfDecade(anchorDate) };
  }
  return { startDate: startOfYear(anchorDate), endDate: endOfYear(anchorDate) };
}

function nextAnchor(currentStart: string, kind: UnitKind): string {
  if (kind === "week") return addDays(currentStart, 7);
  if (kind === "month") return addDays(endOfMonth(currentStart), 1);
  if (kind === "decade") return `${parseDate(currentStart).getFullYear() + 10}-01-01`;
  return `${parseDate(currentStart).getFullYear() + 1}-01-01`;
}

function unitLabel(startDate: string, kind: UnitKind): string {
  if (kind === "week") return `v${isoWeekNumber(startDate)}`;
  if (kind === "month") return monthLabel(startDate);
  if (kind === "decade") return `${Math.floor(parseDate(startDate).getFullYear() / 10) * 10}-tal`;
  return yearLabel(startDate);
}

function buildSegments(
  rangeStartDate: string,
  rangeEndDate: string,
  kind: UnitKind
): HeaderSegment[] {
  const segments: HeaderSegment[] = [];
  let cursor = unitBounds(rangeStartDate, kind).startDate;

  while (parseDate(cursor).getTime() <= parseDate(rangeEndDate).getTime()) {
    const bounds = unitBounds(cursor, kind);
    const startDate = maxDate(bounds.startDate, rangeStartDate);
    const endDate = minDate(bounds.endDate, rangeEndDate);
    segments.push({
      id: `${kind}-${bounds.startDate}`,
      label: unitLabel(bounds.startDate, kind),
      startDate,
      endDate,
      days: segmentDays(startDate, endDate),
    });
    cursor = nextAnchor(bounds.startDate, kind);
  }

  return segments;
}

export function buildHeader(
  range: DateRange,
  scale: Scale,
  options?: { padDays?: number }
): ScaleHeader {
  const rawStart = /\d{4}-\d{2}-\d{2}/.test(range.startDate) ? range.startDate : toDateOnly(new Date());
  const rawEnd = /\d{4}-\d{2}-\d{2}/.test(range.endDate) ? range.endDate : rawStart;
  const orderedStart = minDate(rawStart, rawEnd);
  const orderedEnd = maxDate(rawStart, rawEnd);
  const padDays = Math.max(0, options?.padDays ?? 30);
  const paddedStartDate = addDays(orderedStart, -padDays);
  const paddedEndDate = addDays(orderedEnd, padDays);
  const totalDays = segmentDays(paddedStartDate, paddedEndDate);

  const bottomKind: UnitKind = scale === "week" ? "week" : scale === "month" ? "month" : "year";
  const topKind: UnitKind = scale === "year" ? "decade" : "year";

  return {
    paddedStartDate,
    paddedEndDate,
    totalDays,
    top: buildSegments(paddedStartDate, paddedEndDate, topKind),
    bottom: buildSegments(paddedStartDate, paddedEndDate, bottomKind),
  };
}

export function dateToX(date: string, rangeStartDate: string, pxPerDay: number): number {
  return diffDays(rangeStartDate, date) * pxPerDay;
}

export function getBasePxPerDay(scale: Scale): number {
  if (scale === "week") return 22;
  if (scale === "year") return 4;
  return 10;
}

