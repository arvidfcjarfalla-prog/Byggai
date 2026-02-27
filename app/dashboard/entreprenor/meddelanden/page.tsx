"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveProject } from "../../../components/active-project-context";
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
import { routes } from "../../../lib/routes";

function requestStatusLabel(status: PlatformRequest["status"]): string {
  if (status === "received") return "Svar inkommen";
  if (status === "draft") return "Utkast";
  return "Skickad";
}

function EntreprenorMeddelandenContent({
  incomingRequests,
  selectedRequestId,
  onSelectRequest,
  actorLabel,
  onMessageSent,
}: {
  incomingRequests: PlatformRequest[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string) => void;
  actorLabel: string;
  onMessageSent: (request: PlatformRequest) => void;
}) {
  const { activeProject } = useActiveProject();
  const scopedProjectId = activeProject?.id ?? null;
  const isProjectScoped = Boolean(scopedProjectId);
  const visibleRequests = scopedProjectId
    ? incomingRequests.filter((request) => request.id === scopedProjectId)
    : incomingRequests;

  if (visibleRequests.length === 0) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#766B60]">
          Inga förfrågningar ännu. När BRF eller privatperson skickar dyker de upp här.
        </p>
      </section>
    );
  }

  const resolvedSelectedRequestId =
    scopedProjectId && visibleRequests.some((request) => request.id === scopedProjectId)
      ? scopedProjectId
      : selectedRequestId && visibleRequests.some((request) => request.id === selectedRequestId)
        ? selectedRequestId
        : visibleRequests[0]?.id || null;

  const selectedRequest =
    visibleRequests.find((request) => request.id === resolvedSelectedRequestId) || visibleRequests[0] || null;

  if (!selectedRequest) return null;

  return (
    <section className={isProjectScoped ? "space-y-4" : "grid gap-6 xl:grid-cols-[320px_1fr]"}>
      {!isProjectScoped && (
        <RequestConversationsSidebar
          requests={visibleRequests}
          selectedRequestId={resolvedSelectedRequestId}
          actorRole="entreprenor"
          title="Inkorg"
          onSelectRequest={onSelectRequest}
        />
      )}

      <main>
        {isProjectScoped && (
          <div className="mb-4 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Aktiv förfrågan</p>
            <p className="text-sm font-semibold text-[#2A2520]">
              Visar endast meddelanden för {selectedRequest.title}
            </p>
          </div>
        )}
        <RequestMessagesPanel
          key={`entreprenor-request-messages-${selectedRequest.id}`}
          requestId={selectedRequest.id}
          actorRole="entreprenor"
          actorLabel={actorLabel}
          headline={selectedRequest.title}
          description={`${selectedRequest.location} · ${requestStatusLabel(selectedRequest.status)}`}
          onMessageSent={() => onMessageSent(selectedRequest)}
        />
      </main>
    </section>
  );
}

export default function EntreprenorMeddelandenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get("requestId");
  const { user, ready } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(() => listRequests());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") {
      router.replace(routes.brf.overview());
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace(routes.privatperson.overview());
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

  const actorLabel = user.name?.trim() || user.email || "Entreprenör";

  const handleMessageSent = (selectedRequest: PlatformRequest) => {
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
      startProjectHref={routes.entreprenor.requestsIndex()}
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: routes.entreprenor.overview(), label: "Översikt" },
        { href: routes.entreprenor.requestsIndex(), label: "Se förfrågningar" },
        { href: routes.entreprenor.messagesIndex(), label: "Meddelanden" },
        { href: routes.entreprenor.documentsIndex(), label: "Dokumentgenerator" },
      ]}
      cards={[]}
    >
      <EntreprenorMeddelandenContent
        incomingRequests={incomingRequests}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        actorLabel={actorLabel}
        onMessageSent={handleMessageSent}
      />
    </DashboardShell>
  );
}
