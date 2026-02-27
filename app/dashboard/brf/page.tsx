"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/dashboard-shell";
import { FileDeletionNotificationsWidget } from "../../components/file-deletion-notifications-widget";
import { ProjectPhaseBanner } from "../../components/project-phase-banner";
import { useAuth } from "../../components/auth-context";
import { routes } from "../../lib/routes";

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
      router.replace(routes.privatperson.overview());
      return;
    }
    if (user.role === "entreprenor") router.replace(routes.entreprenor.overview());
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
      startProjectHref={routes.brf.maintenanceIndex()}
      startProjectLabel="Underhållsplan"
      navItems={[
        { href: routes.brf.overview(), label: "Översikt" },
        { href: routes.brf.propertyIndex(), label: "Fastighet" },
        { href: routes.brf.maintenanceIndex(), label: "Underhållsplan" },
        { href: "/timeline", label: "Timeline" },
        { href: routes.brf.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.brf.documentsIndex(), label: "Avtalsinkorg" },
        { href: routes.brf.filesIndex(), label: "Filer" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[
        {
          title: "Fastighet",
          body: "Se samlad fastighetsdata, komponenter och dokument med tydliga filtyper och sökbara listor.",
          ctaLabel: "Öppna fastighet",
          ctaHref: routes.brf.propertyIndex(),
        },
        {
          title: "Underhållsplan",
          body: "Ladda upp föreningens underhållsplan och få en prioriterad åtgärdslista med risk- och tidsbedömning.",
          ctaLabel: "Ladda upp underhållsplan",
          ctaHref: routes.brf.maintenanceIndex(),
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
          ctaHref: routes.brf.propertyIndex(),
        },
        {
          title: "Tidslinje",
          body: "Följ projektstatus med milstolpar och händelser från förfrågan till avtal, ÄTA och avslut.",
          ctaLabel: "Öppna tidslinje",
          ctaHref: routes.brf.timelineIndex(),
        },
        {
          title: "Mina förfrågningar",
          body: "Se allt som skickats, vilka entreprenörer som fått underlag och komplettera efter utskick.",
          ctaLabel: "Öppna förfrågningar",
          ctaHref: routes.brf.requestsIndex(),
        },
      ]}
      topContent={
        <div className="space-y-4">
          <ProjectPhaseBanner audience="brf" />
          <FileDeletionNotificationsWidget workspaceId="brf" />
        </div>
      }
    />
  );
}
