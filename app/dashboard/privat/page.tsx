"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/dashboard-shell";
import { useAuth } from "../../components/auth-context";

export default function PrivatDashboardPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") router.replace("/dashboard/brf");
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
      roleLabel="Privatperson"
      heading="Översikt för ditt byggprojekt"
      subheading="Här ser du nästa steg i ditt projekt, vilka underlag som saknas och när det är dags att gå vidare mot upphandling."
      navItems={[
        { href: "/dashboard/privat", label: "Översikt" },
        { href: "/dashboard/privat/underlag", label: "Bostad & underlag" },
        { href: "/timeline", label: "Timeline" },
        { href: "/dashboard/privat/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/privat/dokumentinkorg", label: "Dokumentinkorg" },
        { href: "/dashboard/privat/filer", label: "Filer" },
        { href: "/start", label: "Initiera / fortsätt projekt" },
      ]}
      cards={[
        {
          title: "Bostad & underlag",
          body: "Samla bostadsfakta, kontaktvägar och filer på ett ställe för tydligare offertförfrågningar.",
          ctaLabel: "Öppna underlag",
          ctaHref: "/dashboard/privat/underlag",
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
          ctaHref: "/dashboard/privat/tidslinje",
        },
        {
          title: "Mina förfrågningar",
          body: "Följ skickade förfrågningar, se mottagande entreprenörer och komplettera underlag.",
          ctaLabel: "Öppna förfrågningar",
          ctaHref: "/dashboard/privat/forfragningar",
        },
      ]}
    />
  );
}
