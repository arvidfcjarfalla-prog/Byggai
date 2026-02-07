/**
 * Routing Utilities
 *
 * Hanterar smooth transitions och wizard state vid navigation
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { WizardData } from "./wizard-context";

/**
 * Smooth navigation – enkel delay utan att manipulera body-opacity
 */
export function useSmoothNavigation() {
  const router = useRouter();

  const navigate = useCallback(
    (path: string, delay = 200) => {
      setTimeout(() => {
        router.push(path);
      }, delay);
    },
    [router]
  );

  return { navigate };
}

/**
 * Routing-regler per roll
 */
export const ROLE_ROUTES = {
  privat: {
    landing: "/privatperson",
    wizard: "/start",
    dashboard: "/projekt",
  },
  brf: {
    landing: "/brf",
    wizard: "/brf/start",
    dashboard: "/brf/atgarder",
  },
  entreprenor: {
    landing: "/entreprenor",
    wizard: null,
    dashboard: "/entreprenor/projekt",
  },
  osaker: {
    landing: "/start",
    wizard: "/start",
    dashboard: null,
  },
} as const;

export function getRoleRoute(
  role: keyof typeof ROLE_ROUTES,
  type: "landing" | "wizard" | "dashboard"
): string | null {
  return ROLE_ROUTES[role]?.[type] ?? null;
}

/**
 * Wizard step order
 */
export const WIZARD_STEP_ORDER = [
  "/start",
  "/start/nulage",
  "/start/renovering",
  "/start/tillbyggnad",
  "/start/nybyggnation",
  "/start/beskrivning",
  "/start/underlag",
  "/start/omfattning",
  "/start/budget",
  "/start/tidplan",
  "/start/sammanfattning",
] as const;

export type WizardStepPath = (typeof WIZARD_STEP_ORDER)[number];

/**
 * Route guards – kontrollera om användare kan komma åt sida
 */
