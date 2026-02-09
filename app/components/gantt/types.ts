export interface GanttProject {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  actions: GanttAction[];
}

export interface GanttAction {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "not-started" | "in-progress" | "completed";
  progress?: number;
  assignee?: string;
}

export const MOCK_GANTT_DATA: GanttProject[] = [
  {
    id: "p1",
    name: "Koksrenovering - Vasastan",
    startDate: "2026-03-01",
    endDate: "2026-05-31",
    actions: [
      {
        id: "a1",
        name: "Rivning och bortforsling",
        startDate: "2026-03-01",
        endDate: "2026-03-07",
        status: "completed",
        progress: 100,
      },
      {
        id: "a2",
        name: "Elinstallation",
        startDate: "2026-03-08",
        endDate: "2026-03-21",
        status: "in-progress",
        progress: 60,
      },
      {
        id: "a3",
        name: "Malning och finish",
        startDate: "2026-05-15",
        endDate: "2026-05-31",
        status: "not-started",
        progress: 0,
      },
    ],
  },
  {
    id: "p2",
    name: "Badrumsrenovering - Sodermalm",
    startDate: "2026-04-01",
    endDate: "2026-06-15",
    actions: [
      {
        id: "a4",
        name: "Tatskikt och kakel",
        startDate: "2026-04-01",
        endDate: "2026-04-20",
        status: "not-started",
      },
      {
        id: "a5",
        name: "VVS-arbeten",
        startDate: "2026-04-21",
        endDate: "2026-05-10",
        status: "not-started",
      },
      {
        id: "a6",
        name: "Slutbesiktning",
        startDate: "2026-06-10",
        endDate: "2026-06-15",
        status: "not-started",
      },
    ],
  },
  {
    id: "p3",
    name: "Fasadrenovering - Ostermalm",
    startDate: "2026-05-01",
    endDate: "2026-08-31",
    actions: [
      {
        id: "a7",
        name: "Stallningsbygge",
        startDate: "2026-05-01",
        endDate: "2026-05-07",
        status: "not-started",
      },
      {
        id: "a8",
        name: "Puts och malning",
        startDate: "2026-05-08",
        endDate: "2026-08-20",
        status: "not-started",
      },
      {
        id: "a9",
        name: "Stallningsrivning",
        startDate: "2026-08-21",
        endDate: "2026-08-31",
        status: "not-started",
      },
    ],
  },
];
