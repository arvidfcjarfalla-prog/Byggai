import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Skapa konto – Byggplattformen",
  description:
    "Skapa ett konto för att spara projekt, följa upp beslut och dela underlag med andra.",
};

export default function KontoPage() {
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
      {/* Header */}
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
            <span className="text-lg font-bold tracking-tight">
              Byggplattformen
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Har du redan ett konto?
            </Link>
            <Link
              href="/login"
              className="hidden rounded-xl bg-[#8C7860] px-4 py-2.5 text-sm font-semibold text-white shadow-md outline-none transition-all duration-300 hover:bg-[#6B5A47] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 sm:inline-flex"
            >
              Logga in
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
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

              <p className="mt-3 text-base leading-relaxed text-[#766B60] md:text-lg">
                Ett konto gör det enklare att spara projekt, följa upp beslut och
                fortsätta där du slutade.
              </p>

              <form className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    E-postadress
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="namn@example.se"
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Lösenord</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minst 8 tecken"
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
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
                    className="w-full rounded-2xl border-2 border-[#E8E3DC] bg-white px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-[#9A9086] focus:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                  />
                </div>

                <button
                  type="submit"
                  className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-6 py-4 text-sm font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-[1.01] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                >
                  Skapa konto
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

                <div className="flex items-start gap-2 rounded-2xl border border-[#E8E3DC] bg-[#CDB49B]/10 p-4 text-xs text-[#766B60]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <p className="leading-relaxed">
                    Ingen information delas med entreprenörer eller tredje part utan ditt
                    uttryckliga godkännande.
                  </p>
                </div>
              </form>

              <div className="mt-7 flex flex-col gap-3 text-sm">
                <p className="text-[#766B60]">
                  Redan konto?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[#8C7860] underline-offset-4 hover:underline"
                  >
                    Logga in
                  </Link>
                </p>

                <Link
                  href="/"
                  className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="10 4 6 8 10 12" />
                  </svg>
                  Tillbaka till startsidan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E8E3DC] bg-white px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 text-sm text-[#766B60] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span>© 2026 Byggplattformen</span>
              <span className="text-[#CDB49B]">•</span>
              <span>Alla rättigheter förbehållna</span>
            </div>
            <div className="flex flex-wrap gap-6">
              <Link
                className="font-medium outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                href="/start"
              >
                Kom igång
              </Link>
              <Link
                className="font-medium outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                href="/login"
              >
                Logga in
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