export function canAccessWizardStep(
  targetPath: WizardStepPath,
  data: WizardData
): { allowed: boolean; redirectTo?: WizardStepPath; reason?: string } {
  const { projectType, currentPhase, description } = data;

  if (targetPath === "/start") {
    return { allowed: true };
  }

  if (targetPath === "/start/nulage") {
    if (!projectType) {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Du behöver först välja projekttyp.",
      };
    }
    return { allowed: true };
  }

  if (
    targetPath === "/start/renovering" ||
    targetPath === "/start/tillbyggnad" ||
    targetPath === "/start/nybyggnation"
  ) {
    if (!projectType) {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Du behöver först välja projekttyp.",
      };
    }
    if (!currentPhase) {
      return {
        allowed: false,
        redirectTo: "/start/nulage",
        reason: "Fyll i nuläge innan du går vidare.",
      };
    }
    if (targetPath === "/start/renovering" && projectType !== "renovering") {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Det här steget gäller bara för renovering.",
      };
    }
    if (targetPath === "/start/tillbyggnad" && projectType !== "tillbyggnad") {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Det här steget gäller bara för tillbyggnad.",
      };
    }
    if (
      targetPath === "/start/nybyggnation" &&
      projectType !== "nybyggnation"
    ) {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Det här steget gäller bara för nybyggnation.",
      };
    }
    return { allowed: true };
  }

  if (targetPath === "/start/beskrivning") {
    if (!projectType) {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Du behöver först välja projekttyp.",
      };
    }
    if (!currentPhase) {
      return {
        allowed: false,
        redirectTo: "/start/nulage",
        reason: "Fyll i nuläge först.",
      };
    }
    return { allowed: true };
  }

  if (targetPath === "/start/underlag") {
    if (!projectType) {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Välj projekttyp först.",
      };
    }
    if (!currentPhase) {
      return {
        allowed: false,
        redirectTo: "/start/nulage",
        reason: "Fyll i nuläge först.",
      };
    }
    const text = description?.rawText ?? "";
    if (text.trim().length < 20) {
      return {
        allowed: false,
        redirectTo: "/start/beskrivning",
        reason:
          "Beskriv projektet lite mer så entreprenörer förstår vad du vill göra.",
      };
    }
    return { allowed: true };
  }

  if (targetPath === "/start/omfattning") {
    const hasFiles = (data.files?.length ?? 0) > 0;
    const hasDescription = (description?.rawText ?? "").trim().length >= 20;
    if (!hasFiles && !hasDescription) {
      return {
        allowed: false,
        redirectTo: "/start/underlag",
        reason:
          "Lägg till minst ett underlag eller skriv en kortare beskrivning.",
      };
    }
    return { allowed: true };
  }

  if (targetPath === "/start/budget") {
    if (!data.omfattning) {
      return {
        allowed: false,
        redirectTo: "/start/omfattning",
        reason: "Beskriv omfattningen innan du fyller i budget.",
      };
    }
    return { allowed: true };
  }

  if (targetPath === "/start/tidplan") {
    if (!data.budget || data.budget.intervalMin === undefined) {
      return {
        allowed: false,
        redirectTo: "/start/budget",
        reason: "Fyll i en ungefärlig budget innan tidplan.",
      };
    }
    return { allowed: true };
  }

  if (targetPath === "/start/sammanfattning") {
    if (!data.tidplan?.startFrom && !data.tidplan?.startTo) {
      return {
        allowed: false,
        redirectTo: "/start/tidplan",
        reason: "Sätt ett ungefärligt startfönster innan sammanfattning.",
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Hitta nästa steg i wizard
 */
export function getNextWizardStep(
  currentPath: WizardStepPath
): WizardStepPath | null {
  const currentIndex = WIZARD_STEP_ORDER.indexOf(currentPath);
  if (currentIndex === -1) return null;
  const nextIndex = currentIndex + 1;
  if (nextIndex >= WIZARD_STEP_ORDER.length) return null;
  return WIZARD_STEP_ORDER[nextIndex];
}

/**
 * Hitta föregående steg i wizard
 */
export function getPreviousWizardStep(
  currentPath: WizardStepPath
): WizardStepPath | null {
  const currentIndex = WIZARD_STEP_ORDER.indexOf(currentPath);
  if (currentIndex <= 0) return null;
  return WIZARD_STEP_ORDER[currentIndex - 1];
}

/**
 * Navigation hooks för wizard
 */
export function useWizardNavigation() {
  const { navigate } = useSmoothNavigation();

  const goToNextStep = useCallback(
    (currentPath: WizardStepPath) => {
      const next = getNextWizardStep(currentPath);
      if (next) navigate(next);
    },
    [navigate]
  );

  const goToPreviousStep = useCallback(
    (currentPath: WizardStepPath) => {
      const prev = getPreviousWizardStep(currentPath);
      if (prev) navigate(prev);
    },
    [navigate]
  );

  const goToStep = useCallback(
    (path: WizardStepPath) => {
      navigate(path);
    },
    [navigate]
  );

  return {
    goToNextStep,
    goToPreviousStep,
    goToStep,
  };
}

/**
 * Exit wizard med bekräftelse
 */
export function useWizardExit() {
  const router = useRouter();

  const exit = useCallback(
    (hasUnsavedChanges = false) => {
      if (hasUnsavedChanges) {
        const confirmExit = window.confirm(
          "Du har osparade ändringar. Är du säker på att du vill avsluta?"
        );
        if (!confirmExit) return;
      }
      router.push("/");
    },
    [router]
  );

  return { exit };
}

/**
 * Routing Utilities
 * 
 * Hanterar smooth transitions och wizard state vid navigation
 */

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Smooth navigation med fade effect
 */
export function useSmoothNavigation() {
  const router = useRouter();

  const navigate = useCallback((path: string, delay = 300) => {
    // Fade out
    if (typeof document !== 'undefined') {
      document.body.style.opacity = "0";
      document.body.style.transition = "opacity 300ms ease-out";
    }

    // Navigate after fade
    setTimeout(() => {
      router.push(path);
      
      // Fade in på nästa sida (hanteras av layout)
      if (typeof document !== 'undefined') {
        setTimeout(() => {
          document.body.style.opacity = "1";
        }, 50);
      }
    }, delay);
  }, [router]);

  return { navigate };
}

/**
 * Route guards - kontrollera om användare kan komma åt sida
 */
export function canAccessWizardStep(
  targetPath: string,
  completedSteps: string[] = [],
  currentProjectType: string | null
): { allowed: boolean; redirectTo?: string; reason?: string } {
  // Exempel på logik:
  
  // Måste välja projekttyp först
  if (targetPath.includes('/underlag') && !currentProjectType) {
    return {
      allowed: false,
      redirectTo: '/start',
      reason: 'Du måste välja projekttyp först'
    };
  }

  // Kan alltid gå bakåt till tidigare steg
  if (completedSteps.includes(targetPath)) {
    return { allowed: true };
  }

  // Kan gå till nästa steg
  return { allowed: true };
}

/**
 * Routing-regler per roll
 */
export const ROLE_ROUTES = {
  privat: {
    landing: '/privatperson',
    wizard: '/start',
    dashboard: '/projekt', // Framtida
  },
  brf: {
    landing: '/brf',
    wizard: '/brf/start', // Framtida BRF-specific wizard
    dashboard: '/brf/atgarder',
  },
  entreprenor: {
    landing: '/entreprenor',
    wizard: null, // Entreprenörer har ingen wizard
    dashboard: '/entreprenor/projekt',
  },
  osaker: {
    landing: '/start', // Går direkt till wizard
    wizard: '/start',
    dashboard: null,
  },
} as const;

/**
 * Hämta rätt route baserat på roll
 */
export function getRoleRoute(
  role: keyof typeof ROLE_ROUTES,
  type: 'landing' | 'wizard' | 'dashboard'
): string | null {
  return ROLE_ROUTES[role]?.[type] ?? null;
}

/**
 * Wizard step order och validering
 */
export const WIZARD_STEP_ORDER = [
  '/start',
  '/start/nulage',
  // Dynamiska steg baserat på projekttyp:
  // - /start/renovering (om renovering)
  // - /start/tillbyggnad (om tillbyggnad)  
  // - /start/nybyggnation (om nybyggnation)
  '/start/beskrivning',
  '/start/underlag',
  '/start/omfattning',
  '/start/budget',
  '/start/tidplan',
  '/start/sammanfattning',
] as const;

export type WizardStepPath = (typeof WIZARD_STEP_ORDER)[number];

/**
 * Hitta nästa steg i wizard
 */
export function getNextWizardStep(
  currentPath: WizardStepPath,
  _projectType: string | null
): string | null {
  const currentIndex = WIZARD_STEP_ORDER.indexOf(currentPath);
  if (currentIndex === -1) return null;

  // Enkel logik - kan utökas med projekttyp-specifika regler
  const nextIndex = currentIndex + 1;
  if (nextIndex >= WIZARD_STEP_ORDER.length) return null;

  return WIZARD_STEP_ORDER[nextIndex];
}

/**
 * Hitta föregående steg i wizard
 */
export function getPreviousWizardStep(
  currentPath: WizardStepPath
): string | null {
  const currentIndex = WIZARD_STEP_ORDER.indexOf(currentPath);
  if (currentIndex <= 0) return null;

  return WIZARD_STEP_ORDER[currentIndex - 1];
}

/**
 * Navigation hooks för wizard
 */
export function useWizardNavigation() {
  const { navigate } = useSmoothNavigation();

  const goToNextStep = useCallback((currentPath: string, projectType: string | null) => {
    const next = getNextWizardStep(currentPath, projectType);
    if (next) {
      navigate(next);
    }
  }, [navigate]);

  const goToPreviousStep = useCallback((currentPath: string) => {
    const prev = getPreviousWizardStep(currentPath);
    if (prev) {
      navigate(prev);
    }
  }, [navigate]);

  const goToStep = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return {
    goToNextStep,
    goToPreviousStep,
    goToStep,
  };
}

/**
 * Exit wizard med bekräftelse
 */
export function useWizardExit() {
  const router = useRouter();

  const exit = useCallback((hasUnsavedChanges = false) => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        'Du har osparade ändringar. Är du säker på att du vill avsluta?'
      );
      if (!confirm) return;
    }

    // Fade och navigera till start
    if (typeof document !== 'undefined') {
      document.body.style.opacity = "0";
      document.body.style.transition = "opacity 300ms ease-out";
    }

    setTimeout(() => {
      router.push('/');
    }, 300);
  }, [router]);

  return { exit };
}