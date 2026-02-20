export type RefIdKind = "DOC" | "FIL";

export interface RefIdParts {
  kind: RefIdKind;
  body: string;
  checksum: string;
}

export interface RefRegistryEntry {
  kind: RefIdKind;
  id: string;
  projectId?: string;
  workspaceId?: string;
  createdAt: string;
}

export interface GenerateRefIdInput {
  kind: RefIdKind;
  workspaceId?: string;
  date?: Date;
}
