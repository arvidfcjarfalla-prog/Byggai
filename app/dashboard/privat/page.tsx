"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/dashboard-shell";
import { FileDeletionNotificationsWidget } from "../../components/file-deletion-notifications-widget";
import { ProjectPhaseBanner } from "../../components/project-phase-banner";
import { useAuth } from "../../components/auth-context";
import { routes } from "../../lib/routes";

export default function PrivatDashboardPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") router.replace(routes.brf.overview());
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
      roleLabel="Privatperson"
      heading="Översikt för ditt byggprojekt"
      subheading="Här ser du nästa steg i ditt projekt, vilka underlag som saknas och när det är dags att gå vidare mot upphandling."
      navItems={[
        { href: routes.privatperson.overview(), label: "Översikt" },
        { href: routes.privatperson.underlagIndex(), label: "Bostad & underlag" },
        { href: "/timeline", label: "Timeline" },
        { href: routes.privatperson.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.privatperson.documentsIndex(), label: "Dokumentinkorg" },
        { href: routes.privatperson.filesIndex(), label: "Filer" },
        { href: "/start", label: "Initiera / fortsätt projekt" },
      ]}
      cards={[
        {
          title: "Bostad & underlag",
          body: "Samla bostadsfakta, kontaktvägar och filer på ett ställe för tydligare offertförfrågningar.",
          ctaLabel: "Öppna underlag",
          ctaHref: routes.privatperson.underlagIndex(),
        },
        {
          title: "Fortsätt projektguiden",
          body: "Fyll i nuläge, omfattning, budget och tidplan för att minska osäkerhet innan upphandling.",
          ctaLabel: "Fortsätt wizard",
          ctaHref: "/start",
        },
        {
          title: "Ladda upp underlag",
          body: "Komplettera med ritningar, bilder och handlingar så entreprenörer får rätt förutsättningar.",
          ctaLabel: "Till underlag",
          ctaHref: "/start/underlag",
        },
        {
          title: "Riskprofil",
          body: "Du får en tydlig sammanfattning av osäkerheter innan du skickar förfrågan till entreprenörer.",
          ctaLabel: "Se sammanfattning",
          ctaHref: "/start/sammanfattning",
        },
        {
          title: "Tidslinje",
          body: "Följ projektets läge med milstolpar och händelser från förfrågan till avtal, ÄTA och avslut.",
          ctaLabel: "Öppna tidslinje",
          ctaHref: routes.privatperson.timelineIndex(),
        },
        {
          title: "Mina förfrågningar",
          body: "Följ skickade förfrågningar, se mottagande entreprenörer och komplettera underlag.",
          ctaLabel: "Öppna förfrågningar",
          ctaHref: routes.privatperson.requestsIndex(),
        },
      ]}
      topContent={
        <div className="space-y-4">
          <ProjectPhaseBanner audience="privat" />
          <FileDeletionNotificationsWidget workspaceId="privat" />
        </div>
      }
    />
  );
}
