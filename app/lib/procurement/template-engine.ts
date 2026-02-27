import type { ProcurementAction } from "../requests-store";

export type ScopeStandardLevel = "Bas" | "Standard" | "Premium";

export interface ProcurementTemplateStep {
  id: string;
  title: string;
}

export interface ProcurementTemplateDefinition {
  id: string;
  versionId: string;
  title: string;
  categoryPatterns: RegExp[];
  processSteps: ProcurementTemplateStep[];
  subSteps: string[];
  standardAssumptions: string[];
  conditionBlocks: Array<"garanti" | "ata" | "betalning" | "ansvar">;
  referenceBudgetHint?: string;
  defaultUnit: "st" | "m2" | "lm" | "lopm";
}

export interface ProcurementAdjustedScopeItem {
  actionId: string;
  title: string;
  category: string;
  quantity: number | null;
  unit: ProcurementTemplateDefinition["defaultUnit"];
  standardLevel: ScopeStandardLevel;
  additionalRequirements: string;
  isOption: boolean;
  templateId: string;
  templateVersionId: string;
}

export interface ProcurementOriginalScopeItem {
  actionId: string;
  title: string;
  category: string;
  estimatedPriceSek: number;
  emissionsKgCo2e: number;
  plannedYear: number;
  status: ProcurementAction["status"];
}

const TEMPLATES: ProcurementTemplateDefinition[] = [
  {
    id: "lighting-modernization",
    versionId: "byggprocess-v1-lighting",
    title: "El & belysning – modernisering",
    categoryPatterns: [/el/i, /belys/i],
    processSteps: [
      { id: "forarbete", title: "Förarbete & kontroll" },
      { id: "material", title: "Material & montage" },
      { id: "provning", title: "Provning & dokumentation" },
    ],
    subSteps: [
      "Inventering av befintliga armaturer",
      "Demontering och återvinning",
      "Montering ny armatur/styrning",
      "Funktionsprov och injustering",
    ],
    standardAssumptions: [
      "Arbete på vardagar dagtid",
      "Normal åtkomst till trapphus/gemensamma ytor",
      "Befintlig elmatning återanvänds där möjligt",
    ],
    conditionBlocks: ["garanti", "ata", "betalning", "ansvar"],
    referenceBudgetHint: "Jämför mot Planima-rad + installationspåslag",
    defaultUnit: "st",
  },
  {
    id: "painting-interior",
    versionId: "byggprocess-v1-paint",
    title: "Invändigt – målning",
    categoryPatterns: [/invänd/i, /mål/i, /golv/i],
    processSteps: [
      { id: "skydd", title: "Skydd & etablering" },
      { id: "underarbete", title: "Underarbete" },
      { id: "ytbehandling", title: "Ytbehandling" },
    ],
    subSteps: [
      "Täckning och skydd av ytor",
      "Spackling/slipning vid behov",
      "Grundning och slutstrykning",
      "Städning och avetablering",
    ],
    standardAssumptions: [
      "Normal ytkvalitet utan omfattande skador",
      "Arbetsområde tillgängligt enligt plan",
      "Kulörval beslutas före produktionsstart",
    ],
    conditionBlocks: ["garanti", "ata", "betalning", "ansvar"],
    referenceBudgetHint: "Beräkna per m² eller per våningsplan",
    defaultUnit: "m2",
  },
  {
    id: "ventilation-hvac",
    versionId: "byggprocess-v1-vent",
    title: "Ventilation/VVS – systemåtgärd",
    categoryPatterns: [/vent/i, /vvs/i, /värme/i],
    processSteps: [
      { id: "projektering", title: "Teknisk genomgång" },
      { id: "installation", title: "Installation/byte" },
      { id: "injustering", title: "Injustering & överlämning" },
    ],
    subSteps: [
      "Systeminventering och måttagning",
      "Materialbeställning",
      "Installation/utbyte",
      "Provning, injustering och dokumentation",
    ],
    standardAssumptions: [
      "Tillträde till teknikrum enligt plan",
      "Avstängningar kan samordnas",
      "Egenkontroll och dokumentation ingår",
    ],
    conditionBlocks: ["garanti", "ata", "betalning", "ansvar"],
    referenceBudgetHint: "Validera med systemstorlek och leveranstid",
    defaultUnit: "st",
  },
  {
    id: "building-envelope",
    versionId: "byggprocess-v1-envelope",
    title: "Byggnadsskal – fasad/tak",
    categoryPatterns: [/fasad/i, /tak/i, /byggnadsskal/i],
    processSteps: [
      { id: "etablering", title: "Etablering" },
      { id: "utförande", title: "Utförande" },
      { id: "kontroll", title: "Kontroll & avetablering" },
    ],
    subSteps: [
      "Etablering/ställning/lift enligt behov",
      "Reparation/byte enligt omfattning",
      "Kvalitetskontroll och städning",
    ],
    standardAssumptions: [
      "Väderfönster enligt planerad säsong",
      "Tillträde runt fasad/tak säkerställs av beställare",
      "Myndighetskrav hanteras enligt överenskommen ansvarsfördelning",
    ],
    conditionBlocks: ["garanti", "ata", "betalning", "ansvar"],
    referenceBudgetHint: "Säsong, etablering och säkerhet påverkar pris kraftigt",
    defaultUnit: "m2",
  },
  {
    id: "general-maintenance",
    versionId: "byggprocess-v1-general",
    title: "Generell underhållsåtgärd",
    categoryPatterns: [/./],
    processSteps: [
      { id: "forarbete", title: "Förarbete" },
      { id: "utförande", title: "Utförande" },
      { id: "avslut", title: "Kontroll & avslut" },
    ],
    subSteps: [
      "Förberedelser och materialplanering",
      "Utförande enligt omfattning",
      "Kontroll, dokumentation och överlämning",
    ],
    standardAssumptions: [
      "Normal tillgänglighet och arbetstid",
      "Ingen dold skada utöver känt underlag",
      "ÄTA hanteras skriftligt före utförande",
    ],
    conditionBlocks: ["garanti", "ata", "betalning", "ansvar"],
    referenceBudgetHint: "Bekräfta mängd och nivå före utskick",
    defaultUnit: "st",
  },
];

