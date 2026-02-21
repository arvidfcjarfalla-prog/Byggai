import { describe, expect, it } from "vitest";
import type { PlatformDocument } from "../app/lib/documents-store";
import { generateDocumentPdf } from "../app/lib/pdf/generate-document-pdf";

describe("generateDocumentPdf", () => {
  it("returns pdf bytes and a filename", async () => {
    const doc: PlatformDocument = {
      id: "doc-pdf-1",
      refId: "DOC-260101AAAA-B",
      requestId: "req-1",
      audience: "brf",
      type: "quote",
      status: "sent",
      version: 2,
      createdAt: "2026-01-10T10:00:00.000Z",
      updatedAt: "2026-01-11T10:00:00.000Z",
      createdByRole: "entreprenor",
      createdByLabel: "Entreprenör AB",
      title: "Offert - Test",
      linkedFileIds: [],
      linkedRefs: [],
      attachments: [],
      sections: [
        {
          id: "project-overview",
          title: "Projektöversikt",
          enabled: true,
          fields: [{ id: "project-title", label: "Titel", type: "text", value: "Testprojekt" }],
        },
      ],
    };

    const result = await generateDocumentPdf({
      document: doc,
      request: null,
    });

    const signature = new TextDecoder().decode(result.bytes.slice(0, 5));
    expect(signature).toBe("%PDF-");
    expect(result.fileName.endsWith(".pdf")).toBe(true);
    expect(result.fileName).toContain("v2");
  });
});
