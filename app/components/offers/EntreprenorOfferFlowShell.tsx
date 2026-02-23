"use client";

import type { ReactNode } from "react";

import type { EntreprenorOfferFlowStep } from "../../lib/offers/flow";
import { EntreprenorOfferFlowStepper } from "./EntreprenorOfferFlowStepper";

export function EntreprenorOfferFlowShell({
  steps,
  stepperSubheading,
  children,
}: {
  steps: EntreprenorOfferFlowStep[];
  stepperSubheading: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {steps.length > 0 && (
        <EntreprenorOfferFlowStepper steps={steps} subheading={stepperSubheading} />
      )}
      {children}
    </div>
  );
}
