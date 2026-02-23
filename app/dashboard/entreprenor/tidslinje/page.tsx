"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { ProjectTimeline } from "../../../components/timeline/project-timeline";
import { routes } from "../../../lib/routes";

export default function EntreprenorTidslinjePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId");
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "brf") {
      router.replace(routes.brf.overview());
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace(routes.privatperson.overview());
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
      heading="Tidslinje"
      subheading="Följ projektets läge från förfrågan till avtal, arbete och avslut med en gemensam, spårbar statuskedja."
      startProjectHref={routes.entreprenor.requestsIndex()}
      startProjectLabel="Se förfrågningar"
      navItems={[
        { href: routes.entreprenor.overview(), label: "Översikt" },
        { href: routes.entreprenor.requestsIndex(), label: "Se förfrågningar" },
        { href: routes.entreprenor.messagesIndex(), label: "Meddelanden" },
        { href: routes.entreprenor.documentsIndex(), label: "Dokumentgenerator" },
        { href: routes.entreprenor.filesIndex(), label: "Filer" },
      ]}
      cards={[]}
    >
      <ProjectTimeline role="entreprenor" initialProjectId={initialProjectId} />
    </DashboardShell>
  );
}
