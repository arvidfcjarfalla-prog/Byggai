/**
 * AI & Offertanalys Utilities
 *
 * Mock/heuristiska implementationer för nu - kan ersättas med verklig modell senare.
 */

import type { FileDoc, QuoteDraft, WizardData } from "../components/wizard-context";
import { analyzeOfferStructure } from "./offers/analysis";
import {
  calculateCategoryBreakdown,
  calculateTopDrivers,
  normalizeLineItem,
  recomputeOffer,
} from "./offers/calculations";
import type {
  Offer as StructuredOffer,
  OfferSimulationModification,
  OfferTotals,
} from "./offers/types";

// ============================================================================
// AI ANALYSIS
// ============================================================================

export interface OfferAnalysisResult {
  overallScore: number; // 0-100
  priceAssessment: {
    status: "competitive" | "high" | "low" | "unknown";
    marketComparison?: string;
    explanation: string;
  };
  scopeMatch: {
    coverage: number; // 0-100 % av underlag som täcks
    missingItems: string[];
    extraItems: string[];
  };
  risks: {
    level: "low" | "medium" | "high";
    flags: string[];
    recommendations: string[];
  };
  timeline: {
    realistic: boolean;
    concerns: string[];
  };
  recommendation: {
    action: "accept" | "negotiate" | "decline" | "request_clarification";
    reasoning: string;
    negotiationPoints?: string[];
  };
}

export interface StructuredOfferAiResult {
  explanation: string;
  risks: string[];
  suggestions: string[];
  simulatedTotals?: OfferTotals;
}

function cloneStructuredOffer(offer: StructuredOffer): StructuredOffer {
  return {
    ...offer,
    createdAt: new Date(offer.createdAt),
    lineItems: offer.lineItems.map((lineItem) => ({ ...lineItem })),
    assumptions: offer.assumptions ? [...offer.assumptions] : undefined,
    timeline: offer.timeline ? offer.timeline.map((entry) => ({ ...entry })) : undefined,
    totals: { ...offer.totals },
  };
}

function applyOfferSimulationModification(
  offer: StructuredOffer,
  modification: OfferSimulationModification
): StructuredOffer {
  const next = cloneStructuredOffer(offer);
  let lineItems = [...next.lineItems];

  if (modification.removeLineItemId) {
    lineItems = lineItems.filter((lineItem) => lineItem.id !== modification.removeLineItemId);
  }

  if (modification.replaceLineItem) {
    lineItems = lineItems.map((lineItem) => {
      if (lineItem.id !== modification.replaceLineItem?.id) return lineItem;
      return normalizeLineItem({
        ...lineItem,
        ...modification.replaceLineItem,
      });
    });
  }

  if (modification.updateQuantity) {
    lineItems = lineItems.map((lineItem) =>
      lineItem.id === modification.updateQuantity?.lineItemId
        ? normalizeLineItem({
            ...lineItem,
            quantity: modification.updateQuantity.quantity,
          })
        : lineItem
    );
  }

  if (modification.updateUnitPrice) {
    lineItems = lineItems.map((lineItem) =>
      lineItem.id === modification.updateUnitPrice?.lineItemId
        ? normalizeLineItem({
            ...lineItem,
            unitPrice: modification.updateUnitPrice.unitPrice,
          })
        : lineItem
    );
  }

  return recomputeOffer({
    ...next,
    lineItems,
  });
}

