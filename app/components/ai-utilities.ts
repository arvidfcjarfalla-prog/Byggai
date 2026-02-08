/**
 * AI & Offertanalys Utilities
 * 
 * Mock implementations för nu - kan ersättas med verklig Claude API
 */

import type { FileDoc, WizardData, QuoteDraft } from "./wizard-context";

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
  
  if (data.freeTextDescription) {
    parts.push(`Beskrivning: ${data.freeTextDescription.slice(0, 200)}`);
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
  suggestedTags: FileDoc['tags'];
  suggestedRelatesTo?: FileDoc['relatesTo'];
  detectedContent: string[];
  confidence: number;
}> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const fileName = file.name.toLowerCase();
  const fileType = file.type;

  // Simple heuristics
  const suggestedTags: FileDoc['tags'][] = [];
  let suggestedRelatesTo: FileDoc['relatesTo'] | undefined;
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
