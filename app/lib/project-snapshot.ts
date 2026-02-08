import { computeRiskProfile, type WizardData } from "../components/wizard-context";
import { calculateCompleteness } from "./ai-utilities";

export type SnapshotAudience = "privat" | "brf";
export type SnapshotBudgetConfidence = "low" | "medium" | "high";
export type SnapshotFlexibility = "fixed" | "flexible";
export type SnapshotRiskLevel = "low" | "medium" | "high";

export interface ProjectSnapshotFile {
  id: string;
  name: string;
  type: string;
  size: number;
  tags: string[];
}

export interface ProjectSnapshotOverview {
  projectType: string;
  title: string;
  description: string;
  location?: string;
}

export interface ProjectSnapshotScope {
  selectedItems: string[];
  freeDescription?: string;
  projectSpecific: Record<string, string | number | boolean | string[]>;
}

export interface ProjectSnapshotBudget {
  min?: number;
  max?: number;
  confidence: SnapshotBudgetConfidence;
}

export interface ProjectSnapshotTimeline {
  desiredStartFrom?: string;
  desiredStartTo?: string;
  flexibility: SnapshotFlexibility;
  blockedWeeks?: string[];
}

export interface ProjectSnapshotRiskProfile {
  level: SnapshotRiskLevel;
  reasons: string[];
  recommendedNextSteps: string[];
}

export interface ProjectSnapshot {
  id: string;
  createdAt: string;
  audience: SnapshotAudience;
  overview: ProjectSnapshotOverview;
  scope: ProjectSnapshotScope;
  budget: ProjectSnapshotBudget;
  timeline: ProjectSnapshotTimeline;
  riskProfile: ProjectSnapshotRiskProfile;
  files: ProjectSnapshotFile[];
  completenessScore: number;
  lockedAt?: string;
}

export const PROJECT_SNAPSHOT_KEY = "byggplattformen-project-snapshot";
export const PROJECT_SNAPSHOT_UPDATED_EVENT = "byggplattformen-project-snapshot-updated";

export interface BrfSnapshotSeedAction {
  title: string;
  category?: string;
  status?: "Planerad" | "Eftersatt" | "Genomförd";
  plannedYear?: number;
  estimatedPriceSek?: number;
}

export interface BrfSnapshotSeedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  tags?: string[];
}

export interface BrfSnapshotSeed {
  title: string;
  location?: string;
  description?: string;
  actions: BrfSnapshotSeedAction[];
  files: BrfSnapshotSeedFile[];
  desiredStartFrom?: string;
  desiredStartTo?: string;
  projectSpecific?: Record<string, string | number | boolean | string[]>;
}

function normalizeProjectType(projectType: WizardData["projectType"]): string {
  if (!projectType) return "okänd";
  return projectType;
}

function clampTitle(text: string, maxLength = 72): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function prettifyRoomKey(key: string): string {
  if (key === "kok") return "kök";
  if (key === "tvattrum") return "tvättrum";
  return key;
}

function getSelectedScopeItems(data: WizardData): string[] {
  const selected: string[] = [];

  if (data.projectType === "renovering" && data.renovering) {
    const rooms = Object.entries(data.renovering)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([room]) => prettifyRoomKey(room));
    selected.push(...rooms);
  }

  if (data.omfattningScope) {
    const selectedScope = Object.entries(data.omfattningScope)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
    selected.push(...selectedScope);
  }

  if (data.projectType === "tillbyggnad" && data.tillbyggnad) {
    if (data.tillbyggnad.typ) selected.push(`typ:${data.tillbyggnad.typ}`);
    if (data.tillbyggnad.storlek) selected.push(`storlek:${data.tillbyggnad.storlek}`);
  }

  if (data.projectType === "nybyggnation" && data.nybyggnation) {
    if (data.nybyggnation.harTomt === true) selected.push("tomt:ja");
    if (data.nybyggnation.harTomt === false) selected.push("tomt:nej");
    if (data.nybyggnation.detaljplan) selected.push(`detaljplan:${data.nybyggnation.detaljplan}`);
    if (data.nybyggnation.bygglov) selected.push(`bygglov:${data.nybyggnation.bygglov}`);
  }

  return Array.from(new Set(selected));
}

function getProjectSpecificScope(data: WizardData): Record<string, string | number | boolean | string[]> {
  const details: Record<string, string | number | boolean | string[]> = {};

  if (data.projectType) details.projectType = data.projectType;
  if (data.currentPhase) details.currentPhase = data.currentPhase;

  if (data.tillbyggnad) {
    if (data.tillbyggnad.storlek) details.tillbyggnadStorlek = data.tillbyggnad.storlek;
    if (data.tillbyggnad.typ) details.tillbyggnadTyp = data.tillbyggnad.typ;
    if (data.tillbyggnad.befintlig) details.befintligAnslutning = data.tillbyggnad.befintlig;
  }

  if (data.nybyggnation) {
    if (typeof data.nybyggnation.harTomt === "boolean") {
      details.harTomt = data.nybyggnation.harTomt;
    }
    if (data.nybyggnation.detaljplan) details.detaljplan = data.nybyggnation.detaljplan;
    if (data.nybyggnation.bygglov) details.bygglov = data.nybyggnation.bygglov;
  }

  if (data.derivedSummary?.flags?.length) details.flags = data.derivedSummary.flags;
  if (data.derivedSummary?.extractedRooms?.length) {
    details.extractedRooms = data.derivedSummary.extractedRooms;
  }

  return details;
}

