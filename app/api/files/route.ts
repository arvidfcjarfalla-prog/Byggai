import { NextResponse } from "next/server";

import {
  listProjectFiles,
  upsertProjectFile,
  upsertProjectFiles,
} from "../../lib/server/backend-store";
import type { ProjectFile, ProjectFolder, WorkspaceId } from "../../lib/project-files/types";

export const runtime = "nodejs";

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

function toWorkspaceId(value: unknown): WorkspaceId | undefined {
  if (value === "entreprenor" || value === "brf" || value === "privat") return value;
  return undefined;
}

function toProjectFileSourceType(value: unknown): ProjectFile["sourceType"] | null {
  if (value === "offert" || value === "avtal" || value === "ata" || value === "manual") {
    return value;
  }
  return null;
}

function parseProjectFile(raw: unknown): ProjectFile | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const folder = toProjectFolder(record.folder);
  const sourceType = toProjectFileSourceType(record.sourceType);
  const contentRefRaw =
    record.contentRef && typeof record.contentRef === "object"
      ? (record.contentRef as Record<string, unknown>)
      : null;

  const contentStorage =
    contentRefRaw?.storage === "idb" || contentRefRaw?.storage === "localStorage"
      ? contentRefRaw.storage
      : null;
  const contentId = typeof contentRefRaw?.contentId === "string" ? contentRefRaw.contentId : "";
  const contentMimeType =
    typeof contentRefRaw?.mimeType === "string" ? contentRefRaw.mimeType : "";
  const contentSize =
    typeof contentRefRaw?.size === "number" && Number.isFinite(contentRefRaw.size)
      ? Math.max(0, Math.round(contentRefRaw.size))
      : 0;

  if (
    typeof record.id !== "string" ||
    typeof record.refId !== "string" ||
    typeof record.projectId !== "string" ||
    !folder ||
    typeof record.filename !== "string" ||
    typeof record.mimeType !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.createdBy !== "string" ||
    !sourceType ||
    typeof record.sourceId !== "string" ||
    !contentStorage ||
    !contentId ||
    !contentMimeType
  ) {
    return null;
  }

  const senderRole =
    record.senderRole === "entreprenor" ||
    record.senderRole === "brf" ||
    record.senderRole === "privatperson"
      ? record.senderRole
      : undefined;

  return {
    id: record.id,
    refId: record.refId,
    projectId: record.projectId,
    folder,
    filename: record.filename,
    mimeType: record.mimeType,
    size:
      typeof record.size === "number" && Number.isFinite(record.size)
        ? Math.max(0, Math.round(record.size))
        : 0,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    sourceType,
    sourceId: record.sourceId,
    senderRole,
    senderWorkspaceId: toWorkspaceId(record.senderWorkspaceId),
    recipientWorkspaceId: toWorkspaceId(record.recipientWorkspaceId),
    deliveredAt: typeof record.deliveredAt === "string" ? record.deliveredAt : undefined,
    version:
      typeof record.version === "number" && Number.isFinite(record.version)
        ? Math.max(0, Math.round(record.version))
        : undefined,
    contentRef: {
      storage: contentStorage,
      contentId,
      mimeType: contentMimeType,
      size: contentSize,
    },
  };
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const folderRaw = url.searchParams.get("folder");
  const query = url.searchParams.get("query") ?? undefined;
  const workspaceRaw = url.searchParams.get("workspaceId");

  if (!projectId) return error("projectId saknas.");

  const folder = folderRaw ? toProjectFolder(folderRaw) ?? undefined : undefined;
  if (folderRaw && !folder) return error("Ogiltig folder.");

  const workspaceId = workspaceRaw ? toWorkspaceId(workspaceRaw) : undefined;
  if (workspaceRaw && !workspaceId) return error("Ogiltig workspaceId.");

  const files = await listProjectFiles({
    projectId,
    folder,
    query,
    workspaceId,
  });

  return NextResponse.json({ files });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Ogiltig payload.");

  const payload = body as Record<string, unknown>;

  if (Array.isArray(payload.files)) {
    const files = payload.files
      .map((entry) => parseProjectFile(entry))
      .filter((entry): entry is ProjectFile => entry !== null);
    if (files.length === 0) return error("Inga giltiga filer i payload.");
    const upserted = await upsertProjectFiles(files);
    return NextResponse.json({ files: upserted });
  }

  const single = parseProjectFile(payload.file);
  if (!single) return error("Ogiltig fil i payload.");
  const file = await upsertProjectFile(single);
  return NextResponse.json({ file });
}
