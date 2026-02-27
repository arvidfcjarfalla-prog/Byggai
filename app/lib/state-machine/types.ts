export type ProjectStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "TENDERING"
  | "OFFERS_RECEIVED"
  | "NEGOTIATION"
  | "CONTRACTED"
  | "IN_PROGRESS"
  | "COMPLETED_PENDING_INSPECTION"
  | "CLOSED"
  | "CANCELLED"
  | "EXPIRED";

export type ChangeOrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED";

export type ProjectLifecycleEvent =
  | "SAVE_DRAFT"
  | "PUBLISH_REQUEST"
  | "APPROVE_CONTRACTOR_TO_TENDER"
  | "SUBMIT_OFFER"
  | "TENDER_DEADLINE_PASSED"
  | "NO_OFFERS_TIMEOUT"
  | "SELECT_OFFER_FOR_NEGOTIATION"
  | "ACCEPT_OFFER_AND_START_CONTRACT"
  | "SIGN_CONTRACT"
  | "CONFIRM_START"
  | "SUBMIT_COMPLETION_NOTICE"
  | "BOOK_INSPECTION"
  | "CONFIRM_INSPECTION_PASSED"
  | "CLOSE_PROJECT"
  | "CANCEL_PROJECT";

export type ProjectActorRole = "bestallare" | "entreprenor" | "system";

export interface ProjectTransitionActor {
  role: ProjectActorRole;
  id?: string;
  label?: string;
}

export interface ProjectTransitionContext {
  projectId: string;
  currentStatus: ProjectStatus;
  requiredFieldsComplete?: boolean;
  attachmentsCount?: number;
  minAttachmentsRequired?: number;
  recipientCount?: number;
  offerCount?: number;
  selectedOfferId?: string | null;
  buyerAcceptedOffer?: boolean;
  contractorSignedContract?: boolean;
  startDate?: string | null;
  inspectionPassed?: boolean;
  finalPaymentMarkedPaid?: boolean;
}

export interface ProjectTransitionAuditEntry {
  kind: "project_status_transition";
  projectId: string;
  event: ProjectLifecycleEvent;
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  createdAt: string;
  actorRole: ProjectActorRole;
  actorId?: string;
  actorLabel?: string;
}

export interface ProjectTransitionSuccess {
  ok: true;
  nextStatus: ProjectStatus;
  audit: ProjectTransitionAuditEntry;
}

export interface ProjectTransitionFailure {
  ok: false;
  reason: string;
  code:
    | "INVALID_TRANSITION"
    | "MISSING_REQUIRED_FIELDS"
    | "MISSING_ATTACHMENTS"
    | "NO_RECIPIENTS"
    | "NO_OFFERS"
    | "NO_SELECTED_OFFER"
    | "CONTRACT_NOT_ACCEPTED"
    | "CONTRACT_NOT_SIGNED"
    | "MISSING_START_DATE"
    | "INSPECTION_NOT_PASSED"
    | "FINAL_PAYMENT_NOT_MARKED";
}

export type ProjectTransitionResult = ProjectTransitionSuccess | ProjectTransitionFailure;

export interface ChangeOrderRecord {
  id: string;
  projectId: string;
  status: ChangeOrderStatus;
  description: string;
  costEstimateSek: number;
  attachments?: string[];
  createdAt: string;
  deadlineAt: string;
  decidedAt?: string;
  escalatedAt?: string;
}

export interface CreateChangeOrderInput {
  id: string;
  projectId: string;
  description: string;
  costEstimateSek: number;
  attachments?: string[];
  createdAt?: string;
}

