"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { getDashboardPath, getLandingPath } from "../lib/auth";

interface DashboardCard {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

interface DashboardNavItem {
  href: string;
  label: string;
}

export function DashboardShell({
  roleLabel,
  heading,
  subheading,
  cards,
  startProjectHref = "/start",
  startProjectLabel = "Starta projekt",
  navItems,
  children,
}: {
  roleLabel: string;
  heading: string;
  subheading: string;
  cards: DashboardCard[];
  startProjectHref?: string;
  startProjectLabel?: string;
  navItems?: DashboardNavItem[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const landingHref = getLandingPath(user?.role ?? "osaker");
  const overviewHref = getDashboardPath(user?.role ?? "osaker");
  const resolvedNavItems =
    navItems ??
    [
      { href: overviewHref, label: "Översikt" },
      { href: startProjectHref, label: startProjectLabel },
    ];

  const onSignOut = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-[#F6F3EE] text-[#2A2520] antialiased">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-[#E6DFD6] bg-white/90 p-6">
          <Link href={landingHref} className="mb-10 inline-flex items-center gap-2 text-xl font-bold">
            Byggplattformen
          </Link>

          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#8C7860]">
            Inloggad som
          </p>
          <p className="mb-10 rounded-xl border border-[#E6DFD6] bg-[#FAF8F5] px-3 py-2 text-sm font-semibold">
            {roleLabel}
          </p>

          <nav className="space-y-2">
            {resolvedNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href.length > 1 && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-[#EFE9DE] text-[#2A2520]"
                      : "text-[#2A2520] hover:bg-[#EFE9DE]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 border-t border-[#E6DFD6] pt-4">
            <p className="mb-3 text-xs text-[#766B60]">{user?.email}</p>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Logga ut
            </button>
          </div>
        </aside>

        <section className="p-6 lg:p-10">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#766B60]">{subheading}</p>
          </header>

          {children ? (
            children
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {cards.map((card) => (
                <article key={card.title} className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold">{card.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#766B60]">{card.body}</p>
                  {card.ctaLabel && card.ctaHref && (
                    <Link
                      href={card.ctaHref}
                      className="mt-4 inline-flex rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
                    >
                      {card.ctaLabel}
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
