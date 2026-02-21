"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/dashboard-shell";
import { FileDeletionNotificationsWidget } from "../../components/file-deletion-notifications-widget";
import { useAuth } from "../../components/auth-context";

export default function BrfDashboardPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
      return;
    }
    if (user.role === "entreprenor") router.replace("/dashboard/entreprenor");
  }, [ready, router, user]);

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#F6F3EE] text-[#2A2520] antialiased">
        <div className="mx-auto flex min-h-screen max-w-[1400px] items-center justify-center px-6">
          <p className="rounded-xl border border-[#E6DFD6] bg-white px-4 py-2 text-sm text-[#6B5A47]">
            Laddar konto...
          </p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading="BRF-översikt för förvaltning och upphandling"
      subheading="Ladda upp underhållsplan, prioritera åtgärder och driv upphandling med tydlig dokumentation från beslut till garanti."
      startProjectHref="/dashboard/brf/underhallsplan"
      startProjectLabel="Underhållsplan"
      navItems={[
        { href: "/dashboard/brf", label: "Översikt" },
        { href: "/dashboard/brf/fastighet", label: "Fastighet" },
        { href: "/dashboard/brf/underhallsplan", label: "Underhållsplan" },
        { href: "/timeline", label: "Timeline" },
        { href: "/dashboard/brf/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/brf/dokumentinkorg", label: "Avtalsinkorg" },
        { href: "/dashboard/brf/filer", label: "Filer" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[
        {
          title: "Fastighet",
          body: "Se samlad fastighetsdata, komponenter och dokument med tydliga filtyper och sökbara listor.",
          ctaLabel: "Öppna fastighet",
          ctaHref: "/dashboard/brf/fastighet",
        },
        {
          title: "Underhållsplan",
          body: "Ladda upp föreningens underhållsplan och få en prioriterad åtgärdslista med risk- och tidsbedömning.",
          ctaLabel: "Ladda upp underhållsplan",
          ctaHref: "/dashboard/brf/underhallsplan",
        },
        {
          title: "Upphandling",
          body: "Bygg ett strukturerat förfrågningsunderlag med ansvarsfördelning, krav och beslutslogg.",
          ctaLabel: "Starta upphandling",
          ctaHref: "/brf/start",
        },
        {
          title: "Styrelsebeslut",
          body: "Samla protokoll, val av entreprenör och avtalsunderlag i en spårbar beslutslogg.",
          ctaLabel: "Öppna fastighetsvy",
          ctaHref: "/dashboard/brf/fastighet",
        },
        {
          title: "Tidslinje",
          body: "Följ projektstatus med milstolpar och händelser från förfrågan till avtal, ÄTA och avslut.",
          ctaLabel: "Öppna tidslinje",
          ctaHref: "/dashboard/brf/tidslinje",
        },
        {
          title: "Mina förfrågningar",
          body: "Se allt som skickats, vilka entreprenörer som fått underlag och komplettera efter utskick.",
          ctaLabel: "Öppna förfrågningar",
          ctaHref: "/dashboard/brf/forfragningar",
        },
      ]}
      topContent={<FileDeletionNotificationsWidget workspaceId="brf" />}
    />
  );
}
