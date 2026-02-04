import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Omfattning – Byggplattformen",
  description:
    "Avgränsa projektet genom att välja den kategori som bäst beskriver vad som ska genomföras.",
};

export default function OmfattningPage() {
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
            href="/start/underlag"
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
              Omfattning
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              Nästa steg är att avgränsa projektet. Välj den kategori som bäst
              beskriver vad som ska genomföras.
            </p>

            <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Vilken typ av projekt?
              </h2>

              <div className="mt-5 grid gap-3">
                <ChoiceCard
                  title="Renovering"
                  text="Befintlig yta som ska förbättras/ändras."
                />
                <ChoiceCard
                  title="Tillbyggnad"
                  text="Utökning av befintlig byggnad."
                />
                <ChoiceCard
                  title="Nybyggnation"
                  text="Helt ny byggnad eller ny del från grunden."
                />
                <ChoiceCard
                  title="Osäker"
                  text="Jag behöver hjälp att avgränsa omfattningen."
                />
              </div>

              <p className="mt-6 text-sm text-slate-500">
                Vi sparar inget än. Målet är att skapa en tydlig struktur steg för
                steg.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function ChoiceCard({ title, text }: { title: string; text: string }) {
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm outline-none transition-colors duration-150 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-slate-600">{text}</div>
    </button>
  );
}

