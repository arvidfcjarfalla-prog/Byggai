"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { DocumentsInboxPanel } from "../../../components/documents-inbox-panel";

export default function PrivatDokumentPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

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

  if (!ready) return null;
  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading="Dokument"
      subheading="Här hittar du avtal, offerter och ÄTA-dokument som entreprenörer skickat till ditt projekt."
      startProjectHref="/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      cards={[]}
    >
      <DocumentsInboxPanel audience="privat" />
    </DashboardShell>
  );
}
