import { describe, expect, it } from "vitest";
import type { PlatformDocument } from "../app/lib/documents-store";
import type { ProjectFile } from "../app/lib/project-files/types";
import type { RequestMessage } from "../app/lib/request-messages";
import type { PlatformRequest } from "../app/lib/requests-store";
import { buildProjectTimeline } from "../app/lib/timeline/builder";

function makeRequest(overrides: Partial<PlatformRequest> = {}): PlatformRequest {
  return {
    id: "req-1",
    refId: "DOC-REQ-1",
    createdAt: "2026-01-01T08:00:00.000Z",
    audience: "brf",
    status: "sent",
    requestType: "offer_request_v1",
    title: "Stambyte i BRF Exempel",
    location: "Göteborg",
    desiredStart: "2026-03-01",
    budgetRange: "1 000 000 - 1 500 000 kr",
    scope: {
      actions: [],
      scopeItems: [],
    },
    completeness: 80,
    missingInfo: [],
    sharingApproved: false,
    ...overrides,
  } as PlatformRequest;
}

function makeDocument(overrides: Partial<PlatformDocument> = {}): PlatformDocument {
  return {
    id: "doc-1",
    refId: "DOC-1001",
    requestId: "req-1",
    audience: "brf",
    type: "quote",
    status: "draft",
    version: 1,
    createdAt: "2026-01-03T09:00:00.000Z",
    updatedAt: "2026-01-03T09:00:00.000Z",
    createdByRole: "entreprenor",
    createdByLabel: "Entreprenör AB",
    title: "Offert",
    linkedFileIds: [],
    attachments: [],
    sections: [],
    ...overrides,
  };
}

function makeFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: "file-1",
    refId: "FIL-101",
    projectId: "req-1",
    folder: "ritningar",
    filename: "ritning.pdf",
    mimeType: "application/pdf",
    size: 1500,
    createdAt: "2026-01-07T10:00:00.000Z",
    createdBy: "Entreprenör AB",
    sourceType: "manual",
    sourceId: "manual-1",
    contentRef: {
      storage: "localStorage",
      contentId: "content-1",
      mimeType: "application/pdf",
      size: 1500,
    },
    ...overrides,
  };
}

function makeMessage(overrides: Partial<RequestMessage> = {}): RequestMessage {
  return {
    id: "msg-1",
    requestId: "req-1",
    authorRole: "entreprenor",
    authorLabel: "Entreprenör AB",
    body: "Vi behöver komplettering.",
    messageType: "question",
    createdAt: "2026-01-06T14:00:00.000Z",
    attachments: [],
    ...overrides,
  };
}

describe("buildProjectTimeline", () => {
  it("returns current milestone and events sorted by latest timestamp", () => {
    const request = makeRequest({
      recipients: [
        {
          id: "rec-1",
          companyName: "Nord Bygg",
          status: "sent",
          sentAt: "2026-01-02T10:00:00.000Z",
        },
      ],
    });

    const documents: PlatformDocument[] = [
      makeDocument({
        id: "doc-quote-1",
        refId: "DOC-2001",
        type: "quote",
        status: "sent",
        sentAt: "2026-01-04T08:00:00.000Z",
      }),
      makeDocument({
        id: "doc-contract-1",
        refId: "DOC-3001",
        type: "contract",
        status: "draft",
        createdAt: "2026-01-05T08:00:00.000Z",
        updatedAt: "2026-01-05T08:00:00.000Z",
      }),
    ];

    const timeline = buildProjectTimeline({
      projectId: "req-1",
      role: "brf",
      sources: {
        request,
        documents,
        files: [makeFile()],
        messages: [makeMessage()],
      },
    });

    expect(timeline.currentMilestoneId).toBe("quote-decision");
    expect(timeline.events[0]?.id).toBe("file-file-1");

    const firstTimestamp = timeline.events[0]?.timestamp;
    const secondTimestamp = timeline.events[1]?.timestamp;
    expect(firstTimestamp).toBeTruthy();
    expect(secondTimestamp).toBeTruthy();
    if (firstTimestamp && secondTimestamp) {
      expect(Date.parse(firstTimestamp)).toBeGreaterThan(Date.parse(secondTimestamp));
    }
  });

  it("includes multiple ATA events when several ATA documents exist", () => {
    const ataDocuments: PlatformDocument[] = [
      makeDocument({
        id: "doc-ata-1",
        refId: "DOC-ATA-1",
        type: "ate",
        status: "sent",
        createdAt: "2026-02-01T08:00:00.000Z",
        updatedAt: "2026-02-01T08:00:00.000Z",
        sentAt: "2026-02-01T09:00:00.000Z",
      }),
      makeDocument({
        id: "doc-ata-2",
        refId: "DOC-ATA-2",
        type: "ate",
        status: "accepted",
        createdAt: "2026-02-03T08:00:00.000Z",
        updatedAt: "2026-02-03T12:00:00.000Z",
        acceptedAt: "2026-02-03T12:00:00.000Z",
      }),
    ];

    const timeline = buildProjectTimeline({
      projectId: "req-1",
      role: "entreprenor",
      sources: {
        request: makeRequest({ status: "received" }),
        documents: ataDocuments,
        files: [],
        messages: [],
      },
    });

    const ataEvents = timeline.events.filter((event) => event.filters.includes("ata"));

    expect(ataEvents.length).toBeGreaterThanOrEqual(2);
    expect(ataEvents.some((event) => event.label.includes("DOC-ATA-1"))).toBe(true);
    expect(ataEvents.some((event) => event.label.includes("DOC-ATA-2"))).toBe(true);
    expect(timeline.milestones.find((milestone) => milestone.id === "ata")?.state).toBe("done");
  });
});
