"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard-shell";
import { useAuth } from "../../../../components/auth-context";
import { DocumentViewer } from "../../../../components/document-viewer";
import { getDocumentById, subscribeDocuments, type PlatformDocument } from "../../../../lib/documents-store";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../../lib/requests-store";
import { routes } from "../../../../lib/routes";

function documentStatusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avvisad";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

export default function PrivatDocumentViewerPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready } = useAuth();

  const [document, setDocument] = useState<PlatformDocument | null>(null);
  const [request, setRequest] = useState<PlatformRequest | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=privat");
      return;
    }
    if (user.role === "brf") {
      router.replace(routes.brf.overview());
      return;
    }
    if (user.role === "entreprenor") {
      router.replace(routes.entreprenor.overview());
    }
  }, [ready, router, user]);

  useEffect(() => {
    const sync = () => {
      const loaded = getDocumentById(params.documentId);
      if (!loaded || loaded.audience !== "privat") {
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

  const contextRequestId = searchParams.get("requestId") ?? document?.requestId ?? undefined;
  const backHref = routes.privatperson.documentsIndex({ requestId: contextRequestId });

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading="Dokumentviewer"
      subheading="Läs dokument kopplade till ditt projekt."
      contextHeader={
        document && request
          ? {
              projectName: request.title,
              roleLabel: "Privatperson",
              statusLabel: documentStatusLabel(document.status),
            }
          : undefined
      }
      cards={[]}
      navItems={[
        { href: routes.privatperson.overview(), label: "Översikt" },
        { href: routes.privatperson.underlagIndex(), label: "Bostad och underlag" },
        { href: routes.privatperson.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.privatperson.documentsIndex(), label: "Dokument" },
        { href: routes.privatperson.filesIndex(), label: "Filer" },
      ]}
    >
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
        />
      )}
    </DashboardShell>
  );
}
