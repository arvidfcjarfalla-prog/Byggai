"use client";

import Link from "next/link";

export function RoleSwitcher({
  current,
}: {
  current: "privat" | "brf" | "entreprenor";
}) {
  const items: Array<{
    id: "privat" | "brf" | "entreprenor";
    label: string;
    href: string;
  }> = [
    { id: "privat", label: "Privatperson", href: "/privatperson" },
    { id: "brf", label: "BRF", href: "/brf" },
    { id: "entreprenor", label: "Entreprenör", href: "/entreprenor" },
  ];

  return (
    <div className="py-1">
      <nav aria-label="Byt roll" className="flex flex-wrap items-center gap-5 text-sm">
        {items.map((item) => {
          const isActive = item.id === current;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`relative px-0.5 py-1 font-medium transition-colors duration-200 ${
                isActive
                  ? "text-[#2A2520]"
                  : "text-[#766B60] hover:text-[#4F453B]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-[#8C7860]/70"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
