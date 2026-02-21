import { beforeEach, describe, expect, it } from "vitest";
import {
  getDocumentById,
  saveDocument,
  type PlatformDocument,
} from "../app/lib/documents-store";

describe("documents-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists linked refs and prompt payload", () => {
    const doc: PlatformDocument = {
      id: "doc-store-1",
      refId: "",
      requestId: "req-store-1",
      audience: "brf",
      type: "contract",
      status: "sent",
      version: 1,
      createdAt: "2026-01-12T08:00:00.000Z",
      updatedAt: "2026-01-12T08:00:00.000Z",
      createdByRole: "entreprenor",
      createdByLabel: "Entreprenör AB",
      title: "Avtal - Test",
      linkedFileIds: ["file-1"],
      linkedRefs: ["FIL-260112AAAA-C"],
      attachments: [
        {
          fileId: "file-1",
          fileRefId: "FIL-260112AAAA-C",
          filename: "Avtal_Test.pdf",
          folder: "avtal",
          mimeType: "application/pdf",
        },
      ],
      sections: [],
      documentPromptPayload: {
        generatedAt: "2026-01-12T08:00:00.000Z",
        selectedSectionIds: ["parties", "payment"],
        entrepreneurInputs: {
          priceSummary: "120 000 kr",
          paymentPlan: "50/50",
        },
        requestContext: {
          id: "req-store-1",
          title: "Stambyte",
          audience: "brf",
          location: "Malmö",
          desiredStart: "2026-03-01",
          budgetRange: "100 000 - 150 000 kr",
          scope: { actions: [], scopeItems: [] },
          filesSummary: [
            {
              id: "file-1",
              name: "Ritning.pdf",
              fileTypeLabel: "Ritning",
            },
          ],
          derivedSummary: "Testsammanfattning",
        },
      },
    };

    saveDocument(doc);
    const stored = getDocumentById("doc-store-1");

    expect(stored).not.toBeNull();
    expect(stored?.linkedRefs).toContain("FIL-260112AAAA-C");
    expect(stored?.documentPromptPayload?.selectedSectionIds).toEqual(["parties", "payment"]);
    expect(stored?.documentPromptPayload?.requestContext.id).toBe("req-store-1");
  });
});