function toSnapshotRiskLevel(level: "green" | "yellow" | "red"): SnapshotRiskLevel {
  if (level === "red") return "high";
  if (level === "yellow") return "medium";
  return "low";
}

function getBudgetConfidence(data: WizardData): SnapshotBudgetConfidence {
  const min = data.budget?.intervalMin;
  const max = data.budget?.intervalMax;
  if (min == null || max == null) return "low";

  const spread = Math.abs(max - min);
  if (data.budget?.isHard) return "high";
  if (spread <= Math.max(100, max * 0.25)) return "high";
  if (spread <= Math.max(250, max * 0.45)) return "medium";
  return "low";
}

function toAudience(role: WizardData["userRole"]): SnapshotAudience {
  return role === "brf" ? "brf" : "privat";
}

function getOverviewTitle(data: WizardData): string {
  const candidate =
    data.derivedSummary?.goal ||
    data.freeTextDescription?.slice(0, 80) ||
    data.omfattning?.slice(0, 80);
  if (candidate && candidate.trim().length > 0) return clampTitle(candidate);
  if (data.projectType === "renovering") return "Renoveringsprojekt";
  if (data.projectType === "tillbyggnad") return "Tillbyggnadsprojekt";
  if (data.projectType === "nybyggnation") return "Nybyggnationsprojekt";
  if (data.projectType === "annat") return "Byggprojekt";
  return "Projektförfrågan";
}

function getOverviewDescription(data: WizardData): string {
  const parts = [
    data.freeTextDescription,
    data.derivedSummary?.scope,
    data.omfattning,
  ]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .map((part) => part.trim());

  if (parts.length > 0) return parts.join(" ");
  return "Beskrivning saknas ännu.";
}

function mapWizardFiles(files: WizardData["files"]): ProjectSnapshotFile[] {
  if (!files || files.length === 0) return [];
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    type: file.type || "okänd",
    size: file.size,
    tags: [...(file.tags ?? [])],
  }));
}

function toSekFromWizardBudget(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  // Wizard-budget anges i tkr, men snapshot ska representera SEK.
  return Math.round(value * 1000);
}

export function buildProjectSnapshotFromWizard(
  wizardData: WizardData,
  previousSnapshot?: Partial<ProjectSnapshot>
): ProjectSnapshot {
  const now = new Date().toISOString();
  const risk = computeRiskProfile(wizardData);

  return {
    id: previousSnapshot?.id ?? `snapshot-${Date.now()}`,
    createdAt: previousSnapshot?.createdAt ?? now,
    audience: previousSnapshot?.audience ?? toAudience(wizardData.userRole),
    overview: {
      projectType: normalizeProjectType(wizardData.projectType),
      title: getOverviewTitle(wizardData),
      description: getOverviewDescription(wizardData),
      location: previousSnapshot?.overview?.location,
    },
    scope: {
      selectedItems: getSelectedScopeItems(wizardData),
      freeDescription: wizardData.omfattning || wizardData.freeTextDescription,
      projectSpecific: getProjectSpecificScope(wizardData),
    },
    budget: {
      min: toSekFromWizardBudget(wizardData.budget?.intervalMin),
      max: toSekFromWizardBudget(wizardData.budget?.intervalMax),
      confidence: getBudgetConfidence(wizardData),
    },
    timeline: {
      desiredStartFrom: wizardData.tidplan?.startFrom,
      desiredStartTo: wizardData.tidplan?.startTo,
      flexibility:
        wizardData.tidplan?.startWindowFlexible || wizardData.tidplan?.executionPace === "kan_vanta"
          ? "flexible"
          : "fixed",
      blockedWeeks: wizardData.tidplan?.blockedWeeks,
    },
    riskProfile: {
      level: toSnapshotRiskLevel(risk.level),
      reasons: risk.reasons,
      recommendedNextSteps: risk.recommendedNextSteps,
    },
    files: mapWizardFiles(wizardData.files),
    completenessScore: calculateCompleteness(wizardData),
    lockedAt: previousSnapshot?.lockedAt,
  };
}

