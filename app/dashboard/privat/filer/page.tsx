"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { FilesBrowser } from "../../../components/files/files-browser";

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
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
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
        { href: "/dashboard/privat", label: "Översikt" },
        { href: "/dashboard/privat/underlag", label: "Bostad & underlag" },
        { href: "/dashboard/privat/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/privat/dokumentinkorg", label: "Dokumentinkorg" },
        { href: "/dashboard/privat/filer", label: "Filer" },
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
