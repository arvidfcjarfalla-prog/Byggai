"use client";

import { useWizard } from "./wizard-context";

export function WizardProgress() {
  const { calculateProgress, currentStep, totalSteps } = useWizard();
  const progress = calculateProgress();
  const total = Math.max(1, totalSteps);

  const getEstimatedTime = () => {
    const remaining = Math.max(0, total - currentStep + 1);
    return `≈ ${remaining * 1}–${remaining * 2} minuter`;
  };

  return (
    <div className="rounded-3xl border border-[#E8E3DC] bg-white/70 p-4 backdrop-blur-sm md:p-5">
      <div className="flex items-center justify-between text-xs font-semibold text-[#766B60]">
        <span>
          Steg {currentStep} av {total}
        </span>
        <span>{getEstimatedTime()}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E8E3DC]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8C7860] to-[#6B5A47] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-[#766B60]">
        <svg
          className="animate-pulse"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 6a4 4 0 1 0-8 0c0 4-2 4-2 4h12s-2 0-2-4" />
        </svg>
        <span>Dina svar sparas automatiskt</span>
      </div>
    </div>
  );
}