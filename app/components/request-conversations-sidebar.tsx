"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getRequestConversation,
  subscribeRequestMessages,
  type ConversationActorRole,
} from "../lib/request-messages";
import type { PlatformRequest } from "../lib/requests-store";

interface RequestConversationsSidebarProps {
  requests: PlatformRequest[];
  selectedRequestId: string | null;
  actorRole: ConversationActorRole;
  onSelectRequest: (requestId: string) => void;
  title?: string;
}

interface ConversationListItem {
  requestId: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  preview: string;
  unread: number;
}

function formatTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("sv-SE", {
    month: "short",
    day: "numeric",
  });
}

export function RequestConversationsSidebar({
  requests,
  selectedRequestId,
  actorRole,
  onSelectRequest,
  title = "Meddelanden",
}: RequestConversationsSidebarProps) {
  const [messageVersion, setMessageVersion] = useState(0);

  useEffect(() => {
    return subscribeRequestMessages(() => {
      setMessageVersion((current) => current + 1);
    });
  }, []);

  const items = useMemo<ConversationListItem[]>(() => {
    const marker = messageVersion;
    void marker;

    return requests
      .map((request) => {
        const conversation = getRequestConversation(request.id);
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const preview = lastMessage
          ? lastMessage.body.trim().length > 0
            ? lastMessage.body
            : lastMessage.attachments.length > 0
            ? `📎 ${lastMessage.attachments.length} bilaga${lastMessage.attachments.length > 1 ? "r" : ""}`
            : "Nytt meddelande"
          : "Ingen dialog än";
        const updatedAt = lastMessage?.createdAt || request.createdAt;
        return {
          requestId: request.id,
          title: request.title,
          subtitle: request.location,
          updatedAt,
          preview,
          unread: conversation.unreadByRole[actorRole] || 0,
        };
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [actorRole, messageVersion, requests]);

  return (
    <aside className="rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-[#2A2520]">{title}</h2>
      <p className="mb-3 text-xs text-[#766B60]">
        Förfrågningsdialoger i iMessage-stil
      </p>

      <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const isActive = item.requestId === selectedRequestId;
          return (
            <button
              key={item.requestId}
              type="button"
              onClick={() => onSelectRequest(item.requestId)}
              className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                isActive
                  ? "border-[#8C7860] bg-[#F6F0E8]"
                  : "border-[#E8E3DC] bg-white hover:bg-[#FAF8F5]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-sm font-semibold text-[#2A2520]">{item.title}</p>
                <span className="shrink-0 text-[11px] text-[#766B60]">{formatTime(item.updatedAt)}</span>
              </div>
              <p className="line-clamp-1 text-xs text-[#6B5A47]">{item.subtitle}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-xs text-[#766B60]">{item.preview}</p>
                {item.unread > 0 && (
                  <span className="rounded-full bg-[#8C7860] px-2 py-0.5 text-[11px] font-bold text-white">
                    {item.unread}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
