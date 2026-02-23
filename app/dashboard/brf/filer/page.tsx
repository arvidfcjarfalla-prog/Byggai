"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { FilesBrowser } from "../../../components/files/files-browser";
import { routes } from "../../../lib/routes";

export default function BrfFilerPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

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

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading="Filer"
      subheading="Alla delade och mottagna projektfiler från entreprenörer och egen dokumentation."
      cards={[]}
      navItems={[
        { href: routes.brf.overview(), label: "Översikt" },
        { href: routes.brf.propertyIndex(), label: "Fastighet" },
        { href: routes.brf.maintenanceIndex(), label: "Underhållsplan" },
        { href: routes.brf.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.brf.documentsIndex(), label: "Avtalsinkorg" },
        { href: routes.brf.filesIndex(), label: "Filer" },
      ]}
    >
      <FilesBrowser
        workspaceId="brf"
        actorRole="brf"
        actorLabel={user.name?.trim() || user.email || "BRF-kontakt"}
      />
    </DashboardShell>
  );
}