function deriveBrfRiskProfile(actions: BrfSnapshotSeedAction[]): ProjectSnapshotRiskProfile {
  const overdueCount = actions.filter((action) => action.status === "Eftersatt").length;
  const hasExecuted = actions.some((action) => action.status === "Genomförd");
  const hasLargeUnknownCosts = actions.some(
    (action) => (action.estimatedPriceSek ?? 0) <= 0
  );

  const reasons: string[] = [];
  const recommendedNextSteps: string[] = [];

  if (overdueCount > 0) {
    reasons.push(`${overdueCount} åtgärder är markerade som eftersatta.`);
    recommendedNextSteps.push("Prioritera kritiska eftersatta åtgärder i första utskicket.");
  }

  if (!hasExecuted) {
    reasons.push("Få genomförda referensåtgärder i underlaget.");
    recommendedNextSteps.push("Be om prisindikation per etapp för bättre jämförbarhet.");
  }

  if (hasLargeUnknownCosts) {
    reasons.push("Minst en åtgärd saknar tydlig kostnadsnivå.");
    recommendedNextSteps.push("Komplettera med uppskattad kostnad eller mängd innan avtal.");
  }

  if (reasons.length === 0) {
    reasons.push("Underlaget ser komplett ut för första offertdialog.");
    recommendedNextSteps.push("Skicka förfrågan till minst tre entreprenörer.");
    return {
      level: "low",
      reasons,
      recommendedNextSteps,
    };
  }

  return {
    level: overdueCount >= 3 ? "high" : "medium",
    reasons,
    recommendedNextSteps,
  };
}

function deriveBrfBudget(actions: BrfSnapshotSeedAction[]): ProjectSnapshotBudget {
  const sum = actions.reduce((total, action) => total + (action.estimatedPriceSek ?? 0), 0);
  if (sum <= 0) {
    return {
      confidence: "low",
    };
  }

  const min = Math.round(sum * 0.9);
  const max = Math.round(sum * 1.15);
  const confidence: SnapshotBudgetConfidence = actions.length >= 3 ? "medium" : "low";

  return { min, max, confidence };
}

function deriveBrfCompleteness(seed: BrfSnapshotSeed): number {
  const checks = [
    seed.title.trim().length > 0,
    seed.description ? seed.description.trim().length > 0 : false,
    seed.actions.length > 0,
    seed.files.length > 0,
    Boolean(seed.location),
    Boolean(seed.desiredStartFrom || seed.desiredStartTo),
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function buildProjectSnapshotFromBrfSeed(
  seed: BrfSnapshotSeed,
  previousSnapshot?: Partial<ProjectSnapshot>
): ProjectSnapshot {
  const now = new Date().toISOString();
  const riskProfile = deriveBrfRiskProfile(seed.actions);
  const years = Array.from(
    new Set(seed.actions.map((action) => action.plannedYear).filter((year): year is number => Boolean(year)))
  ).sort((a, b) => a - b);
  const categories = Array.from(
    new Set(seed.actions.map((action) => action.category).filter((value): value is string => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b, "sv"));

  return {
    id: previousSnapshot?.id ?? `snapshot-${Date.now()}`,
    createdAt: previousSnapshot?.createdAt ?? now,
    audience: "brf",
    overview: {
      projectType: "underhållsplan",
      title: seed.title.trim() || "BRF underhållsprojekt",
      description:
        seed.description?.trim() ||
        `${seed.actions.length} åtgärder valda för offertförfrågan.`,
      location: seed.location?.trim() || undefined,
    },
    scope: {
      selectedItems: seed.actions.map((action) => action.title).slice(0, 80),
      freeDescription: seed.description?.trim() || undefined,
      projectSpecific: {
        categories,
        plannedYears: years.map((year) => String(year)),
        selectedActions: seed.actions.length,
        ...(seed.projectSpecific ?? {}),
      },
    },
    budget: deriveBrfBudget(seed.actions),
    timeline: {
      desiredStartFrom: seed.desiredStartFrom,
      desiredStartTo: seed.desiredStartTo,
      flexibility: "flexible",
    },
    riskProfile,
    files: seed.files.slice(0, 120).map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      tags: file.tags ? [...file.tags] : [],
    })),
    completenessScore: deriveBrfCompleteness(seed),
    lockedAt: previousSnapshot?.lockedAt,
  };
}

export function formatSnapshotBudget(snapshot: ProjectSnapshot): string {
  const { min, max } = snapshot.budget;
  if (min == null && max == null) return "Budget ej angiven";
  const formatNumber = (value: number) => new Intl.NumberFormat("sv-SE").format(value);
  if (min != null && max != null) return `${formatNumber(min)} - ${formatNumber(max)} kr`;
  const known = min ?? max ?? 0;
  return `${formatNumber(known)} kr`;
}

export function formatSnapshotTimeline(snapshot: ProjectSnapshot): string {
  const from = snapshot.timeline.desiredStartFrom;
  const to = snapshot.timeline.desiredStartTo;
  if (!from && !to) return "Startfönster ej angivet";
  if (from && to) return `${from} till ${to}`;
  return from || to || "Startfönster ej angivet";
}

export function toSwedishRiskLabel(level: SnapshotRiskLevel): "Låg" | "Medel" | "Hög" {
  if (level === "high") return "Hög";
  if (level === "medium") return "Medel";
  return "Låg";
}

export function readProjectSnapshotFromStorage(): ProjectSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROJECT_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectSnapshot;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProjectSnapshotToStorage(snapshot: ProjectSnapshot) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECT_SNAPSHOT_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new Event(PROJECT_SNAPSHOT_UPDATED_EVENT));
}
