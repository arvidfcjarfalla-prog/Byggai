"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../../components/auth-context";
import { DashboardShell } from "../../../../../components/dashboard-shell";
import { BrfActionDetailsEditor } from "../../../../../components/brf-action-details-editor";

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
  const backHref =
    from && from.startsWith("/dashboard/brf") ? from : "/dashboard/brf/underhallsplan";

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
    if (user.role === "entreprenor") router.replace("/dashboard/entreprenor");
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
      startProjectHref="/dashboard/brf/underhallsplan"
      startProjectLabel="Underhållsplan"
      navItems={[
        { href: "/dashboard/brf", label: "Översikt" },
        { href: "/dashboard/brf/fastighet", label: "Fastighet" },
        { href: "/dashboard/brf/underhallsplan", label: "Underhållsplan" },
        { href: "/timeline", label: "Timeline" },
        { href: "/dashboard/brf/forfragningar", label: "Mina förfrågningar" },
        { href: "/brf/start", label: "Initiera BRF-projekt" },
      ]}
      cards={[]}
    >
      <BrfActionDetailsEditor key={actionId} actionId={actionId} backHref={backHref} />
    </DashboardShell>
  );
}
