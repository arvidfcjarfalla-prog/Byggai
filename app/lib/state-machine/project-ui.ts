import type { ProjectStatus } from "./types";

export type ProjectModuleKey =
  | "requests"
  | "offers"
  | "documents"
  | "messages"
  | "change_orders"
  | "inspection";

export interface ProjectUiSpec {
  phaseLabel: string;
  statusLabel: string;
  primaryCtaLabel: string;
  lockedModules: ProjectModuleKey[];
}

export const PROJECT_STATUS_UI: Record<ProjectStatus, ProjectUiSpec> = {
  DRAFT: {
    phaseLabel: "Initiering",
    statusLabel: "Utkast",
    primaryCtaLabel: "Publicera förfrågan",
    lockedModules: ["offers", "documents", "change_orders", "inspection"],
  },
  PUBLISHED: {
    phaseLabel: "Upphandling",
    statusLabel: "Publicerad",
    primaryCtaLabel: "Starta upphandling",
    lockedModules: ["offers", "documents", "change_orders", "inspection"],
  },
  TENDERING: {
    phaseLabel: "Upphandling",
    statusLabel: "Under upphandling",
    primaryCtaLabel: "Följ frågor & svar",
    lockedModules: ["change_orders", "inspection"],
  },
  OFFERS_RECEIVED: {
    phaseLabel: "Offertval",
    statusLabel: "Offerter inkomna",
    primaryCtaLabel: "Jämför offerter",
    lockedModules: ["change_orders", "inspection"],
  },
  NEGOTIATION: {
    phaseLabel: "Offertval",
    statusLabel: "Förhandling",
    primaryCtaLabel: "Fortsätt förhandling",
    lockedModules: ["change_orders", "inspection"],
  },
  CONTRACTED: {
    phaseLabel: "Avtal",
    statusLabel: "Avtalad",
    primaryCtaLabel: "Bekräfta projektstart",
    lockedModules: ["change_orders", "inspection"],
  },
  IN_PROGRESS: {
    phaseLabel: "Genomförande",
    statusLabel: "Pågående",
    primaryCtaLabel: "Följ projektstatus",
    lockedModules: [],
  },
  COMPLETED_PENDING_INSPECTION: {
    phaseLabel: "Besiktning",
    statusLabel: "Väntar på besiktning",
    primaryCtaLabel: "Boka / registrera besiktning",
    lockedModules: [],
  },
  CLOSED: {
    phaseLabel: "Avslut",
    statusLabel: "Avslutat",
    primaryCtaLabel: "Öppna projektarkiv",
    lockedModules: [],
  },
  CANCELLED: {
    phaseLabel: "Avslut",
    statusLabel: "Avbrutet",
    primaryCtaLabel: "Visa historik",
    lockedModules: ["offers", "change_orders", "inspection"],
  },
  EXPIRED: {
    phaseLabel: "Upphandling",
    statusLabel: "Utgången",
    primaryCtaLabel: "Publicera på nytt",
    lockedModules: ["change_orders", "inspection"],
  },
};

export function getProjectUiSpec(status: ProjectStatus): ProjectUiSpec {
  return PROJECT_STATUS_UI[status];
}

