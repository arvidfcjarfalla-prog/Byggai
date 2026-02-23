"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { FilesBrowser } from "../../../components/files/files-browser";
import { routes } from "../../../lib/routes";

export default function EntreprenorFilerPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "entreprenor") {
      router.replace(user.role === "brf" ? routes.brf.overview() : routes.privatperson.overview());
    }
  }, [ready, router, user]);

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Filer"
      subheading="Projektbundna filer och PDF-dokument (offert, avtal, ÄTA) per förfrågan."
      cards={[]}
      navItems={[
        { href: routes.entreprenor.overview(), label: "Översikt" },
        { href: routes.entreprenor.requestsIndex(), label: "Se förfrågningar" },
        { href: routes.entreprenor.messagesIndex(), label: "Meddelanden" },
        { href: routes.entreprenor.documentsIndex(), label: "Dokumentgenerator" },
        { href: routes.entreprenor.filesIndex(), label: "Filer" },
      ]}
    >
      <FilesBrowser
        workspaceId="entreprenor"
        actorRole="entreprenor"
        actorLabel={user.name?.trim() || user.email || "Entreprenör"}
        allowShare
      />
    </DashboardShell>
  );
}
