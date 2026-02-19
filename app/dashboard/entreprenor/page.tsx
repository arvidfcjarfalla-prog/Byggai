"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/dashboard-shell";
import { useAuth } from "../../components/auth-context";

export default function EntreprenorDashboardPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") {
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace("/dashboard/privat");
    }
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
      roleLabel="Entreprenör"
      heading="Entreprenörsöversikt"
      subheading="Se relevanta projektförfrågningar, håll koll på kapacitet och svara med tydliga underlag i rätt tid."
      startProjectHref="/dashboard/entreprenor/forfragningar"
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
        { href: "/dashboard/entreprenor/meddelanden", label: "Meddelanden" },
        { href: "/dashboard/entreprenor/dokument", label: "Dokumentgenerator" },
      ]}
      cards={[
        {
          title: "Nya förfrågningar",
          body: "Följ inkomna projekt som matchar din profil, geografi och kapacitet.",
          ctaLabel: "Visa förfrågningar",
          ctaHref: "/dashboard/entreprenor/forfragningar",
        },
        {
          title: "Offertutkast",
          body: "Skapa och justera offertutkast från strukturerade projektprofiler för snabbare svar.",
          ctaLabel: "Öppna offerter",
          ctaHref: "/dashboard/entreprenor/forfragningar",
        },
        {
          title: "Kapacitetsläge",
          body: "Planera beläggning och tacka nej till fel uppdrag med tydliga skäl.",
          ctaLabel: "Hantera kapacitet",
          ctaHref: "/dashboard/entreprenor/forfragningar",
        },
        {
          title: "Meddelanden",
          body: "Kommunicera med beställare i en ren inkorg/chat-vy med bilagor.",
          ctaLabel: "Öppna meddelanden",
          ctaHref: "/dashboard/entreprenor/meddelanden",
        },
      ]}
    />
  );
}
