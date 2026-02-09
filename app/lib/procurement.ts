import {
  listRequests,
  replaceRequests,
  REQUESTS_STORAGE_KEY,
  REQUESTS_UPDATED_EVENT,
  saveRequest,
  type PlatformRequest,
} from "./requests-store";

export type {
  PlatformRequest as EntrepreneurRequest,
  ProcurementAction,
  ProcurementActionDetail,
  RequestDocumentSummary,
  RequestDocumentSummaryItem,
  RequestFileRecord,
  RequestPropertySnapshot,
  RequestScopeItem,
  RequestAudience,
  RequestRecipient,
  RequestRecipientStatus,
  RequestStatus,
} from "./requests-store";

export const PROCUREMENT_REQUESTS_KEY = REQUESTS_STORAGE_KEY;
export const PROCUREMENT_UPDATED_EVENT = REQUESTS_UPDATED_EVENT;

export function readProcurementRequests(): PlatformRequest[] {
  return listRequests();
}

export function writeProcurementRequests(requests: PlatformRequest[]): PlatformRequest[] {
  return replaceRequests(requests);
}

export function prependProcurementRequest(request: PlatformRequest): PlatformRequest[] {
  return saveRequest(request);
}
