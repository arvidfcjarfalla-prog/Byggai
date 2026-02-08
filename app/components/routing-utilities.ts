"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Routing Utilities
 *
 * Hanterar wizard-nav och enklare route guards för startflödet.
 */

export type ProjectType = "renovering" | "tillbyggnad" | "nybyggnation" | "annat" | null;

const BASE_STEP_ORDER = [
  "/start",
  "/start/nulage",
] as const;

const COMMON_END_STEPS = [
  "/start/beskrivning",
  "/start/underlag",
  "/start/omfattning",
  "/start/budget",
  "/start/tidplan",
  "/start/sammanfattning",
] as const;

export type WizardStepPath =
  | (typeof BASE_STEP_ORDER)[number]
  | "/start/renovering"
  | "/start/tillbyggnad"
  | "/start/nybyggnation"
  | (typeof COMMON_END_STEPS)[number];

function getProjectSpecificStep(projectType: ProjectType): WizardStepPath | null {
  if (projectType === "renovering") return "/start/renovering";
  if (projectType === "tillbyggnad") return "/start/tillbyggnad";
  if (projectType === "nybyggnation") return "/start/nybyggnation";
  return null;
}

function getWizardStepOrder(projectType: ProjectType): WizardStepPath[] {
  const order: WizardStepPath[] = [...BASE_STEP_ORDER];
  const projectSpecificStep = getProjectSpecificStep(projectType);
  if (projectSpecificStep) {
    order.push(projectSpecificStep);
  }

  if (projectType) {
    order.push(...COMMON_END_STEPS);
  }

  return order;
}

/**
 * Smooth navigation med enkel fade-out på body innan route push.
 */
export function useSmoothNavigation() {
  const router = useRouter();

  const navigate = useCallback(
    (path: string, delay = 200) => {
      window.setTimeout(() => {
        router.push(path);
      }, delay);
    },
    [router]
  );

  return { navigate };
}

/**
 * Route guards för wizard med lättviktig validering.
 */
export function canAccessWizardStep(
  targetPath: string,
  completedSteps: string[] = [],
  currentProjectType: ProjectType
): { allowed: boolean; redirectTo?: string; reason?: string } {
  const projectType = currentProjectType;

  if (targetPath === "/start") return { allowed: true };

  if (!projectType && targetPath !== "/start/nulage") {
    return {
      allowed: false,
      redirectTo: "/start",
      reason: "Du måste välja projekttyp först.",
    };
  }

  const projectStep = getProjectSpecificStep(projectType);
  if (
    targetPath === "/start/renovering" ||
    targetPath === "/start/tillbyggnad" ||
    targetPath === "/start/nybyggnation"
  ) {
    if (!projectStep || targetPath !== projectStep) {
      return {
        allowed: false,
        redirectTo: "/start",
        reason: "Det här steget matchar inte vald projekttyp.",
      };
    }
    return { allowed: true };
  }

  if (completedSteps.includes(targetPath)) {
    return { allowed: true };
  }

  const order = getWizardStepOrder(projectType);
  const targetIndex = order.indexOf(targetPath as WizardStepPath);
  if (targetIndex <= 0) return { allowed: true };

  const previousPath = order[targetIndex - 1];
  if (!completedSteps.includes(previousPath)) {
    return {
      allowed: false,
      redirectTo: previousPath,
      reason: "Slutför föregående steg först.",
    };
  }

  return { allowed: true };
}

/**
 * Routing-regler per roll.
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
 * Hitta nästa steg i wizard.
 */
export function getNextWizardStep(
  currentPath: string,
  projectType: ProjectType
): WizardStepPath | null {
  const order = getWizardStepOrder(projectType);
  const currentIndex = order.indexOf(currentPath as WizardStepPath);
  if (currentIndex === -1) return null;
  const nextIndex = currentIndex + 1;
  if (nextIndex >= order.length) return null;
  return order[nextIndex];
}

/**
 * Hitta föregående steg i wizard.
 */
export function getPreviousWizardStep(
  currentPath: string,
  projectType: ProjectType
): WizardStepPath | null {
  const order = getWizardStepOrder(projectType);
  const currentIndex = order.indexOf(currentPath as WizardStepPath);
  if (currentIndex <= 0) return null;
  return order[currentIndex - 1];
}

/**
 * Navigation hooks för wizard.
 */
export function useWizardNavigation() {
  const { navigate } = useSmoothNavigation();

  const goToNextStep = useCallback(
    (currentPath: string, projectType: ProjectType) => {
      const next = getNextWizardStep(currentPath, projectType);
      if (next) {
        navigate(next);
      }
    },
    [navigate]
  );

  const goToPreviousStep = useCallback(
    (currentPath: string, projectType: ProjectType) => {
      const prev = getPreviousWizardStep(currentPath, projectType);
      if (prev) {
        navigate(prev);
      }
    },
    [navigate]
  );

  const goToStep = useCallback(
    (path: string) => {
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
 * Exit wizard med bekräftelse.
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
