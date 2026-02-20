"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestsOutboxPanel } from "../../../components/requests-outbox-panel";
import { useAuth } from "../../../components/auth-context";

export default function BrfForfragningarPage() {
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
      heading="BRF-förfrågningar"
      subheading="Följ utskickade upphandlingar och välj nästa steg i varje projekt: meddelanden, dokument eller tidslinje."
      startProjectHref="/brf/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      navItems={[
        { href: "/dashboard/brf", label: "Översikt" },
        { href: "/dashboard/brf/fastighet", label: "Fastighet" },
        { href: "/dashboard/brf/underhallsplan", label: "Underhållsplan" },
        { href: "/timeline", label: "Timeline" },
        { href: "/dashboard/brf/forfragningar", label: "Mina förfrågningar" },
        { href: "/dashboard/brf/dokumentinkorg", label: "Avtalsinkorg" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[]}
    >
      <RequestsOutboxPanel audience="brf" mode="overview" />
    </DashboardShell>
  );
}
