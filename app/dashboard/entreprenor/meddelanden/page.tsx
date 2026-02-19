"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/auth-context";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestConversationsSidebar } from "../../../components/request-conversations-sidebar";
import { RequestMessagesPanel } from "../../../components/request-messages-panel";
import {
  listRequests,
  saveRequest,
  subscribeRequests,
  type PlatformRequest,
} from "../../../lib/requests-store";

function requestStatusLabel(status: PlatformRequest["status"]): string {
  if (status === "received") return "Svar inkommen";
  if (status === "draft") return "Utkast";
  return "Skickad";
}

export default function EntreprenorMeddelandenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get("requestId");
  const { user, ready } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(
    () => listRequests()
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") {
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
    }
  }, [ready, router, user]);

  useEffect(() => {
    return subscribeRequests(() => {
      setIncomingRequests(listRequests());
    });
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#F6F3EE] text-[#2A2520] antialiased">
        <div className="mx-auto flex min-h-screen max-w-[1400px] items-center justify-center px-6">
          <p className="rounded-xl border border-[#E6DFD6] bg-white px-4 py-2 text-sm text-[#6B5A47]">
            Laddar konto...
          </p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const resolvedSelectedRequestId =
    selectedRequestId && incomingRequests.some((request) => request.id === selectedRequestId)
      ? selectedRequestId
      : incomingRequests[0]?.id || null;

  const selectedRequest =
    incomingRequests.find((request) => request.id === resolvedSelectedRequestId) ||
    incomingRequests[0] ||
    null;

  const actorLabel = user.name?.trim() || user.email || "Entreprenör";

  const handleMessageSent = () => {
    if (!selectedRequest) return;

    const nextRecipients = selectedRequest.recipients?.map((recipient) => {
      if (recipient.status === "declined") return recipient;
      return {
        ...recipient,
        status: "responded" as const,
      };
    });

    saveRequest({
      ...selectedRequest,
      status: "received",
      recipients: nextRecipients,
    });
  };

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Meddelanden"
      subheading="Inkorg till vänster och aktiv chatt till höger."
      startProjectHref="/dashboard/entreprenor/forfragningar"
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
        { href: "/dashboard/entreprenor/meddelanden", label: "Meddelanden" },
      ]}
      cards={[]}
    >
      {incomingRequests.length === 0 && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#766B60]">
            Inga förfrågningar ännu. När BRF eller privatperson skickar dyker de upp här.
          </p>
        </section>
      )}

      {selectedRequest && (
        <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <RequestConversationsSidebar
            requests={incomingRequests}
            selectedRequestId={resolvedSelectedRequestId}
            actorRole="entreprenor"
            title="Inkorg"
            onSelectRequest={setSelectedRequestId}
          />

          <main>
            <RequestMessagesPanel
              key={`entreprenor-request-messages-${selectedRequest.id}`}
              requestId={selectedRequest.id}
              actorRole="entreprenor"
              actorLabel={actorLabel}
              headline={selectedRequest.title}
              description={`${selectedRequest.location} · ${requestStatusLabel(selectedRequest.status)}`}
              onMessageSent={handleMessageSent}
            />
          </main>
        </section>
      )}
    </DashboardShell>
  );
}
