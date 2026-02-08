"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/auth-context";
import type { UserRole } from "../lib/auth";
import { getDashboardPath } from "../lib/auth";

const ROLE_STORAGE_KEY = "byggplattformen-role";
const VALID_ROLES = new Set<UserRole>([
  "privat",
  "brf",
  "entreprenor",
  "osaker",
]);

function readRoleFromQueryString(query: string): UserRole | null {
  const value = new URLSearchParams(query).get("role");
  if (!value) return null;
  return VALID_ROLES.has(value as UserRole) ? (value as UserRole) : null;
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>(() => {
    if (typeof window === "undefined") return "privat";
    const queryRole = readRoleFromQueryString(window.location.search);
    if (queryRole) {
      localStorage.setItem(ROLE_STORAGE_KEY, queryRole);
      return queryRole;
    }
    const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
    if (storedRole && VALID_ROLES.has(storedRole as UserRole)) {
      return storedRole;
    }
    return "privat";
  });
  const [error, setError] = useState<string | null>(null);

  const roleFromQuery = useMemo<UserRole | null>(
    () => readRoleFromQueryString(searchParams.toString()),
    [searchParams]
  );
  const lockRole = roleFromQuery === "privat" || roleFromQuery === "brf" || roleFromQuery === "entreprenor";

  useEffect(() => {
    if (!ready || !user) return;
    router.replace(getDashboardPath(user.role));
  }, [ready, router, user]);

  const roleOptions = useMemo(
    () => [
      { id: "privat", label: "Privatperson" },
      { id: "brf", label: "Bostadsrättsförening" },
      { id: "entreprenor", label: "Entreprenör" },
    ] as const,
    []
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (typeof window !== "undefined") {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    }
    const result = signUp({ email, password, name, role });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace(getDashboardPath(result.user.role));
  };

  return (
    <main
      className="min-h-screen bg-[#FAF8F5] text-[#2A2520] antialiased"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(205, 180, 155, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(140, 120, 100, 0.06) 0%, transparent 50%)
        `,
      }}
    >
      <header className="sticky top-0 z-50 border-b border-[#E8E3DC] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-2xl outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
          >
            <div
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8C7860] to-[#6B5A47] shadow-md transition-transform duration-300 group-hover:scale-105"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">Byggplattformen</span>
          </Link>
          <Link
            href={roleFromQuery ? `/login?role=${roleFromQuery}` : "/login"}
            className="text-sm font-semibold text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
          >
            Har du redan ett konto?
          </Link>
        </div>
      </header>

      <section className="px-4 py-16 lg:py-20">
        <div className="mx-auto flex max-w-7xl justify-center">
          <div className="relative w-full max-w-xl">
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-[#CDB49B]/20 to-transparent blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tl from-[#8C7860]/15 to-transparent blur-3xl" />

            <div className="relative rounded-3xl border-2 border-[#E8E3DC] bg-white/95 p-8 shadow-2xl backdrop-blur-sm md:p-10 lg:rounded-[2.5rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
                Konto · Spara & dela
              </div>

              <h1 className="mt-7 text-3xl font-bold tracking-tight md:text-4xl">
                Skapa konto
              </h1>

              <form className="mt-8 space-y-5" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Roll</label>
                  {lockRole && (
                    <p className="text-xs text-[#766B60]">
                      Rollen är förvald utifrån sidan du kom från.
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-3">
                    {roleOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors ${
                          role === option.id
                            ? "border-[#8C7860] bg-[#8C7860]/10 text-[#2A2520]"
                            : "border-[#E8E3DC] text-[#766B60]"
                        } ${lockRole ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="role"
                          value={option.id}
                          checked={role === option.id}
                          onChange={() => setRole(option.id)}
                          disabled={lockRole}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">E-postadress</label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="namn@example.se"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Lösenord</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minst 8 tecken"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    Namn <span className="font-normal text-[#766B60]">(valfritt)</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="För- och efternamn"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-6 py-4 text-sm font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-[1.01] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                >
                  Skapa konto
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
