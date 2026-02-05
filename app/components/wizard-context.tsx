"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ProjectType =
  | "renovering"
  | "tillbyggnad"
  | "nybyggnation"
  | "annat"
  | null;

export type CurrentPhase = "ide" | "skiss" | "ritningar" | "fardigt" | null;

export interface RenoveringRooms {
  badrum?: boolean;
  kok?: boolean;
  vardagsrum?: boolean;
  sovrum?: boolean;
  hall?: boolean;
  tvattrum?: boolean;
  kontor?: boolean;
  annat?: boolean;
}

export interface TillbyggnadData {
  storlek?: string;
  typ?: string;
  befintlig?: string;
}

export interface NybyggnationData {
  harTomt?: boolean;
  detaljplan?: string;
  bygglov?: string;
}

export type FileTag = "ritning" | "foto" | "bygghandling" | "ovrigt";

export interface FileDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  tags: FileTag[];
}

export interface BudgetData {
  intervalMin?: number;
  intervalMax?: number;
  isHard?: boolean;
  financing?: "egen" | "bank" | "osaker";
}

export interface TidplanData {
  startFrom?: string; // ISO date
  startTo?: string;
  executionPace?: "snabb" | "normal" | "kan_vanta";
  blockedWeeks?: string[]; // e.g. ["2026-W10", "2026-W11"]
}

export type RiskLevel = "green" | "yellow" | "red";

export interface RiskProfile {
  level: RiskLevel;
  reasons: string[];
  recommendedNextSteps: string[];
}

export interface Collaborator {
  email: string;
  role: "owner" | "read" | "edit";
}

export interface WizardData {
  projectType: ProjectType;
  currentPhase: CurrentPhase;
  renovering?: RenoveringRooms;
  tillbyggnad?: TillbyggnadData;
  nybyggnation?: NybyggnationData;
  omfattning?: string;
  omfattningScope?: Record<string, boolean | string>; // type-specific scope answers
  budget?: BudgetData;
  tidplan?: TidplanData;
  mal?: string;
  files?: FileDoc[];
  riskProfile?: RiskProfile;
  collaborators?: Collaborator[];
  quoteDraft?: { createdAt: string; summary?: string };
  decisionLog?: Array<{ at: string; what: string }>;
}

interface WizardContextType {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  resetWizard: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
  stepConfig: { label: string; path: string }[];
  calculateProgress: () => number;
  addFile: (file: FileDoc) => void;
  removeFile: (id: string) => void;
  updateFileTags: (id: string, tags: FileTag[]) => void;
  computeRiskProfile: (data: WizardData) => RiskProfile;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

const STORAGE_KEY = "byggplattformen-wizard";

const initialData: WizardData = {
  projectType: null,
  currentPhase: null,
};

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Step config per project type (order of wizard pages). */
function getStepConfig(projectType: ProjectType): { label: string; path: string }[] {
  const base = [
    { label: "Projekttyp", path: "/start" },
    { label: "Nuläge", path: "/start/nulage" },
  ];
  if (projectType === "renovering") {
    base.push({ label: "Renovering", path: "/start/renovering" });
  } else if (projectType === "tillbyggnad") {
    base.push({ label: "Tillbyggnad", path: "/start/tillbyggnad" });
  } else if (projectType === "nybyggnation") {
    base.push({ label: "Nybyggnation", path: "/start/nybyggnation" });
  } else if (projectType === "annat") {
    base.push(
      { label: "Underlag", path: "/start/underlag" },
      { label: "Omfattning", path: "/start/omfattning" },
      { label: "Budget", path: "/start/budget" },
      { label: "Tidplan", path: "/start/tidplan" },
      { label: "Sammanfattning", path: "/start/sammanfattning" }
    );
  }
  if (projectType && projectType !== "annat") {
    base.push(
      { label: "Underlag", path: "/start/underlag" },
      { label: "Omfattning", path: "/start/omfattning" },
      { label: "Budget", path: "/start/budget" },
      { label: "Tidplan", path: "/start/tidplan" },
      { label: "Sammanfattning", path: "/start/sammanfattning" }
    );
  }
  return base;
}

/** Compute risk profile from wizard data (transparent, neutral). */
export function computeRiskProfile(data: WizardData): RiskProfile {
  const reasons: string[] = [];
  const recommendedNextSteps: string[] = [];

  if (data.projectType === "nybyggnation") {
    if (data.nybyggnation?.harTomt === false) {
      reasons.push("Ingen tomt ännu – påverkar tidplan och val av lösning.");
      recommendedNextSteps.push("Kontrollera planbestämmelser för tänkta tomter.");
    }
    if (data.nybyggnation?.detaljplan === "nej" || data.nybyggnation?.detaljplan === "vet-ej") {
      reasons.push("Detaljplan oklar eller saknas – kan innebära längre utredning.");
      recommendedNextSteps.push("Kontakta kommunen för detaljplansförhållanden.");
    }
    if (data.nybyggnation?.bygglov === "nej") {
      reasons.push("Bygglov inte sökt – vanligt steg innan upphandling.");
      recommendedNextSteps.push("Få ritningar klara innan bygglovsansökan.");
    }
  }

  if (data.projectType === "tillbyggnad") {
    const storlek = data.tillbyggnad?.storlek;
    if (storlek === "over-50") {
      reasons.push("Större tillbyggnad – bygglov oftast nödvändigt.");
      recommendedNextSteps.push("Kontrollera grannpåverkan och bygglovskrav.");
    }
  }

  if (data.projectType === "renovering" && data.renovering) {
    const hasBadrum = data.renovering.badrum;
    const hasKok = data.renovering.kok;
    if (hasBadrum || hasKok) {
      reasons.push("Våtrum inkluderat – kräver fuktsäker stomme och ofta tillstånd.");
      recommendedNextSteps.push("Kontrollera befintliga installationer och eventuellt asbest.");
    }
  }

  if (data.budget?.intervalMax && data.budget.intervalMin) {
    const range = data.budget.intervalMax - data.budget.intervalMin;
    if (range > 500) {
      reasons.push("Stort budgetspann – överväg att precisera för bättre offerter.");
    }
  }

  if (!data.currentPhase || data.currentPhase === "ide") {
    reasons.push("Tidigt skede – underlag och omfattning kan ändras.");
    recommendedNextSteps.push("Samla skisser eller mått innan du bjuder in entreprenörer.");
  }

  if (reasons.length === 0) {
    return {
      level: "green",
      reasons: ["Inga särskilda risker identifierade utifrån dina svar."],
      recommendedNextSteps: recommendedNextSteps.length
        ? recommendedNextSteps
        : ["Granska sammanfattningen och nästa steg innan du delar med andra."],
    };
  }
  if (reasons.length >= 3) {
    return { level: "red", reasons, recommendedNextSteps };
  }
  return { level: "yellow", reasons, recommendedNextSteps };
}

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<WizardData>(initialData);
  const [currentStep, setCurrentStep] = useState(1);

