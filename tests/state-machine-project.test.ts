import { describe, expect, it } from "vitest";
import {
  canTransitionProject,
  listAllowedProjectEvents,
  transitionProjectStatus,
} from "../app/lib/state-machine/project";
import {
  approveChangeOrder,
  createChangeOrder,
  escalateChangeOrderIfExpired,
  rejectChangeOrder,
} from "../app/lib/state-machine/change-order";
import { getProjectUiSpec } from "../app/lib/state-machine/project-ui";
import { legacyRequestStatusToProjectStatus, projectStatusToLegacyRequestStatus } from "../app/lib/state-machine/request-status-bridge";
import type { ProjectTransitionContext } from "../app/lib/state-machine/types";

function makeContext(overrides: Partial<ProjectTransitionContext> = {}): ProjectTransitionContext {
  return {
    projectId: "req-1",
    currentStatus: "DRAFT",
    requiredFieldsComplete: false,
    attachmentsCount: 0,
    minAttachmentsRequired: 1,
    recipientCount: 0,
    offerCount: 0,
    selectedOfferId: null,
    buyerAcceptedOffer: false,
    contractorSignedContract: false,
    startDate: null,
    inspectionPassed: false,
    finalPaymentMarkedPaid: false,
    ...overrides,
  };
}

describe("project state machine", () => {
  it("blocks DRAFT -> PUBLISHED when required fields are missing", () => {
    const result = canTransitionProject(makeContext(), "PUBLISH_REQUEST");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("MISSING_REQUIRED_FIELDS");
    }
  });

  it("allows DRAFT -> PUBLISHED when minimum requirements are met", () => {
    const result = transitionProjectStatus({
      context: makeContext({
        requiredFieldsComplete: true,
        attachmentsCount: 2,
      }),
      event: "PUBLISH_REQUEST",
      actor: { role: "bestallare", id: "buyer-1", label: "Beställare" },
      now: "2026-02-23T10:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextStatus).toBe("PUBLISHED");
      expect(result.audit.fromStatus).toBe("DRAFT");
      expect(result.audit.toStatus).toBe("PUBLISHED");
      expect(result.audit.actorRole).toBe("bestallare");
      expect(result.audit.createdAt).toBe("2026-02-23T10:00:00.000Z");
    }
  });

  it("blocks SUBMIT_OFFER when project is not in TENDERING", () => {
    const result = canTransitionProject(
      makeContext({
        currentStatus: "PUBLISHED",
        offerCount: 1,
      }),
      "SUBMIT_OFFER"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_TRANSITION");
    }
  });

  it("moves TENDERING -> OFFERS_RECEIVED when an offer exists", () => {
    const result = transitionProjectStatus({
      context: makeContext({
        currentStatus: "TENDERING",
        offerCount: 1,
      }),
      event: "SUBMIT_OFFER",
      actor: { role: "entreprenor", id: "ctr-1" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextStatus).toBe("OFFERS_RECEIVED");
    }
  });

  it("supports direct OFFERS_RECEIVED -> CONTRACTED without mandatory NEGOTIATION", () => {
    const result = transitionProjectStatus({
      context: makeContext({
        currentStatus: "OFFERS_RECEIVED",
        selectedOfferId: "offer-1",
        buyerAcceptedOffer: true,
      }),
      event: "ACCEPT_OFFER_AND_START_CONTRACT",
      actor: { role: "bestallare" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextStatus).toBe("CONTRACTED");
    }
  });

  it("requires inspection + final payment before closing", () => {
    const invalid = canTransitionProject(
      makeContext({
        currentStatus: "COMPLETED_PENDING_INSPECTION",
        inspectionPassed: true,
        finalPaymentMarkedPaid: false,
      }),
      "CLOSE_PROJECT"
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe("FINAL_PAYMENT_NOT_MARKED");
    }

    const valid = canTransitionProject(
      makeContext({
        currentStatus: "COMPLETED_PENDING_INSPECTION",
        inspectionPassed: true,
        finalPaymentMarkedPaid: true,
      }),
      "CLOSE_PROJECT"
    );
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.nextStatus).toBe("CLOSED");
    }
  });

  it("lists allowed events with guard reasons for UI gating", () => {
    const events = listAllowedProjectEvents(
      makeContext({
        currentStatus: "PUBLISHED",
        recipientCount: 0,
      })
    );

    const tenderEvent = events.find((entry) => entry.event === "APPROVE_CONTRACTOR_TO_TENDER");
    expect(tenderEvent).toBeDefined();
    expect(tenderEvent?.allowed).toBe(false);
    expect(tenderEvent?.reason?.length).toBeGreaterThan(0);
  });
});

describe("change order state machine", () => {
  it("creates a pending change order with a 48h deadline", () => {
    const order = createChangeOrder({
      id: "co-1",
      projectId: "req-1",
      description: "Extra rivning pga dold skada",
      costEstimateSek: 12500,
      createdAt: "2026-02-23T10:00:00.000Z",
    });

    expect(order.status).toBe("PENDING");
    expect(order.deadlineAt).toBe("2026-02-25T10:00:00.000Z");
  });

  it("escalates pending change order after 48h", () => {
    const order = createChangeOrder({
      id: "co-1",
      projectId: "req-1",
      description: "ÄTA",
      costEstimateSek: 1000,
      createdAt: "2026-02-23T10:00:00.000Z",
    });

    const escalated = escalateChangeOrderIfExpired(order, "2026-02-25T10:00:00.001Z");
    expect(escalated.status).toBe("ESCALATED");
    expect(escalated.escalatedAt).toBe("2026-02-25T10:00:00.001Z");
  });

  it("allows approval/rejection from escalated state", () => {
    const order = createChangeOrder({
      id: "co-1",
      projectId: "req-1",
      description: "ÄTA",
      costEstimateSek: 1000,
      createdAt: "2026-02-23T10:00:00.000Z",
    });
    const escalated = escalateChangeOrderIfExpired(order, "2026-02-26T10:00:00.000Z");
    const approved = approveChangeOrder(escalated, "2026-02-26T11:00:00.000Z");
    expect(approved.status).toBe("APPROVED");

    const rejected = rejectChangeOrder(escalated, "2026-02-26T12:00:00.000Z");
    expect(rejected.status).toBe("REJECTED");
  });
});

describe("state-machine bridge and ui config", () => {
  it("maps legacy request statuses to project statuses and back", () => {
    expect(legacyRequestStatusToProjectStatus("draft")).toBe("DRAFT");
    expect(legacyRequestStatusToProjectStatus("sent")).toBe("TENDERING");
    expect(legacyRequestStatusToProjectStatus("received")).toBe("OFFERS_RECEIVED");

    expect(projectStatusToLegacyRequestStatus("DRAFT")).toBe("draft");
    expect(projectStatusToLegacyRequestStatus("NEGOTIATION")).toBe("received");
    expect(projectStatusToLegacyRequestStatus("IN_PROGRESS")).toBe("sent");
  });

  it("exposes UI metadata for phase banner and module gating", () => {
    const draftUi = getProjectUiSpec("DRAFT");
    expect(draftUi.primaryCtaLabel).toBe("Publicera förfrågan");
    expect(draftUi.lockedModules).toContain("offers");

    const inProgressUi = getProjectUiSpec("IN_PROGRESS");
    expect(inProgressUi.lockedModules).not.toContain("change_orders");
  });
});

