export type BrfFileType =
  | "Underhallsplan"
  | "Ritning"
  | "Detaljplan"
  | "Avtal"
  | "Offert"
  | "Myndighet"
  | "Kalkyl"
  | "Bild"
  | "Dokument"
  | "Annat";

export interface BrfFileRecord {
  id: string;
  name: string;
  fileType: BrfFileType;
  extension: string;
  sizeKb: number;
  uploadedAt: string;
  sourceLabel: string;
  linkedActionTitle?: string;
}

export const BRF_FILES_KEY = "byggplattformen-brf-files";
export const BRF_FILES_UPDATED_EVENT = "byggplattformen-brf-files-updated";
export const PRIVATE_FILES_KEY = "byggplattformen-private-files";
export const PRIVATE_FILES_UPDATED_EVENT = "byggplattformen-private-files-updated";

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function inferBrfFileType(fileName: string): BrfFileType {
  const lower = fileName.toLowerCase();
  const ext = getFileExtension(fileName);

  if (
    lower.includes("underhållsplan") ||
    lower.includes("underhallsplan") ||
    lower.includes("maintenance") ||
    ["xls", "xlsx", "xlsm"].includes(ext)
  ) {
    return "Underhallsplan";
  }

  if (
    lower.includes("ritning") ||
    lower.includes("dwg") ||
    lower.includes("ifc") ||
    ext === "dwg" ||
    ext === "ifc"
  ) {
    return "Ritning";
  }

  if (lower.includes("detaljplan") || lower.includes("planbeskrivning")) {
    return "Detaljplan";
  }

  if (
    lower.includes("avtal") ||
    lower.includes("kontrakt") ||
    lower.includes("upphandling")
  ) {
    return "Avtal";
  }

  if (lower.includes("offert") || lower.includes("anbud")) {
    return "Offert";
  }

  if (
    lower.includes("bygglov") ||
    lower.includes("tillstånd") ||
    lower.includes("myndighet")
  ) {
    return "Myndighet";
  }

  if (lower.includes("kalkyl") || lower.includes("budget")) {
    return "Kalkyl";
  }

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return "Bild";
  }

  if (["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)) {
    return "Dokument";
  }

  return "Annat";
}

export function getFileTypeLabel(fileType: BrfFileType): string {
  if (fileType === "Underhallsplan") return "Underhållsplan";
  if (fileType === "Ritning") return "Ritning";
  if (fileType === "Detaljplan") return "Detaljplan";
  if (fileType === "Avtal") return "Avtal";
  if (fileType === "Offert") return "Offert";
  if (fileType === "Myndighet") return "Myndighet";
  if (fileType === "Kalkyl") return "Kalkyl";
  if (fileType === "Bild") return "Bild";
  if (fileType === "Dokument") return "Dokument";
  return "Annat";
}
