import { NextResponse } from "next/server";

import { listFileDeletionNotifications } from "../../lib/server/backend-store";

export const runtime = "nodejs";

type NotificationWorkspaceId = "brf" | "privat";

function toWorkspaceId(value: string | null): NotificationWorkspaceId | undefined {
  if (value === "brf" || value === "privat") return value;
  return undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const workspaceId = toWorkspaceId(url.searchParams.get("workspaceId"));
  const onlyUnread = url.searchParams.get("onlyUnread") === "true";
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;

  const notifications = await listFileDeletionNotifications({
    projectId,
    workspaceId,
    onlyUnread,
    limit,
  });

  return NextResponse.json({ notifications });
}
