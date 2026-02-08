export interface BrfPropertyProfile {
  propertyName: string;
  associationName: string;
  addressLine: string;
  postalCode: string;
  city: string;
  buildingYear: string;
  apartmentsCount: string;
  buildingsCount: string;
  boaM2: string;
  loaM2: string;
  grossM2: string;
  floorsCount: string;
  elevatorsCount: string;
  heatingSystem: string;
  ventilationSystem: string;
  facadeType: string;
  roofType: string;
  accessibilityLogistics: string;
  authorityConstraints: string;
  procurementContact: string;
  procurementEmail: string;
  procurementPhone: string;
  notes: string;
}

export interface PrivateHomeProfile {
  projectName: string;
  homeType: string;
  addressLine: string;
  postalCode: string;
  city: string;
  buildYear: string;
  livingAreaM2: string;
  lotAreaM2: string;
  floorsCount: string;
  bathroomsCount: string;
  kitchenCount: string;
  residentsDuringWork: string;
  accessAndParking: string;
  permitStatus: string;
  budgetRange: string;
  desiredStart: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

export const BRF_PROPERTY_PROFILE_KEY = "byggplattformen-brf-property-profile";
export const BRF_PROPERTY_PROFILE_UPDATED_EVENT =
  "byggplattformen-brf-property-profile-updated";

export const PRIVATE_HOME_PROFILE_KEY = "byggplattformen-private-home-profile";
export const PRIVATE_HOME_PROFILE_UPDATED_EVENT =
  "byggplattformen-private-home-profile-updated";

export const DEFAULT_BRF_PROPERTY_PROFILE: BrfPropertyProfile = {
  propertyName: "Diamanten 5:2 (1021)",
  associationName: "BRF Diamanten",
  addressLine: "Kontrabasgatan 2",
  postalCode: "421 46",
  city: "Västra Frölunda",
  buildingYear: "1956",
  apartmentsCount: "128",
  buildingsCount: "3",
  boaM2: "8500",
  loaM2: "500",
  grossM2: "9300",
  floorsCount: "7",
  elevatorsCount: "3",
  heatingSystem: "Fjärrvärme",
  ventilationSystem: "FTX i gemensamma utrymmen, F-vent i lägenheter",
  facadeType: "Tegel med putsade detaljer",
  roofType: "Sadeltak, plåt och papp",
  accessibilityLogistics:
    "Innergård för etablering, begränsat utrymme mot gata, bullerkänsliga tider 07:30-17:00.",
  authorityConstraints:
    "Arbete nära skolområde, särskild hänsyn till framkomlighet och brandskydd under etappindelning.",
  procurementContact: "Styrelsen via projektgrupp",
  procurementEmail: "styrelsen@brf-diamanten.se",
  procurementPhone: "070-123 45 67",
  notes:
    "Föreningen vill prioritera åtgärder med låg störning för boende under Q2-Q3.",
};

export const DEFAULT_PRIVATE_HOME_PROFILE: PrivateHomeProfile = {
  projectName: "Renovering kök och entréplan",
  homeType: "Villa",
  addressLine: "Exempelvägen 10",
  postalCode: "123 45",
  city: "Stockholm",
  buildYear: "1986",
  livingAreaM2: "165",
  lotAreaM2: "620",
  floorsCount: "2",
  bathroomsCount: "2",
  kitchenCount: "1",
  residentsDuringWork: "Ja, delvis kvarboende under byggtid",
  accessAndParking: "Infart för lätt lastbil, fri parkering på uppfart.",
  permitStatus: "Bygglov bedöms ej krävas för nuvarande omfattning",
  budgetRange: "450 000 - 750 000 kr",
  desiredStart: "Q3 2026",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "Önskar tydlig etappplan med köksstopp max 2 veckor.",
};

export function toAddress(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(", ");
}

export function readStoredObject<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStoredObject<T>(key: string, eventName: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(eventName));
}

export function countFilledFields(
  values: Record<string, string>,
  requiredFields: string[]
): number {
  return requiredFields.reduce((count, field) => {
    const value = values[field];
    return value && value.trim().length > 0 ? count + 1 : count;
  }, 0);
}

export function completenessPercent(
  values: Record<string, string>,
  requiredFields: string[]
): number {
  if (requiredFields.length === 0) return 100;
  const filled = countFilledFields(values, requiredFields);
  return Math.round((filled / requiredFields.length) * 100);
}