export async function analyzeOfferForCustomer(
  offer: StructuredOffer
): Promise<StructuredOfferAiResult> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const normalized = recomputeOffer(offer);
  const topDrivers = calculateTopDrivers(normalized.lineItems, normalized.totals.exVat, 3);
  const categoryBreakdown = calculateCategoryBreakdown(normalized.lineItems, normalized.totals.exVat);
  const risks: string[] = [];
  const suggestions: string[] = [];

  if (!normalized.assumptions || normalized.assumptions.length === 0) {
    risks.push("Offerten saknar dokumenterade antaganden/reservationer.");
  } else if (normalized.assumptions.some((entry) => entry.trim().length < 12)) {
    risks.push("Vissa antaganden är kortfattade och kan behöva förtydligas.");
  }

  if (topDrivers[0] && topDrivers[0].share >= 40) {
    risks.push(`En enskild post (${topDrivers[0].title}) står för ${topDrivers[0].share.toFixed(1)}% av priset.`);
  }

  if (normalized.lineItems.some((lineItem) => lineItem.quantity <= 0 || lineItem.unitPrice <= 0)) {
    risks.push("Minst en rad har 0-värde i mängd eller á-pris.");
  }

  if (topDrivers[0]) {
    suggestions.push(`Begär förtydligande/spec av posten "${topDrivers[0].title}" som största kostnadsdrivare.`);
  }
  if (categoryBreakdown[0]) {
    suggestions.push(`Granska kategorin "${categoryBreakdown[0].category}" där största kostnadsandel finns.`);
  }
  if (topDrivers.length > 1) {
    suggestions.push("Be entreprenören visa alternativt material/utförande för de 2-3 dyraste posterna.");
  }

  const explanation =
    normalized.lineItems.length === 0
      ? "Offerten innehåller inga kostnadsrader ännu."
      : `Priset drivs främst av ${topDrivers
          .slice(0, 2)
          .map((driver) => driver.title)
          .join(" och ")}. AI-analysen har endast granskat lineItems och ändrar inte offerten.`;

  return {
    explanation,
    risks,
    suggestions,
  };
}

export async function analyzeOfferForContractor(
  offer: StructuredOffer
): Promise<StructuredOfferAiResult> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const normalized = recomputeOffer(offer);
  const summary = analyzeOfferStructure(normalized);

  const risks = summary.riskFlags.map((flag) => flag.message);
  const suggestions: string[] = [];

  if (summary.riskFlags.some((flag) => flag.kind === "unclear_title")) {
    suggestions.push("Byt generiska radnamn mot tydliga arbetsmoment/materialbeskrivningar.");
  }
  if (summary.riskFlags.some((flag) => flag.kind === "missing_quantity")) {
    suggestions.push("Komplettera saknade mängder innan skick för att minska tvistrisk.");
  }
  if (summary.riskFlags.some((flag) => flag.kind === "extreme_unit_price")) {
    suggestions.push("Verifiera avvikande á-priser och dokumentera skäl i antaganden.");
  }
  if ((normalized.assumptions?.length ?? 0) === 0) {
    suggestions.push("Lägg till tydliga antaganden/reservationer för omfattning, åtkomst och avvikelser.");
  }
  suggestions.push("Säkerställ att lineItems är grupperade i konsekventa kategorier före export/utskick.");

  return {
    explanation:
      "Intern AI-granskning kontrollerar struktur, lineItems och typiska riskmönster. Ingen automatisk ändring har gjorts.",
    risks,
    suggestions,
  };
}

export async function simulateOfferScenario(
  offer: StructuredOffer,
  modification: OfferSimulationModification
): Promise<StructuredOfferAiResult> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const simulated = applyOfferSimulationModification(offer, modification);
  const original = recomputeOffer(offer);
  const delta = simulated.totals.exVat - original.totals.exVat;
  const sign = delta === 0 ? "oförändrad" : delta < 0 ? "minskar" : "ökar";

  return {
    explanation: `Simulering genomförd. Totalen ${sign} med ${Math.abs(Math.round(delta))} kr ex moms. Originalofferten är oförändrad.`,
    risks: simulated.lineItems.length === 0 ? ["Simuleringen ger en tom offert utan lineItems."] : [],
    suggestions: [
      "Granska påverkan på omfattning och ansvar innan du accepterar ändringen.",
      "Bekräfta att antaganden/reservationer fortfarande gäller efter simuleringen.",
    ],
    simulatedTotals: simulated.totals,
  };
}

/**
 * Analysera en offert mot projektunderlag
 * Mock implementation - ersätt med Claude API
 */
