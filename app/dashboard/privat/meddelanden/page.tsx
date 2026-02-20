"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestsOutboxPanel } from "../../../components/requests-outbox-panel";
import { useAuth } from "../../../components/auth-context";

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
      router.replace("/dashboard/brf");
      return;
    }
    if (user.role === "entreprenor") {
      router.replace("/dashboard/entreprenor");
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
