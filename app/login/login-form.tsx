"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../components/auth-context";
import { getDashboardPath, type UserRole } from "../lib/auth";

const ROLE_STORAGE_KEY = "byggplattformen-role";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signOut, user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const roleFromQueryRaw = searchParams.get("role");
  const roleFromQuery: UserRole | null =
    roleFromQueryRaw === "privat" ||
    roleFromQueryRaw === "brf" ||
    roleFromQueryRaw === "entreprenor" ||
    roleFromQueryRaw === "osaker"
      ? roleFromQueryRaw
      : null;

  useEffect(() => {
    if (roleFromQuery) {
      localStorage.setItem(ROLE_STORAGE_KEY, roleFromQuery);
    }
  }, [roleFromQuery]);

  useEffect(() => {
    if (!ready || !user) return;
    if (roleFromQuery && user.role !== roleFromQuery) {
      signOut();
      return;
    }
    router.replace(getDashboardPath(user.role));
  }, [ready, roleFromQuery, router, signOut, user]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const result = signIn(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (roleFromQuery && result.user.role !== roleFromQuery) {
      signOut();
      setError(
        `Det kontot är registrerat som ${result.user.role}. Byt till rätt konto eller öppna ${result.user.role}-vyn.`
      );
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
            href={roleFromQuery ? `/konto?role=${roleFromQuery}` : "/konto"}
            className="text-sm font-semibold text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
          >
            Skapa konto
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
                Inloggning
                {roleFromQuery && <span>· {roleFromQuery}</span>}
              </div>

              <h1 className="mt-7 text-3xl font-bold tracking-tight md:text-4xl">
                Logga in
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#766B60]">
                Fortsätt där du slutade och öppna dina projekt, underlag och förfrågningar.
              </p>

              <form className="mt-8 space-y-5" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">E-postadress</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                    placeholder="namn@example.se"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Lösenord</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                    placeholder="Ditt lösenord"
                    autoComplete="current-password"
                    required
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
                  Logga in
                  <svg
                    className="transition-transform duration-300 group-hover:translate-x-1"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="8" x2="14" y2="8" />
                    <polyline points="10 4 14 8 10 12" />
                  </svg>
                </button>
              </form>

              <p className="mt-6 text-xs leading-relaxed text-[#766B60]">
                Har du problem med inloggningen? Kontrollera att du är på rätt roll-sida eller
                skapa ett nytt konto för vald roll.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
