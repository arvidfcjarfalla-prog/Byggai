"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectEconomyOverview } from "../../../components/economy/project-economy-overview";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { routes } from "../../../lib/routes";

export default function PrivatEkonomiPage() {
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

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading="Ekonomi"
      subheading="Samlad ekonomivy för valt projekt: vad som gäller nu i avtal/offert, signerade ÄTA och total kostnadsbild."
      cards={[]}
    >
      <ProjectEconomyOverview role="privatperson" />
    </DashboardShell>
  );
}
