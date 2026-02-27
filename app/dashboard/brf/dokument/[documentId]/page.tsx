"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard-shell";
import { useAuth } from "../../../../components/auth-context";
import { DocumentViewer } from "../../../../components/document-viewer";
import {
  getDocumentById,
  saveDocument,
  subscribeDocuments,
  type PlatformDocument,
} from "../../../../lib/documents-store";
import {
  listRequests,
  markRequestStartedFromSignedQuoteDocument,
  subscribeRequests,
  type PlatformRequest,
} from "../../../../lib/requests-store";
import { publishSignedDocumentPdfForSignerWorkspace } from "../../../../lib/project-files/document-integration";
import { routes } from "../../../../lib/routes";

function documentStatusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avvisad";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

export default function BrfDocumentViewerPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready } = useAuth();

  const [document, setDocument] = useState<PlatformDocument | null>(null);
  const [request, setRequest] = useState<PlatformRequest | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signNotice, setSignNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace(routes.privatperson.overview());
      return;
    }
    if (user.role === "entreprenor") {
      router.replace(routes.entreprenor.overview());
    }
  }, [ready, router, user]);

  useEffect(() => {
    const sync = () => {
      const loaded = getDocumentById(params.documentId);
      if (!loaded || loaded.audience !== "brf") {
        setDocument(null);
        setRequest(null);
        return;
      }
      setDocument(loaded);
      const req = listRequests().find((entry) => entry.id === loaded.requestId) ?? null;
      setRequest(req);
    };

    sync();
    const unsubDoc = subscribeDocuments(sync);
    const unsubReq = subscribeRequests(sync);
    return () => {
      unsubDoc();
      unsubReq();
    };
  }, [params.documentId]);

  if (!ready || !user) return null;

  const handleSignDocument = async () => {
    if (
      !document ||
      (document.type !== "quote" && document.type !== "contract" && document.type !== "ate") ||
      document.status !== "sent"
    ) {
      return;
    }
    const documentLabel =
      document.type === "contract" ? "avtalet" : document.type === "ate" ? "ÄTA-dokumentet" : "offerten";
    const confirmed = window.confirm(
      `Signera och godkänn ${documentLabel}? Detta markerar dokumentet som accepterat.`
    );
    if (!confirmed) return;

    setIsSigning(true);
    try {
      const signerLabel = user.name?.trim() || user.email || "BRF-kontakt";
      const savedDocument =
        saveDocument({
          ...document,
          status: "accepted",
          acceptedByRole: "brf",
          acceptedByLabel: signerLabel,
        }).find((entry) => entry.id === document.id) ??
        {
          ...document,
          status: "accepted",
          acceptedByRole: "brf" as const,
          acceptedByLabel: signerLabel,
        };
      setDocument(savedDocument);

      await publishSignedDocumentPdfForSignerWorkspace({
        document: savedDocument,
        request,
        signerLabel,
        signerRole: "brf",
        signerWorkspaceId: "brf",
      });

      let updatedRequest: PlatformRequest | null = null;
      if (document.type === "quote" || document.type === "contract") {
        updatedRequest = markRequestStartedFromSignedQuoteDocument(document.requestId, {
          actorLabel: "BRF",
        });
        if (updatedRequest) {
          setRequest(updatedRequest);
        }
      }

      setSignNotice(
        (document.type === "quote" || document.type === "contract") &&
          updatedRequest?.projectStatus === "IN_PROGRESS"
          ? "Dokumentet är signerat. Projektet är nu markerat som Pågående och entreprenören ser signeringen."
          : document.type === "ate"
            ? "ÄTA-dokumentet är signerat och uppdaterad PDF finns nu under Filer."
            : "Dokumentet är signerat. Entreprenören ser nu att dokumentet är accepterat."
      );
    } finally {
      setIsSigning(false);
    }
  };

  const contextRequestId = searchParams.get("requestId") ?? document?.requestId ?? undefined;
  const backHref = routes.brf.documentsIndex({ requestId: contextRequestId });

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading="Dokumentviewer"
      subheading="Läs dokument kopplade till föreningens projekt."
      contextHeader={
        document && request
          ? {
              projectName: request.title,
              roleLabel: "BRF",
              statusLabel: documentStatusLabel(document.status),
            }
          : undefined
      }
      cards={[]}
      navItems={[
        { href: routes.brf.overview(), label: "Översikt" },
        { href: routes.brf.propertyIndex(), label: "Fastighet" },
        { href: routes.brf.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.brf.documentsIndex(), label: "Dokument" },
        { href: routes.brf.filesIndex(), label: "Filer" },
      ]}
    >
      {signNotice && (
        <section className="mb-4 rounded-2xl border border-[#D8E8CF] bg-[#F4FBEE] px-4 py-3 text-sm text-[#355B35] shadow-sm">
          {signNotice}
        </section>
      )}
      {!document ? (
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#766B60]">Dokumentet kunde inte hittas.</p>
        </section>
      ) : (
        <DocumentViewer
          document={document}
          request={request}
          backHref={backHref}
          backLabel="Till dokumentöversikt"
          breadcrumbs={[
            { href: backHref, label: "Dokument" },
            { label: document.title || "Dokument" },
          ]}
          approvalAction={
            (document.type === "quote" || document.type === "contract" || document.type === "ate") &&
            document.status === "sent"
              ? {
                  onApprove: handleSignDocument,
                  pending: isSigning,
                  label:
                    document.type === "contract"
                      ? "Signera avtal"
                      : document.type === "ate"
                        ? "Signera ÄTA"
                        : "Signera offert",
                }
              : undefined
          }
        />
      )}
    </DashboardShell>
  );
}
