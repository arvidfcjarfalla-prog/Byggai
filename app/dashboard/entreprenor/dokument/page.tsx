"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/auth-context";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestConversationsSidebar } from "../../../components/request-conversations-sidebar";
import { RequestDocumentGeneratorPanel } from "../../../components/request-document-generator-panel";
import {
  listDocumentsByRequest,
  subscribeDocuments,
  type PlatformDocument,
} from "../../../lib/documents-store";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../lib/requests-store";

function documentTypeLabel(type: PlatformDocument["type"]): string {
  if (type === "quote") return "Offert";
  if (type === "contract") return "Avtal";
  return "ÄTA";
}

function statusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslog";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function EntreprenorDokumentPage() {
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
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
    }
  }, [ready, router, user]);

  useEffect(() => subscribeRequests(() => setIncomingRequests(listRequests())), []);
  useEffect(() => subscribeDocuments(() => setVersion((current) => current + 1)), []);

  const resolvedSelectedRequestId =
    selectedRequestId && incomingRequests.some((request) => request.id === selectedRequestId)
      ? selectedRequestId
      : incomingRequests[0]?.id || null;

  const selectedRequest =
    incomingRequests.find((request) => request.id === resolvedSelectedRequestId) ||
    incomingRequests[0] ||
    null;

  const actorLabel = user?.name?.trim() || user?.email || "Entreprenör";

  const documents = useMemo(() => {
    const marker = version;
    void marker;
    if (!selectedRequest) return [];
    return listDocumentsByRequest(selectedRequest.id);
  }, [selectedRequest, version]);

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Dokument"
      subheading="Skapa och hantera offert, avtal och ÄTA som projektbundna dokumentobjekt."
      startProjectHref="/dashboard/entreprenor/forfragningar"
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
        { href: "/dashboard/entreprenor/meddelanden", label: "Meddelanden" },
        { href: "/dashboard/entreprenor/dokument", label: "Dokumentgenerator" },
        { href: "/dashboard/entreprenor/filer", label: "Filer" },
      ]}
      cards={[]}
    >
      {incomingRequests.length === 0 && (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#766B60]">Inga förfrågningar ännu.</p>
        </section>
      )}

      {selectedRequest && (
        <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <RequestConversationsSidebar
            requests={incomingRequests}
            selectedRequestId={resolvedSelectedRequestId}
            actorRole="entreprenor"
            title="Förfrågningar"
            onSelectRequest={setSelectedRequestId}
          />

          <main className="space-y-6">
            <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#2A2520]">Dokument för vald förfrågan</h3>
              <p className="mt-1 text-sm text-[#766B60]">{selectedRequest.title} · {selectedRequest.location}</p>
              <p className="text-xs text-[#8C7860]">
                Request: {selectedRequest.id} · Skapad{" "}
                {new Date(selectedRequest.createdAt).toLocaleDateString("sv-SE")}
              </p>
              {documents.length === 0 ? (
                <p className="mt-3 text-sm text-[#766B60]">Inga dokument skapade ännu.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {documents.map((document) => (
                    <li key={document.id} className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#2A2520]">{document.title}</p>
                          <p className="text-xs text-[#6B5A47]">
                            {documentTypeLabel(document.type)} · v{document.version} · {statusLabel(document.status)}
                          </p>
                          <p className="font-mono text-[11px] text-[#6B5A47]">{document.refId}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyText(document.refId)}
                            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Kopiera RefID
                          </button>
                          <Link
                            href={`/dashboard/entreprenor/dokument/${document.id}`}
                            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Öppna editor
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <RequestDocumentGeneratorPanel request={selectedRequest} actorLabel={actorLabel} />
          </main>
        </section>
      )}
    </DashboardShell>
  );
}
