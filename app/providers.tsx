"use client";

import { WizardProvider } from "./components/wizard-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <WizardProvider>{children}</WizardProvider>;
}

