"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveProject } from "../../../components/active-project-context";
import { useAuth } from "../../../components/auth-context";
import { DashboardShell } from "../../../components/dashboard-shell";
import { EntreprenorOfferFlowShell } from "../../../components/offers/EntreprenorOfferFlowShell";
import { RequestConversationsSidebar } from "../../../components/request-conversations-sidebar";
import { RequestDocumentGeneratorPanel } from "../../../components/request-document-generator-panel";
import {
  listDocumentsByRequest,
  subscribeDocuments,
  type PlatformDocument,
} from "../../../lib/documents-store";
import {
  buildEntreprenorOfferFlowSteps,
  getLatestQuoteDocumentForRequest,
} from "../../../lib/offers/flow";
import { listLatestOffersByProject, subscribeOffers } from "../../../lib/offers/store";
import type { Offer } from "../../../lib/offers/types";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../lib/requests-store";
import { routes } from "../../../lib/routes";

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

function formatDateTimeLabel(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function getContractorOfferForUser(offers: Offer[], userId?: string, userEmail?: string): Offer | null {
  const normalizedUserId = userId?.trim();
  const normalizedUserEmail = userEmail?.trim().toLowerCase();
  return (
    offers.find((offer) => {
      if (normalizedUserId && offer.contractorId === normalizedUserId) return true;
      if (normalizedUserEmail && offer.contractorId.toLowerCase() === normalizedUserEmail) return true;
      return false;
    }) ?? null
  );
}

function EntreprenorDokumentContent({
  incomingRequests,
  selectedRequestId,
  onSelectRequest,
  version,
  offersVersion,
  userId,
  userEmail,
  actorLabel,
}: {
  incomingRequests: PlatformRequest[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string | null) => void;
  version: number;
  offersVersion: number;
  userId?: string;
  userEmail?: string;
  actorLabel: string;
}) {
  const { activeProject } = useActiveProject();
  const searchParams = useSearchParams();
  const scopedProjectId = activeProject?.id ?? null;
  const isProjectScoped = Boolean(scopedProjectId);
  const typeFilter = searchParams.get("type");
  const normalizedTypeFilter =
    typeFilter === "quote" || typeFilter === "contract" || typeFilter === "ate" ? typeFilter : null;
  const visibleRequests = scopedProjectId
    ? incomingRequests.filter((request) => request.id === scopedProjectId)
    : incomingRequests;

  const resolvedSelectedRequestId =
    scopedProjectId && visibleRequests.some((request) => request.id === scopedProjectId)
      ? scopedProjectId
      : selectedRequestId && visibleRequests.some((request) => request.id === selectedRequestId)
        ? selectedRequestId
        : visibleRequests[0]?.id || null;

  const selectedRequest =
    visibleRequests.find((request) => request.id === resolvedSelectedRequestId) || visibleRequests[0] || null;

  const documents = useMemo(() => {
    const marker = version;
    void marker;
    if (!selectedRequest) return [];
    const all = listDocumentsByRequest(selectedRequest.id);
    return normalizedTypeFilter ? all.filter((document) => document.type === normalizedTypeFilter) : all;
  }, [normalizedTypeFilter, selectedRequest, version]);
  const projectOffers = useMemo(() => {
    const marker = offersVersion;
    void marker;
    if (!selectedRequest) return [];
    return listLatestOffersByProject(selectedRequest.id);
  }, [offersVersion, selectedRequest]);
  const currentContractorOffer = useMemo(
    () => getContractorOfferForUser(projectOffers, userId, userEmail),
    [projectOffers, userEmail, userId]
  );
  const latestQuoteDocument = useMemo(() => getLatestQuoteDocumentForRequest(documents), [documents]);
  const flowSteps = useMemo(
    () =>
      selectedRequest
        ? buildEntreprenorOfferFlowSteps({
            activeStepId: "offer_document",
            requestId: selectedRequest.id,
            offerId: currentContractorOffer?.id ?? null,
            generateDocumentId: latestQuoteDocument?.id ?? null,
            previewDocumentId: latestQuoteDocument?.id ?? null,
          })
        : [],
    [currentContractorOffer?.id, latestQuoteDocument?.id, selectedRequest]
  );

  if (visibleRequests.length === 0) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#766B60]">Inga förfrågningar ännu.</p>
      </section>
    );
  }

  if (!selectedRequest) return null;

  return (
    <EntreprenorOfferFlowShell
      steps={flowSteps}
      stepperSubheading="Steg 3 bygger själva offertdokumentet. Skapa ett utkast och gå vidare till live preview innan skick."
    >
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
                Visar endast dokument för {selectedRequest.title}
              </p>
            </div>
          )}
          {normalizedTypeFilter && (
            <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Dokumentfilter</p>
              <p className="text-sm font-semibold text-[#2A2520]">
                Visar endast {documentTypeLabel(normalizedTypeFilter).toLowerCase()}-dokument.
              </p>
            </div>
          )}

          <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#2A2520]">Dokument för vald förfrågan</h3>
            <p className="mt-1 text-sm text-[#766B60]">
              {selectedRequest.title} · {selectedRequest.location}
            </p>
            <p className="text-xs text-[#8C7860]">
              Request: {selectedRequest.id} · Skapad{" "}
              {new Date(selectedRequest.createdAt).toLocaleDateString("sv-SE")}
            </p>
            {documents.length === 0 ? (
              <p className="mt-3 text-sm text-[#766B60]">Inga dokument skapade ännu.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {documents.map((document) => {
                  const acceptedAtLabel = formatDateTimeLabel(document.acceptedAt);
                  const recipientLabel = document.audience === "brf" ? "BRF" : "privatperson";
                  const acceptedByLabel = document.acceptedByLabel ?? recipientLabel;
                  return (
                    <li key={document.id} className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#2A2520]">{document.title}</p>
                          <p className="text-xs text-[#6B5A47]">
                            {documentTypeLabel(document.type)} · v{document.version} · {statusLabel(document.status)}
                          </p>
                          {document.status === "accepted" && acceptedAtLabel && (
                            <p className="text-xs font-semibold text-[#3F6B3F]">
                              Signerat av {acceptedByLabel} {acceptedAtLabel}
                            </p>
                          )}
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
                            href={routes.entreprenor.documentDetail({
                              documentId: document.id,
                              requestId: selectedRequest.id,
                            })}
                            className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                          >
                            Öppna editor
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <RequestDocumentGeneratorPanel
            request={selectedRequest}
            actorLabel={actorLabel}
            allowedKinds={["quote", "contract"]}
            title="Skapa offert / avtal"
            description="Generera offert- och avtalsdokument här. ÄTA-generering finns nu i den separata fliken ÄTA i vänstermenyn."
          />
        </main>
      </section>
    </EntreprenorOfferFlowShell>
  );
}

export default function EntreprenorDokumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get("requestId");
  const { user, ready } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<PlatformRequest[]>(() => listRequests());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);
  const [version, setVersion] = useState(0);
  const [offersVersion, setOffersVersion] = useState(0);

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
  useEffect(() => subscribeOffers(() => setOffersVersion((current) => current + 1)), []);

  const actorLabel = user?.name?.trim() || user?.email || "Entreprenör";

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Dokument"
      subheading="Skapa och hantera offert, avtal och ÄTA som projektbundna dokumentobjekt."
      startProjectHref={routes.entreprenor.requestsIndex()}
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: routes.entreprenor.overview(), label: "Översikt" },
        { href: routes.entreprenor.requestsIndex(), label: "Se förfrågningar" },
        { href: routes.entreprenor.messagesIndex(), label: "Meddelanden" },
        { href: routes.entreprenor.documentsIndex(), label: "Dokumentgenerator" },
        { href: routes.entreprenor.filesIndex(), label: "Filer" },
      ]}
      cards={[]}
    >
      <EntreprenorDokumentContent
        incomingRequests={incomingRequests}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        version={version}
        offersVersion={offersVersion}
        userId={user.id}
        userEmail={user.email}
        actorLabel={actorLabel}
      />
    </DashboardShell>
  );
}
