"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-context";
import { getDashboardPath } from "../lib/auth";

export default function DashboardEntryPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(getDashboardPath(user.role));
  }, [ready, router, user]);

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
