"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard-shell";
import { useAuth } from "../../../../components/auth-context";
import { DocumentViewer } from "../../../../components/document-viewer";
import { getDocumentById, subscribeDocuments, type PlatformDocument } from "../../../../lib/documents-store";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../../lib/requests-store";

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
  const { user, ready } = useAuth();

  const [document, setDocument] = useState<PlatformDocument | null>(null);
  const [request, setRequest] = useState<PlatformRequest | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
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
        { href: "/dashboard/brf", label: "Översikt" },
        { href: "/dashboard/brf/fastighet", label: "Fastighet" },
        { href: "/dashboard/brf/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/brf/dokument", label: "Dokument" },
        { href: "/dashboard/brf/filer", label: "Filer" },
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
          backHref="/dashboard/brf/dokument"
          backLabel="Till dokument"
        />
      )}
    </DashboardShell>
  );
}
