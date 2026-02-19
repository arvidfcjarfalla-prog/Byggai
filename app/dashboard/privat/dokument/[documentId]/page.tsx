"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard-shell";
import { useAuth } from "../../../../components/auth-context";
import { DocumentViewer } from "../../../../components/document-viewer";
import { getDocumentById, subscribeDocuments, type PlatformDocument } from "../../../../lib/documents-store";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../../lib/requests-store";

export default function PrivatDocumentViewerPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
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
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
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

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading="Dokumentviewer"
      subheading="Läs dokument kopplade till ditt projekt."
      cards={[]}
      navItems={[
        { href: "/dashboard/privat", label: "Översikt" },
        { href: "/dashboard/privat/underlag", label: "Bostad och underlag" },
        { href: "/dashboard/privat/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/privat/dokumentinkorg", label: "Dokumentinkorg" },
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
          backHref="/dashboard/privat/dokumentinkorg"
          backLabel="Till dokumentinkorg"
        />
      )}
    </DashboardShell>
  );
}
