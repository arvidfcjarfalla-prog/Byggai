"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { FilesBrowser } from "../../../components/files/files-browser";

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
      router.replace("/dashboard/privat");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
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
        { href: "/dashboard/brf", label: "Översikt" },
        { href: "/dashboard/brf/fastighet", label: "Fastighet" },
        { href: "/dashboard/brf/underhallsplan", label: "Underhållsplan" },
        { href: "/dashboard/brf/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/brf/dokumentinkorg", label: "Avtalsinkorg" },
        { href: "/dashboard/brf/filer", label: "Filer" },
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
