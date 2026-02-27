"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveProject } from "../../../../components/active-project-context";
import { useAuth } from "../../../../components/auth-context";
import { ChangeOrdersPanel } from "../../../../components/change-orders/change-orders-panel";
import { DashboardShell } from "../../../../components/dashboard-shell";
import { RequestConversationsSidebar } from "../../../../components/request-conversations-sidebar";
import { RequestDocumentGeneratorPanel } from "../../../../components/request-document-generator-panel";
import {
  listDocumentsByRequest,
  subscribeDocuments,
  type PlatformDocument,
} from "../../../../lib/documents-store";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../../lib/requests-store";
import { routes } from "../../../../lib/routes";

function documentStatusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avvisad";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

function EntreprenorAtaDocumentsContent({
  incomingRequests,
  selectedRequestId,
  onSelectRequest,
  actorLabel,
  version,
}: {
  incomingRequests: PlatformRequest[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string | null) => void;
  actorLabel: string;
  version: number;
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
        <p className="text-sm text-[#766B60]">Inga förfrågningar ännu.</p>
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

  const ateDocuments = useMemo(() => {
    const marker = version;
    void marker;
    if (!selectedRequest) return [];
    return listDocumentsByRequest(selectedRequest.id)
      .filter((doc) => doc.type === "ate" && doc.status === "draft")
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [selectedRequest, version]);

  if (!selectedRequest) return null;

  return (
    <section className={isProjectScoped ? "space-y-6" : "grid gap-6 xl:grid-cols-[320px_1fr]"}>
      {!isProjectScoped && (
        <RequestConversationsSidebar
          requests={visibleRequests}
          selectedRequestId={resolvedSelectedRequestId}
          actorRole="entreprenor"
          title="Förfrågningar"
          onSelectRequest={onSelectRequest}
        />
      )}

      <main className="space-y-6">
        {isProjectScoped && (
          <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Aktiv förfrågan</p>
            <p className="text-sm font-semibold text-[#2A2520]">
              Visar ÄTA-generering och ÄTA-dokument för {selectedRequest.title}
            </p>
          </div>
        )}

        <section id="ata-dokument" className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#2A2520]">ÄTA-utkast</h2>
              <p className="mt-1 text-sm text-[#766B60]">
                Förfrågan: {selectedRequest.title} · {selectedRequest.location}
              </p>
              <p className="text-xs text-[#8B7A68]">
                Skickade ÄTA-dokument visas under Inskickade dokument. Här visas bara utkast.
              </p>
            </div>
            <Link
              href={`${routes.entreprenor.ataGeneratorIndex({ requestId: selectedRequest.id })}#ata-dokument`}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Hoppa till ÄTA-utkast
            </Link>
          </div>

          {ateDocuments.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
              Inga ÄTA-utkast skapade ännu för denna förfrågan.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {ateDocuments.slice(0, 6).map((document) => (
                <li key={document.id} className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#2A2520]">{document.title}</p>
                      <p className="text-xs text-[#6B5A47]">
                        v{document.version} · {documentStatusLabel(document.status)}
                      </p>
                      <p className="font-mono text-[11px] text-[#6B5A47]">{document.refId}</p>
                    </div>
                    <Link
                      href={routes.entreprenor.documentDetail({
                        documentId: document.id,
                        requestId: selectedRequest.id,
                      })}
                      className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                    >
                      Öppna editor
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ChangeOrdersPanel
          projectId={selectedRequest.id}
          actorRole="entreprenor"
          request={selectedRequest}
          title="ÄTA (48h) · Skapa ändringsförfrågan"
        />

        <RequestDocumentGeneratorPanel
          request={selectedRequest}
          actorLabel={actorLabel}
          lockedKind="ate"
          title="Skapa ÄTA-dokument"
          description="Skapa ett ÄTA-utkast för vald förfrågan/projekt, granska preview och skicka när beställaren ska få beslutsunderlag."
        />
      </main>
    </section>
  );
}

export default function EntreprenorAtaDocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get("requestId");
  const { user, ready } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(() => listRequests());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);
  const [version, setVersion] = useState(0);

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

  useEffect(() => subscribeRequests(() => setIncomingRequests(listRequests())), []);
  useEffect(() => subscribeDocuments(() => setVersion((current) => current + 1)), []);

  if (!ready || !user) return null;

  const actorLabel = user.name?.trim() || user.email || "Entreprenör";

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="ÄTA"
      subheading="Egen vy för att skapa och hantera ÄTA-dokument per vald förfrågan."
      startProjectHref={routes.entreprenor.requestsIndex()}
      startProjectLabel="Se förfrågningar"
      cards={[]}
    >
      <EntreprenorAtaDocumentsContent
        incomingRequests={incomingRequests}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        actorLabel={actorLabel}
        version={version}
      />
    </DashboardShell>
  );
}
