export type ProjectFolder =
  | "avtal"
  | "offert"
  | "ata"
  | "bilder"
  | "ritningar"
  | "ovrigt";

export type ProjectFileSourceType = "offert" | "ata" | "avtal" | "manual";

export type WorkspaceId = "entreprenor" | "brf" | "privat";

export interface ProjectFileContentRef {
  storage: "idb" | "localStorage";
  contentId: string;
  mimeType: string;
  size: number;
}

export interface ProjectFile {
  id: string;
  refId: string;
  projectId: string;
  folder: ProjectFolder;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  createdBy: string;
  sourceType: ProjectFileSourceType;
  sourceId: string;
  senderRole?: "entreprenor" | "brf" | "privatperson";
  senderWorkspaceId?: WorkspaceId;
  recipientWorkspaceId?: WorkspaceId;
  deliveredAt?: string;
  version?: number;
  contentRef: ProjectFileContentRef;
}

export interface AddProjectFileInput {
  projectId: string;
  folder: ProjectFolder;
  filename: string;
  mimeType: string;
  createdBy: string;
  sourceType: ProjectFileSourceType;
  sourceId: string;
  bytes: Uint8Array;
  senderRole?: "entreprenor" | "brf" | "privatperson";
  senderWorkspaceId?: WorkspaceId;
  recipientWorkspaceId?: WorkspaceId;
  deliveredAt?: string;
  version?: number;
}
