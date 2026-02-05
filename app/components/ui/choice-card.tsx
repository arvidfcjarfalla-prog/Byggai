"use client";

export function ChoiceCard({
  children,
  selected,
  onClick,
  className = "",
  as: Component = "button",
  ...rest
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  as?: "button" | "div";
} & React.HTMLAttributes<HTMLButtonElement | HTMLDivElement>) {
  const base =
    "group relative overflow-hidden rounded-3xl border-2 p-6 text-left shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 ";
  const state = selected
    ? "border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5"
    : "border-[#E8E3DC] bg-white hover:border-[#CDB49B]";

  if (Component === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={base + state + " " + className}
        aria-pressed={selected}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={base + state + " " + className} {...rest}>
      {children}
    </div>
  );
}
