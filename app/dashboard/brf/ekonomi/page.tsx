"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectEconomyOverview } from "../../../components/economy/project-economy-overview";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { routes } from "../../../lib/routes";

export default function BrfEkonomiPage() {
  const router = useRouter();
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

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading="Ekonomi"
      subheading="Samlad ekonomivy för valt projekt: avtal, signerade ÄTA, öppna kostnader och total ekonomisk överblick."
      cards={[]}
    >
      <ProjectEconomyOverview role="brf" />
    </DashboardShell>
  );
}
