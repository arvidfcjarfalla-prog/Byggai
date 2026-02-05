"use client";

export function StepPill({
  stepNumber,
  label,
  active = false,
}: {
  stepNumber: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
        active
          ? "border-[#8C7860] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 text-[#8C7860]"
          : "border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/20 to-[#CDB49B]/5 text-[#8C7860]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-[#8C7860]" : "bg-[#8C7860]"
        }`}
      />
      Steg {stepNumber} · {label}
    </div>
  );
}
