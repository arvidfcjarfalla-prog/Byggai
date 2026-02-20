"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/dashboard-shell";
import { useAuth } from "../../components/auth-context";

function roleLabel(role: string | undefined): string {
  if (role === "brf") return "Bostadsrättsförening";
  if (role === "entreprenor") return "Entreprenör";
  return "Privatperson";
}

export default function DashboardKontoPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
    }
  }, [ready, router, user]);

  if (!ready || !user) return null;

  return (
    <DashboardShell
      roleLabel={roleLabel(user.role)}
      heading="Konto"
      subheading="Hantera grundläggande kontoinformation och rollkontext."
      cards={[]}
    >
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Namn</dt>
            <dd className="mt-1 text-sm font-semibold text-[#2A2520]">{user.name || "Ej angivet"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">E-post</dt>
            <dd className="mt-1 text-sm font-semibold text-[#2A2520]">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Roll</dt>
            <dd className="mt-1 text-sm font-semibold text-[#2A2520]">{roleLabel(user.role)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Skapad</dt>
            <dd className="mt-1 text-sm font-semibold text-[#2A2520]">
              {new Date(user.createdAt).toLocaleDateString("sv-SE")}
            </dd>
          </div>
        </dl>
      </section>
    </DashboardShell>
  );
}
