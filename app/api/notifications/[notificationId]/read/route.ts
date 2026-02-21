import { NextResponse } from "next/server";

import { markNotificationRead } from "../../../../lib/server/backend-store";

export const runtime = "nodejs";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  _req: Request,
  context: { params: Promise<{ notificationId: string }> }
) {
  const { notificationId } = await context.params;
  if (!notificationId) return error("notificationId saknas.");

  const notification = await markNotificationRead(notificationId);
  if (!notification) return error("Notis hittades inte.", 404);

  return NextResponse.json({ ok: true, notification });
}
