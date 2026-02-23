export const SEK_FORMATTER = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});

export function formatSek(value: number): string {
  return `${SEK_FORMATTER.format(Math.round(value))} kr`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return SEK_FORMATTER.format(Math.round(value));
}

export const OFFER_CHART_COLORS = [
  "#F8B62A",
  "#2F2F31",
  "#F97316",
  "#0F766E",
  "#22C55E",
  "#14B8A6",
  "#9333EA",
  "#60A5FA",
] as const;
