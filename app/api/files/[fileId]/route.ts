import { NextResponse } from "next/server";

import {
  persistFileDeletion,
  persistFileMetadataUpdate,
} from "../../../lib/server/backend-store";
import type { ProjectFolder } from "../../../lib/project-files/types";

export const runtime = "nodejs";

type FileActorRole = "entreprenor" | "brf" | "privatperson" | "system";
type NotificationWorkspaceId = "brf" | "privat";

function toActorRole(value: unknown): FileActorRole | null {
  if (
    value === "entreprenor" ||
    value === "brf" ||
    value === "privatperson" ||
    value === "system"
  ) {
    return value;
  }
  return null;
}

function toProjectFolder(value: unknown): ProjectFolder | null {
  if (
    value === "avtal" ||
    value === "offert" ||
    value === "ata" ||
    value === "bilder" ||
    value === "ritningar" ||
    value === "ovrigt"
  ) {
    return value;
  }
  return null;
}

function toNotificationTargets(value: unknown): NotificationWorkspaceId[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry): entry is NotificationWorkspaceId => entry === "brf" || entry === "privat")));
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  if (!fileId) return error("Fil-ID saknas.");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Ogiltig payload.");

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  const fileRefId =
    typeof body.fileRefId === "string" && body.fileRefId.trim().length > 0
      ? body.fileRefId
      : undefined;
  const actorRole = toActorRole(body.actorRole);
  const actorLabel = typeof body.actorLabel === "string" ? body.actorLabel.trim() : "";
  const notifyWorkspaces = toNotificationTargets(body.notifyWorkspaces);

  if (!projectId) return error("projectId saknas.");
  if (!filename) return error("filename saknas.");
  if (!actorRole) return error("Ogiltig actorRole.");
  if (!actorLabel) return error("actorLabel saknas.");

  const { event, notifications } = await persistFileDeletion({
    projectId,
    fileId,
    fileRefId,
    filename,
    actorRole,
    actorLabel,
    notifyWorkspaces,
  });

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    notificationsCreated: notifications.length,
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  if (!fileId) return error("Fil-ID saknas.");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Ogiltig payload.");

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const fileRefId =
    typeof body.fileRefId === "string" && body.fileRefId.trim().length > 0
      ? body.fileRefId
      : undefined;
  const actorRole = toActorRole(body.actorRole);
  const actorLabel = typeof body.actorLabel === "string" ? body.actorLabel.trim() : "";
  const previousFilename =
    typeof body.previousFilename === "string" ? body.previousFilename.trim() : "";
  const nextFilename = typeof body.nextFilename === "string" ? body.nextFilename.trim() : "";
  const previousFolder = toProjectFolder(body.previousFolder);
  const nextFolder = toProjectFolder(body.nextFolder);

  if (!projectId) return error("projectId saknas.");
  if (!actorRole) return error("Ogiltig actorRole.");
  if (!actorLabel) return error("actorLabel saknas.");
  if (!previousFilename || !nextFilename) return error("Filnamn saknas.");
  if (!previousFolder || !nextFolder) return error("Ogiltig mapp.");

  const event = await persistFileMetadataUpdate({
    projectId,
    fileId,
    fileRefId,
    actorRole,
    actorLabel,
    previousFilename,
    nextFilename,
    previousFolder,
    nextFolder,
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
