"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-context";
import type { UserRole } from "../lib/auth";
import { getDashboardPath } from "../lib/auth";

const ROLE_STORAGE_KEY = "byggplattformen-role";
const DEV_ROLE_OVERRIDE_KEY = "byggplattformen-dev-role-override";
const DEV_BYPASS_DISABLED_KEY = "byggplattformen-dev-bypass-disabled";

export function DevMenu() {
  const router = useRouter();
  const { ready } = useAuth();
  const [open, setOpen] = useState(false);

  if (process.env.NODE_ENV !== "development" || !ready) return null;

  const setRoleAndGo = (role: UserRole) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
      localStorage.setItem(DEV_ROLE_OVERRIDE_KEY, role);
      localStorage.removeItem(DEV_BYPASS_DISABLED_KEY);
    }
    router.push(getDashboardPath(role));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-[#D9D1C6] bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#6B5A47] shadow-md backdrop-blur hover:bg-white"
      >
        Dev meny
      </button>
      {open && (
        <div className="mt-2 w-72 space-y-3 rounded-2xl border border-[#D2C5B5] bg-white p-4 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            Snabbnavigering
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRoleAndGo("privat")}
              className="rounded-lg border px-2 py-1.5 text-left text-xs font-medium hover:bg-[#F6F0E8]"
            >
              Dash privat
            </button>
            <button
              type="button"
              onClick={() => setRoleAndGo("brf")}
              className="rounded-lg border px-2 py-1.5 text-left text-xs font-medium hover:bg-[#F6F0E8]"
            >
              Dash BRF
            </button>
            <button
              type="button"
              onClick={() => setRoleAndGo("entreprenor")}
              className="rounded-lg border px-2 py-1.5 text-left text-xs font-medium hover:bg-[#F6F0E8]"
            >
              Dash entrepr.
            </button>
            <Link href="/start/sammanfattning" className="rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-[#F6F0E8]">Wizard slut</Link>
            <Link href="/privatperson" className="rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-[#F6F0E8]">Landning privat</Link>
            <Link href="/entreprenor" className="rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-[#F6F0E8]">Landning entrepr.</Link>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
            Byt roll lokalt
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setRoleAndGo("privat")} className="rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-[#F6F0E8]">Privat</button>
            <button type="button" onClick={() => setRoleAndGo("brf")} className="rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-[#F6F0E8]">BRF</button>
            <button type="button" onClick={() => setRoleAndGo("entreprenor")} className="rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-[#F6F0E8]">Entr.</button>
          </div>
        </div>
      )}
    </div>
  );
}
