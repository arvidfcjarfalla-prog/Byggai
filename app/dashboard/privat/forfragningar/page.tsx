"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestsOutboxPanel } from "../../../components/requests-outbox-panel";
import { useAuth } from "../../../components/auth-context";
import { routes } from "../../../lib/routes";

export default function PrivatForfragningarPage() {
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
      heading="Mina offertförfrågningar"
      subheading="Följ skickade förfrågningar och välj nästa steg: meddelanden, dokument eller tidslinje."
      startProjectHref="/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      navItems={[
        { href: routes.privatperson.overview(), label: "Översikt" },
        { href: routes.privatperson.underlagIndex(), label: "Bostad & underlag" },
        { href: "/timeline", label: "Timeline" },
        { href: routes.privatperson.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.privatperson.documentsIndex(), label: "Dokumentinkorg" },
        { href: "/start", label: "Initiera / fortsätt projekt" },
      ]}
      cards={[]}
    >
      <RequestsOutboxPanel audience="privat" mode="overview" />
    </DashboardShell>
  );
}
