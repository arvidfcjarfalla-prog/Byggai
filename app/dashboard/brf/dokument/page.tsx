"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { DocumentsInboxPanel } from "../../../components/documents-inbox-panel";

export default function BrfDokumentPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

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

  if (!ready) return null;
  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading="Dokument"
      subheading="Här hittar du avtal, offerter och ÄTA-dokument som entreprenörer har skickat till föreningen."
      startProjectHref="/brf/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      cards={[]}
    >
      <DocumentsInboxPanel audience="brf" />
    </DashboardShell>
  );
}
