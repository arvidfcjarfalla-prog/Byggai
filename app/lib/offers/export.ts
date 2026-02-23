import * as XLSX from "xlsx";

import {
  calculateCategoryBreakdown,
  calculateTypeBreakdown,
  recomputeOffer,
  toComparisonRows,
} from "./calculations";
import type { Offer } from "./types";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildOfferWorkbook(input: {
  offer: Offer;
  comparisonOffers?: Offer[];
}): XLSX.WorkBook {
  const offer = recomputeOffer(input.offer);
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    { KPI: "OfferId", Value: offer.id },
    { KPI: "Projekt", Value: offer.projectId },
    { KPI: "Entreprenör", Value: offer.contractorId },
    { KPI: "Version", Value: offer.version },
    { KPI: "Status", Value: offer.status },
    { KPI: "Skapad", Value: formatDate(offer.createdAt) },
    { KPI: "Total ex moms", Value: offer.totals.exVat },
    { KPI: "Moms", Value: offer.totals.vat },
    { KPI: "Total inkl moms", Value: offer.totals.incVat },
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");

  const lineItemRows = offer.lineItems.map((lineItem) => ({
    Id: lineItem.id,
    Titel: lineItem.title,
    Kategori: lineItem.category,
    Typ: lineItem.type,
    Mangd: lineItem.quantity,
    Enhet: lineItem.unit,
    Apris: lineItem.unitPrice,
    Summa: lineItem.total,
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(lineItemRows.length > 0 ? lineItemRows : [{ Info: "Inga lineItems" }]),
    "LineItems"
  );

  const assumptionRows =
    offer.assumptions && offer.assumptions.length > 0
      ? offer.assumptions.map((assumption, index) => ({
          Rad: index + 1,
          Antagande: assumption,
        }))
      : [{ Info: "Inga antaganden" }];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(assumptionRows), "Assumptions");

  if (offer.timeline && offer.timeline.length > 0) {
    const timelineRows = offer.timeline.map((entry, index) => ({
      Rad: index + 1,
      Aktivitet: entry.label,
      Belopp: entry.amount,
      Datum: entry.date ?? "",
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(timelineRows), "Timeline");
  }

  const comparisonOffers = input.comparisonOffers ?? [];
  if (comparisonOffers.length > 1) {
    const comparisonRows = toComparisonRows(comparisonOffers).map((row) => ({
      OfferId: row.offerId,
      Entreprenor: row.contractorId,
      Version: row.version,
      Status: row.status,
      ExMoms: row.totals.exVat,
      Moms: row.totals.vat,
      InklMoms: row.totals.incVat,
      Poster: row.itemCount,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(comparisonRows), "Comparison");
  }

  const categoryBreakdownRows = calculateCategoryBreakdown(offer.lineItems, offer.totals.exVat).map(
    (entry) => ({
      Kategori: entry.category,
      Belopp: entry.amount,
      AndelProcent: entry.share,
    })
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      categoryBreakdownRows.length > 0 ? categoryBreakdownRows : [{ Info: "Ingen kategoridata" }]
    ),
    "CategorySplit"
  );

  const typeBreakdownRows = calculateTypeBreakdown(offer.lineItems, offer.totals.exVat).map(
    (entry) => ({
      Typ: entry.type,
      Belopp: entry.amount,
      AndelProcent: entry.share,
    })
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(typeBreakdownRows.length > 0 ? typeBreakdownRows : [{ Info: "Ingen typdata" }]),
    "TypeSplit"
  );

  return workbook;
}

export function exportOfferToXlsx(input: {
  offer: Offer;
  comparisonOffers?: Offer[];
  fileName?: string;
}): string {
  const workbook = buildOfferWorkbook({
    offer: input.offer,
    comparisonOffers: input.comparisonOffers,
  });
  const fileName =
    input.fileName ??
    `offert-${input.offer.projectId}-v${input.offer.version}-${input.offer.id}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return fileName;
}
