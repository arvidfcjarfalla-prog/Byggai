import { beforeEach, describe, expect, it } from "vitest";
import {
  addFile,
  ensureProjectFileTree,
  findEntityByRefId,
  listFiles,
  shareFileToWorkspace,
  updateFileMetadata,
  PROJECT_FILE_TREES_KEY,
  PROJECT_FILES_STORAGE_KEY,
} from "../app/lib/project-files/store";
import { validateRefId } from "../app/lib/refid/validate";

describe("project-files store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("addFile + listFiles returns file in correct folder", async () => {
    const tree = ensureProjectFileTree("req-1");
    expect(tree).toContain("offert");

    const bytes = new TextEncoder().encode("test-pdf");

    await addFile({
      projectId: "req-1",
      folder: "offert",
      filename: "offert-test.pdf",
      mimeType: "application/pdf",
      createdBy: "Tester",
      sourceType: "offert",
      sourceId: "doc-1",
      bytes,
      senderRole: "entreprenor",
      senderWorkspaceId: "entreprenor",
    });

    const listed = listFiles("req-1", "offert");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.filename).toBe("offert-test.pdf");
    expect(listed[0]?.refId.startsWith("FIL-")).toBe(true);
    expect(validateRefId(listed[0]?.refId || "")).toBe(true);
    expect(localStorage.getItem(PROJECT_FILES_STORAGE_KEY)).toContain("offert-test.pdf");
    expect(localStorage.getItem(PROJECT_FILE_TREES_KEY)).toContain("req-1");

    const found = findEntityByRefId("req-1", listed[0]?.refId || "");
    expect(found).toEqual({ kind: "FIL", id: listed[0]?.id, projectId: "req-1" });
  });

  it("shareFileToWorkspace copies file with provenance", async () => {
    const bytes = new TextEncoder().encode("pdf-content");
    const source = await addFile({
      projectId: "req-2",
      folder: "avtal",
      filename: "avtal.pdf",
      mimeType: "application/pdf",
      createdBy: "Entreprenör",
      sourceType: "avtal",
      sourceId: "doc-2",
      bytes,
      senderRole: "entreprenor",
      senderWorkspaceId: "entreprenor",
      version: 1,
    });

    await shareFileToWorkspace({
      fileId: source.id,
      fromProjectId: "req-2",
      toWorkspaceId: "brf",
      senderRole: "entreprenor",
      senderWorkspaceId: "entreprenor",
      senderLabel: "Entreprenör",
    });

    const recipientFiles = listFiles("req-2", "avtal", undefined, "brf");
    expect(recipientFiles.length).toBeGreaterThan(0);
    const delivered = recipientFiles[0];
    expect(delivered?.recipientWorkspaceId).toBe("brf");
    expect(delivered?.sourceId).toBe("doc-2");
    expect(delivered?.senderWorkspaceId).toBe("entreprenor");
    expect(validateRefId(delivered?.refId || "")).toBe(true);
    expect(delivered?.refId).not.toBe(source.refId);
  });

  it("updateFileMetadata persists filename and folder", async () => {
    const bytes = new TextEncoder().encode("text-content");
    const created = await addFile({
      projectId: "req-3",
      folder: "ovrigt",
      filename: "anteckning.txt",
      mimeType: "text/plain",
      createdBy: "Tester",
      sourceType: "manual",
      sourceId: "manual-1",
      bytes,
      senderRole: "entreprenor",
      senderWorkspaceId: "entreprenor",
    });

    const updated = updateFileMetadata({
      projectId: "req-3",
      fileId: created.id,
      filename: "anteckning-uppdaterad.txt",
      folder: "ritningar",
    });

    expect(updated).not.toBeNull();
    expect(updated?.filename).toBe("anteckning-uppdaterad.txt");
    expect(updated?.folder).toBe("ritningar");

    const listed = listFiles("req-3", undefined, "uppdaterad");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.folder).toBe("ritningar");
  });
});
