import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skapa konto – Byggplattformen",
  description:
    "Skapa ett konto för att spara projekt, följa upp beslut och dela underlag med andra.",
};

export default function KontoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a
            href="/"
            className="flex items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            <div aria-hidden="true" className="h-9 w-9 rounded-xl bg-slate-900" />
            <span className="text-sm font-semibold tracking-tight">
              Byggplattformen
            </span>
          </a>

          <a
            href="/login"
            className="text-sm font-semibold text-slate-700 outline-none transition-colors duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Har du redan ett konto?
          </a>
        </div>
      </header>

      <section className="px-4 py-16">
        <div className="mx-auto flex max-w-6xl justify-center">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-8 md:py-10">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Skapa konto
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ett konto gör det enklare att spara projekt, följa upp beslut och
              fortsätta där du slutade.
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
                  placeholder="Minst 8 tecken"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-800">
                  Namn (valfritt)
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
                  placeholder="För- och efternamn"
                />
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition-colors duration-150 hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Skapa konto
              </button>
            </form>

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              Ingen information delas med entreprenörer eller tredje part utan ditt
              uttryckliga godkännande.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

