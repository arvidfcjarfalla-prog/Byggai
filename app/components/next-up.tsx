"use client";

/**
 * Panel that shows what step(s) come next in the wizard.
 * Use on each wizard step for clarity.
 */
export function NextUp({
  nextStepName,
  upcomingSteps = [],
}: {
  nextStepName: string;
  upcomingSteps?: string[];
}) {
  return (
    <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
        Nästa steg
      </div>
      <p className="mt-1 font-semibold text-[#2A2520]">{nextStepName}</p>
      {upcomingSteps.length > 0 && (
        <p className="mt-1 text-sm text-[#766B60]">
          Därefter: {upcomingSteps.join(" → ")}
        </p>
      )}
    </div>
  );
}
