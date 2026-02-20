import { beforeEach, describe, expect, it } from "vitest";
import {
  BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY,
  getDocumentById,
  listDocuments,
  saveDocument,
  type PlatformDocument,
} from "../app/lib/documents-store";
import { findEntityByRefId } from "../app/lib/project-files/store";
import { validateRefId } from "../app/lib/refid/validate";

describe("documents refId migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("backfills missing RefID once and keeps it stable", () => {
    const legacyRaw = [
      {
        id: "doc-legacy-1",
        requestId: "req-legacy",
        audience: "privat",
        type: "quote",
        status: "sent",
        version: 1,
        createdAt: "2026-02-10T10:00:00.000Z",
        updatedAt: "2026-02-10T10:00:00.000Z",
        createdByRole: "entreprenor",
        createdByLabel: "Test",
        title: "Legacy Offert",
        linkedFileIds: [],
        sections: [],
      },
    ];

    localStorage.setItem(BYGGPLATTFORMEN_DOCUMENTS_STORAGE_KEY, JSON.stringify(legacyRaw));

    const firstRead = listDocuments();
    expect(firstRead).toHaveLength(1);
    const firstRefId = firstRead[0]?.refId || "";
    expect(validateRefId(firstRefId)).toBe(true);

    const secondRead = listDocuments();
    expect(secondRead[0]?.refId).toBe(firstRefId);

    const found = findEntityByRefId("req-legacy", firstRefId);
    expect(found).toEqual({ kind: "DOC", id: "doc-legacy-1", projectId: "req-legacy" });
  });

  it("persists attachments on document save", () => {
    const doc: PlatformDocument = {
      id: "doc-attachments-1",
      refId: "",
      requestId: "req-attachments",
      audience: "brf",
      type: "contract",
      status: "draft",
      version: 1,
      createdAt: "2026-02-12T08:00:00.000Z",
      updatedAt: "2026-02-12T08:00:00.000Z",
      createdByRole: "entreprenor",
      createdByLabel: "Test",
      title: "Avtal",
      linkedFileIds: ["file-1"],
      attachments: [
        {
          fileId: "file-1",
          fileRefId: "FIL-26ABCDEF-0",
          filename: "Bilaga.pdf",
          folder: "avtal",
          mimeType: "application/pdf",
        },
      ],
      sections: [],
    };

    saveDocument(doc);
    const saved = getDocumentById("doc-attachments-1");
    expect(saved?.attachments).toHaveLength(1);
    expect(saved?.attachments[0]?.fileRefId).toBe("FIL-26ABCDEF-0");
    expect(validateRefId(saved?.refId || "")).toBe(true);
  });
});
