"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { getLandingPath } from "../lib/auth";
import { getQuickActions, getSidebarNav, type NavItem } from "../lib/navigation";

interface DashboardCard {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

interface DashboardNavItem {
  href: string;
  label: string;
  children?: DashboardNavItem[];
}

function stripUrlQuery(input: string): string {
  return input.split("?")[0] || input;
}

function isItemActive(pathname: string, item: NavItem): boolean {
  const href = stripUrlQuery(item.href);
  const matchMode = item.match ?? "prefix";
  if (matchMode === "exact") return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({
  roleLabel,
  heading,
  subheading,
  cards,
  startProjectHref = "/start",
  startProjectLabel = "Starta projekt",
  // Deprecated: kept for backwards compatibility while pages are migrated.
  navItems,
  children,
  contextHeader,
}: {
  roleLabel: string;
  heading: string;
  subheading: string;
  cards: DashboardCard[];
  startProjectHref?: string;
  startProjectLabel?: string;
  navItems?: DashboardNavItem[];
  children?: React.ReactNode;
  contextHeader?: {
    projectName: string;
    roleLabel?: string;
    statusLabel?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const role = user?.role ?? "osaker";
  const landingHref = getLandingPath(role);
  const navGroups = getSidebarNav(role);
  const quickActions = getQuickActions(role);
  const effectiveQuickActions =
    quickActions.length > 0
      ? quickActions
      : [{ id: "start-project", label: startProjectLabel, href: startProjectHref }];
  void navItems;
  const flatNavItems = navGroups.flatMap((group) => group.items);
  const activeItem = flatNavItems.find((item) => isItemActive(pathname, item)) ?? null;

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

          <nav className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.id}>
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#8C7860]">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = isItemActive(pathname, item);
                    return (
                      <Link
                        key={item.id}
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
                </div>
              </div>
            ))}
          </nav>

          {effectiveQuickActions.length > 0 && (
            <div className="mt-8 border-t border-[#E6DFD6] pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8C7860]">
                Snabbval
              </p>
              <div className="space-y-2">
                {effectiveQuickActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="block rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
              {activeItem ? `Du är här: ${activeItem.label}` : `Du är här: ${heading}`}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#766B60]">{subheading}</p>
            {contextHeader && (
              <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#E6DFD6] bg-white px-3 py-2 text-xs text-[#6B5A47]">
                <span className="font-semibold text-[#2A2520]">{contextHeader.projectName}</span>
                {contextHeader.roleLabel && (
                  <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-0.5 font-semibold">
                    {contextHeader.roleLabel}
                  </span>
                )}
                {contextHeader.statusLabel && (
                  <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-0.5 font-semibold">
                    {contextHeader.statusLabel}
                  </span>
                )}
              </div>
            )}
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