export async function analyzeOffer(
  offerData: {
    pdfText?: string;
    totalCost?: number;
    timeline?: string;
    scope?: string;
  },
  projectData: WizardData
): Promise<OfferAnalysisResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock analysis based on simple heuristics
  const budgetMin = projectData.budget?.intervalMin || 0;
  const budgetMax = projectData.budget?.intervalMax || 0;
  const offerCost = offerData.totalCost || 0;

  const priceStatus: "competitive" | "high" | "low" | "unknown" = 
    offerCost === 0 ? "unknown" :
    offerCost < budgetMin * 1000 ? "low" :
    offerCost > budgetMax * 1000 * 1.2 ? "high" : "competitive";

  const overallScore = 
    priceStatus === "competitive" ? 85 :
    priceStatus === "high" ? 60 :
    priceStatus === "low" ? 70 : 50;

  return {
    overallScore,
    priceAssessment: {
      status: priceStatus,
      marketComparison: offerCost > 0 ? `Din budget: ${budgetMin}-${budgetMax} tkr. Offert: ${Math.round(offerCost / 1000)} tkr.` : undefined,
      explanation: 
        priceStatus === "competitive" ? "Priset ligger inom marknadsspann och din budget." :
        priceStatus === "high" ? "Priset ligger över din budget. Överväg förhandling eller alternativa lösningar." :
        priceStatus === "low" ? "Priset är lågt - dubbelkolla omfattning och kvalitet." :
        "Kunde inte bedöma pris mot marknad.",
    },
    scopeMatch: {
      coverage: 85,
      missingItems: ["Specifikation av el-arbete", "Fuktsäkring badrum"],
      extraItems: ["Städning efter projekt"],
    },
    risks: {
      level: priceStatus === "low" ? "medium" : "low",
      flags: priceStatus === "low" ? ["Lågt pris kan indikera begränsad omfattning"] : [],
      recommendations: [
        "Be om detaljerad specifikation av material",
        "Kontrollera att ROT-avdrag är inkluderat",
      ],
    },
    timeline: {
      realistic: true,
      concerns: [],
    },
    recommendation: {
      action: 
        priceStatus === "competitive" ? "accept" :
        priceStatus === "high" ? "negotiate" :
        priceStatus === "low" ? "request_clarification" : "request_clarification",
      reasoning: 
        priceStatus === "competitive" ? "Offerten verkar solid och ligger i linje med din budget och projektomfattning." :
        priceStatus === "high" ? "Priset är högre än budget. Förhandla eller be om alternativa lösningar." :
        priceStatus === "low" ? "Priset är lågt - verifiera att all omfattning är inkluderad." :
        "Mer information behövs för att bedöma offerten.",
      negotiationPoints: priceStatus === "high" ? [
        "Fasindelning för att sprida kostnad",
        "Alternativa material",
        "Reducerad omfattning",
      ] : undefined,
    },
  };
}

/**
 * Generera AI-sammanfattning av projekt för entreprenörer
 * Mock - ersätt med Claude API
 */
export async function generateProjectSummary(data: WizardData): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const parts: string[] = [];
  
  if (data.projectType) {
    parts.push(`Projekttyp: ${data.projectType}`);
  }
  
  if (data.currentPhase) {
    parts.push(`Nuläge: ${data.currentPhase}`);
  }
  
  const desc = data.freeTextDescription;
  if (desc) {
    parts.push(`Beskrivning: ${desc.slice(0, 200)}`);
  }
  
  if (data.budget) {
    parts.push(`Budget: ${data.budget.intervalMin}-${data.budget.intervalMax} tkr`);
  }
  
  if (data.tidplan?.startFrom) {
    parts.push(`Start: ${data.tidplan.startFrom}`);
  }

  return parts.join(". ") + ".";
}

/**
 * Analysera uppladdade filer med AI
 * Mock - ersätt med Claude API för bildanalys
 */
export async function analyzeFile(file: File): Promise<{
  suggestedTags: FileDoc["tags"];
  suggestedRelatesTo?: FileDoc["relatesTo"];
  detectedContent: string[];
  confidence: number;
}> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const fileName = file.name.toLowerCase();
  const fileType = file.type;

  // Simple heuristics
  const suggestedTags: FileDoc["tags"] = [];
  let suggestedRelatesTo: FileDoc["relatesTo"] | undefined;
  const detectedContent: string[] = [];

  if (fileName.includes('ritning') || fileName.includes('plan')) {
    suggestedTags.push('ritning');
    detectedContent.push('Ritning/planritning');
  }
  
  if (fileName.includes('foto') || fileType.startsWith('image/')) {
    suggestedTags.push('foto');
    detectedContent.push('Bild');
  }
  
  if (fileName.includes('inspiration')) {
    suggestedTags.push('inspiration');
    detectedContent.push('Inspirationsbild');
  }

  if (fileName.includes('kök') || fileName.includes('kok')) {
    suggestedRelatesTo = 'kök';
    detectedContent.push('Relaterad till kök');
  }
  
  if (fileName.includes('badrum') || fileName.includes('bad')) {
    suggestedRelatesTo = 'badrum';
    detectedContent.push('Relaterad till badrum');
  }

  if (suggestedTags.length === 0) {
    suggestedTags.push('ovrigt');
  }

  return {
    suggestedTags,
    suggestedRelatesTo,
    detectedContent: detectedContent.length > 0 ? detectedContent : ['Fil uppladdad'],
    confidence: 0.7,
  };
}

