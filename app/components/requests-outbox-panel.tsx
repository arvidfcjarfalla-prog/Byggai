"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { RequestConversationsSidebar } from "./request-conversations-sidebar";
import { RequestMessagesPanel } from "./request-messages-panel";
import {
  listRequests,
  subscribeRequests,
  type PlatformRequest,
  type RequestAudience,
} from "../lib/requests-store";

function statusLabel(status: PlatformRequest["status"]): string {
  if (status === "received") return "Svar inkommen";
  if (status === "draft") return "Utkast";
  return "Skickad";
}

export function RequestsOutboxPanel({
  audience,
  mode = "messages",
}: {
  audience: RequestAudience;
  mode?: "messages" | "documents";
}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const filtered = listRequests().filter((request) => request.audience === audience);
      setRequests(filtered);
    };
    sync();
    return subscribeRequests(sync);
  }, [audience]);

  const selectedRequestId =
    activeRequestId && requests.some((request) => request.id === activeRequestId)
      ? activeRequestId
      : requests[0]?.id || null;

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) || requests[0] || null;

  if (requests.length === 0) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2520]">{mode === "documents" ? "Dokumentinkorg" : "Inkorg"}</h2>
        <p className="mt-2 text-sm text-[#766B60]">
          Inga förfrågningar ännu. När du skickar en förfrågan öppnas inkorgen här.
        </p>
      </section>
    );
  }

  const actorRole = audience === "brf" ? "brf" : "privatperson";
  const actorLabel =
    user?.name?.trim() ||
    user?.email ||
    (audience === "brf" ? "BRF-kontakt" : "Privat beställare");

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <RequestConversationsSidebar
        requests={requests}
        selectedRequestId={selectedRequestId}
        actorRole={actorRole}
        onSelectRequest={setActiveRequestId}
        title={mode === "documents" ? "Avtalsinkorg · Dokument" : "Inkorg · Meddelanden"}
      />

      {selectedRequest && (
        <main>
          <RequestMessagesPanel
            key={`request-messages-${selectedRequest.id}-${mode}`}
            requestId={selectedRequest.id}
            actorRole={actorRole}
            actorLabel={actorLabel}
            headline={mode === "documents" ? `${selectedRequest.title} · Dokumentinkorg` : selectedRequest.title}
            description={`${selectedRequest.location} · ${statusLabel(selectedRequest.status)} · Förfrågan-ID: ${selectedRequest.id}`}
            allowedMessageTypes={mode === "documents" ? ["document"] : undefined}
            hideComposer={mode === "documents"}
          />
        </main>
      )}
    </section>
  );
}
