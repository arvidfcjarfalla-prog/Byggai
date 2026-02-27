import type { RequestStatus } from "../requests-store";
import type { ProjectStatus } from "./types";

// Temporary bridge while the app still stores a simplified request.status.
export function legacyRequestStatusToProjectStatus(status: RequestStatus): ProjectStatus {
  if (status === "draft") return "DRAFT";
  if (status === "received") return "OFFERS_RECEIVED";
  return "TENDERING";
}

export function projectStatusToLegacyRequestStatus(status: ProjectStatus): RequestStatus {
  if (status === "DRAFT") return "draft";
  if (status === "OFFERS_RECEIVED" || status === "NEGOTIATION") return "received";
  return "sent";
}

