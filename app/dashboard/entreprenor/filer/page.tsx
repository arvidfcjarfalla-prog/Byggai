"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { FilesBrowser } from "../../../components/files/files-browser";

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
      router.replace(user.role === "brf" ? "/dashboard/brf" : "/dashboard/privat");
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
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
        { href: "/dashboard/entreprenor/meddelanden", label: "Meddelanden" },
        { href: "/dashboard/entreprenor/dokument", label: "Dokumentgenerator" },
        { href: "/dashboard/entreprenor/filer", label: "Filer" },
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
