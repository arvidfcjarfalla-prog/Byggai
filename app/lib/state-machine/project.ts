import type {
  ProjectLifecycleEvent,
  ProjectStatus,
  ProjectTransitionActor,
  ProjectTransitionAuditEntry,
  ProjectTransitionContext,
  ProjectTransitionFailure,
  ProjectTransitionResult,
} from "./types";

type GuardFailureCode = ProjectTransitionFailure["code"];

interface GuardFailure {
  code: GuardFailureCode;
  reason: string;
}

function minAttachmentsRequired(context: ProjectTransitionContext): number {
  return Math.max(0, context.minAttachmentsRequired ?? 1);
}

function requirePublishReadiness(context: ProjectTransitionContext): GuardFailure | null {
  if (!context.requiredFieldsComplete) {
    return {
      code: "MISSING_REQUIRED_FIELDS",
      reason: "Du kan inte publicera ännu — obligatoriska fält saknas.",
    };
  }
  const attachments = context.attachmentsCount ?? 0;
  const minimum = minAttachmentsRequired(context);
  if (attachments < minimum) {
    return {
      code: "MISSING_ATTACHMENTS",
      reason: `Du kan inte publicera ännu — minst ${minimum} bilaga/bilagor krävs.`,
    };
  }
  return null;
}

function requireRecipients(context: ProjectTransitionContext): GuardFailure | null {
  if ((context.recipientCount ?? 0) < 1) {
    return {
      code: "NO_RECIPIENTS",
      reason: "Du kan inte starta upphandling ännu — inga mottagare är valda.",
    };
  }
  return null;
}

function requireOffers(context: ProjectTransitionContext): GuardFailure | null {
  if ((context.offerCount ?? 0) < 1) {
    return {
      code: "NO_OFFERS",
      reason: "Du kan inte gå vidare ännu — inga offerter finns.",
    };
  }
  return null;
}

function requireSelectedOffer(context: ProjectTransitionContext): GuardFailure | null {
  if (!context.selectedOfferId) {
    return {
      code: "NO_SELECTED_OFFER",
      reason: "Du måste välja en offert först.",
    };
  }
  return null;
}

function requireContractAccepted(context: ProjectTransitionContext): GuardFailure | null {
  if (!context.buyerAcceptedOffer) {
    return {
      code: "CONTRACT_NOT_ACCEPTED",
      reason: "Beställaren har inte accepterat offerten ännu.",
    };
  }
  return null;
}

function requireContractSigned(context: ProjectTransitionContext): GuardFailure | null {
  if (!context.contractorSignedContract) {
    return {
      code: "CONTRACT_NOT_SIGNED",
      reason: "Kontraktet är inte signerat av entreprenören ännu.",
    };
  }
  return null;
}

function requireStartDate(context: ProjectTransitionContext): GuardFailure | null {
  if (!context.startDate || context.startDate.trim().length === 0) {
    return {
      code: "MISSING_START_DATE",
      reason: "Projektstart kan inte bekräftas utan startdatum.",
    };
  }
  return null;
}

function requireInspectionPassed(context: ProjectTransitionContext): GuardFailure | null {
  if (!context.inspectionPassed) {
    return {
      code: "INSPECTION_NOT_PASSED",
      reason: "Projektet kan inte avslutas innan godkänd besiktning.",
    };
  }
  return null;
}

function requireFinalPayment(context: ProjectTransitionContext): GuardFailure | null {
  if (!context.finalPaymentMarkedPaid) {
    return {
      code: "FINAL_PAYMENT_NOT_MARKED",
      reason: "Projektet kan inte avslutas innan slutfaktura markerats som betald.",
    };
  }
  return null;
}

type TransitionRule = {
  nextStatus: ProjectStatus;
  guards?: Array<(context: ProjectTransitionContext) => GuardFailure | null>;
};

type TransitionTable = Partial<Record<ProjectLifecycleEvent, TransitionRule>>;