// ============================================================================
// PROJECT ANALYSIS
// ============================================================================

/**
 * Beräkna projektets fullständighet
 */
export function calculateCompleteness(data: WizardData): number {
  const checks = [
    !!data.projectType,
    !!data.currentPhase,
    !!(data.renovering || data.tillbyggnad || data.nybyggnation || data.projectType === "annat"),
    !!data.freeTextDescription,
    !!(data.files && data.files.length > 0),
    !!data.omfattning,
    !!data.budget?.intervalMin,
    !!data.tidplan?.startFrom,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

/**
 * Generera matchningspoäng för entreprenörer (framtida feature)
 */
export function calculateMatchScore(
  projectData: WizardData,
  entreprenorProfile: {
    specialties: string[];
    region: string;
    capacity: number;
  }
): number {
  // Simple mock
  let score = 50;

  if (projectData.projectType && entreprenorProfile.specialties.includes(projectData.projectType)) {
    score += 30;
  }

  if (projectData.files && projectData.files.length > 3) {
    score += 10; // Bra underlag
  }

  if (projectData.budget?.intervalMin && projectData.budget.intervalMin > 100) {
    score += 10; // Större projekt
  }

  return Math.min(100, score);
}

// ============================================================================
// QUOTE DRAFT HELPERS
// ============================================================================

/**
 * Konvertera WizardData till sharable format för entreprenörer
 */
export function createShareableSnapshot(data: WizardData): QuoteDraft['projectSnapshot'] {
  return {
    projectType: data.projectType,
    currentPhase: data.currentPhase,
    freeTextDescription: data.freeTextDescription,
    omfattning: data.omfattning,
    budget: data.budget,
    tidplan: data.tidplan,
    files: data.files?.map(f => ({
      ...f,
      // Exkludera känslig data om nödvändigt
    })),
    riskProfile: data.riskProfile,
  };
}

/**
 * Estimera projektvärde baserat på data
 */
export function estimateProjectValue(data: WizardData): {
  low: number;
  high: number;
  confidence: 'low' | 'medium' | 'high';
} {
  if (data.budget?.intervalMin && data.budget?.intervalMax) {
    return {
      low: data.budget.intervalMin * 1000,
      high: data.budget.intervalMax * 1000,
      confidence: 'high',
    };
  }

  // Fallback estimering baserat på projekttyp
  const baseEstimate = {
    renovering: { low: 100000, high: 500000 },
    tillbyggnad: { low: 300000, high: 1000000 },
    nybyggnation: { low: 2000000, high: 5000000 },
    annat: { low: 50000, high: 500000 },
  };

  const estimate = data.projectType ? baseEstimate[data.projectType] : baseEstimate.annat;

  return {
    ...estimate,
    confidence: 'low',
  };
}

// ============================================================================
// SYSTEM MESSAGES (för wizard microtext)
// ============================================================================

export const SYSTEM_MESSAGES = {
  analyzing: [
    "systemet analyserar...",
    "bearbetar information...",
    "strukturerar data...",
  ],
  thinking: [
    "tänker...",
    "beräknar nästa steg...",
    "optimerar flöde...",
  ],
  saving: [
    "sparar...",
    "uppdaterar...",
    "synkroniserar...",
  ],
  complete: [
    "klart!",
    "genomfört",
    "sparat",
  ],
} as const;

/**
 * Hämta random systemmeddelande
 */
export function getSystemMessage(type: keyof typeof SYSTEM_MESSAGES): string {
  const messages = SYSTEM_MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)];
}
