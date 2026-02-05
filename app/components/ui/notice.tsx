"use client";

export function Notice({
  children,
  variant = "info",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "info" | "warning" | "success";
  className?: string;
}) {
  const variants = {
    info: "border-[#E8E3DC] bg-[#CDB49B]/10 text-[#766B60]",
    warning: "border-[#8C7860]/40 bg-[#8C7860]/10 text-[#6B5A47]",
    success: "border-[#6B5A47]/30 bg-[#CDB49B]/15 text-[#2A2520]",
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 text-sm leading-relaxed ${variants[variant]} ${className}`}
      role="status"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <div className="flex-1">{children}</div>
    </div>
  );
}
