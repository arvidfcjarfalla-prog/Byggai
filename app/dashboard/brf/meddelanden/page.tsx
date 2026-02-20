"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { RequestsOutboxPanel } from "../../../components/requests-outbox-panel";
import { useAuth } from "../../../components/auth-context";

export default function BrfMeddelandenPage() {
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

  if (!ready) return null;
  if (!user) return null;

  return (
    <DashboardShell
      roleLabel="Bostadsrättsförening"
      heading="Meddelanden"
      subheading="Kommunicera per projektförfrågan i en tydlig och spårbar tråd."
      startProjectHref="/brf/start/sammanfattning"
      startProjectLabel="Skapa ny förfrågan"
      cards={[]}
    >
      <RequestsOutboxPanel audience="brf" mode="messages" />
    </DashboardShell>
  );
}