function inferDefaultQuantity(action: ProcurementAction): number | null {
  const segments = [action.rawRow, action.details, ...(action.extraDetails ?? []).map((d) => `${d.label}: ${d.value}`)]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" · ");
  const match = segments.match(/(\d+(?:[.,]\d+)?)\s*(st|m2|m²|lm|lopm|lampor?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function normalizeUnit(unit: string | undefined, fallback: ProcurementTemplateDefinition["defaultUnit"]) {
  if (!unit) return fallback;
  const u = unit.toLowerCase();
  if (u === "m²" || u === "m2") return "m2";
  if (u === "lm") return "lm";
  if (u === "lopm") return "lopm";
  if (u === "st" || u.includes("lampa")) return "st";
  return fallback;
}

function inferDefaultUnit(action: ProcurementAction, template: ProcurementTemplateDefinition) {
  const text = [action.title, action.rawRow, action.details].filter(Boolean).join(" ").toLowerCase();
  if (/\bm²\b|\bm2\b|våningsplan|mål/.test(text)) return "m2" as const;
  if (/\blm\b|löpmeter/.test(text)) return "lm" as const;
  if (/lampa|armatur|st\b/.test(text)) return "st" as const;
  return template.defaultUnit;
}

export function resolveProcurementTemplate(action: ProcurementAction): ProcurementTemplateDefinition {
  return (
    TEMPLATES.find((template) =>
      template.categoryPatterns.some(
        (pattern) => pattern.test(action.category) || pattern.test(action.title)
      )
    ) ?? TEMPLATES[TEMPLATES.length - 1]
  );
}

export function buildOriginalScopeItem(action: ProcurementAction): ProcurementOriginalScopeItem {
  return {
    actionId: action.id,
    title: action.title,
    category: action.category,
    estimatedPriceSek: action.estimatedPriceSek,
    emissionsKgCo2e: action.emissionsKgCo2e,
    plannedYear: action.plannedYear,
    status: action.status,
  };
}

export function buildAdjustedScopeItem(action: ProcurementAction): ProcurementAdjustedScopeItem {
  const template = resolveProcurementTemplate(action);
  const inferredUnit = inferDefaultUnit(action, template);
  return {
    actionId: action.id,
    title: action.title,
    category: action.category,
    quantity: inferDefaultQuantity(action),
    unit: normalizeUnit(inferredUnit, template.defaultUnit),
    standardLevel: "Standard",
    additionalRequirements: "",
    isOption: false,
    templateId: template.id,
    templateVersionId: template.versionId,
  };
}

export function listProcurementTemplates(): ProcurementTemplateDefinition[] {
  return TEMPLATES;
}

