import { beforeEach, describe, expect, it } from "vitest";

import {
  calculateCategoryBreakdown,
  calculateTopDrivers,
  calculateTotalsFromLineItems,
  calculateTypeBreakdown,
  recomputeOffer,
} from "../app/lib/offers/calculations";
import { buildOfferWorkbook } from "../app/lib/offers/export";
import { createOffer, getOfferById, saveOffer, setOfferStatus } from "../app/lib/offers/store";
import type { LineItem, Offer } from "../app/lib/offers/types";

function sampleLineItems(): LineItem[] {
  return [
    {
      id: "li-1",
      title: "Ställning och etablering",
      category: "Etablering",
      type: "arbete",
      quantity: 1,
      unit: "st",
      unitPrice: 120000,
      total: 0,
    },
    {
      id: "li-2",
      title: "Fasadfärg premium",
      category: "Material",
      type: "material",
      quantity: 50,
      unit: "liter",
      unitPrice: 950,
      total: 0,
    },
    {
      id: "li-3",
      title: "UE lift",
      category: "Maskiner",
      type: "ue",
      quantity: 10,
      unit: "dag",
      unitPrice: 6500,
      total: 0,
    },
  ];
}

function sampleOffer(overrides: Partial<Offer> = {}): Offer {
  return recomputeOffer({
    id: "offer-test",
    projectId: "req-1",
    contractorId: "ctr-1",
    version: 1,
    status: "draft",
    lineItems: sampleLineItems(),
    assumptions: ["Pris gäller under normala åtkomstförhållanden."],
    timeline: [
      { label: "Start", amount: 50000, date: "2026-04-01" },
      { label: "Delbetalning", amount: 100000, date: "2026-05-15" },
    ],
    totals: { exVat: 0, vat: 0, incVat: 0 },
    createdAt: new Date("2026-02-23T10:00:00.000Z"),
    ...overrides,
  });
}

describe("offers module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("calculates totals, breakdowns and top drivers from lineItems", () => {
    const offer = sampleOffer();
    const totals = calculateTotalsFromLineItems(offer.lineItems);
    expect(totals.exVat).toBe(232500);
    expect(totals.vat).toBe(58125);
    expect(totals.incVat).toBe(290625);

    const typeBreakdown = calculateTypeBreakdown(offer.lineItems, totals.exVat);
    expect(typeBreakdown.map((entry) => entry.type)).toEqual(["arbete", "ue", "material"]);
    expect(typeBreakdown.find((entry) => entry.type === "arbete")?.amount).toBe(120000);

    const categoryBreakdown = calculateCategoryBreakdown(offer.lineItems, totals.exVat);
    expect(categoryBreakdown[0]?.category).toBe("Etablering");

    const topDrivers = calculateTopDrivers(offer.lineItems, totals.exVat, 2);
    expect(topDrivers).toHaveLength(2);
    expect(topDrivers[0]?.title).toBe("Ställning och etablering");
    expect(topDrivers[0]?.share).toBeGreaterThan(40);
  });

  it("creates a new version when saving changes after offer is sent", () => {
    const created = createOffer({
      projectId: "req-2",
      contractorId: "entreprenor-1",
      lineItems: sampleLineItems(),
      assumptions: ["Testantagande"],
    });
    const sent = setOfferStatus(created.id, "sent");
    expect(sent?.status).toBe("sent");

    const modified = recomputeOffer({
      ...(sent ?? created),
      lineItems: [
        ...(sent ?? created).lineItems.slice(0, 2),
        {
          ...(sent ?? created).lineItems[2],
          quantity: 12,
          total: 0,
        },
      ],
    });
    const result = saveOffer(modified);

    expect(result.createdNewVersion).toBe(true);
    expect(result.offer.id).not.toBe(created.id);
    expect(result.offer.version).toBe(created.version + 1);
    expect(result.offer.status).toBe("draft");
    expect(getOfferById(created.id)?.status).toBe("sent");
  });

  it("builds xlsx workbook with required sheets from same offer data source", () => {
    const offer = sampleOffer();
    const comparison = [
      offer,
      sampleOffer({
        id: "offer-test-2",
        contractorId: "ctr-2",
        version: 1,
        lineItems: [
          ...sampleLineItems(),
          {
            id: "li-4",
            title: "Extra skydd",
            category: "Skydd",
            type: "ovrigt",
            quantity: 1,
            unit: "st",
            unitPrice: 15000,
            total: 0,
          },
        ],
      }),
    ];

    const workbook = buildOfferWorkbook({
      offer,
      comparisonOffers: comparison,
    });

    expect(workbook.SheetNames).toEqual(
      expect.arrayContaining([
        "Summary",
        "LineItems",
        "Assumptions",
        "Timeline",
        "Comparison",
      ])
    );
  });
});
