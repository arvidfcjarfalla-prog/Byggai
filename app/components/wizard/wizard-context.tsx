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

export type FileTag = "ritning" | "foto" | "bygghandling" | "detaljplan" | "inspiration" | "ovrigt";

export type RelatesTo = "kök" | "badrum" | "fasad" | "mark" | "tak" | "el" | "vvs" | "övrigt";

export interface FileDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  tags: FileTag[];
  relatesTo?: RelatesTo;
  uploadedAt: string; // ISO timestamp
  aiAnalysis?: {
    detectedContent?: string[]; // ["ritning av kök", "skala 1:50"]
    suggestedTags?: FileTag[];
    suggestedRelatesTo?: RelatesTo;
    confidence?: number; // 0-1
  };
}

export interface BudgetData {
  intervalMin?: number;
  intervalMax?: number;
  isHard?: boolean;
  financing?: "egen" | "bank" | "osaker";
  budgetAcknowledged?: boolean;
}

export interface TidplanData {
  startFrom?: string; // ISO date
  startTo?: string;
  executionPace?: "snabb" | "normal" | "kan_vanta";
  blockedWeeks?: string[]; // e.g. ["2026-W10", "2026-W11"]
  startWindowFlexible?: boolean;
}

export type RiskLevel = "green" | "yellow" | "red";

export interface RiskProfile {
  level: RiskLevel;
  reasons: string[];
  recommendedNextSteps: string[];
}

/** AI/entreprenör-vänlig sammanfattning */
export interface ProjectBrief {
  shortSummary: string;
  scopeBullets: string[];
  assumptions: string[];
  openQuestions: string[];
  riskProfile: RiskProfile;
}

export interface Collaborator {
  email: string;
  role: "owner" | "read" | "edit";
}

/** Heuristic-derived summary from free text (no AI) */
export interface DerivedSummary {
  goal?: string;
  scope?: string;
  flags?: string[];
  extractedRooms?: string[];
}

/** AI-analys av projekt (mock för nu, verklig API senare) */
export interface AIAnalysis {
  timestamp: string;
  summary: string;
  detectedRisks: string[];
  suggestedNextSteps: string[];
  completeness: number; // 0-100
  confidence: number; // 0-1
}

/** Offert draft - förberett för framtida offertmatchning */
export interface QuoteDraft {
  id: string;
  createdAt: string;
  status: "draft" | "pending" | "sent" | "received";
  projectSnapshot: Partial<WizardData>; // Snapshot när offert skapades
  aiSummary?: string; // AI-genererad sammanfattning för entreprenörer
  sharedWith?: string[]; // Entreprenör-IDs (framtida)
  metadata?: {
    estimatedValue?: number;
    complexity?: "low" | "medium" | "high";
    matchScore?: number; // För entreprenör-matchning
  };
}

export type UserRole = "privat" | "brf" | "entreprenor" | "osaker";

export interface WizardData {
  userRole?: UserRole;
  projectType: ProjectType;
  currentPhase: CurrentPhase;
  renovering?: RenoveringRooms;
  tillbyggnad?: TillbyggnadData;
  nybyggnation?: NybyggnationData;
  freeTextDescription?: string;
  derivedSummary?: DerivedSummary;
  aiAnalysis?: AIAnalysis; // NYT: AI-analys av projektet
  omfattning?: string;
  omfattningScope?: Record<string, boolean | string>;
  budget?: BudgetData;
  tidplan?: TidplanData;
  mal?: string;
  files?: FileDoc[];
  riskProfile?: RiskProfile;
  collaborators?: Collaborator[];
  quoteDraft?: QuoteDraft; // NYT: Uppdaterad quote draft
  decisionLog?: Array<{ at: string; what: string }>;
  
  // NYT: Resume-funktionalitet
  resumePoint?: string; // Path där användaren var senast
  completedSteps?: string[]; // Paths till färdiga steg
  lastUpdated?: string; // ISO timestamp
}

interface WizardContextType {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  resetWizard: () => void;
  softReset: () => void; // NYT: Behåller data men återställer steg
  currentStep: number;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
  stepConfig: { label: string; path: string }[];
  calculateProgress: () => number;
  projectBrief: ProjectBrief;
  
  // Fil-hantering
  addFile: (file: FileDoc) => void;
  removeFile: (id: string) => void;
  updateFileTags: (id: string, tags: FileTag[]) => void;
  updateFileRelatesTo: (id: string, relatesTo: RelatesTo | undefined) => void;
  
  // Roll-hantering
  setRole: (role: UserRole) => void;
  
