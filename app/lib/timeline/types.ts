export type TimelineRole = "entreprenor" | "brf" | "privatperson";

export type TimelineMilestoneState = "done" | "current" | "todo";

export type TimelineEventFilter = "dokument" | "filer" | "ata" | "meddelanden";

export interface TimelineMilestone {
  id: string;
  order: number;
  label: string;
  optional?: boolean;
  state: TimelineMilestoneState;
  completedAt?: string;
}

export interface TimelineEventLink {
  href: string;
  label: string;
}

export interface TimelineEvent {
  id: string;
  label: string;
  timestamp: string | null;
  refId?: string;
  filters: TimelineEventFilter[];
  source: "request" | "document" | "file" | "message";
  link?: TimelineEventLink;
}

export interface TimelineAction {
  id: string;
  label: string;
  href: string;
}

export interface TimelineModel {
  projectId: string;
  projectTitle: string;
  role: TimelineRole;
  milestones: TimelineMilestone[];
  currentMilestoneId: string | null;
  events: TimelineEvent[];
  actions: TimelineAction[];
  generatedAt: string;
}
