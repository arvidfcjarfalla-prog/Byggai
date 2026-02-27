"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../../components/auth-context";
import { DashboardShell } from "../../../../../components/dashboard-shell";
import { AtgardDetaljPanel } from "../../../../../components/atgard-detalj-panel";
import { Breadcrumbs } from "../../../../../components/ui/breadcrumbs";
import { routes } from "../../../../../lib/routes";

function toParamValue(value: string | string[] | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] || "";
  return value;
}

export default function BrfActionDetailsPage() {
  const router = useRouter();
  const params = useParams<{ actionId: string }>();
  const searchParams = useSearchParams();
  const { user, ready } = useAuth();
  const actionId = decodeURIComponent(toParamValue(params?.actionId));
  const from = searchParams.get("from");
  const brfDashboardBase = routes.brf.overview();
  const backHref =
    from && from.startsWith(brfDashboardBase) ? from : routes.brf.maintenanceIndex();
  const maintenanceIndexHref = routes.brf.maintenanceIndex();

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
    if (user.role === "entreprenor") router.replace(routes.entreprenor.overview());
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
      heading="Detaljera åtgärd"
      subheading="Fyll i åtgärdsspecifik information så att entreprenören får ett tydligt och jämförbart underlag."
      startProjectHref={maintenanceIndexHref}
      startProjectLabel="Underhållsplan"
      navItems={[
        { href: routes.brf.overview(), label: "Översikt" },
        { href: routes.brf.propertyIndex(), label: "Fastighet" },
        { href: routes.brf.maintenanceIndex(), label: "Underhållsplan" },
        { href: "/timeline", label: "Timeline" },
        { href: routes.brf.requestsIndex(), label: "Mina förfrågningar" },
        { href: routes.brf.documentsIndex(), label: "Avtalsinkorg" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[]}
    >
      <section className="mb-4 rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
        <Breadcrumbs
          items={[
            { href: maintenanceIndexHref, label: "Underhållsplan" },
            { label: `Åtgärd ${actionId}` },
          ]}
        />
        <Link
          href={maintenanceIndexHref}
          className="inline-flex rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
        >
          Till underhållsöversikt
        </Link>
      </section>

      <AtgardDetaljPanel key={actionId} actionId={actionId} backHref={backHref} />
    </DashboardShell>
  );
}