  // AI & Analys
  deriveSummaryFromText: (text: string, projectType: ProjectType) => DerivedSummary;
  computeRiskProfile: (data: WizardData) => RiskProfile;
  requestAIAnalysis: () => Promise<void>; // NYT: Trigger AI-analys
  
  // Quote draft
  createQuoteDraft: () => QuoteDraft; // NYT: Skapa offert draft
  updateQuoteDraft: (updates: Partial<QuoteDraft>) => void; // NYT
  
  // Resume
  canResume: boolean; // NYT: Om användaren kan återuppta
  getResumePoint: () => string | null; // NYT: Hämta resume path
  markStepCompleted: (path: string) => void; // NYT: Markera steg som klart
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

const STORAGE_KEY = "byggplattformen-wizard";
const ROLE_STORAGE_KEY = "byggplattformen-role";

const initialData: WizardData = {
  projectType: null,
  currentPhase: null,
  completedSteps: [],
};

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Step config per project type */
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
  }
  
  if (projectType) {
    base.push({ label: "Beskrivning", path: "/start/beskrivning" });
  }
  
  if (projectType === "annat") {
    base.push(
      { label: "Underlag", path: "/start/underlag" },
      { label: "Omfattning", path: "/start/omfattning" },
      { label: "Budget", path: "/start/budget" },
      { label: "Tidplan", path: "/start/tidplan" },
      { label: "Sammanfattning", path: "/start/sammanfattning" }
    );
  } else if (projectType) {
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

/** Heuristic derivation from free text */
export function deriveSummaryFromText(
  text: string,
  projectType: ProjectType
): DerivedSummary {
  void projectType;
  const t = text.toLowerCase();
  const flags: string[] = [];
  const riskWords = [
    "badrum",
    "bärande vägg",
    "bärande",
    "fukt",
    "el",
    "vvs",
    "asbest",
    "tak",
    "grund",
  ];
  
  riskWords.forEach((w) => {
    if (t.includes(w)) flags.push(w);
  });
  
  const rooms: string[] = [];
  ["kök", "badrum", "vardagsrum", "sovrum", "hall", "tvättrum", "kontor"].forEach((r) => {
    if (t.includes(r)) rooms.push(r);
  });
  
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const goal = sentences[0]?.slice(0, 120) || undefined;
  const scope = sentences.length > 1 ? sentences.slice(1).join(". ").slice(0, 200) : undefined;
  
  return {
    goal,
    scope,
    flags: flags.length ? flags : undefined,
    extractedRooms: rooms.length ? rooms : undefined
  };
}

/** Compute risk profile */
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

/** Generate project brief */
function getProjectBrief(data: WizardData): ProjectBrief {
  const riskProfile = computeRiskProfile(data);
  const scopeBullets: string[] = [];
  const assumptions: string[] = [];
  const openQuestions: string[] = [];

  if (data.freeTextDescription) {
    scopeBullets.push(`Fritext: ${data.freeTextDescription.slice(0, 100)}...`);
  }
  if (data.derivedSummary?.goal) {
    scopeBullets.push(`Mål: ${data.derivedSummary.goal}`);
  }
  if (data.derivedSummary?.extractedRooms?.length) {
    scopeBullets.push(`Rum: ${data.derivedSummary.extractedRooms.join(", ")}`);
  }

  if (data.projectType === "renovering" && data.renovering) {
    const rooms = Object.entries(data.renovering)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (rooms.length) scopeBullets.push(`Renovering: ${rooms.join(", ")}`);
  }
  if (data.projectType === "tillbyggnad" && data.tillbyggnad) {
    if (data.tillbyggnad.storlek) scopeBullets.push(`Storlek: ${data.tillbyggnad.storlek}`);
    if (data.tillbyggnad.typ) scopeBullets.push(`Typ: ${data.tillbyggnad.typ}`);
  }
  if (data.projectType === "nybyggnation" && data.nybyggnation) {
    if (data.nybyggnation.harTomt !== undefined) {
      scopeBullets.push(data.nybyggnation.harTomt ? "Tomt: ja" : "Tomt: nej");
    }
    if (data.nybyggnation.detaljplan) scopeBullets.push(`Detaljplan: ${data.nybyggnation.detaljplan}`);
    if (data.nybyggnation.bygglov) scopeBullets.push(`Bygglov: ${data.nybyggnation.bygglov}`);
  }

  if (data.omfattning) scopeBullets.push(`Omfattning: ${data.omfattning}`);

  if (data.budget?.intervalMin !== undefined || data.budget?.intervalMax !== undefined) {
    const min = data.budget.intervalMin ?? "?";
    const max = data.budget.intervalMax ?? "?";
    scopeBullets.push(`Budget (tkr): ${min}–${max}`);
    if (data.budget.budgetAcknowledged) {
      assumptions.push("Användaren vill fortsätta trots budgetvarning.");
    }
  }
  
  if (data.tidplan?.startFrom || data.tidplan?.startTo) {
    scopeBullets.push(`Start: ${data.tidplan.startFrom ?? "?"}–${data.tidplan.startTo ?? "?"}`);
    if (data.tidplan.startWindowFlexible !== undefined) {
      assumptions.push(`Start-fönster flexibelt: ${data.tidplan.startWindowFlexible ? "ja" : "nej"}`);
    }
  }
  
  if (data.tidplan?.executionPace) {
    scopeBullets.push(`Tempo: ${data.tidplan.executionPace}`);
  }

  if (!data.projectType) openQuestions.push("Vilken typ av projekt (renovering/tillbyggnad/nybyggnation/annat)?");
  if (!data.currentPhase) openQuestions.push("Vilket nuläge har projektet (idé/skiss/ritningar/färdigt)?");
  if (data.projectType === "renovering" && !data.renovering) openQuestions.push("Vilka rum berörs?");
  if (data.projectType === "tillbyggnad" && !data.tillbyggnad?.storlek) openQuestions.push("Ungefärlig storlek på tillbyggnaden?");
  if (data.projectType === "nybyggnation" && data.nybyggnation?.harTomt === undefined) openQuestions.push("Har du tomt och eventuellt detaljplan/bygglov?");
  if (!data.omfattning) openQuestions.push("Kort beskrivning av omfattning.");
  if (data.budget?.intervalMin === undefined && data.budget?.intervalMax === undefined) openQuestions.push("Budgetspann (min–max)?");
  if (!data.tidplan?.startFrom && !data.tidplan?.startTo) openQuestions.push("Önskat startfönster?");

  const parts: string[] = [];
  if (data.projectType) parts.push(data.projectType);
  if (data.currentPhase) parts.push(`nuläge ${data.currentPhase}`);
  if (data.omfattning) parts.push(data.omfattning);
  
  const shortSummary =
    parts.length > 0
      ? `Projekt: ${parts.join(", ")}. ${scopeBullets.length ? "Scope: " + scopeBullets.slice(0, 3).join("; ") + "." : ""}`
      : "Ingen projektinfo ifylld än.";

  return {
    shortSummary,
    scopeBullets,
    assumptions,
    openQuestions,
    riskProfile,
  };
}

function getResumeStep(restored: WizardData): number {
  const config = getStepConfig(restored.projectType);
  let step = 1;
  if (restored.projectType) step = 2;
  if (restored.currentPhase) step = 3;
  if (restored.renovering || restored.tillbyggnad || restored.nybyggnation) step = 4;
  if (restored.freeTextDescription) step = Math.max(step, 4);
  if (restored.files !== undefined && (restored.files?.length ?? 0) > 0) step = Math.max(step, 5);
  if (restored.omfattning) step = Math.max(step, 6);
  if (restored.budget?.intervalMin !== undefined) step = Math.max(step, 7);
  if (restored.tidplan?.startFrom) step = Math.max(step, 8);
  return Math.min(step, config.length || 1);
}

function getInitialWizardState(): { data: WizardData; currentStep: number } {
  if (typeof window === "undefined") {
    return { data: initialData, currentStep: 1 };
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { data: initialData, currentStep: 1 };
  }

  const parsed = safeParse(saved);
  if (!parsed || typeof parsed !== "object") {
    return { data: initialData, currentStep: 1 };
  }

  const restored = parsed as WizardData;
  let role = restored.userRole;
  const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
  if (storedRole && ["privat", "brf", "entreprenor", "osaker"].includes(storedRole)) {
    role = storedRole as UserRole;
  }

  return {
    data: { ...initialData, ...restored, userRole: role ?? restored.userRole },
    currentStep: getResumeStep(restored),
  };
}

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [initialWizardState] = useState(getInitialWizardState);
  const [data, setData] = useState<WizardData>(initialWizardState.data);
  const [currentStep, setCurrentStep] = useState(initialWizardState.currentStep);

  const stepConfig = useMemo(
    () => getStepConfig(data.projectType),
    [data.projectType]
  );
  const totalSteps = stepConfig.length;

  // Auto-save to localStorage
  useEffect(() => {
    if (!data.projectType) return;
    
    const id = window.setTimeout(() => {
      const dataToSave = {
        ...data,
        lastUpdated: new Date().toISOString(),
        resumePoint: stepConfig[currentStep - 1]?.path,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, 300);
    
    return () => window.clearTimeout(id);
  }, [data, currentStep, stepConfig]);

  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => {
      const next: WizardData = { ...prev, ...updates };
      
      // Nested object merging
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
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const softReset = useCallback(() => {
    // Behåller data men återställer steg
    setCurrentStep(1);
    setData((prev) => ({
      ...prev,
      resumePoint: undefined,
      completedSteps: [],
    }));
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

  const updateFileRelatesTo = useCallback((id: string, relatesTo: RelatesTo | undefined) => {
    setData((prev) => ({
      ...prev,
      files: (prev.files ?? []).map((f) =>
        f.id === id ? { ...f, relatesTo } : f
      ),
    }));
  }, []);

  const setRole = useCallback((role: UserRole) => {
    setData((prev) => ({ ...prev, userRole: role }));
    if (typeof window !== "undefined") {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    }
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

  // AI Analysis (mock for now, can be replaced with real API)
  const requestAIAnalysis = useCallback(async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const analysis: AIAnalysis = {
      timestamp: new Date().toISOString(),
      summary: `Projekt: ${data.projectType || "okänd typ"}. ${data.omfattning ? data.omfattning.slice(0, 100) : "Ingen omfattning angiven."}`,
      detectedRisks: data.riskProfile?.reasons || [],
      suggestedNextSteps: data.riskProfile?.recommendedNextSteps || ["Fortsätt fylla i wizard"],
      completeness: calculateProgress(),
      confidence: 0.85,
    };
    
    setData((prev) => ({ ...prev, aiAnalysis: analysis }));
  }, [data, calculateProgress]);

  const projectBrief = useMemo(() => getProjectBrief(data), [data]);

  // Quote Draft
  const createQuoteDraft = useCallback((): QuoteDraft => {
    const draft: QuoteDraft = {
      id: `quote-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "draft",
      projectSnapshot: { ...data },
      aiSummary: projectBrief.shortSummary,
      metadata: {
        complexity: data.riskProfile?.level === "red" ? "high" : 
                   data.riskProfile?.level === "yellow" ? "medium" : "low",
        estimatedValue: data.budget?.intervalMax,
      },
    };
    
    setData((prev) => ({ ...prev, quoteDraft: draft }));
    return draft;
  }, [data, projectBrief]);

  const updateQuoteDraft = useCallback((updates: Partial<QuoteDraft>) => {
    setData((prev) => ({
      ...prev,
      quoteDraft: prev.quoteDraft ? { ...prev.quoteDraft, ...updates } : undefined,
    }));
  }, []);

  // Resume functionality
  const canResume = useMemo(() => {
    return !!(data.resumePoint && data.projectType);
  }, [data.resumePoint, data.projectType]);

  const getResumePoint = useCallback(() => {
    return data.resumePoint || null;
  }, [data.resumePoint]);

  const markStepCompleted = useCallback((path: string) => {
    setData((prev) => ({
      ...prev,
      completedSteps: [...(prev.completedSteps || []), path].filter(
        (p, i, arr) => arr.indexOf(p) === i // Deduplicate
      ),
    }));
  }, []);

  const computeRiskProfileCb = useCallback((d: WizardData) => computeRiskProfile(d), []);
  const deriveSummaryFromTextCb = useCallback(
    (text: string, projectType: ProjectType) => deriveSummaryFromText(text, projectType),
    []
  );

  const value: WizardContextType = useMemo(
    () => ({
      data,
      updateData,
      resetWizard,
      softReset,
      currentStep,
      setCurrentStep,
      totalSteps,
      stepConfig,
      calculateProgress,
      projectBrief,
      addFile,
      removeFile,
      updateFileTags,
      updateFileRelatesTo,
      setRole,
      deriveSummaryFromText: deriveSummaryFromTextCb,
      computeRiskProfile: computeRiskProfileCb,
      requestAIAnalysis,
      createQuoteDraft,
      updateQuoteDraft,
      canResume,
      getResumePoint,
      markStepCompleted,
    }),
    [
      data,
      updateData,
      resetWizard,
      softReset,
      currentStep,
      setCurrentStep,
      totalSteps,
      stepConfig,
      calculateProgress,
      projectBrief,
      addFile,
      removeFile,
      updateFileTags,
      updateFileRelatesTo,
      setRole,
      deriveSummaryFromTextCb,
      computeRiskProfileCb,
      requestAIAnalysis,
      createQuoteDraft,
      updateQuoteDraft,
      canResume,
      getResumePoint,
      markStepCompleted,
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