const PROJECT_TRANSITIONS: Record<ProjectStatus, TransitionTable> = {
  DRAFT: {
    PUBLISH_REQUEST: {
      nextStatus: "PUBLISHED",
      guards: [requirePublishReadiness],
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  PUBLISHED: {
    APPROVE_CONTRACTOR_TO_TENDER: {
      nextStatus: "TENDERING",
      guards: [requireRecipients],
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  TENDERING: {
    SUBMIT_OFFER: {
      nextStatus: "OFFERS_RECEIVED",
      guards: [requireOffers],
    },
    TENDER_DEADLINE_PASSED: {
      nextStatus: "OFFERS_RECEIVED",
      guards: [requireOffers],
    },
    NO_OFFERS_TIMEOUT: {
      nextStatus: "EXPIRED",
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  OFFERS_RECEIVED: {
    SELECT_OFFER_FOR_NEGOTIATION: {
      nextStatus: "NEGOTIATION",
      guards: [requireSelectedOffer],
    },
    ACCEPT_OFFER_AND_START_CONTRACT: {
      nextStatus: "CONTRACTED",
      guards: [requireSelectedOffer, requireContractAccepted],
    },
    SIGN_CONTRACT: {
      nextStatus: "CONTRACTED",
      guards: [requireSelectedOffer, requireContractAccepted, requireContractSigned],
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  NEGOTIATION: {
    ACCEPT_OFFER_AND_START_CONTRACT: {
      nextStatus: "CONTRACTED",
      guards: [requireSelectedOffer, requireContractAccepted],
    },
    SIGN_CONTRACT: {
      nextStatus: "CONTRACTED",
      guards: [requireSelectedOffer, requireContractAccepted, requireContractSigned],
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  CONTRACTED: {
    CONFIRM_START: {
      nextStatus: "IN_PROGRESS",
      guards: [requireStartDate],
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  IN_PROGRESS: {
    SUBMIT_COMPLETION_NOTICE: {
      nextStatus: "COMPLETED_PENDING_INSPECTION",
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  COMPLETED_PENDING_INSPECTION: {
    CONFIRM_INSPECTION_PASSED: {
      nextStatus: "CLOSED",
      guards: [requireInspectionPassed, requireFinalPayment],
    },
    CLOSE_PROJECT: {
      nextStatus: "CLOSED",
      guards: [requireInspectionPassed, requireFinalPayment],
    },
    CANCEL_PROJECT: {
      nextStatus: "CANCELLED",
    },
  },
  CLOSED: {},
  CANCELLED: {},
  EXPIRED: {},
};

function invalidTransitionResult(
  context: ProjectTransitionContext,
  event: ProjectLifecycleEvent
): ProjectTransitionFailure {
  return {
    ok: false,
    code: "INVALID_TRANSITION",
    reason: `Ogiltig övergång: ${context.currentStatus} -> ${event}`,
  };
}

function buildAuditEntry(input: {
  context: ProjectTransitionContext;
  actor: ProjectTransitionActor;
  event: ProjectLifecycleEvent;
  toStatus: ProjectStatus;
  nowIso: string;
}): ProjectTransitionAuditEntry {
  return {
    kind: "project_status_transition",
    projectId: input.context.projectId,
    event: input.event,
    fromStatus: input.context.currentStatus,
    toStatus: input.toStatus,
    createdAt: input.nowIso,
    actorRole: input.actor.role,
    actorId: input.actor.id,
    actorLabel: input.actor.label,
  };
}

export function canTransitionProject(
  context: ProjectTransitionContext,
  event: ProjectLifecycleEvent
): ProjectTransitionResult {
  const rule = PROJECT_TRANSITIONS[context.currentStatus]?.[event];
  if (!rule) {
    return invalidTransitionResult(context, event);
  }

  const guards = rule.guards ?? [];
  for (const guard of guards) {
    const failure = guard(context);
    if (failure) {
      return {
        ok: false,
        code: failure.code,
        reason: failure.reason,
      };
    }
  }

  return {
    ok: true,
    nextStatus: rule.nextStatus,
    audit: buildAuditEntry({
      context,
      actor: { role: "system", label: "Validation" },
      event,
      toStatus: rule.nextStatus,
      nowIso: new Date().toISOString(),
    }),
  };
}

export function transitionProjectStatus(input: {
  context: ProjectTransitionContext;
  event: ProjectLifecycleEvent;
  actor: ProjectTransitionActor;
  now?: string;
}): ProjectTransitionResult {
  const rule = PROJECT_TRANSITIONS[input.context.currentStatus]?.[input.event];
  if (!rule) {
    return invalidTransitionResult(input.context, input.event);
  }

  const guards = rule.guards ?? [];
  for (const guard of guards) {
    const failure = guard(input.context);
    if (failure) {
      return {
        ok: false,
        code: failure.code,
        reason: failure.reason,
      };
    }
  }

  const nowIso = input.now ?? new Date().toISOString();
  return {
    ok: true,
    nextStatus: rule.nextStatus,
    audit: buildAuditEntry({
      context: input.context,
      actor: input.actor,
      event: input.event,
      toStatus: rule.nextStatus,
      nowIso,
    }),
  };
}

export function listAllowedProjectEvents(context: ProjectTransitionContext): Array<{
  event: ProjectLifecycleEvent;
  allowed: boolean;
  nextStatus?: ProjectStatus;
  reason?: string;
}> {
  const table = PROJECT_TRANSITIONS[context.currentStatus];
  const events = Object.keys(table) as ProjectLifecycleEvent[];
  return events.map((event) => {
    const result = canTransitionProject(context, event);
    if (result.ok) {
      return {
        event,
        allowed: true,
        nextStatus: result.nextStatus,
      };
    }
    return {
      event,
      allowed: false,
      reason: result.reason,
    };
  });
}

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "TENDERING",
  "OFFERS_RECEIVED",
  "NEGOTIATION",
  "CONTRACTED",
  "IN_PROGRESS",
  "COMPLETED_PENDING_INSPECTION",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
];

