"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/dashboard-shell";
import { useAuth } from "../../../components/auth-context";
import { BrfUploadWorkspace } from "../../../start/upload/page";
import { routes } from "../../../lib/routes";

export function BrfProcurementDashboardShell({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading: string;
  children: ReactNode;
}) {
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
      heading={heading}
      subheading={subheading}
      cards={[]}
    >
      {children}
    </DashboardShell>
  );
}

export function BrfProcurementOfferStepWorkspace({ step }: { step: 1 | 2 | 3 }) {
  return <BrfUploadWorkspace embedded mode="wizard-only" wizardStepOverride={step} />;
}

