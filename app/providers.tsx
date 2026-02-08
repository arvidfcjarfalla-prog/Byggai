"use client";

import { AuthProvider } from "./components/auth-context";
import { WizardProvider } from "./components/wizard-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WizardProvider>{children}</WizardProvider>
    </AuthProvider>
  );
}
