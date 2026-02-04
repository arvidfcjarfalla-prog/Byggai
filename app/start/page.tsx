import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start – Byggplattformen",
  description:
    "Starta projektinitiering och skapa struktur i projektets tidiga skede. Vi börjar med nuläget och går vidare steg för steg.",
};

export default function StartPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 antialiased">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      >
        Hoppa till innehåll
      </a>

      {/* Topbar (matchar startsidan) */}
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
            href="/"
            className="text-sm font-semibold text-slate-700 outline-none transition-colors duration-150 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            ← Tillbaka
          </a>
        </div>
      </header>

      <section id="content" className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              Projektinitiering
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
              Start
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              Den här processen används för att skapa struktur i projektets tidiga
              skede. Vi börjar med nuläget och går vidare steg för steg.
            </p>

            <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Vad händer nu?
              </h2>

              <ol className="mt-4 grid gap-2 pl-5 text-sm leading-relaxed text-slate-600">
                <li>Du anger vilket underlag som finns idag.</li>
                <li>Du avgränsar projektets omfattning.</li>
                <li>Du får en tydlig struktur för nästa beslut.</li>
              </ol>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="/start/underlag"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition-colors duration-150 hover:bg-slate-950 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  Fortsätt
                </a>

                <p className="text-sm text-slate-500">
                  Ingen inloggning i detta steg.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}



