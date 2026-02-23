import type { UserRole } from "./auth";
import { routes } from "./routes";

export type SidebarMatch = "exact" | "prefix";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  match?: SidebarMatch;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export interface QuickAction {
  id: string;
  label: string;
  href: string;
}

function normalizeRole(role: UserRole): Exclude<UserRole, "osaker"> {
  if (role === "brf") return "brf";
  if (role === "entreprenor") return "entreprenor";
  return "privat";
}

const SIDEBAR_NAV: Record<Exclude<UserRole, "osaker">, NavGroup[]> = {
  privat: [
    {
      id: "overview",
      label: "Översikt",
      items: [{ id: "overview", label: "Översikt", href: routes.privatperson.overview(), match: "exact" }],
    },
    {
      id: "project",
      label: "Projekt",
      items: [
        { id: "underlag", label: "Underlag", href: routes.privatperson.underlagIndex(), match: "prefix" },
        { id: "timeline", label: "Tidslinje", href: routes.privatperson.timelineIndex(), match: "prefix" },
        {
          id: "planning",
          label: "Planering (Gantt)",
          href: routes.privatperson.planningIndex(),
          match: "prefix",
        },
      ],
    },
    {
      id: "requests",
      label: "Förfrågningar",
      items: [{ id: "requests", label: "Förfrågningar", href: routes.privatperson.requestsIndex(), match: "prefix" }],
    },
    {
      id: "documents",
      label: "Dokument",
      items: [{ id: "documents", label: "Dokument", href: routes.privatperson.documentsIndex(), match: "prefix" }],
    },
    {
      id: "files",
      label: "Filer",
      items: [{ id: "files", label: "Filer", href: routes.privatperson.filesIndex(), match: "prefix" }],
    },
    {
      id: "messages",
      label: "Meddelanden",
      items: [{ id: "messages", label: "Meddelanden", href: routes.privatperson.messagesIndex(), match: "prefix" }],
    },
    {
      id: "account",
      label: "Konto",
      items: [{ id: "account", label: "Konto", href: routes.konto(), match: "exact" }],
    },
  ],
  brf: [
    {
      id: "overview",
      label: "Översikt",
      items: [{ id: "overview", label: "Översikt", href: routes.brf.overview(), match: "exact" }],
    },
    {
      id: "project",
      label: "Projekt",
      items: [
        { id: "property", label: "Fastighet", href: routes.brf.propertyIndex(), match: "prefix" },
        {
          id: "maintenance",
          label: "Underhållsplan",
          href: routes.brf.maintenanceIndex(),
          match: "prefix",
        },
        { id: "timeline", label: "Tidslinje", href: routes.brf.timelineIndex(), match: "prefix" },
        {
          id: "planning",
          label: "Planering (Gantt)",
          href: routes.brf.planningIndex(),
          match: "prefix",
        },
      ],
    },
    {
      id: "requests",
      label: "Förfrågningar",
      items: [{ id: "requests", label: "Förfrågningar", href: routes.brf.requestsIndex(), match: "prefix" }],
    },
    {
      id: "documents",
      label: "Dokument",
      items: [{ id: "documents", label: "Dokument", href: routes.brf.documentsIndex(), match: "prefix" }],
    },
    {
      id: "files",
      label: "Filer",
      items: [{ id: "files", label: "Filer", href: routes.brf.filesIndex(), match: "prefix" }],
    },
    {
      id: "messages",
      label: "Meddelanden",
      items: [{ id: "messages", label: "Meddelanden", href: routes.brf.messagesIndex(), match: "prefix" }],
    },
    {
      id: "account",
      label: "Konto",
      items: [{ id: "account", label: "Konto", href: routes.konto(), match: "exact" }],
    },
  ],
  entreprenor: [
    {
      id: "overview",
      label: "Översikt",
      items: [{ id: "overview", label: "Översikt", href: routes.entreprenor.overview(), match: "exact" }],
    },
    {
      id: "project",
      label: "Projekt",
      items: [{ id: "timeline", label: "Tidslinje", href: routes.entreprenor.timelineIndex(), match: "prefix" }],
    },
    {
      id: "requests",
      label: "Förfrågningar",
      items: [{ id: "requests", label: "Förfrågningar", href: routes.entreprenor.requestsIndex(), match: "prefix" }],
    },
    {
      id: "documents",
      label: "Dokument",
      items: [{ id: "documents", label: "Dokument", href: routes.entreprenor.documentsIndex(), match: "prefix" }],
    },
    {
      id: "files",
      label: "Filer",
      items: [{ id: "files", label: "Filer", href: routes.entreprenor.filesIndex(), match: "prefix" }],
    },
    {
      id: "messages",
      label: "Meddelanden",
      items: [{ id: "messages", label: "Meddelanden", href: routes.entreprenor.messagesIndex(), match: "prefix" }],
    },
    {
      id: "account",
      label: "Konto",
      items: [{ id: "account", label: "Konto", href: routes.konto(), match: "exact" }],
    },
  ],
};

const QUICK_ACTIONS: Record<Exclude<UserRole, "osaker">, QuickAction[]> = {
  privat: [{ id: "new-request", label: "Skapa förfrågan", href: "/start/sammanfattning" }],
  brf: [{ id: "new-request", label: "Skapa förfrågan", href: "/brf/start/sammanfattning" }],
  entreprenor: [{ id: "view-requests", label: "Se förfrågningar", href: routes.entreprenor.requestsIndex() }],
};

export function getSidebarNav(role: UserRole): NavGroup[] {
  return SIDEBAR_NAV[normalizeRole(role)];
}

export function getQuickActions(role: UserRole): QuickAction[] {
  return QUICK_ACTIONS[normalizeRole(role)];
}
