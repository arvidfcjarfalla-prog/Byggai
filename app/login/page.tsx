import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Logga in – Byggplattformen",
  description:
    "Logga in för att fortsätta arbeta med dina projekt och följa upp beslut.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            <div aria-hidden="true" className="h-9 w-9 rounded-xl bg-slate-900" />
            <span className="text-sm font-semibold tracking-tight">
              Byggplattformen
            </span>
          </Link>

          <Link
            href="/konto"
            className="text-sm font-semibold text-slate-700 outline-none transition-colors duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Skapa konto
          </Link>
        </div>
      </header>

      <section className="px-4 py-16">
        <div className="mx-auto flex max-w-6xl justify-center">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-8 md:py-10">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Logga in
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Fortsätt där du slutade, och få tillgång till dina sparade projekt
              och beslut.
            </p>

            <form className="mt-8 space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-800">
                  E-postadress
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
                  placeholder="namn@example.se"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-800">
                  Lösenord
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
                  placeholder="Ditt lösenord"
                />
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition-colors duration-150 hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Logga in
              </button>
            </form>

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              Har du problem med inloggningen? Kontakta din projektägare eller
              plattformens administratör.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

