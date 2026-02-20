import type { UserRole } from "./auth";

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
      items: [{ id: "overview", label: "Översikt", href: "/dashboard/privat", match: "exact" }],
    },
    {
      id: "project",
      label: "Projekt",
      items: [
        { id: "underlag", label: "Underlag", href: "/dashboard/privat/underlag", match: "prefix" },
        { id: "timeline", label: "Tidslinje", href: "/dashboard/privat/tidslinje", match: "prefix" },
        {
          id: "planning",
          label: "Planering (Gantt)",
          href: "/dashboard/privat/planering",
          match: "prefix",
        },
      ],
    },
    {
      id: "requests",
      label: "Förfrågningar",
      items: [{ id: "requests", label: "Förfrågningar", href: "/dashboard/privat/forfragningar", match: "prefix" }],
    },
    {
      id: "documents",
      label: "Dokument",
      items: [{ id: "documents", label: "Dokument", href: "/dashboard/privat/dokument", match: "prefix" }],
    },
    {
      id: "files",
      label: "Filer",
      items: [{ id: "files", label: "Filer", href: "/dashboard/privat/filer", match: "prefix" }],
    },
    {
      id: "messages",
      label: "Meddelanden",
      items: [{ id: "messages", label: "Meddelanden", href: "/dashboard/privat/meddelanden", match: "prefix" }],
    },
    {
      id: "account",
      label: "Konto",
      items: [{ id: "account", label: "Konto", href: "/dashboard/konto", match: "exact" }],
    },
  ],
  brf: [
    {
      id: "overview",
      label: "Översikt",
      items: [{ id: "overview", label: "Översikt", href: "/dashboard/brf", match: "exact" }],
    },
    {
      id: "project",
      label: "Projekt",
      items: [
        { id: "property", label: "Fastighet", href: "/dashboard/brf/fastighet", match: "prefix" },
        {
          id: "maintenance",
          label: "Underhållsplan",
          href: "/dashboard/brf/underhallsplan",
          match: "prefix",
        },
        { id: "timeline", label: "Tidslinje", href: "/dashboard/brf/tidslinje", match: "prefix" },
        {
          id: "planning",
          label: "Planering (Gantt)",
          href: "/dashboard/brf/planering",
          match: "prefix",
        },
      ],
    },
    {
      id: "requests",
      label: "Förfrågningar",
      items: [{ id: "requests", label: "Förfrågningar", href: "/dashboard/brf/forfragningar", match: "prefix" }],
    },
    {
      id: "documents",
      label: "Dokument",
      items: [{ id: "documents", label: "Dokument", href: "/dashboard/brf/dokument", match: "prefix" }],
    },
    {
      id: "files",
      label: "Filer",
      items: [{ id: "files", label: "Filer", href: "/dashboard/brf/filer", match: "prefix" }],
    },
    {
      id: "messages",
      label: "Meddelanden",
      items: [{ id: "messages", label: "Meddelanden", href: "/dashboard/brf/meddelanden", match: "prefix" }],
    },
    {
      id: "account",
      label: "Konto",
      items: [{ id: "account", label: "Konto", href: "/dashboard/konto", match: "exact" }],
    },
  ],
  entreprenor: [
    {
      id: "overview",
      label: "Översikt",
      items: [{ id: "overview", label: "Översikt", href: "/dashboard/entreprenor", match: "exact" }],
    },
    {
      id: "project",
      label: "Projekt",
      items: [{ id: "timeline", label: "Tidslinje", href: "/dashboard/entreprenor/tidslinje", match: "prefix" }],
    },
    {
      id: "requests",
      label: "Förfrågningar",
      items: [{ id: "requests", label: "Förfrågningar", href: "/dashboard/entreprenor/forfragningar", match: "prefix" }],
    },
    {
      id: "documents",
      label: "Dokument",
      items: [{ id: "documents", label: "Dokument", href: "/dashboard/entreprenor/dokument", match: "prefix" }],
    },
    {
      id: "files",
      label: "Filer",
      items: [{ id: "files", label: "Filer", href: "/dashboard/entreprenor/filer", match: "prefix" }],
    },
    {
      id: "messages",
      label: "Meddelanden",
      items: [{ id: "messages", label: "Meddelanden", href: "/dashboard/entreprenor/meddelanden", match: "prefix" }],
    },
    {
      id: "account",
      label: "Konto",
      items: [{ id: "account", label: "Konto", href: "/dashboard/konto", match: "exact" }],
    },
  ],
};

const QUICK_ACTIONS: Record<Exclude<UserRole, "osaker">, QuickAction[]> = {
  privat: [{ id: "new-request", label: "Skapa förfrågan", href: "/start/sammanfattning" }],
  brf: [{ id: "new-request", label: "Skapa förfrågan", href: "/brf/start/sammanfattning" }],
  entreprenor: [{ id: "view-requests", label: "Se förfrågningar", href: "/dashboard/entreprenor/forfragningar" }],
};

export function getSidebarNav(role: UserRole): NavGroup[] {
  return SIDEBAR_NAV[normalizeRole(role)];
}

export function getQuickActions(role: UserRole): QuickAction[] {
  return QUICK_ACTIONS[normalizeRole(role)];
}
