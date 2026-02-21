"use client";

import { useEffect, useMemo, useState } from "react";

type NotificationWorkspaceId = "brf" | "privat";

interface FileDeletionNotification {
  id: string;
  projectId: string;
  workspaceId: NotificationWorkspaceId;
  type: "document_deleted";
  title: string;
  message: string;
  fileId: string;
  fileRefId?: string;
  createdAt: string;
  readAt: string | null;
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Tid saknas";
  return parsed.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchNotifications(workspaceId: NotificationWorkspaceId): Promise<FileDeletionNotification[]> {
  const params = new URLSearchParams({
    workspaceId,
    limit: "12",
  });
  const response = await fetch(`/api/notifications?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Kunde inte läsa notiser.");
  }
  const payload = (await response.json()) as { notifications?: unknown };
  if (!Array.isArray(payload.notifications)) return [];
  return payload.notifications.filter(
    (entry): entry is FileDeletionNotification =>
      Boolean(entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string")
  );
}

async function markNotificationAsRead(notificationId: string): Promise<void> {
  const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PATCH",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Kunde inte markera notisen som läst.");
  }
}

export function FileDeletionNotificationsWidget({
  workspaceId,
}: {
  workspaceId: NotificationWorkspaceId;
}) {
  const [notifications, setNotifications] = useState<FileDeletionNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.readAt === null).length,
    [notifications]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const items = await fetchNotifications(workspaceId);
        if (!cancelled) {
          setNotifications(items);
          setNotice(null);
        }
      } catch {
        if (!cancelled) {
          setNotice("Kunde inte läsa notiser just nu.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workspaceId]);

  const markOne = async (notificationId: string) => {
    setBusyId(notificationId);
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
    } catch {
      setNotice("Kunde inte markera notisen som läst.");
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    const unread = notifications.filter((notification) => notification.readAt === null);
    if (unread.length === 0) return;
    setBusyId("all");
    try {
      await Promise.all(unread.map((notification) => markNotificationAsRead(notification.id)));
      const nowIso = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => (item.readAt === null ? { ...item, readAt: nowIso } : item))
      );
      setNotice(null);
    } catch {
      setNotice("Kunde inte markera alla notiser som lästa.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Notiser</p>
          <h2 className="text-lg font-bold text-[#2A2520]">Dokumenthändelser</h2>
          <p className="text-sm text-[#766B60]">
            {unreadCount > 0
              ? `${unreadCount} olästa notiser`
              : "Inga olästa notiser just nu"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={markAll}
            disabled={busyId === "all" || unreadCount === 0}
            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Markera alla lästa
          </button>
        </div>
      </header>

      {isLoading ? (
        <p className="mt-3 text-sm text-[#766B60]">Laddar notiser...</p>
      ) : notifications.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
          Inga notiser än.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notifications.map((notification) => {
            const unread = notification.readAt === null;
            return (
              <li
                key={notification.id}
                className={`rounded-xl border px-3 py-3 ${
                  unread ? "border-[#D7C3A8] bg-[#FFF9F1]" : "border-[#E8E3DC] bg-[#FAF8F5]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#2A2520]">{notification.title}</p>
                    <p className="mt-1 text-sm text-[#5D5245]">{notification.message}</p>
                    <p className="mt-1 text-[11px] text-[#766B60]">
                      Projekt: {notification.projectId} · {formatTimestamp(notification.createdAt)}
                    </p>
                  </div>
                  {unread && (
                    <button
                      type="button"
                      onClick={() => void markOne(notification.id)}
                      disabled={busyId === notification.id || busyId === "all"}
                      className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Markera läst
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {notice && (
        <p className="mt-3 rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
          {notice}
        </p>
      )}
    </section>
  );
}
