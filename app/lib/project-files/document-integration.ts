import type { PlatformDocument } from "../documents-store";
import type { PlatformRequest } from "../requests-store";
import { generateDocumentPdf } from "../pdf/generate-document-pdf";
import type { ProjectFile, ProjectFolder, WorkspaceId } from "./types";
import { addFile, deleteFile, listFiles, shareFileToWorkspace } from "./store";

function folderFromDocumentType(type: PlatformDocument["type"]): ProjectFolder {
  if (type === "contract") return "avtal";
  if (type === "ate") return "ata";
  return "offert";
}

function sourceTypeFromDocumentType(type: PlatformDocument["type"]): ProjectFile["sourceType"] {
  if (type === "contract") return "avtal";
  if (type === "ate") return "ata";
  return "offert";
}

export async function generateAndStoreDocumentPdf(input: {
  document: PlatformDocument;
  request: PlatformRequest | null;
  createdBy: string;
  senderRole: "entreprenor" | "brf" | "privatperson";
  senderWorkspaceId: WorkspaceId;
}): Promise<ProjectFile> {
  const folder = folderFromDocumentType(input.document.type);

  const existingForSameVersion = (await listFiles(input.document.requestId, folder)).find(
    (file) =>
      file.sourceId === input.document.id &&
      file.version === input.document.version &&
      !file.recipientWorkspaceId
  );

  if (existingForSameVersion) {
    await deleteFile(input.document.requestId, existingForSameVersion.id);
  }

  const generated = await generateDocumentPdf({
    document: input.document,
    request: input.request,
    generatedAtIso: input.document.updatedAt,
  });

  return addFile({
    projectId: input.document.requestId,
    folder,
    filename: generated.fileName,
    mimeType: "application/pdf",
    createdBy: input.createdBy,
    sourceType: sourceTypeFromDocumentType(input.document.type),
    sourceId: input.document.id,
    bytes: generated.bytes,
    senderRole: input.senderRole,
    senderWorkspaceId: input.senderWorkspaceId,
    version: input.document.version,
  });
}

export async function shareDocumentPdfToRecipient(input: {
  document: PlatformDocument;
  senderLabel: string;
  senderRole: "entreprenor" | "brf" | "privatperson";
  senderWorkspaceId: WorkspaceId;
}): Promise<ProjectFile> {
  const folder = folderFromDocumentType(input.document.type);
  const ownProjectFiles = await listFiles(
    input.document.requestId,
    folder,
    undefined,
    input.senderWorkspaceId
  );

  const sourceFile = ownProjectFiles.find(
    (file) =>
      file.sourceId === input.document.id &&
      file.version === input.document.version &&
      file.mimeType === "application/pdf"
  );

  if (!sourceFile) {
    throw new Error("Ingen PDF hittades för dokumentet. Spara dokumentet först.");
  }

  const recipientWorkspaceId: WorkspaceId = input.document.audience === "brf" ? "brf" : "privat";
  const recipientFiles = await listFiles(
    input.document.requestId,
    folder,
    undefined,
    recipientWorkspaceId
  );
  const existingRecipientCopy = recipientFiles.find(
    (file) =>
      file.sourceId === input.document.id &&
      file.version === input.document.version &&
      file.mimeType === "application/pdf"
  );

  if (existingRecipientCopy) {
    await deleteFile(input.document.requestId, existingRecipientCopy.id);
  }

  return shareFileToWorkspace({
    fileId: sourceFile.id,
    fromProjectId: input.document.requestId,
    toProjectId: input.document.requestId,
    toWorkspaceId: recipientWorkspaceId,
    senderRole: input.senderRole,
    senderWorkspaceId: input.senderWorkspaceId,
    senderLabel: input.senderLabel,
  });
}
