"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconCompass({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
function IconHandshake({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 12h2a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-2" />
      <path d="M12 2v4" /><path d="M12 18v4" /><path d="M8 12H6a2 2 0 0 0-2 2v4a1 1 0 0 0 1 1h2" />
      <path d="M16 12h2a1 1 0 0 1 1 1v4a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}
function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
          <a
            href="#main"
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
          </a>

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
              href="/konto"
              className="hidden rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white shadow-md outline-none transition-all duration-300 hover:bg-[#6B5A47] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 md:inline-flex"
            >
              Skapa konto
            </Link>
            <Link
              href="/login"
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
                { href: "/start", label: "Initiera projekt" },
                { href: "/konto", label: "Skapa konto" },
                { href: "/tjanster", label: "Våra tjänster" },
                { href: "/guider", label: "Guider & resurser" },
                { href: "/om-oss", label: "Om plattformen" },
                { href: "/kontakt", label: "Kontakt" },
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
              <div className="inline-flex items-center gap-2 rounded-full border border-[#CDB49B] bg-[#CDB49B]/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B5A47] animate-fade-in-up">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
                Beslutsstöd · Tidigt skede
              </div>

              <h1 className="font-display mt-8 text-4xl font-bold leading-tight tracking-tight text-[#2A2520] animate-fade-in-up delay-100 md:text-5xl lg:text-6xl">
                Initiera ditt
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">byggprojekt</span>
                  <span className="absolute bottom-2 left-0 h-3 w-full bg-[#CDB49B]/30 -rotate-1" />
                </span>
                .
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-[#766B60] animate-fade-in-up delay-200 md:text-xl">
                Svara på några frågor om nuläge och mål. Plattformen skapar en
                första projektöversikt och föreslår nästa steg — strukturerat och
                transparent.
              </p>

              <div className="mt-10 flex flex-col gap-4 animate-fade-in-up delay-300 sm:flex-row sm:items-center">
                <Link
                  href="/start"
                  className="group inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#8C7860] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:bg-[#6B5A47] hover:scale-[1.02] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 sm:flex-none"
                >
                  Initiera projekt
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
                  className="inline-flex items-center justify-center text-sm font-semibold text-[#6B5A47] underline-offset-4 outline-none transition-colors duration-300 hover:text-[#2A2520] hover:underline focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                >
                  Läs mer om hur det funkar
                </a>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-[#6B5A47] animate-fade-in-up delay-500">
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
                Ingen inloggning i första steget. Du kan avbryta när som helst.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section aria-label="Nyckelfördelar" className="px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="group rounded-3xl border border-[#E8E3DC] bg-white p-8 shadow-lg transition-all duration-300 hover:border-[#CDB49B] hover:shadow-xl hover-lift">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#CDB49B]/20 to-[#CDB49B]/5 text-[#8C7860] transition-transform duration-300 group-hover:scale-110">
                <IconFile className="h-6 w-6 shrink-0" />
              </div>
              <h3 className="mb-3 text-lg font-bold text-[#2A2520]">
                Strukturerat underlag
              </h3>
              <p className="text-sm leading-relaxed text-[#766B60]">
                Samlar rätt info i rätt ordning – även utan ritningar.
              </p>
            </div>

            <div className="group rounded-3xl border border-[#E8E3DC] bg-white p-8 shadow-lg transition-all duration-300 hover:border-[#CDB49B] hover:shadow-xl hover-lift">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#CDB49B]/20 to-[#CDB49B]/5 text-[#8C7860] transition-transform duration-300 group-hover:scale-110">
                <IconClock className="h-6 w-6 shrink-0" />
              </div>
              <h3 className="mb-3 text-lg font-bold text-[#2A2520]">
                Sparar tid senare
              </h3>
              <p className="text-sm leading-relaxed text-[#766B60]">
                Mindre fram-och-tillbaka när du väl går vidare.
              </p>
            </div>

            <div className="group rounded-3xl border border-[#E8E3DC] bg-white p-8 shadow-lg transition-all duration-300 hover:border-[#CDB49B] hover:shadow-xl hover-lift">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#CDB49B]/20 to-[#CDB49B]/5 text-[#8C7860] transition-transform duration-300 group-hover:scale-110">
                <IconShield className="h-6 w-6 shrink-0" />
              </div>
              <h3 className="mb-3 text-lg font-bold text-[#2A2520]">
                Transparens
              </h3>
              <p className="text-sm leading-relaxed text-[#766B60]">
                Neutral logik, tydliga antaganden och spårbarhet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="hur"
        aria-labelledby="hur-title"
        className="scroll-mt-28 px-6 py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <h2
              id="hur-title"
              className="font-display text-3xl font-bold tracking-tight text-[#2A2520] md:text-4xl lg:text-5xl"
            >
              Så funkar det
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#766B60]">
              Du beskriver nuläget. Plattformen skapar struktur och visar vilket
              beslut som bör tas härnäst.
            </p>
          </div>

          <ol className="grid gap-8 md:grid-cols-3">
            {[
              {
                n: 1,
                title: "Nuläge & underlag",
                desc: "Välj var du är i skedet: idé, skiss eller ritningar.",
              },
              {
                n: 2,
                title: "Avgränsa projektet",
                desc: "Omfattning, mål och osäkerheter – tydligt och spårbart.",
              },
              {
                n: 3,
                title: "Få en översikt",
                desc: "Sammanfattning + rekommenderad ordning för nästa steg.",
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
                  <h3 className="mb-3 text-xl font-bold text-[#2A2520]">
                    {s.title}
                  </h3>
                  <p className="leading-relaxed text-[#766B60]">
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-14 text-center">
            <Link
              href="/start"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-8 py-4 text-base font-semibold text-white shadow-lg outline-none transition-all duration-300 hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Skapa projektöversikt
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
              Varför vi börjar med struktur
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#766B60]">
              Plattformen är byggd för att minska osäkerhet och förbättra
              beslutsordning.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                Icon: IconCompass,
                title: "Planeringsstöd",
                desc: "Guidar skede för skede och gör osäkerhet synlig istället för att gömma den.",
              },
              {
                Icon: IconHandshake,
                title: "Neutral matchning",
                desc: "När du går vidare kan underlaget användas för en bättre dialog.",
              },
              {
                Icon: IconLayers,
                title: "Tydlig struktur",
                desc: "Projektobjektet blir den gemensamma sanningen – underlag, beslut och nästa steg.",
              },
            ].map((b) => (
              <div
                key={b.title}
                className="group relative overflow-hidden rounded-3xl border-2 border-[#E8E3DC] bg-gradient-to-br from-white to-[#FAF8F5] p-10 shadow-lg transition-all duration-300 hover:border-[#CDB49B] hover-lift"
              >
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-[#CDB49B]/20 to-transparent blur-2xl transition-opacity duration-300 group-hover:opacity-0" />
                <div className="relative">
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#CDB49B]/20 to-[#CDB49B]/5 text-[#8C7860] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <b.Icon className="h-8 w-8 shrink-0" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-[#2A2520]">
                    {b.title}
                  </h3>
                  <p className="leading-relaxed text-[#766B60]">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        aria-labelledby="faq-title"
        className="scroll-mt-28 px-6 py-20"
      >
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
                q: "Är det här en offerttjänst?",
                a: "Nej. Det här är ett beslutsstöd i tidiga skeden. Målet är att minska felbeslut och skapa bättre underlag innan man tar in offerter.",
              },
              {
                q: "Måste jag ha ritningar?",
                a: "Nej. Du kan börja med idé/skiss. Plattformen visar vad som saknas och vad som är rimligt som nästa steg.",
              },
              {
                q: "Ger ni bindande besked om bygglov?",
                a: "Nej. Plattformen ger struktur och vägledning och visar vad som bör kontrolleras. Kommunen fattar beslut.",
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
                  <p className="mt-4 leading-relaxed text-[#766B60]">
                    {item.a}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#8C7860] via-[#6B5A47] to-[#5A4937] p-12 text-white shadow-2xl md:p-16">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

          <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h3 className="font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Börja med en översikt.
              </h3>
              <p className="mt-4 text-lg leading-relaxed text-white/80">
                Testa flödet och få en första projektöversikt på några minuter –
                utan inloggning eller kostnad.
              </p>
            </div>
            <div className="md:text-right">
              <Link
                href="/start"
                className="group inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-semibold text-[#8C7860] shadow-xl outline-none transition-all duration-300 hover:scale-105 hover:bg-[#FAF8F5] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#8C7860]"
              >
                Skapa projektöversikt
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
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E8E3DC] bg-white px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#8C7860] to-[#6B5A47] shadow-md">
              <svg
                width="18"
                height="18"
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
            <span className="font-display text-lg font-bold text-[#2A2520]">
              Byggplattformen
            </span>
          </div>

          <div className="flex flex-col gap-6 text-sm text-[#766B60] md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span>© 2026 Byggplattformen</span>
              <span className="text-[#CDB49B]">•</span>
              <span>Alla rättigheter förbehållna</span>
            </div>
            <div className="flex flex-wrap gap-6">
              <a
                className="font-medium outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                href="#hur"
              >
                Så funkar det
              </a>
              <a
                className="font-medium outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                href="#faq"
              >
                FAQ
              </a>
              <Link
                className="font-medium outline-none transition-colors duration-300 hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                href="/start"
              >
                Kom igång
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}