"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { FilesBrowser } from "../../../components/files/files-browser";
import { routes } from "../../../lib/routes";

export default function PrivatFilerPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

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

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading="Filer"
      subheading="Alla projektfiler, inklusive mottagna PDF:er för offert, avtal och ÄTA."
      cards={[]}
      navItems={[
        { href: routes.privatperson.overview(), label: "Översikt" },
        { href: routes.privatperson.underlagIndex(), label: "Bostad & underlag" },
        { href: routes.privatperson.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.privatperson.documentsIndex(), label: "Dokumentinkorg" },
        { href: routes.privatperson.filesIndex(), label: "Filer" },
      ]}
    >
      <FilesBrowser
        workspaceId="privat"
        actorRole="privatperson"
        actorLabel={user.name?.trim() || user.email || "Privatperson"}
      />
    </DashboardShell>
  );
}
