"use client";

import { OFFER_CHART_COLORS, formatPercent, formatSek } from "./format";

interface DonutEntry {
  key: string;
  label: string;
  amount: number;
  share: number;
}

function describeArcSlice(input: {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
}): string {
  const { cx, cy, radius, startAngle, endAngle } = input;
  const start = {
    x: cx + radius * Math.cos(startAngle),
    y: cy + radius * Math.sin(startAngle),
  };
  const end = {
    x: cx + radius * Math.cos(endAngle),
    y: cy + radius * Math.sin(endAngle),
  };
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

export function OfferDonutChart({
  title,
  totalLabel,
  totalValue,
  entries,
}: {
  title: string;
  totalLabel: string;
  totalValue: number;
  entries: DonutEntry[];
}) {
  const normalizedEntries = entries.filter((entry) => entry.amount > 0);
  const pieEntries =
    normalizedEntries.length > 0
      ? normalizedEntries
      : [{ key: "empty", label: "Ingen data", amount: 1, share: 100 }];

  const radius = 70;
  const innerRadius = 38;
  const cx = 90;
  const cy = 90;
  const total = pieEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const slices = pieEntries.reduce<{
    cursor: number;
    slices: Array<DonutEntry & { path: string; color: string }>;
  }>(
    (acc, entry, index) => {
      const fraction = total > 0 ? entry.amount / total : 0;
      const span = fraction * Math.PI * 2;
      const startAngle = acc.cursor;
      const endAngle = startAngle + span;

      acc.slices.push({
        ...entry,
        path: describeArcSlice({ cx, cy, radius, startAngle, endAngle }),
        color: OFFER_CHART_COLORS[index % OFFER_CHART_COLORS.length] ?? "#9CA3AF",
      });
      return {
        cursor: endAngle,
        slices: acc.slices,
      };
    },
    { cursor: -Math.PI / 2, slices: [] }
  ).slices;

  return (
    <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">{title}</p>
          <h3 className="text-2xl font-bold text-[#2A2520]">{formatSek(totalValue)}</h3>
          <p className="text-xs text-[#6B5A47]">{totalLabel}</p>
        </div>
      </header>

      <div className="mt-3 grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="flex items-center justify-center rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] p-2">
          <svg viewBox="0 0 180 180" className="h-[170px] w-[170px]" aria-label={title}>
            {slices.map((slice) => (
              <path key={slice.key} d={slice.path} fill={slice.color} />
            ))}
            <circle cx={cx} cy={cy} r={innerRadius} fill="#FAF8F5" />
            <text
              x={cx}
              y={cy - 3}
              textAnchor="middle"
              className="fill-[#2A2520] text-[12px] font-semibold"
            >
              {formatSek(totalValue)}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              className="fill-[#6B5A47] text-[10px]"
            >
              Summa
            </text>
          </svg>
        </div>

        <ul className="space-y-2">
          {entries.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
              Ingen data för den här fördelningen.
            </li>
          ) : (
            entries.map((entry, index) => (
              <li
                key={entry.key}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2"
              >
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: OFFER_CHART_COLORS[index % OFFER_CHART_COLORS.length] }}
                />
                <span className="truncate text-sm font-semibold text-[#2A2520]">{entry.label}</span>
                <span className="text-xs text-[#6B5A47]">{formatPercent(entry.share)}</span>
                <span className="text-sm font-semibold text-[#2A2520]">{formatSek(entry.amount)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </article>
  );
}
