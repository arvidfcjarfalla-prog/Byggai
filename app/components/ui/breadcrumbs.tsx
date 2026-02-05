"use client";

import Link from "next/link";

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Brödsmulor" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[#766B60]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="font-medium outline-none transition-colors hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 rounded-lg px-1"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[#8C7860]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
