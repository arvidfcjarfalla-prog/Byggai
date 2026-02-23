"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { ProjectTimeline } from "../../../components/timeline/project-timeline";
import { routes } from "../../../lib/routes";

export default function BrfTidslinjePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId");
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?role=brf");
      return;
    }
    if (user.role === "privat" || user.role === "osaker") {
      router.replace(routes.privatperson.overview());
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
      roleLabel="Bostadsrättsförening"
      heading="Tidslinje"
      subheading="Se ett gemensamt projektflöde med milstolpar och händelser från förfrågan till leverans och avslut."
      startProjectHref="/brf/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      navItems={[
        { href: routes.brf.overview(), label: "Översikt" },
        { href: routes.brf.propertyIndex(), label: "Fastighet" },
        { href: routes.brf.maintenanceIndex(), label: "Underhållsplan" },
        { href: routes.brf.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.brf.documentsIndex(), label: "Avtalsinkorg" },
        { href: routes.brf.filesIndex(), label: "Filer" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[]}
    >
      <ProjectTimeline role="brf" initialProjectId={initialProjectId} />
    </DashboardShell>
  );
}