  const stepConfig = useMemo(
    () => getStepConfig(data.projectType),
    [data.projectType]
  );
  const totalSteps = stepConfig.length;

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!saved) return;

    const parsed = safeParse(saved);
    if (!parsed || typeof parsed !== "object") return;

    const restored = parsed as WizardData;
    setData({ ...initialData, ...restored });

    const config = getStepConfig(restored.projectType);
    let step = 1;
    if (restored.projectType) step = 2;
    if (restored.currentPhase) step = 3;
    if (restored.renovering || restored.tillbyggnad || restored.nybyggnation) step = 4;
    if (restored.files !== undefined) step = Math.max(step, 5);
    if (restored.omfattning) step = Math.max(step, 6);
    if (restored.budget?.intervalMin !== undefined) step = Math.max(step, 7);
    if (restored.tidplan?.startFrom) step = Math.max(step, 8);
    setCurrentStep(Math.min(step, config.length || 1));
  }, []);

  useEffect(() => {
    if (!data.projectType) return;
    const id = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 300);
    return () => window.clearTimeout(id);
  }, [data]);

  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => {
      const next: WizardData = { ...prev, ...updates };
      if (updates.renovering) {
        next.renovering = { ...(prev.renovering ?? {}), ...updates.renovering };
      }
      if (updates.tillbyggnad) {
        next.tillbyggnad = { ...(prev.tillbyggnad ?? {}), ...updates.tillbyggnad };
      }
      if (updates.nybyggnation) {
        next.nybyggnation = { ...(prev.nybyggnation ?? {}), ...updates.nybyggnation };
      }
      if (updates.budget) {
        next.budget = { ...(prev.budget ?? {}), ...updates.budget };
      }
      if (updates.tidplan) {
        next.tidplan = { ...(prev.tidplan ?? {}), ...updates.tidplan };
      }
      if (updates.omfattningScope) {
        next.omfattningScope = { ...(prev.omfattningScope ?? {}), ...updates.omfattningScope };
      }
      return next;
    });
  }, []);

  const resetWizard = useCallback(() => {
    setData(initialData);
    setCurrentStep(1);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  const addFile = useCallback((file: FileDoc) => {
    setData((prev) => ({
      ...prev,
      files: [...(prev.files ?? []), file],
    }));
  }, []);

  const removeFile = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      files: (prev.files ?? []).filter((f) => f.id !== id),
    }));
  }, []);

  const updateFileTags = useCallback((id: string, tags: FileTag[]) => {
    setData((prev) => ({
      ...prev,
      files: (prev.files ?? []).map((f) =>
        f.id === id ? { ...f, tags } : f
      ),
    }));
  }, []);

  const calculateProgress = useCallback(() => {
    let completed = 0;
    if (data.projectType) completed++;
    if (data.currentPhase) completed++;
    if (data.projectType === "renovering" && data.renovering) completed++;
    if (data.projectType === "tillbyggnad" && data.tillbyggnad?.storlek) completed++;
    if (data.projectType === "nybyggnation" && data.nybyggnation?.harTomt !== undefined) completed++;
    if (data.projectType === "annat") completed++;
    if (data.omfattning) completed++;
    if (data.budget?.intervalMin !== undefined) completed++;
    if (data.tidplan?.startFrom) completed++;
    const denom = Math.max(1, totalSteps);
    return Math.round((completed / denom) * 100);
  }, [data, totalSteps]);

  const computeRiskProfileCb = useCallback((d: WizardData) => computeRiskProfile(d), []);

  const value: WizardContextType = useMemo(
    () => ({
      data,
      updateData,
      resetWizard,
      currentStep,
      setCurrentStep,
      totalSteps,
      stepConfig,
      calculateProgress,
      addFile,
      removeFile,
      updateFileTags,
      computeRiskProfile: computeRiskProfileCb,
    }),
    [
      data,
      updateData,
      resetWizard,
      currentStep,
      setCurrentStep,
      totalSteps,
      stepConfig,
      calculateProgress,
      addFile,
      removeFile,
      updateFileTags,
      computeRiskProfileCb,
    ]
  );

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context)
    throw new Error("useWizard must be used within WizardProvider");
  return context;
}
