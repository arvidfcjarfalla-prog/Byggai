"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestsOutboxPanel } from "../../../components/requests-outbox-panel";
import { useAuth } from "../../../components/auth-context";
import { routes } from "../../../lib/routes";

export default function PrivatMeddelandenPage() {
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

  if (!ready) return null;
  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Privatperson"
      heading="Meddelanden"
      subheading="Kommunicera med entreprenörer per projektförfrågan i en tydlig tråd."
      startProjectHref="/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      cards={[]}
    >
      <RequestsOutboxPanel audience="privat" mode="messages" />
    </DashboardShell>
  );
}
