// Routing contract:
// Never hardcode `/dashboard/...` routes in UI/navigation code. Use helpers in this file.

export type DashboardRoleSegment = "entreprenor" | "brf" | "privat";
export type RoutesRoleKey = "entreprenor" | "brf" | "privatperson";

type QueryValue = string | number | boolean | null | undefined;
type QueryShape = Record<string, QueryValue>;

type RequestContext = {
  requestId?: string | null;
};

type DocumentsIndexContext = RequestContext & {
  type?: "quote" | "contract" | "ate" | "all" | null;
};

type ProjectContext = {
  projectId?: string | null;
};

type WithFrom = {
  from?: string | null;
};

function withQuery(path: string, query?: QueryShape): string {
  if (!query) return path;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, rawValue]) => {
    if (rawValue === null || rawValue === undefined) return;
    const value = String(rawValue).trim();
    if (!value) return;
    params.set(key, value);
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function dashboardBase(segment: DashboardRoleSegment): string {
  return `/dashboard/${segment}`;
}

function createWorkspaceRoutes(segment: DashboardRoleSegment) {
  const base = dashboardBase(segment);
  return {
    dashboard(): string {
      return base;
    },
    overview(): string {
      return base;
    },
    documentsIndex(context?: DocumentsIndexContext): string {
      return withQuery(`${base}/dokument`, { requestId: context?.requestId, type: context?.type });
    },
    documentDetail(input: { documentId: string } & RequestContext): string {
      return withQuery(`${base}/dokument/${encodeURIComponent(input.documentId)}`, {
        requestId: input.requestId,
      });
    },
    requestsIndex(context?: RequestContext): string {
      return withQuery(`${base}/forfragningar`, { requestId: context?.requestId });
    },
    timelineIndex(context?: ProjectContext): string {
      return withQuery(`${base}/tidslinje`, { projectId: context?.projectId });
    },
    planningIndex(context?: ProjectContext): string {
      return withQuery(`${base}/planering`, { projectId: context?.projectId });
    },
    filesIndex(): string {
      return `${base}/filer`;
    },
    economyIndex(context?: ProjectContext): string {
      return withQuery(`${base}/ekonomi`, { projectId: context?.projectId });
    },
    messagesIndex(context?: RequestContext): string {
      return withQuery(`${base}/meddelanden`, { requestId: context?.requestId });
    },
  };
}

const brfRoutes = {
  ...createWorkspaceRoutes("brf"),
  propertyIndex(): string {
    return "/dashboard/brf/fastighet";
  },
  maintenanceIndex(): string {
    return "/dashboard/brf/underhallsplan";
  },
  procurementIndex(): string {
    return "/dashboard/brf/upphandling";
  },
  procurementOfferIndex(): string {
    return "/dashboard/brf/upphandling/offert";
  },
  procurementOfferStep1(): string {
    return "/dashboard/brf/upphandling/offert/steg-1";
  },
  procurementOfferStep2(): string {
    return "/dashboard/brf/upphandling/offert/steg-2";
  },
  procurementOfferStep3(): string {
    return "/dashboard/brf/upphandling/offert/steg-3";
  },
  actionDetail(input: { actionId: string } & WithFrom): string {
    return withQuery(`/dashboard/brf/underhallsplan/atgard/${encodeURIComponent(input.actionId)}`, {
      from: input.from,
    });
  },
  actionDetailBase(): string {
    return "/dashboard/brf/underhallsplan/atgard";
  },
};

const entreprenorRoutes = {
  ...createWorkspaceRoutes("entreprenor"),
  ataGeneratorIndex(context?: RequestContext): string {
    return withQuery("/dashboard/entreprenor/dokument/ata", { requestId: context?.requestId });
  },
  requestDetail(input: { requestId: string }): string {
    return `/dashboard/entreprenor/forfragningar/request/${encodeURIComponent(input.requestId)}`;
  },
  offerAnalysis(input: { offerId: string }): string {
    return `/dashboard/entreprenor/forfragningar/${encodeURIComponent(input.offerId)}/analysis`;
  },
};

const privatpersonRoutes = {
  ...createWorkspaceRoutes("privat"),
  offerDetail(input: { offerId: string } & RequestContext): string {
    return withQuery(`/dashboard/privat/forfragningar/${encodeURIComponent(input.offerId)}`, {
      requestId: input.requestId,
    });
  },
  underlagIndex(): string {
    return "/dashboard/privat/underlag";
  },
};

export const routes = {
  entreprenor: entreprenorRoutes,
  brf: brfRoutes,
  privatperson: privatpersonRoutes,
  // Alias to match existing internal naming (`privat`) while keeping public API explicit.
  privat: privatpersonRoutes,
  konto(): string {
    return "/dashboard/konto";
  },
};

export type EntreprenorRoutes = typeof routes.entreprenor;
export type BrfRoutes = typeof routes.brf;
export type PrivatpersonRoutes = typeof routes.privatperson;
