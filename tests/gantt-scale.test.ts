import { describe, expect, it } from "vitest";
import { buildHeader, dateToX, getBasePxPerDay } from "../app/lib/gantt/scale";

describe("gantt scale utilities", () => {
  it("builds two-row month/year header with consistent span", () => {
    const header = buildHeader(
      { startDate: "2026-03-15", endDate: "2026-05-10" },
      "month",
      { padDays: 0 }
    );

    const monthLabels = header.bottom.map((segment) => segment.label.toLowerCase());
    expect(header.top.length).toBe(1);
    expect(monthLabels.some((label) => label.startsWith("mar"))).toBe(true);
    expect(monthLabels.some((label) => label.startsWith("apr"))).toBe(true);
    expect(monthLabels.some((label) => label.startsWith("maj"))).toBe(true);
    expect(header.bottom.reduce((sum, segment) => sum + segment.days, 0)).toBe(header.totalDays);
  });

  it("builds year scale with decade top row and year bottom row", () => {
    const header = buildHeader(
      { startDate: "2024-01-01", endDate: "2026-12-31" },
      "year",
      { padDays: 0 }
    );

    expect(header.top[0]?.label).toContain("2020");
    expect(header.bottom.map((segment) => segment.label)).toEqual(["2024", "2025", "2026"]);
  });

  it("builds week scale with week labels", () => {
    const header = buildHeader(
      { startDate: "2026-01-05", endDate: "2026-01-20" },
      "week",
      { padDays: 0 }
    );

    expect(header.bottom.length).toBeGreaterThan(1);
    expect(header.bottom[0]?.label.startsWith("v")).toBe(true);
  });

  it("maps dates to x positions consistently", () => {
    expect(getBasePxPerDay("month")).toBeGreaterThan(getBasePxPerDay("year"));
    expect(dateToX("2026-01-11", "2026-01-01", 10)).toBe(100);
    expect(dateToX("2026-01-01", "2026-01-01", 10)).toBe(0);
  });
});
