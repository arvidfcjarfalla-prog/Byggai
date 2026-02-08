"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RoleSwitcher } from "../components/role-switcher";

const ROLE_STORAGE_KEY = "byggplattformen-role";

export default function BrfPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, "brf");
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main
      id="main"
      className="min-h-screen bg-[#FAF8F5] text-[#2A2520] antialiased"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(205, 180, 155, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(140, 120, 100, 0.06) 0%, transparent 50%)
        `,
      }}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-4 focus:z-[60] focus:rounded-2xl focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860]"
      >
        Hoppa till innehåll
      </a>

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
            <span className="font-display text-lg font-bold tracking-tight text-[#2A2520]">
              Byggplattformen
            </span>
          </Link>

          <nav
            aria-label="Primär navigering"
            className="hidden items-center gap-8 md:flex"
          >
            <a
              href="#hur"
              className="relative text-sm font-medium text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-[#8C7860] after:transition-all after:duration-300 hover:after:w-full"
            >
              Så funkar det
            </a>
            <a
              href="#varfor"
              className="relative text-sm font-medium text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-[#8C7860] after:transition-all after:duration-300 hover:after:w-full"
            >
              Varför detta
            </a>
            <a
              href="#faq"
              className="relative text-sm font-medium text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-[#8C7860] after:transition-all after:duration-300 hover:after:w-full"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/konto?role=brf"
              className="hidden rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white shadow-md outline-none transition-all duration-300 hover:bg-[#6B5A47] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 md:inline-flex"
            >
              Skapa konto
            </Link>
            <Link
              href="/login?role=brf"
              className="hidden text-sm font-medium text-[#766B60] outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 md:inline-flex"
            >
              Logga in
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#CDB49B] bg-white text-[#2A2520] outline-none transition-all duration-300 hover:border-[#8C7860] hover:bg-[#CDB49B]/10 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              aria-label="Öppna meny"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen(true)}
            >
              <span className="flex flex-col items-center justify-center gap-1">
                <span className="block h-0.5 w-5 rounded-full bg-current transition-all duration-300" />
                <span className="block h-0.5 w-5 rounded-full bg-current transition-all duration-300" />
                <span className="block h-0.5 w-5 rounded-full bg-current transition-all duration-300" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-7xl px-6 lg:px-8">
        <RoleSwitcher current="brf" />
      </div>

      {/* Side Menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm"
          onClick={closeMenu}
        >
          <div
            id="mobile-menu"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Meny"
            className="flex h-full w-80 max-w-full flex-col bg-white shadow-2xl animate-[slide-in-right_300ms_cubic-bezier(0.4,0,0.2,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E8E3DC] bg-gradient-to-r from-[#CDB49B]/10 to-transparent px-6 py-5">
              <h2 className="font-display text-lg font-bold text-[#2A2520]">
                Meny
              </h2>
              <button
                type="button"
                onClick={closeMenu}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#CDB49B] text-[#2A2520] outline-none transition-all duration-300 hover:border-[#8C7860] hover:bg-[#CDB49B]/10 hover:rotate-90 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                aria-label="Stäng meny"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="2" y1="2" x2="14" y2="14" />
                  <line x1="14" y1="2" x2="2" y2="14" />
                </svg>
              </button>
            </div>

            <nav
              aria-label="Huvudmeny"
              className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6 text-sm"
            >
              {[
                { href: "/brf/start", label: "Initiera BRF-projekt" },
                { href: "/konto?role=brf", label: "Skapa konto" },
                { href: "/?chooseRole=1", label: "Byt roll" },
                { href: "#hur", label: "Så funkar det" },
                { href: "#faq", label: "FAQ" },
              ].map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-xl px-4 py-3.5 font-medium text-[#766B60] outline-none transition-all duration-300 hover:bg-[#CDB49B]/10 hover:text-[#8C7860] hover:pl-5 focus-visible:ring-2 focus-visible:ring-[#8C7860]"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Hero */}
      <section id="content" className="px-4 pb-24 pt-20 lg:pt-28">
        <div className="mx-auto flex max-w-7xl flex-col items-center">
          <div className="relative w-full max-w-3xl">
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-[#CDB49B]/20 to-transparent blur-3xl" />
            <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-gradient-to-tl from-[#8C7860]/15 to-transparent blur-3xl" />

            <div className="relative rounded-3xl border-2 border-[#E8E3DC] bg-white/95 p-8 shadow-2xl backdrop-blur-sm hover-lift md:p-12 lg:rounded-[2.5rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860] opacity-0 animate-fade-in-up">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
                För Bostadsrättsföreningar
              </div>

              <h1 className="font-display mt-8 text-4xl font-bold leading-tight tracking-tight text-[#2A2520] opacity-0 animate-fade-in-up delay-100 md:text-5xl lg:text-6xl">
                Planera{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">åtgärder</span>
                  <span className="absolute bottom-2 left-0 h-3 w-full bg-[#CDB49B]/30 -rotate-1" />
                </span>
                <br />
                och upphandling.
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-[#766B60] opacity-0 animate-fade-in-up delay-200 md:text-xl">
                Strukturera era underhålls- och renoveringsprojekt. Skapa tydligt underlag för upphandling och få transparent beslutsordning från start till mål.
              </p>

              <div className="mt-10 flex flex-col gap-4 opacity-0 animate-fade-in-up delay-300 sm:flex-row sm:items-center">
                <Link
                  href="/brf/start"
                  className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 sm:flex-none"
                >
                  Initiera BRF-projekt
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
                </Link>

                <a
                  href="#hur"
                  className="inline-flex items-center justify-center text-sm font-semibold text-[#8C7860] underline-offset-4 outline-none transition-all duration-300 hover:text-[#6B5A47] hover:underline focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                >
                  Läs mer om hur det funkar
                </a>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-[#766B60] opacity-0 animate-fade-in-up delay-500">
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
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 2" />
                </svg>
                Neutral plattform utan leverantörsagenda. Transparent och spårbart.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section aria-label="Nyckelfördelar" className="px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Strukturerad planering",
                desc: "Samla underlag, beslut och åtgärdsplan på ett ställe. Minska osäkerhet innan upphandling.",
              },
              {
                title: "Transparent beslutsgång",
                desc: "Tydlig ordning från idé till genomförande. Spårbara beslut och prioriteringar.",
              },
              {
                title: "Bättre upphandling",
                desc: "Komplett underlag ger bättre offerter och färre missförstånd under projekt.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="group rounded-3xl border border-[#E8E3DC] bg-white p-8 shadow-lg transition-all duration-300 hover:border-[#CDB49B] hover:shadow-xl hover-lift"
              >
                <h3 className="mb-3 text-lg font-bold text-[#2A2520]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#766B60]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="hur" aria-labelledby="hur-title" className="scroll-mt-28 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <h2
              id="hur-title"
              className="font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl lg:text-5xl"
            >
              Så funkar det
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#766B60]">
              Från utredning till upphandling med struktur och transparens.
            </p>
          </div>

          <ol className="grid gap-8 md:grid-cols-3">
            {[
              {
                n: 1,
                title: "Beskriv åtgärden",
                desc: "Välj typ av projekt: underhåll, renovering, fasad, stambyte eller upphandling.",
              },
              {
                n: 2,
                title: "Samla underlag",
                desc: "Ladda upp handlingar, beslut och beskrivningar. Plattformen skapar struktur.",
              },
              {
                n: 3,
                title: "Skapa åtgärdsplan",
                desc: "Få en översikt med beslutsgång, tidplan och nästa steg för upphandling.",
              },
            ].map((s) => (
              <li key={s.n} className="group relative">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#CDB49B]/10 to-transparent opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative rounded-3xl border-2 border-[#E8E3DC] bg-white p-8 shadow-lg transition-all duration-300 hover:border-[#CDB49B] hover-lift">
                  <div className="mb-5 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8C7860] to-[#6B5A47] text-lg font-bold text-white shadow-md">
                      {s.n}
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-[#CDB49B] to-transparent" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-[#2A2520]">{s.title}</h3>
                  <p className="leading-relaxed text-[#766B60]">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-14 text-center">
            <Link
              href="/dashboard/brf/underhallsplan"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Skapa åtgärdsplan
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
            </Link>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section
        id="varfor"
        aria-labelledby="varfor-title"
        className="scroll-mt-28 border-y border-[#E8E3DC] bg-white px-6 py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <h2
              id="varfor-title"
              className="font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl lg:text-5xl"
            >
              Varför börja med struktur
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#766B60]">
              Spara tid, pengar och föreningens resurser genom bättre planering.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                title: "Undvik överraskningar",
                desc: "Tydligt scope och realistiska budgetar från start minskar konflikter under genomförande.",
              },
              {
                title: "Bättre styrelsearbete",
                desc: "Transparent beslutsordning och dokumentation underlättar för både nuvarande och framtida styrelser.",
              },
              {
                title: "Högre kvalitet",
                desc: "Entreprenörer får bättre underlag vilket ger mer exakta offerter och färre ändringar.",
              },
            ].map((b) => (
              <div
                key={b.title}
                className="group relative overflow-hidden rounded-3xl border-2 border-[#E8E3DC] bg-gradient-to-br from-white to-[#FAF8F5] p-10 shadow-lg transition-all duration-300 hover:border-[#CDB49B] hover-lift"
              >
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-[#CDB49B]/20 to-transparent blur-2xl transition-opacity duration-300 group-hover:opacity-0" />
                <div className="relative">
                  <h3 className="mb-3 text-xl font-bold text-[#2A2520]">{b.title}</h3>
                  <p className="leading-relaxed text-[#766B60]">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-28 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <h2
              id="faq-title"
              className="font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl lg:text-5xl"
            >
              Vanliga frågor
            </h2>
          </div>

          <ul className="space-y-4">
            {[
              {
                q: "Är plattformen anpassad för föreningar?",
                a: "Ja, flödet är byggt för kollektiva beslut med tydlig dokumentation och spårbarhet som passar föreningsarbete.",
              },
              {
                q: "Kan flera i styrelsen samarbeta?",
                a: "Ja, ni kan bjuda in kollegor och fördela ansvar. Alla ändringar loggas för transparens.",
              },
              {
                q: "Kostar det något?",
                a: "Grundfunktionen är fri att använda. Betalkonton för föreningar med fler funktioner kommer senare.",
              },
            ].map((item) => (
              <li key={item.q}>
                <details className="group rounded-3xl border-2 border-[#E8E3DC] bg-white p-6 shadow-md transition-all duration-300 hover:border-[#CDB49B] hover:shadow-lg">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-base font-semibold text-[#2A2520] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 marker:content-none">
                    <span>{item.q}</span>
                    <span
                      aria-hidden="true"
                      className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#CDB49B]/20 text-[#8C7860] transition-all duration-300 group-open:rotate-180 group-open:bg-[#8C7860] group-open:text-white"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="6" y1="3" x2="6" y2="9" />
                        <line x1="3" y1="6" x2="9" y2="6" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-4 leading-relaxed text-[#766B60]">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E8E3DC] bg-white px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 text-sm text-[#766B60] md:flex-row md:items-center md:justify-between">
            <div>© 2026 Byggplattformen · Alla rättigheter förbehållna</div>
            <div className="flex gap-6">
              <a href="#hur" className="hover:text-[#8C7860]">Så funkar det</a>
              <a href="#varfor" className="hover:text-[#8C7860]">Varför detta</a>
              <a href="#faq" className="hover:text-[#8C7860]">FAQ</a>
              <Link href="/dashboard/brf/underhallsplan" className="hover:text-[#8C7860]">Kom igång</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
