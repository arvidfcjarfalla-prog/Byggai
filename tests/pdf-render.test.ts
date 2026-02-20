import { describe, expect, it } from "vitest";
import {
  buildDocumentRenderModel,
  renderDocumentToPdfBytes,
} from "../app/lib/pdf/render-document";
import { loadNordicFontBytes } from "../app/lib/pdf/font-loader";
import type { PlatformDocument } from "../app/lib/documents-store";
import { generateRefId } from "../app/lib/refid/generator";

describe("renderDocumentToPdfBytes", () => {
  it("returns bytes beginning with %PDF-", async () => {
    const docRefId = generateRefId({ kind: "DOC", date: new Date("2026-01-10T00:00:00.000Z") });
    const fileRefId = generateRefId({ kind: "FIL", date: new Date("2026-01-10T00:00:00.000Z") });
    const doc: PlatformDocument = {
      id: "doc-1",
      refId: docRefId,
      requestId: "req-1",
      audience: "privat",
      type: "quote",
      status: "draft",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByRole: "entreprenor",
      createdByLabel: "Entreprenör",
      title: "Offert ÅÄÖ åäö",
      linkedFileIds: ["file-1"],
      attachments: [
        {
          fileId: "file-1",
          fileRefId,
          filename: "Ritning-plan-1.pdf",
          folder: "ritningar",
          mimeType: "application/pdf",
        },
      ],
      sections: [
        {
          id: "s1",
          title: "Projektöversikt",
          enabled: true,
          fields: [{ id: "f1", label: "Titel", type: "text", value: "Köksrenovering ÅÄÖ åäö" }],
          items: [{ id: "i1", label: "Rivning", value: "Ingår" }],
        },
        {
          id: "s2",
          title: "Bilagor",
          enabled: true,
          fields: [],
        },
      ],
    };

    const bytes = await renderDocumentToPdfBytes({ document: doc, request: null });
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    expect(signature).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(100);

    const fontBytes = await loadNordicFontBytes();
    expect(fontBytes.length).toBeGreaterThan(1000);

    const model = buildDocumentRenderModel({ document: doc, request: null });
    expect(model.localeSample).toBe("ÅÄÖ åäö");
    expect(JSON.stringify(model)).toContain("ÅÄÖ åäö");
    expect(JSON.stringify(model)).toContain(fileRefId);
    expect(model.projectRows.some((row) => row.label === "RefID" && row.value === docRefId)).toBe(true);
  });
});
